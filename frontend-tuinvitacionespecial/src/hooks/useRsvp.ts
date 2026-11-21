import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  DEFAULT_MENU_OPTIONS,
  DEFAULT_MENU_VALUE,
  RSVP_DEADLINE_EXPIRED_MESSAGE,
  demoRsvpAdapter,
} from '../data/rsvpDefaults';
import type {
  InvitationGuestData,
  MenuOption,
  RsvpAdapter,
  RsvpEventConfig,
  RsvpFeatureFlags,
  RsvpSubmissionPayload,
  TipoMenu,
} from '../types/rsvp';
import {
  buildGoogleCalendarUrl,
  downloadIcsFile,
} from '../utils/calendarUtils';
import { formatRsvpDeadlineLabels } from '../utils/dateUtils';
import { buildRsvpSalutation } from '../utils/greetingUtils';
import {
  buildRsvpStepNumbers,
  isRsvpDeadlinePassed,
  resolveRsvpFeatures,
} from '../utils/rsvpUtils';
import { buildRsvpWhatsAppUrl } from '../utils/whatsappUtils';
import { useInvitationParams } from './useInvitationParams';
import { useRsvpForm } from './useRsvpForm';

export interface UseRsvpOptions {
  eventConfig: RsvpEventConfig;
  menuOptions?: MenuOption[];
  defaultMenu?: TipoMenu;
  features?: Partial<RsvpFeatureFlags>;
  adapter?: RsvpAdapter;
  defaultGuestName?: string;
  defaultMaxPasses?: number;
  maxDemoPasses?: number;
}

/**
 * Fachada global ligera para cualquier plantilla de invitación.
 * Compone `useInvitationParams`, `useRsvpForm`, calendario, WhatsApp, `BR-03`
 * (SSR-safe + verificación en vivo al enviar) y carga inicial vía `RsvpAdapter`.
 */
export function useRsvp({
  eventConfig,
  menuOptions = DEFAULT_MENU_OPTIONS,
  defaultMenu = DEFAULT_MENU_VALUE,
  features,
  adapter = demoRsvpAdapter,
  defaultGuestName = 'Familia García',
  defaultMaxPasses = 2,
  maxDemoPasses = 50,
}: UseRsvpOptions) {
  const urlGuest = useInvitationParams({
    defaultGuestName,
    defaultMaxPasses,
    maxDemoPasses,
  });

  const [serverGuest, setServerGuest] =
    useState<Partial<InvitationGuestData> | null>(null);
  const [serverDeadlineIso, setServerDeadlineIso] = useState<
    string | undefined
  >(undefined);
  const [serverDeadlinePassed, setServerDeadlinePassed] = useState<
    boolean | undefined
  >(undefined);
  const [clientDeadlinePassed, setClientDeadlinePassed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Estabilizar callbacks del adaptador para evitar bucles si se pasa un objeto inline
  const loadInvitationRef = useRef(adapter.loadInvitation);
  loadInvitationRef.current = adapter.loadInvitation;
  const submitRsvpRef = useRef(adapter.submitRsvp);
  submitRsvpRef.current = adapter.submitRsvp;
  const hasLoadInvitation = Boolean(adapter.loadInvitation);

  const resolvedFeatures = useMemo(
    () => resolveRsvpFeatures(features),
    [
      features?.showPassCount,
      features?.showMenu,
      features?.showAllergies,
      features?.showSong,
      features?.showDedication,
      features?.showCalendar,
      features?.showWhatsApp,
    ]
  );

  const stepNumbers = useMemo(
    () => buildRsvpStepNumbers(resolvedFeatures),
    [resolvedFeatures]
  );

  const guest: InvitationGuestData = useMemo(
    () => ({
      ...urlGuest,
      ...serverGuest,
      maxPasses: Math.max(1, serverGuest?.maxPasses ?? urlGuest.maxPasses),
    }),
    [urlGuest, serverGuest]
  );

  const effectiveDeadlineIso = serverDeadlineIso ?? eventConfig.rsvpDeadlineIso;

  const effectiveEventConfig: RsvpEventConfig = useMemo(() => {
    if (!serverDeadlineIso) return eventConfig;
    const labels = formatRsvpDeadlineLabels(serverDeadlineIso);
    if (!labels) {
      return { ...eventConfig, rsvpDeadlineIso: serverDeadlineIso };
    }
    return {
      ...eventConfig,
      rsvpDeadlineIso: serverDeadlineIso,
      rsvpDeadlineDisplay: labels.display,
      rsvpDeadlineShort: labels.short,
    };
  }, [eventConfig, serverDeadlineIso]);

  // Evaluar BR-03 en cliente tras montar (SSR-safe en Astro SSG)
  useEffect(() => {
    setClientDeadlinePassed(isRsvpDeadlinePassed(effectiveDeadlineIso));
  }, [effectiveDeadlineIso]);

  const isDeadlinePassed = serverDeadlinePassed ?? clientDeadlinePassed;

  // Re-evaluación en vivo al intentar enviar o modificar si la pestaña quedó abierta
  const checkDeadlinePassed = useCallback(() => {
    if (serverDeadlinePassed !== undefined) {
      return serverDeadlinePassed;
    }
    const passedNow = isRsvpDeadlinePassed(effectiveDeadlineIso);
    if (passedNow) {
      setClientDeadlinePassed(true);
    }
    return passedNow;
  }, [serverDeadlinePassed, effectiveDeadlineIso]);

  const stableSubmitRsvp = useCallback((payload: RsvpSubmissionPayload) => {
    return submitRsvpRef.current(payload);
  }, []);

  const form = useRsvpForm({
    maxPasses: guest.maxPasses,
    token: guest.token,
    defaultMenu,
    features: resolvedFeatures,
    isDeadlinePassed,
    checkDeadlinePassed,
    onSubmit: stableSubmitRsvp,
  });

  const hydrateResponseRef = useRef(form.hydrateResponse);
  hydrateResponseRef.current = form.hydrateResponse;

  // Cargar datos reales de invitación y respuesta previa cuando hay token opaco y adaptador con lectura
  useEffect(() => {
    const loader = loadInvitationRef.current;
    if (urlGuest.source !== 'token' || !urlGuest.token || !loader) {
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);

    loader(urlGuest.token)
      .then((initial) => {
        if (cancelled) return;
        if (initial.guest) {
          setServerGuest(initial.guest);
        }
        if (initial.rsvpDeadlineIso !== undefined) {
          setServerDeadlineIso(initial.rsvpDeadlineIso);
        }
        if (initial.isDeadlinePassed !== undefined) {
          setServerDeadlinePassed(initial.isDeadlinePassed);
        }
        if (initial.existingResponse) {
          hydrateResponseRef.current(
            initial.existingResponse,
            true,
            initial.guest?.maxPasses
          );
        }
      })
      .catch((err) => {
        if (cancelled) return;
        const message =
          err instanceof Error && err.message.trim()
            ? err.message
            : 'No pudimos cargar los datos de tu invitación. Verifica el enlace o intenta más tarde.';
        setLoadError(message);
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [urlGuest.source, urlGuest.token, hasLoadInvitation]);

  const salutationText = useMemo(() => {
    if (guest.customMessage && guest.customMessage.trim()) {
      return guest.customMessage.trim();
    }
    return buildRsvpSalutation(guest.guestName, guest.maxPasses);
  }, [guest.customMessage, guest.guestName, guest.maxPasses]);

  const googleCalendarUrl = useMemo(
    () => buildGoogleCalendarUrl(effectiveEventConfig),
    [effectiveEventConfig]
  );

  const whatsAppUrl = useMemo(
    () =>
      buildRsvpWhatsAppUrl({
        guestName: guest.guestName,
        maxPasses: guest.maxPasses,
        formValues: form.formValues,
        config: effectiveEventConfig,
        features: resolvedFeatures,
      }),
    [
      guest.guestName,
      guest.maxPasses,
      form.formValues,
      effectiveEventConfig,
      resolvedFeatures,
    ]
  );

  const handleDownloadIcs = useCallback(() => {
    downloadIcsFile(effectiveEventConfig);
  }, [effectiveEventConfig]);

  return {
    guest,
    eventConfig: effectiveEventConfig,
    menuOptions,
    features: resolvedFeatures,
    stepNumbers,
    salutationText,
    googleCalendarUrl,
    whatsAppUrl,
    handleDownloadIcs,
    isLoading,
    loadError,
    isDeadlinePassed,
    deadlineExpiredMessage: RSVP_DEADLINE_EXPIRED_MESSAGE,
    isDemoMode: adapter.mode === 'demo',
    ...form,
  };
}

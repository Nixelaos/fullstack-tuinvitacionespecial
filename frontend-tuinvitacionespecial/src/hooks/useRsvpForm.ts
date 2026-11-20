import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  DEFAULT_MENU_VALUE,
  RSVP_DEADLINE_EXPIRED_MESSAGE,
  demoRsvpAdapter,
} from '../data/rsvpDefaults';
import type {
  AttendanceStatus,
  RsvpFeatureFlags,
  RsvpFormValues,
  RsvpSubmissionPayload,
  TipoMenu,
} from '../types/rsvp';
import {
  buildRsvpSubmissionPayload,
  canIncrementMenu,
  countMenusByType,
  createInitialMenus,
  decrementMenuSelection,
  incrementMenuSelection,
  isMenuSelectionValid,
  resizeSelectedMenus,
  resolveRsvpFeatures,
  selectSingleMenu,
} from '../utils/rsvpUtils';

export interface UseRsvpFormOptions {
  maxPasses: number;
  token?: string | null;
  defaultMenu?: TipoMenu;
  features?: Partial<RsvpFeatureFlags>;
  isDeadlinePassed?: boolean;
  /** Verificación en tiempo real de BR-03 al momento de enviar o editar */
  checkDeadlinePassed?: () => boolean;
  onSubmit?: (payload: RsvpSubmissionPayload) => Promise<void>;
}

/**
 * Gestiona el estado, reglas de negocio (BR-01 y BR-03), normalización y envío del RSVP.
 * Agnóstico al diseño visual para ser reutilizado en cualquier plantilla de invitación.
 */
export const useRsvpForm = ({
  maxPasses,
  token = null,
  defaultMenu = DEFAULT_MENU_VALUE,
  features,
  isDeadlinePassed = false,
  checkDeadlinePassed,
  onSubmit,
}: UseRsvpFormOptions) => {
  const safeMaxPasses = Math.max(1, Math.floor(maxPasses));
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

  const [formValues, setFormValues] = useState<RsvpFormValues>(() => ({
    attendance: 'yes',
    attendeesCount: safeMaxPasses,
    selectedMenus: createInitialMenus(safeMaxPasses, defaultMenu),
    allergies: '',
    song: '',
    dedication: '',
  }));

  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const hasUserEditedAttendeesRef = useRef(false);

  // Sincronizar cupos y menús cuando cambian los pases asignados (URL o backend)
  useEffect(() => {
    setFormValues((prev) => {
      const nextCount = hasUserEditedAttendeesRef.current
        ? Math.min(prev.attendeesCount, safeMaxPasses)
        : safeMaxPasses;

      if (
        nextCount === prev.attendeesCount &&
        prev.selectedMenus.length <= nextCount
      ) {
        return prev;
      }

      return {
        ...prev,
        attendeesCount: nextCount,
        selectedMenus: resizeSelectedMenus(
          prev.selectedMenus,
          nextCount,
          defaultMenu
        ),
      };
    });
  }, [safeMaxPasses, defaultMenu]);

  const setAttendance = useCallback(
    (attendance: AttendanceStatus) => {
      if (isDeadlinePassed) return;
      setValidationError(null);
      setSubmitError(null);
      setFormValues((prev) => ({ ...prev, attendance }));
    },
    [isDeadlinePassed]
  );

  const decrementAttendees = useCallback(() => {
    if (isDeadlinePassed) return;
    hasUserEditedAttendeesRef.current = true;
    setValidationError(null);
    setSubmitError(null);
    setFormValues((prev) => {
      const nextCount = Math.max(1, prev.attendeesCount - 1);
      return {
        ...prev,
        attendeesCount: nextCount,
        selectedMenus: resizeSelectedMenus(
          prev.selectedMenus,
          nextCount,
          defaultMenu
        ),
      };
    });
  }, [isDeadlinePassed, defaultMenu]);

  const incrementAttendees = useCallback(() => {
    if (isDeadlinePassed) return;
    hasUserEditedAttendeesRef.current = true;
    setValidationError(null);
    setSubmitError(null);
    setFormValues((prev) => {
      const nextCount = Math.min(safeMaxPasses, prev.attendeesCount + 1);
      return {
        ...prev,
        attendeesCount: nextCount,
        selectedMenus: resizeSelectedMenus(
          prev.selectedMenus,
          nextCount,
          defaultMenu
        ),
      };
    });
  }, [isDeadlinePassed, safeMaxPasses, defaultMenu]);

  const selectMenuForSingleAttendee = useCallback(
    (menu: TipoMenu) => {
      if (isDeadlinePassed) return;
      setValidationError(null);
      setSubmitError(null);
      setFormValues((prev) => ({
        ...prev,
        selectedMenus: selectSingleMenu(menu),
      }));
    },
    [isDeadlinePassed]
  );

  const incrementMenu = useCallback(
    (menu: TipoMenu) => {
      if (isDeadlinePassed) return;
      setValidationError(null);
      setSubmitError(null);
      setFormValues((prev) => ({
        ...prev,
        selectedMenus: incrementMenuSelection(
          prev.selectedMenus,
          menu,
          prev.attendeesCount,
          defaultMenu
        ),
      }));
    },
    [isDeadlinePassed, defaultMenu]
  );

  const decrementMenu = useCallback(
    (menu: TipoMenu) => {
      if (isDeadlinePassed) return;
      setValidationError(null);
      setSubmitError(null);
      setFormValues((prev) => ({
        ...prev,
        selectedMenus: decrementMenuSelection(prev.selectedMenus, menu),
      }));
    },
    [isDeadlinePassed]
  );

  const updateTextField = useCallback(
    (field: 'allergies' | 'song' | 'dedication', value: string) => {
      if (isDeadlinePassed) return;
      setSubmitError(null);
      setFormValues((prev) => ({ ...prev, [field]: value }));
    },
    [isDeadlinePassed]
  );

  const hydrateResponse = useCallback(
    (
      existing: Partial<RsvpFormValues>,
      markSubmitted = true,
      maxPassesOverride?: number
    ) => {
      const effectiveMaxPasses = Math.max(
        1,
        Math.floor(maxPassesOverride ?? safeMaxPasses)
      );
      hasUserEditedAttendeesRef.current = true;
      setValidationError(null);
      setSubmitError(null);
      setFormValues((prev) => {
        const attendance = existing.attendance ?? prev.attendance;
        const rawCount = existing.attendeesCount ?? prev.attendeesCount;
        const clampedCount = Math.max(
          1,
          Math.min(
            effectiveMaxPasses,
            rawCount > 0 ? rawCount : effectiveMaxPasses
          )
        );
        const menus = existing.selectedMenus
          ? resizeSelectedMenus(existing.selectedMenus, clampedCount, defaultMenu)
          : createInitialMenus(clampedCount, defaultMenu);

        return {
          attendance,
          attendeesCount: clampedCount,
          selectedMenus: menus,
          allergies: existing.allergies ?? '',
          song: existing.song ?? '',
          dedication: existing.dedication ?? '',
        };
      });
      setIsSubmitted(markSubmitted);
    },
    [safeMaxPasses, defaultMenu]
  );

  const menuCounts = useMemo(
    () => countMenusByType(formValues.selectedMenus),
    [formValues.selectedMenus]
  );

  const assignedMenusCount = formValues.selectedMenus.length;
  const remainingMenusCount = Math.max(
    0,
    formValues.attendeesCount - assignedMenusCount
  );

  const isMenuValid = useMemo(
    () =>
      isMenuSelectionValid(
        formValues.attendance,
        formValues.attendeesCount,
        formValues.selectedMenus,
        resolvedFeatures.showMenu
      ),
    [
      formValues.attendance,
      formValues.attendeesCount,
      formValues.selectedMenus,
      resolvedFeatures.showMenu,
    ]
  );

  const canIncrementMenuOption = useCallback(
    (menu: TipoMenu) =>
      !isDeadlinePassed &&
      canIncrementMenu(
        formValues.selectedMenus,
        menu,
        formValues.attendeesCount,
        defaultMenu
      ),
    [
      isDeadlinePassed,
      formValues.selectedMenus,
      formValues.attendeesCount,
      defaultMenu,
    ]
  );

  const normalizedPayload = useMemo(
    () =>
      buildRsvpSubmissionPayload({
        token,
        formValues,
        features: resolvedFeatures,
        defaultMenu,
      }),
    [token, formValues, resolvedFeatures, defaultMenu]
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (isSubmitting) return;

      const expiredNow = isDeadlinePassed || (checkDeadlinePassed?.() ?? false);
      if (expiredNow) {
        setSubmitError(RSVP_DEADLINE_EXPIRED_MESSAGE);
        return;
      }

      if (!isMenuValid) {
        setValidationError(
          `Debes asignar exactamente ${formValues.attendeesCount} ${
            formValues.attendeesCount === 1 ? 'plato' : 'platos'
          } (${assignedMenusCount} de ${formValues.attendeesCount} seleccionados).`
        );
        return;
      }

      setValidationError(null);
      setSubmitError(null);
      setIsSubmitting(true);

      try {
        const submitHandler = onSubmit ?? demoRsvpAdapter.submitRsvp;
        await submitHandler(normalizedPayload);
        setIsSubmitted(true);
      } catch (err) {
        const message =
          err instanceof Error && err.message.trim()
            ? err.message
            : 'No pudimos registrar tu respuesta. Por favor, intenta nuevamente.';
        setSubmitError(message);
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      isSubmitting,
      isDeadlinePassed,
      checkDeadlinePassed,
      isMenuValid,
      formValues.attendeesCount,
      assignedMenusCount,
      onSubmit,
      normalizedPayload,
    ]
  );

  const resetSubmission = useCallback(() => {
    if (isDeadlinePassed || (checkDeadlinePassed?.() ?? false)) return;
    setValidationError(null);
    setSubmitError(null);
    setIsSubmitted(false);
  }, [isDeadlinePassed, checkDeadlinePassed]);

  return {
    formValues,
    normalizedPayload,
    menuCounts,
    assignedMenusCount,
    remainingMenusCount,
    isMenuValid,
    isSubmitted,
    isSubmitting,
    validationError,
    submitError,
    canIncrementMenuOption,
    setAttendance,
    decrementAttendees,
    incrementAttendees,
    selectMenuForSingleAttendee,
    incrementMenu,
    decrementMenu,
    updateTextField,
    handleSubmit,
    resetSubmission,
    hydrateResponse,
  };
};

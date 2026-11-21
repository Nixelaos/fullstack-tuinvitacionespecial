import { useState, useEffect } from 'react';
import type { InvitationGuestData } from '../types/rsvp';
import {
  parseInvitationSearchParams,
  type ParseInvitationParamsOptions,
} from '../utils/rsvpUtils';

export type UseInvitationParamsOptions = ParseInvitationParamsOptions;

/**
 * Extrae y resuelve los datos del invitado desde la URL (query params o token).
 * Separa modo demo (`?n=`, `?pases=`, Base64 JSON) de tokens opacos del backend
 * (`?t=familia-perez-...`) sin sobrescribir el nombre con el token crudo.
 */
export function useInvitationParams(
  options: UseInvitationParamsOptions = {}
): InvitationGuestData {
  const {
    defaultGuestName = 'Familia García',
    defaultMaxPasses = 2,
    maxDemoPasses = 50,
  } = options;

  const [guestData, setGuestData] = useState<InvitationGuestData>({
    guestName: defaultGuestName,
    maxPasses: defaultMaxPasses,
    customMessage: null,
    token: null,
    source: 'default',
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    setGuestData(
      parseInvitationSearchParams(window.location.search, {
        defaultGuestName,
        defaultMaxPasses,
        maxDemoPasses,
      })
    );
  }, [defaultGuestName, defaultMaxPasses, maxDemoPasses]);

  return guestData;
}

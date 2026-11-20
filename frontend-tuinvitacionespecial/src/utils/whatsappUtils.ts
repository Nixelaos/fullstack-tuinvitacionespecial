import type {
  RsvpEventConfig,
  RsvpFeatureFlags,
  RsvpFormValues,
} from '../types/rsvp';
import { formatMenuSummary, resolveRsvpFeatures } from './rsvpUtils.ts';

interface BuildWhatsAppUrlParams {
  guestName: string;
  maxPasses: number;
  formValues: RsvpFormValues;
  config: RsvpEventConfig;
  features?: Partial<RsvpFeatureFlags>;
}

/**
 * Construye el enlace de WhatsApp con el resumen formateado de la respuesta RSVP,
 * respetando los módulos activos (`features`) y omitiendo pases/menú si no asiste.
 */
export const buildRsvpWhatsAppUrl = ({
  guestName,
  maxPasses,
  formValues,
  config,
  features,
}: BuildWhatsAppUrlParams): string => {
  const { attendance, attendeesCount, selectedMenus, allergies, song, dedication } =
    formValues;
  const resolvedFeatures = resolveRsvpFeatures(features);

  const statusText =
    attendance === 'yes' ? '✨ ¡Sí, ahí estaré!' : '💌 No podré asistir';

  let text = `*Confirmación de Asistencia — ${config.eventTitle}*\n\n`;
  text += `👤 *Invitado:* ${guestName}\n`;
  text += `💌 *Respuesta:* ${statusText}\n`;

  if (attendance === 'yes') {
    if (resolvedFeatures.showPassCount) {
      text += `👥 *Asistentes:* ${attendeesCount} de ${maxPasses} pases reservados\n`;
    }
    if (resolvedFeatures.showMenu && selectedMenus.length > 0) {
      text += `🍽️ *Preferencia de Menú:* ${formatMenuSummary(selectedMenus)}\n`;
    }
    if (resolvedFeatures.showAllergies && allergies.trim()) {
      text += `⚠️ *Alergias / Restricciones:* ${allergies.trim()}\n`;
    }
    if (resolvedFeatures.showSong && song.trim()) {
      text += `🎵 *Canción para la fiesta:* ${song.trim()}\n`;
    }
  }

  if (resolvedFeatures.showDedication && dedication.trim()) {
    text += `✍️ *Dedicatoria:* «${dedication.trim()}»\n`;
  }

  return `https://wa.me/${config.whatsappNumber}?text=${encodeURIComponent(text)}`;
};

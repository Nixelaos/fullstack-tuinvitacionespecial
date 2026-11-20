import type { RsvpEventConfig } from '../../types/rsvp';
import { WHATSAPP_NUMBER } from '../siteConfig';
import { generateEventDateFormats } from '../../utils/dateUtils';
import { DEFAULT_MENU_OPTIONS } from '../rsvpDefaults';

export { DEFAULT_MENU_OPTIONS };

/**
 * ============================================================================
 * FECHA BASE DEL EVENTO (Fuente Única de Verdad)
 * Modifica solo este valor y todos los formatos, contadores, calendarios,
 * sellos y textos de la invitación se actualizarán automáticamente.
 * ============================================================================
 */
export const PAPEL_RASGADO_EVENT_DATE = '2027-11-27T17:00:00';

/**
 * Formatos de fecha autocalculados (ICS, display español, sellos, deadlines)
 */
export const PAPEL_RASGADO_DATE_FORMATS = generateEventDateFormats(
  PAPEL_RASGADO_EVENT_DATE,
  6,  // 6 horas de duración para el evento en Google Calendar
  21  // 21 días de anticipación para la fecha límite de RSVP
);

/**
 * Configuración del álbum compartido de recuerdos
 */
export const PAPEL_RASGADO_ALBUM_CONFIG = {
  title: 'Álbum de Fotos',
  badge: 'Comparte tus Recuerdos',
  subtitle: '¡Queremos ver la boda a través de tus ojos!',
  description:
    'Los momentos más especiales se viven desde muchos ángulos. Ayúdanos a capturar cada instante compartiendo las fotos y videos que tomes durante nuestro gran día.',
  albumUrl: `https://photos.app.goo.gl/valentina-y-sebastian-${PAPEL_RASGADO_DATE_FORMATS.stampYear}`,
  imageSrc: '/images/album.png',
  imageAlt: 'Álbum de fotos del matrimonio Valentina & Sebastián',
};

/**
 * Configuración de RSVP y generación de eventos en calendarios
 */
export const PAPEL_RASGADO_RSVP_CONFIG: RsvpEventConfig = {
  eventTitle: 'Boda Valentina & Sebastián',
  coupleNames: 'Valentina & Sebastián',
  uid: `boda-valentina-sebastian-${PAPEL_RASGADO_DATE_FORMATS.startDateIcs.slice(0, 8)}@tuinvitacionespecial.cl`,
  icsFileName: 'Boda-Valentina-y-Sebastian.ics',
  startDateIcs: PAPEL_RASGADO_DATE_FORMATS.startDateIcs,
  endDateIcs: PAPEL_RASGADO_DATE_FORMATS.endDateIcs,
  calendarDescription:
    'Celebración de Boda de Valentina & Sebastián en Casona Las Majadas de Pirque, Chile.',
  location: 'Casona Las Majadas de Pirque, Pirque, Región Metropolitana',
  rsvpDeadlineDisplay: PAPEL_RASGADO_DATE_FORMATS.rsvpDeadlineDisplay,
  rsvpDeadlineShort: PAPEL_RASGADO_DATE_FORMATS.rsvpDeadlineShort,
  rsvpDeadlineIso: PAPEL_RASGADO_DATE_FORMATS.rsvpDeadlineIso,
  eventDateShort: PAPEL_RASGADO_DATE_FORMATS.displayDateShort,
  whatsappNumber: WHATSAPP_NUMBER,
};

// Aliases para compatibilidad con nombres previos
export const BEACH_WEDDING_RSVP_CONFIG = PAPEL_RASGADO_RSVP_CONFIG;
export const BEACH_WEDDING_ALBUM_CONFIG = PAPEL_RASGADO_ALBUM_CONFIG;

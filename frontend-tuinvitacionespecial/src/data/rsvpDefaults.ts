import type {
  MenuOption,
  RsvpAdapter,
  RsvpFeatureFlags,
  TipoMenu,
} from '../types/rsvp';

export const DEFAULT_MENU_VALUE: TipoMenu = 'Estándar';

/**
 * Límites de longitud y cupos alineados con la base de datos (schema.ts).
 */
export const RSVP_FIELD_LIMITS = {
  maxPassesPerFamily: 30,
  allergiesMaxLength: 300,
  songMaxLength: 120,
  dedicationMaxLength: 500,
} as const;

/**
 * Opciones de menú globales alineadas con `tipo_menu_enum` del backend.
 */
export const DEFAULT_MENU_OPTIONS: MenuOption[] = [
  { id: 'standard', value: 'Estándar', label: 'Estándar' },
  { id: 'vegetarian', value: 'Vegetariano', label: 'Vegetariano' },
  { id: 'vegan', value: 'Vegano', label: 'Vegano' },
  { id: 'celiac', value: 'Celíaco', label: 'Celíaco' },
  { id: 'kids', value: 'Menú Infantil', label: 'Menú Infantil' },
];

export const DEFAULT_RSVP_FEATURES: RsvpFeatureFlags = {
  showPassCount: true,
  showMenu: true,
  showAllergies: true,
  showSong: true,
  showDedication: true,
  showCalendar: true,
  showWhatsApp: true,
};

export const RSVP_DEADLINE_EXPIRED_MESSAGE =
  'El plazo para confirmar o modificar tu asistencia ha finalizado';

/**
 * Adaptador local en Modo Demo (sin llamadas de red).
 * Se reemplaza inyectando un adaptador HTTP cuando se conecte la API pública de RSVP.
 */
export const demoRsvpAdapter: RsvpAdapter = {
  mode: 'demo',
  submitRsvp: async () => {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 450);
    });
  },
};

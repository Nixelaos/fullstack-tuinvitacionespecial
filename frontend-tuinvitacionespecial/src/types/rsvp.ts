export type AttendanceStatus = 'yes' | 'no';

/**
 * Valores canónicos alineados 1:1 con `tipo_menu_enum` en PostgreSQL y `tipoMenuSchema` en Zod.
 */
export type TipoMenu =
  | 'Estándar'
  | 'Vegetariano'
  | 'Vegano'
  | 'Celíaco'
  | 'Menú Infantil';

export interface MenuOption {
  id: string;
  value: TipoMenu;
  label: string;
}

export type MenuSelectionCounts = Record<TipoMenu, number>;

export type InvitationParamSource = 'default' | 'demo' | 'token';

export interface InvitationGuestData {
  guestName: string;
  maxPasses: number;
  adultsCount?: number;
  childrenCount?: number;
  customMessage?: string | null;
  token: string | null;
  source: InvitationParamSource;
}

export interface RsvpFormValues {
  attendance: AttendanceStatus;
  attendeesCount: number;
  /** Lista plana de platos elegidos; cuando asiste, su longitud coincide con `attendeesCount` (BR-01). */
  selectedMenus: TipoMenu[];
  allergies: string;
  song: string;
  dedication: string;
}

/**
 * Payload normalizado listo para persistir en el backend o adaptador.
 * Cuando `asistenciaConfirmada` es `false`, `cantAsistentes` se normaliza a `0`
 * y `menusSeleccionados` a `[]`.
 */
export interface RsvpSubmissionPayload {
  token: string | null;
  asistenciaConfirmada: boolean;
  cantAsistentes: number;
  menusSeleccionados: TipoMenu[];
  alergias: string;
  cancionFavorita: string;
  mensajeNovios: string;
}

export interface RsvpFeatureFlags {
  showPassCount: boolean;
  showMenu: boolean;
  showAllergies: boolean;
  showSong: boolean;
  showDedication: boolean;
  showCalendar: boolean;
  showWhatsApp: boolean;
}

export interface RsvpStepNumbers {
  attendance: number;
  passCount: number | null;
  menuSection: number | null;
  song: number | null;
  dedication: number | null;
}

export interface RsvpEventConfig {
  eventTitle: string;
  coupleNames: string;
  uid: string;
  icsFileName: string;
  startDateIcs: string;
  endDateIcs: string;
  calendarDescription: string;
  location: string;
  rsvpDeadlineDisplay: string;
  rsvpDeadlineShort: string;
  /** Fecha límite ISO (ej. '2027-11-06T23:59:59') para evaluación de vigencia BR-03 */
  rsvpDeadlineIso?: string;
  eventDateShort: string;
  whatsappNumber: string;
}

export interface RsvpInitialState {
  guest?: Partial<InvitationGuestData>;
  existingResponse?: Partial<RsvpFormValues> | null;
  isDeadlinePassed?: boolean;
  rsvpDeadlineIso?: string;
}

export interface RsvpAdapter {
  mode: 'demo' | 'api';
  loadInvitation?: (token: string) => Promise<RsvpInitialState>;
  submitRsvp: (payload: RsvpSubmissionPayload) => Promise<void>;
}

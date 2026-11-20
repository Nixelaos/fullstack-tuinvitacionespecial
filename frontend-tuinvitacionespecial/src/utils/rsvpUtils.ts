import {
  DEFAULT_MENU_OPTIONS,
  DEFAULT_MENU_VALUE,
  DEFAULT_RSVP_FEATURES,
  RSVP_FIELD_LIMITS,
} from '../data/rsvpDefaults.ts';
import type {
  AttendanceStatus,
  InvitationGuestData,
  InvitationParamSource,
  MenuSelectionCounts,
  RsvpFeatureFlags,
  RsvpFormValues,
  RsvpStepNumbers,
  RsvpSubmissionPayload,
  TipoMenu,
} from '../types/rsvp';

interface DecodedDemoTokenPayload {
  n?: string;
  nombre?: string;
  name?: string;
  p?: number | string;
  pases?: number | string;
  passes?: number | string;
}

export interface ParseInvitationParamsOptions {
  defaultGuestName?: string;
  defaultMaxPasses?: number;
  maxDemoPasses?: number;
}

export interface BuildSubmissionPayloadParams {
  token: string | null;
  formValues: RsvpFormValues;
  features?: Partial<RsvpFeatureFlags>;
  defaultMenu?: TipoMenu;
}

const CANONICAL_MENUS: TipoMenu[] = DEFAULT_MENU_OPTIONS.map((opt) => opt.value);

export const resolveRsvpFeatures = (
  overrides?: Partial<RsvpFeatureFlags>
): RsvpFeatureFlags => ({
  ...DEFAULT_RSVP_FEATURES,
  ...overrides,
});

/**
 * Calcula la numeración correlativa de pasos visibles según los bloques habilitados.
 */
export const buildRsvpStepNumbers = (
  features: RsvpFeatureFlags
): RsvpStepNumbers => {
  let step = 1;
  const attendance = step;

  const passCount = features.showPassCount ? ++step : null;
  const menuSection =
    features.showMenu || features.showAllergies ? ++step : null;
  const song = features.showSong ? ++step : null;
  const dedication = features.showDedication ? ++step : null;

  return {
    attendance,
    passCount,
    menuSection,
    song,
    dedication,
  };
};

export const createInitialMenus = (
  count: number,
  defaultMenu: TipoMenu = DEFAULT_MENU_VALUE
): TipoMenu[] => {
  const safeCount = Math.max(0, Math.floor(count));
  return Array.from({ length: safeCount }, () => defaultMenu);
};

/**
 * Ajusta el arreglo de menús al total de asistentes confirmados (BR-01).
 * Al reducir cupos, descarta primero platos por defecto para preservar
 * restricciones alimentarias explícitas (ej. Celíaco, Vegano).
 */
export const resizeSelectedMenus = (
  currentMenus: TipoMenu[],
  targetCount: number,
  defaultMenu: TipoMenu = DEFAULT_MENU_VALUE
): TipoMenu[] => {
  const safeTarget = Math.max(0, Math.floor(targetCount));
  if (safeTarget === 0) return [];

  if (currentMenus.length === safeTarget) {
    return [...currentMenus];
  }

  if (currentMenus.length < safeTarget) {
    const missing = safeTarget - currentMenus.length;
    return [...currentMenus, ...createInitialMenus(missing, defaultMenu)];
  }

  const next = [...currentMenus];
  while (next.length > safeTarget) {
    const defaultIndex = next.lastIndexOf(defaultMenu);
    if (defaultIndex !== -1) {
      next.splice(defaultIndex, 1);
    } else {
      next.pop();
    }
  }
  return next;
};

export const countMenusByType = (
  selectedMenus: TipoMenu[]
): MenuSelectionCounts => {
  const counts: MenuSelectionCounts = {
    Estándar: 0,
    Vegetariano: 0,
    Vegano: 0,
    Celíaco: 0,
    'Menú Infantil': 0,
  };

  for (const menu of selectedMenus) {
    if (menu in counts) {
      counts[menu] += 1;
    }
  }

  return counts;
};

export const canIncrementMenu = (
  selectedMenus: TipoMenu[],
  menu: TipoMenu,
  targetCount: number,
  defaultMenu: TipoMenu = DEFAULT_MENU_VALUE
): boolean => {
  if (targetCount <= 0) return false;
  if (selectedMenus.length < targetCount) return true;
  if (
    selectedMenus.length === targetCount &&
    menu !== defaultMenu &&
    selectedMenus.includes(defaultMenu)
  ) {
    return true;
  }
  return false;
};

/**
 * Agrega un plato respetando BR-01.
 * Si el cupo ya está completo con platos por defecto (`Estándar`),
 * reemplaza uno automáticamente para evitar fricción en móvil.
 */
export const incrementMenuSelection = (
  selectedMenus: TipoMenu[],
  menu: TipoMenu,
  targetCount: number,
  defaultMenu: TipoMenu = DEFAULT_MENU_VALUE
): TipoMenu[] => {
  if (targetCount <= 0) return [];

  if (selectedMenus.length < targetCount) {
    return [...selectedMenus, menu];
  }

  if (selectedMenus.length === targetCount && menu !== defaultMenu) {
    const defaultIndex = selectedMenus.lastIndexOf(defaultMenu);
    if (defaultIndex !== -1) {
      const next = [...selectedMenus];
      next[defaultIndex] = menu;
      return next;
    }
  }

  return selectedMenus;
};

export const decrementMenuSelection = (
  selectedMenus: TipoMenu[],
  menu: TipoMenu
): TipoMenu[] => {
  const idx = selectedMenus.lastIndexOf(menu);
  if (idx === -1) return selectedMenus;

  const next = [...selectedMenus];
  next.splice(idx, 1);
  return next;
};

export const selectSingleMenu = (menu: TipoMenu): TipoMenu[] => [menu];

export const isMenuSelectionValid = (
  attendance: AttendanceStatus,
  attendeesCount: number,
  selectedMenus: TipoMenu[],
  showMenu: boolean
): boolean => {
  if (attendance === 'no') return true;
  if (attendeesCount < 1) return false;
  if (!showMenu) return true;
  return selectedMenus.length === attendeesCount;
};

/**
 * Formatea los menús elegidos en un resumen legible (ej. "2× Estándar, 1× Celíaco").
 */
export const formatMenuSummary = (selectedMenus: TipoMenu[]): string => {
  if (selectedMenus.length === 0) return '';
  if (selectedMenus.length === 1) return selectedMenus[0];

  const counts = countMenusByType(selectedMenus);
  return CANONICAL_MENUS.filter((menu) => counts[menu] > 0)
    .map((menu) => `${counts[menu]}× ${menu}`)
    .join(', ');
};

/**
 * Normaliza el estado del formulario al contrato esperado por el backend:
 * - Si no asiste: `cantAsistentes = 0`, `menusSeleccionados = []`, alergias y canción vacías.
 * - Si asiste con `showMenu = false`: rellena con `defaultMenu` para cumplir BR-01.
 */
export const buildRsvpSubmissionPayload = ({
  token,
  formValues,
  features,
  defaultMenu = DEFAULT_MENU_VALUE,
}: BuildSubmissionPayloadParams): RsvpSubmissionPayload => {
  const resolvedFeatures = resolveRsvpFeatures(features);
  const dedication = resolvedFeatures.showDedication
    ? formValues.dedication.trim()
    : '';

  if (formValues.attendance === 'no') {
    return {
      token,
      asistenciaConfirmada: false,
      cantAsistentes: 0,
      menusSeleccionados: [],
      alergias: '',
      cancionFavorita: '',
      mensajeNovios: dedication,
    };
  }

  const cantAsistentes = Math.max(1, Math.floor(formValues.attendeesCount));
  const menusSeleccionados = resolvedFeatures.showMenu
    ? [...formValues.selectedMenus]
    : createInitialMenus(cantAsistentes, defaultMenu);

  return {
    token,
    asistenciaConfirmada: true,
    cantAsistentes,
    menusSeleccionados,
    alergias: resolvedFeatures.showAllergies ? formValues.allergies.trim() : '',
    cancionFavorita: resolvedFeatures.showSong ? formValues.song.trim() : '',
    mensajeNovios: dedication,
  };
};

/**
 * Evalúa BR-03: determina si ya venció la fecha límite de confirmación.
 * Soporta ISO local (`YYYY-MM-DDTHH:mm:ss`) e ISO con zona horaria (`Z` / `±HH:MM`).
 */
export const isRsvpDeadlinePassed = (
  deadlineIso?: string,
  now: Date = new Date()
): boolean => {
  if (!deadlineIso) return false;

  const trimmed = deadlineIso.trim();
  if (!trimmed) return false;

  const hasExplicitTimezone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(trimmed);
  let deadlineDate: Date;

  if (hasExplicitTimezone) {
    deadlineDate = new Date(trimmed);
  } else {
    const [datePart, timePart = '23:59:59'] = trimmed.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hours = 23, minutes = 59, seconds = 59] = timePart
      .split(':')
      .map(Number);

    if (
      [year, month, day, hours, minutes, seconds].some((n) => Number.isNaN(n))
    ) {
      return false;
    }

    deadlineDate = new Date(year, month - 1, day, hours, minutes, seconds);
  }

  if (Number.isNaN(deadlineDate.getTime())) return false;
  return now.getTime() > deadlineDate.getTime();
};

const decodeBase64DemoToken = (
  tokenParam: string
): DecodedDemoTokenPayload | null => {
  try {
    if (typeof atob !== 'function') return null;
    const binary = atob(tokenParam);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const decoded = new TextDecoder().decode(bytes);
    const parsed: unknown = JSON.parse(decoded);

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }

    const record = parsed as DecodedDemoTokenPayload;
    const hasExpectedKey =
      'n' in record ||
      'nombre' in record ||
      'name' in record ||
      'p' in record ||
      'pases' in record ||
      'passes' in record;

    return hasExpectedKey ? record : null;
  } catch {
    return null;
  }
};

/**
 * Parsea parámetros de invitación de la URL separando claramente:
 * - Modo demo (`?n=`, `?pases=`, o token Base64 JSON válido).
 * - Token opaco de producción (`?t=familia-perez-8x9k2m7p4q1z`), sin corromper `guestName`.
 */
export const parseInvitationSearchParams = (
  search: string,
  options: ParseInvitationParamsOptions = {}
): InvitationGuestData => {
  const {
    defaultGuestName = 'Familia García',
    defaultMaxPasses = 2,
    maxDemoPasses = RSVP_FIELD_LIMITS.maxPassesPerFamily,
  } = options;

  const params = new URLSearchParams(search);
  let resolvedName = defaultGuestName;
  let resolvedPasses = defaultMaxPasses;
  let source: InvitationParamSource = 'default';

  const nameParam =
    params.get('n') ||
    params.get('nombre') ||
    params.get('invitado') ||
    params.get('guest');

  if (nameParam && nameParam.trim()) {
    resolvedName = nameParam.trim();
    source = 'demo';
  }

  const passesParam =
    params.get('pases') || params.get('passes') || params.get('cupos');

  if (passesParam) {
    const parsed = parseInt(passesParam, 10);
    if (!Number.isNaN(parsed) && parsed > 0 && parsed <= maxDemoPasses) {
      resolvedPasses = parsed;
      source = 'demo';
    }
  }

  const rawTokenParam = params.get('token') || params.get('t');
  const tokenParam = rawTokenParam?.trim() || null;

  if (tokenParam) {
    const demoPayload = decodeBase64DemoToken(tokenParam);
    if (demoPayload) {
      const tokenName =
        demoPayload.n || demoPayload.nombre || demoPayload.name;
      if (tokenName && typeof tokenName === 'string' && tokenName.trim()) {
        resolvedName = tokenName.trim();
      }

      const rawPasses =
        demoPayload.p ?? demoPayload.pases ?? demoPayload.passes;
      if (rawPasses !== undefined) {
        const parsed = parseInt(String(rawPasses), 10);
        if (!Number.isNaN(parsed) && parsed > 0 && parsed <= maxDemoPasses) {
          resolvedPasses = parsed;
        }
      }
      source = 'demo';
    } else {
      // Token opaco del backend: preservar intacto sin convertirlo en nombre
      source = 'token';
    }
  }

  return {
    guestName: resolvedName,
    maxPasses: resolvedPasses,
    customMessage: null,
    token: tokenParam,
    source,
  };
};

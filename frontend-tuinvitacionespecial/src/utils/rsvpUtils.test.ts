import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_MENU_OPTIONS } from '../data/rsvpDefaults.ts';
import {
  formatRsvpDeadlineLabels,
  generateEventDateFormats,
} from './dateUtils.ts';
import {
  buildRsvpStepNumbers,
  buildRsvpSubmissionPayload,
  canIncrementMenu,
  countMenusByType,
  createInitialMenus,
  decrementMenuSelection,
  formatMenuSummary,
  incrementMenuSelection,
  isMenuSelectionValid,
  isRsvpDeadlinePassed,
  parseInvitationSearchParams,
  resizeSelectedMenus,
  resolveRsvpFeatures,
  selectSingleMenu,
} from './rsvpUtils.ts';
import { buildRsvpWhatsAppUrl } from './whatsappUtils.ts';
import type { RsvpEventConfig, RsvpFormValues } from '../types/rsvp';

describe('DEFAULT_MENU_OPTIONS — alineación con tipo_menu_enum', () => {
  it('expone exactamente los 5 valores canónicos incluyendo Celíaco', () => {
    const values = DEFAULT_MENU_OPTIONS.map((o) => o.value);
    assert.deepEqual(values, [
      'Estándar',
      'Vegetariano',
      'Vegano',
      'Celíaco',
      'Menú Infantil',
    ]);
    const celiac = DEFAULT_MENU_OPTIONS.find((o) => o.id === 'celiac');
    assert.equal(celiac?.label, 'Celíaco');
  });
});

describe('BR-01 — 1 plato por asistente confirmado', () => {
  it('inicializa con tantos platos Estándar como asistentes', () => {
    assert.deepEqual(createInitialMenus(3), [
      'Estándar',
      'Estándar',
      'Estándar',
    ]);
    assert.deepEqual(createInitialMenus(0), []);
  });

  it('al reducir asistentes descarta Estándar antes que restricciones explícitas', () => {
    const resized = resizeSelectedMenus(
      ['Estándar', 'Estándar', 'Celíaco'],
      2
    );
    assert.deepEqual(resized, ['Estándar', 'Celíaco']);
  });

  it('al subir asistentes agrega Estándar hasta igualar el total', () => {
    const resized = resizeSelectedMenus(['Vegetariano'], 3);
    assert.deepEqual(resized, ['Vegetariano', 'Estándar', 'Estándar']);
  });

  it('reemplaza automáticamente un Estándar al aumentar otro plato con cupo lleno', () => {
    const initial = createInitialMenus(2);
    assert.equal(canIncrementMenu(initial, 'Celíaco', 2), true);
    assert.equal(canIncrementMenu(initial, 'Estándar', 2), false);

    const next = incrementMenuSelection(initial, 'Celíaco', 2);
    assert.deepEqual(next, ['Estándar', 'Celíaco']);

    const fullExplicit = incrementMenuSelection(next, 'Vegano', 2);
    assert.deepEqual(fullExplicit, ['Vegano', 'Celíaco']);
    // Ya no quedan platos Estándar ni cupos libres
    assert.equal(canIncrementMenu(fullExplicit, 'Vegetariano', 2), false);
    assert.deepEqual(
      incrementMenuSelection(fullExplicit, 'Vegetariano', 2),
      ['Vegano', 'Celíaco']
    );
  });

  it('permite decrementar un plato y valida estrictamente que suma == asistentes', () => {
    const afterDec = decrementMenuSelection(['Vegano', 'Celíaco'], 'Vegano');
    assert.deepEqual(afterDec, ['Celíaco']);
    assert.equal(isMenuSelectionValid('yes', 2, afterDec, true), false);

    const completed = incrementMenuSelection(afterDec, 'Vegetariano', 2);
    assert.deepEqual(completed, ['Celíaco', 'Vegetariano']);
    assert.equal(isMenuSelectionValid('yes', 2, completed, true), true);
  });

  it('permite selección directa para 1 asistente y formatea resumen legible', () => {
    const single = selectSingleMenu('Celíaco');
    assert.deepEqual(single, ['Celíaco']);
    assert.equal(formatMenuSummary(single), 'Celíaco');

    const multi = formatMenuSummary(['Estándar', 'Estándar', 'Celíaco']);
    assert.equal(multi, '2× Estándar, 1× Celíaco');

    const counts = countMenusByType(['Estándar', 'Estándar', 'Celíaco']);
    assert.equal(counts['Estándar'], 2);
    assert.equal(counts['Celíaco'], 1);
    assert.equal(counts['Vegano'], 0);
  });
});

describe('Normalización de payload (asistencia no / showMenu false)', () => {
  const baseValues: RsvpFormValues = {
    attendance: 'no',
    attendeesCount: 3,
    selectedMenus: ['Estándar', 'Estándar', 'Celíaco'],
    allergies: 'Maní',
    song: 'Danza Kuduro',
    dedication: '  Muchos éxitos  ',
  };

  it('normaliza a 0 asistentes y [] menús cuando attendance es no', () => {
    const payload = buildRsvpSubmissionPayload({
      token: 'familia-perez-8x9k2m7p4q1z',
      formValues: baseValues,
    });

    assert.deepEqual(payload, {
      token: 'familia-perez-8x9k2m7p4q1z',
      asistenciaConfirmada: false,
      cantAsistentes: 0,
      menusSeleccionados: [],
      alergias: '',
      cancionFavorita: '',
      mensajeNovios: 'Muchos éxitos',
    });
  });

  it('rellena con Estándar por asistente si showMenu es false para respetar BR-01', () => {
    const payload = buildRsvpSubmissionPayload({
      token: null,
      formValues: {
        ...baseValues,
        attendance: 'yes',
        attendeesCount: 2,
        selectedMenus: [],
      },
      features: { showMenu: false, showSong: false },
    });

    assert.equal(payload.asistenciaConfirmada, true);
    assert.equal(payload.cantAsistentes, 2);
    assert.deepEqual(payload.menusSeleccionados, ['Estándar', 'Estándar']);
    assert.equal(payload.cancionFavorita, '');
  });
});

describe('BR-03 — Vigencia de fecha límite', () => {
  it('genera rsvpDeadlineIso y bloquea a partir del día siguiente al plazo', () => {
    const formats = generateEventDateFormats('2026-11-15T17:00:00', 6, 21);
    assert.equal(formats.rsvpDeadlineIso, '2026-10-25T23:59:59');

    const beforeDeadline = new Date(2026, 9, 25, 22, 0, 0);
    const afterDeadline = new Date(2026, 9, 26, 0, 0, 1);

    assert.equal(isRsvpDeadlinePassed(formats.rsvpDeadlineIso, beforeDeadline), false);
    assert.equal(isRsvpDeadlinePassed(formats.rsvpDeadlineIso, afterDeadline), true);
  });

  it('soporta timestamps ISO con zona horaria provenientes del backend', () => {
    const now = new Date('2026-10-26T12:00:00Z');
    assert.equal(isRsvpDeadlinePassed('2026-10-25T23:59:59Z', now), true);
    assert.equal(isRsvpDeadlinePassed('2026-10-27T23:59:59Z', now), false);
  });

  it('formatea etiquetas de fecha límite a partir de un ISO del servidor', () => {
    assert.deepEqual(formatRsvpDeadlineLabels('2026-10-25T23:59:59'), {
      display: '25 de Octubre de 2026',
      short: '25 de Octubre',
    });
    assert.equal(formatRsvpDeadlineLabels('invalido'), null);
  });
});

describe('parseInvitationSearchParams — separación demo vs token opaco', () => {
  it('no corrompe guestName cuando llega un token opaco de producción', () => {
    const parsed = parseInvitationSearchParams(
      '?t=familia-perez-8x9k2m7p4q1z'
    );
    assert.equal(parsed.source, 'token');
    assert.equal(parsed.token, 'familia-perez-8x9k2m7p4q1z');
    assert.equal(parsed.guestName, 'Familia García');
  });

  it('acepta pases mayores a 10 en modo demo', () => {
    const parsed = parseInvitationSearchParams('?n=Familia+Soto&pases=14');
    assert.equal(parsed.source, 'demo');
    assert.equal(parsed.guestName, 'Familia Soto');
    assert.equal(parsed.maxPasses, 14);
  });

  it('decodifica tokens Base64 JSON válidos en modo demo', () => {
    const encoded = Buffer.from(
      JSON.stringify({ n: 'Camila', p: 3 }),
      'utf8'
    ).toString('base64');
    const parsed = parseInvitationSearchParams(`?t=${encodeURIComponent(encoded)}`);
    assert.equal(parsed.source, 'demo');
    assert.equal(parsed.guestName, 'Camila');
    assert.equal(parsed.maxPasses, 3);
  });
});

describe('features — numeración correlativa y WhatsApp condicional', () => {
  it('renumera correlativamente al ocultar bloques opcionales', () => {
    const steps = buildRsvpStepNumbers(
      resolveRsvpFeatures({
        showPassCount: true,
        showMenu: false,
        showAllergies: false,
        showSong: false,
        showDedication: true,
      })
    );

    assert.deepEqual(steps, {
      attendance: 1,
      passCount: 2,
      menuSection: null,
      song: null,
      dedication: 3,
    });
  });

  it('omite el menú y canción en WhatsApp cuando están desactivados en features', () => {
    const config: RsvpEventConfig = {
      eventTitle: 'Boda Demo',
      coupleNames: 'A & B',
      uid: 'uid-demo',
      icsFileName: 'demo.ics',
      startDateIcs: '20271127T170000',
      endDateIcs: '20271127T230000',
      calendarDescription: 'Demo',
      location: 'Santiago',
      rsvpDeadlineDisplay: '06 de Noviembre de 2027',
      rsvpDeadlineShort: '06 de Noviembre',
      rsvpDeadlineIso: '2027-11-06T23:59:59',
      eventDateShort: '27 de Noviembre',
      whatsappNumber: '56911111111',
    };

    const url = buildRsvpWhatsAppUrl({
      guestName: 'Valentina',
      maxPasses: 2,
      config,
      features: { showMenu: false, showSong: false },
      formValues: {
        attendance: 'yes',
        attendeesCount: 2,
        selectedMenus: ['Estándar', 'Celíaco'],
        allergies: 'Sin gluten',
        song: 'Danza Kuduro',
        dedication: '¡Felicidades!',
      },
    });

    const decoded = decodeURIComponent(url);
    assert.equal(decoded.includes('Preferencia de Menú'), false);
    assert.equal(decoded.includes('Canción para la fiesta'), false);
    assert.equal(decoded.includes('Alergias / Restricciones'), true);
    assert.equal(decoded.includes('¡Felicidades!'), true);
  });
});

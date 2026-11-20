import assert from 'node:assert/strict';
import test from 'node:test';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { DB_LIMITS, normalizedEmailSchema } from '../schemas/common.ts';
import {
  accesosAutorizados,
  admins,
  familiasInvitadas,
  novios,
  respuestasRsvp,
  rsvpMenus,
} from './schema.ts';

const ALL_TABLES = [
  admins,
  novios,
  accesosAutorizados,
  familiasInvitadas,
  respuestasRsvp,
  rsvpMenus,
] as const;

const findColumn = (table: (typeof ALL_TABLES)[number], columnName: string) => {
  const { columns } = getTableConfig(table);
  const column = columns.find((col) => col.name === columnName);
  assert.ok(column, `Columna ${columnName} no encontrada en tabla ${getTableConfig(table).name}`);
  return column;
};

test('ninguna tabla usa columnas text o integer sin cota superior', () => {
  for (const table of ALL_TABLES) {
    const config = getTableConfig(table);
    for (const column of config.columns) {
      assert.notEqual(
        column.columnType,
        'PgText',
        `${config.name}.${column.name} no debe usar TEXT sin límite`
      );
      assert.notEqual(
        column.columnType,
        'PgInteger',
        `${config.name}.${column.name} no debe usar INTEGER sin cota`
      );
    }
  }
});

test('los tipos y longitudes de columnas coinciden con DB_LIMITS', () => {
  const expectedVarchars: Array<readonly [(typeof ALL_TABLES)[number], string, number]> = [
    [admins, 'nombre', DB_LIMITS.ADMIN_NOMBRE_MAX],
    [admins, 'email_google', DB_LIMITS.EMAIL_MAX],
    [novios, 'nombres_pareja', DB_LIMITS.NOVIOS_NOMBRES_PAREJA_MAX],
    [novios, 'slug_plantilla', DB_LIMITS.NOVIOS_SLUG_PLANTILLA_MAX],
    [novios, 'plantilla_mensaje', DB_LIMITS.NOVIOS_PLANTILLA_MENSAJE_MAX],
    [accesosAutorizados, 'email_google', DB_LIMITS.EMAIL_MAX],
    [familiasInvitadas, 'token_enlace', DB_LIMITS.FAMILIA_TOKEN_ENLACE_MAX],
    [familiasInvitadas, 'familia_nombre', DB_LIMITS.FAMILIA_NOMBRE_MAX],
    [familiasInvitadas, 'email', DB_LIMITS.EMAIL_MAX],
    [familiasInvitadas, 'telefono', DB_LIMITS.FAMILIA_TELEFONO_MAX],
    [familiasInvitadas, 'mensaje_personalizado', DB_LIMITS.FAMILIA_MENSAJE_PERSONALIZADO_MAX],
    [respuestasRsvp, 'alergias', DB_LIMITS.RSVP_ALERGIAS_MAX],
    [respuestasRsvp, 'cancion_favorita', DB_LIMITS.RSVP_CANCION_FAVORITA_MAX],
    [respuestasRsvp, 'mensaje_novios', DB_LIMITS.RSVP_MENSAJE_NOVIOS_MAX],
  ];

  for (const [table, columnName, maxLength] of expectedVarchars) {
    const column = findColumn(table, columnName);
    assert.equal(column.columnType, 'PgVarchar', `${columnName} debe ser PgVarchar`);
    assert.equal(column.getSQLType(), `varchar(${maxLength})`);
  }

  const expectedSmallInts: Array<readonly [(typeof ALL_TABLES)[number], string]> = [
    [novios, 'max_accesos'],
    [novios, 'max_familias'],
    [familiasInvitadas, 'num_adultos'],
    [familiasInvitadas, 'num_ninos'],
    [respuestasRsvp, 'cant_asistentes'],
  ];

  for (const [table, columnName] of expectedSmallInts) {
    const column = findColumn(table, columnName);
    assert.equal(column.columnType, 'PgSmallInt', `${columnName} debe ser PgSmallInt`);
    assert.equal(column.getSQLType(), 'smallint');
  }

  const maxFamilias = findColumn(novios, 'max_familias');
  assert.equal(maxFamilias.default, DB_LIMITS.NOVIOS_MAX_FAMILIAS_MAX);
  assert.equal(maxFamilias.notNull, true);
});

test('existen todos los CHECK constraints de rangos y consistencia R.S.V.P.', () => {
  const noviosChecks = getTableConfig(novios).checks.map((c) => c.name);
  assert.ok(noviosChecks.includes('chk_novios_max_accesos'));
  assert.ok(noviosChecks.includes('chk_novios_max_familias'));

  const familiasChecks = getTableConfig(familiasInvitadas).checks.map((c) => c.name);
  assert.ok(familiasChecks.includes('chk_familias_num_adultos'));
  assert.ok(familiasChecks.includes('chk_familias_num_ninos'));
  assert.ok(familiasChecks.includes('chk_familias_total_pases'));

  const rsvpChecks = getTableConfig(respuestasRsvp).checks.map((c) => c.name);
  assert.ok(rsvpChecks.includes('chk_respuestas_cant_asistentes'));
  assert.ok(rsvpChecks.includes('chk_respuestas_asistencia_consistente'));
});

test('normalizedEmailSchema acepta hasta 160 caracteres y rechaza 161+', () => {
  const domain = '@example.com';
  const validLocal = 'a'.repeat(DB_LIMITS.EMAIL_MAX - domain.length);
  const validEmail = `${validLocal}${domain}`;
  assert.equal(validEmail.length, DB_LIMITS.EMAIL_MAX);
  assert.equal(normalizedEmailSchema.parse(validEmail), validEmail);

  const tooLongEmail = `${validLocal}x${domain}`;
  assert.equal(tooLongEmail.length, DB_LIMITS.EMAIL_MAX + 1);
  assert.throws(() => normalizedEmailSchema.parse(tooLongEmail));
});

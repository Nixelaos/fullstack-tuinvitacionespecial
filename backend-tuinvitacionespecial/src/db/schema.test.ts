import assert from 'node:assert/strict';
import test from 'node:test';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { DB_LIMITS, ianaTimezoneSchema, normalizedEmailSchema } from '../schemas/common.ts';
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

function findColumn(table: (typeof ALL_TABLES)[number], columnName: string) {
  const { columns } = getTableConfig(table);
  const column = columns.find((col) => col.name === columnName);
  assert.ok(column, `Columna ${columnName} no encontrada en tabla ${getTableConfig(table).name}`);
  return column;
}

//1. Recorre todas las tablas del proyecto y verifica que ninguna use PgText (texto sin límite que se preste a ataques de denegación de servicio por memoria) ni PgInteger (cuando smallint es suficiente).
test('ninguna tabla usa columnas text o integer sin cota superior', () => {
  for (const table of ALL_TABLES) {
    const config = getTableConfig(table);
    for (const column of config.columns) {
      assert.notEqual(
        column.columnType,
        'PgText', //pgText es un texto sin límite que se preste a ataquesoS (Denial of Service) por sobrecarga de memoria.
        `${config.name}.${column.name} no debe usar TEXT sin límite`
      );
      assert.notEqual(
        column.columnType,
        'P //PgInteger es un entero sin límite que se preste a ataques de DoS por sobrecarga de memoria.gInteger', //pgInteger es un INTEGER de 4 bytes de números enteros de hasta 2.147.483.647.
        `${config.name}.${column.name} no debe usar INTEGER sin cota`
      );
    }
  }
});

//2. Revisa 15 columnas varchar y 5 columnas smallint para confirmar que sus longitudes en la base de datos sean idénticas a las constantes de common.ts
//Por qué existe: Evita desincronizaciones entre lo que valida el backend (Zod) y lo que permite la base de datos (Postgres).

test('los tipos y longitudes de columnas coinciden con DB_LIMITS', () => {
  const expectedVarchars: Array<readonly [(typeof ALL_TABLES)[number], string, number]> = [
    [admins, 'nombre', DB_LIMITS.ADMIN_NOMBRE_MAX],
    [admins, 'email_google', DB_LIMITS.EMAIL_MAX],
    [novios, 'nombres_pareja', DB_LIMITS.NOVIOS_NOMBRES_PAREJA_MAX],
    [novios, 'slug_plantilla', DB_LIMITS.NOVIOS_SLUG_PLANTILLA_MAX],
    [novios, 'plantilla_mensaje', DB_LIMITS.NOVIOS_PLANTILLA_MENSAJE_MAX],
    [novios, 'timezone', DB_LIMITS.NOVIOS_TIMEZONE_MAX],
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
    [novios, 'max_invitaciones'],
    [familiasInvitadas, 'num_adultos'],
    [familiasInvitadas, 'num_ninos'],
    [respuestasRsvp, 'cant_asistentes'],
  ];

  for (const [table, columnName] of expectedSmallInts) {
    const column = findColumn(table, columnName);
    assert.equal(column.columnType, 'PgSmallInt', `${columnName} debe ser PgSmallInt`);
    assert.equal(column.getSQLType(), 'smallint');
  }

  const maxInvitaciones = findColumn(novios, 'max_invitaciones');
  assert.equal(maxInvitaciones.default, DB_LIMITS.NOVIOS_MAX_FAMILIAS_MAX);
  assert.equal(maxInvitaciones.notNull, true);
});


//3. omprueba que en la definición de las tablas estén registradas las 7 reglas de RSVP.
test('existen todos los CHECK constraints de rangos y consistencia R.S.V.P.', () => {
  const noviosChecks = getTableConfig(novios).checks.map((c) => c.name);
  assert.ok(noviosChecks.includes('chk_novios_max_accesos'));
  assert.ok(noviosChecks.includes('chk_novios_max_invitaciones'));

  const familiasChecks = getTableConfig(familiasInvitadas).checks.map((c) => c.name);
  assert.ok(familiasChecks.includes('chk_familias_num_adultos'));
  assert.ok(familiasChecks.includes('chk_familias_num_ninos'));
  assert.ok(familiasChecks.includes('chk_familias_total_pases'));

  const rsvpChecks = getTableConfig(respuestasRsvp).checks.map((c) => c.name);
  assert.ok(rsvpChecks.includes('chk_respuestas_cant_asistentes'));
  assert.ok(rsvpChecks.includes('chk_respuestas_asistencia_consistente'));
});


//4. Construye un correo de prueba de exactamente 160 caracteres y comprueba que pase, y luego uno de 161 caracteres y comprueba que Zod lance un error (assert.throws).
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


/**
 * Inspecciona en memoria las tablas novios y familiasInvitadas de schema.ts y DB_LIMITS de common.ts para asegurar que:

DB_LIMITS: NOVIOS_MAX_ACCESOS_DEFAULT sea 3 y NOVIOS_TIMEZONE_MAX sea 64.
 * 
 */

//5. 
//Validar los cambios de la migración 0002 y zonas horarias
test('migración 0002: defaults y nulabilidad en novios y familias_invitadas', () => {
  assert.equal(DB_LIMITS.NOVIOS_MAX_ACCESOS_DEFAULT, 3);
  assert.equal(DB_LIMITS.NOVIOS_TIMEZONE_MAX, 64);

  const maxAccesos = findColumn(novios, 'max_accesos');
  assert.equal(maxAccesos.columnType, 'PgSmallInt');
  assert.equal(maxAccesos.notNull, true);
  assert.equal(maxAccesos.default, DB_LIMITS.NOVIOS_MAX_ACCESOS_DEFAULT);

  const timezone = findColumn(novios, 'timezone');
  assert.equal(timezone.columnType, 'PgVarchar');
  assert.equal(timezone.getSQLType(), 'varchar(64)');
  assert.equal(timezone.notNull, true);
  assert.equal(timezone.default, 'America/Santiago');

  const email = findColumn(familiasInvitadas, 'email');
  assert.equal(email.columnType, 'PgVarchar');
  assert.equal(email.getSQLType(), 'varchar(160)');
  assert.equal(email.notNull, false);
  assert.equal(email.isUnique, false);
  const familiasConfig = getTableConfig(familiasInvitadas);
  assert.equal(
    familiasConfig.uniqueConstraints.some((uc) => uc.columns.some((col) => col.name === 'email')),
    false
  );

  const whatsappEnviadoAt = findColumn(familiasInvitadas, 'whatsapp_enviado_at');
  assert.equal(whatsappEnviadoAt.columnType, 'PgTimestamp');
  assert.equal(whatsappEnviadoAt.getSQLType(), 'timestamp with time zone');
  assert.equal(whatsappEnviadoAt.notNull, false);

  const invitacionEnviadaAt = findColumn(familiasInvitadas, 'invitacion_enviada_at');
  assert.equal(invitacionEnviadaAt.columnType, 'PgTimestamp');
  assert.equal(invitacionEnviadaAt.getSQLType(), 'timestamp with time zone');
  assert.equal(invitacionEnviadaAt.notNull, false);
});


/**
 * 
 * Prueba el esquema Zod ianaTimezoneSchema (en common.ts):
 */

//6. Este test verifica que el validador de Zod (ianaTimezoneSchema) controle estrictamente qué zona horaria se puede guardar en novios.timezone.
test('ianaTimezoneSchema acepta zonas IANA válidas y rechaza inválidas o largas', () => {
  assert.equal(ianaTimezoneSchema.parse('America/Santiago'), 'America/Santiago');
  assert.equal(ianaTimezoneSchema.parse('  UTC  '), 'UTC');
  assert.equal(
    ianaTimezoneSchema.parse('America/Argentina/Buenos_Aires'),
    'America/Argentina/Buenos_Aires'
  );
  assert.equal(ianaTimezoneSchema.parse('Europe/Madrid'), 'Europe/Madrid');

  assert.throws(() => ianaTimezoneSchema.parse(''));
  assert.throws(() => ianaTimezoneSchema.parse('   '));
  assert.throws(() => ianaTimezoneSchema.parse('Mars/Olympus'));
  assert.throws(() => ianaTimezoneSchema.parse('Not/A_Timezone'));
  assert.throws(() => ianaTimezoneSchema.parse('A'.repeat(DB_LIMITS.NOVIOS_TIMEZONE_MAX + 1)));
});

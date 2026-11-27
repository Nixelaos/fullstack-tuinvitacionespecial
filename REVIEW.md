# REVIEW.md — Reglas de revisión de código

> Reglas ratificadas (`v1.1.0`, 2026-11-20) junto con [02-DOCS/wiki/sdd/constitution.md](./02-DOCS/wiki/sdd/constitution.md).

## Formato del resumen

Todo reporte de revisión debe abrir con el conteo exacto antes de detallar hallazgos:

`<N> findings: <X> blockers, <Y> nits`

## Qué es un fallo crítico (Blocker) en este repositorio

1. **Fuga entre cuentas / IDOR (`BR-06`):** Cualquier consulta o mutación sobre `familias_invitadas`, `respuestas_rsvp`, `rsvp_menus` o `novios` que no verifique que el usuario autenticado tiene `activo = true` para ese `novios_id` específico ni filtre por `novios_id` en SQL.
2. **Omisión de reglas de negocio (`BR-01`–`BR-05`):**
   - Permitir `cant_asistentes > num_adultos + num_ninos` o `COUNT(rsvp_menus) !== cant_asistentes`.
   - Permitir editar o crear un R.S.V.P. cuando `now() > novios.rsvp_deadline`.
   - Permitir vincular accesos por encima de `novios.max_accesos`.
   - Editar pases por debajo de `cant_asistentes` sin invalidar la respuesta R.S.V.P. previa.
3. **Condición de carrera o estado parcial:** Escrituras de R.S.V.P. sin serialización (`SELECT ... FOR UPDATE` o cola por familia) o carga masiva sin transacción ACID (`ROLLBACK` ante fallo).
4. **Fallo de autenticación, secretos, límites o blindaje HTTP/exportación (Principios 13–18):**
   - Validación incompleta del token Google (`iss`, `aud`, `exp`, `email_verified`), comparación no constante de `MASTER_API_KEY`, o secretos/PII en logs o repositorio.
   - Almacenar sesiones fuera de cookie `HttpOnly; Secure; SameSite=Lax` (ej. en `localStorage`/`sessionStorage`) o sin revocación instantánea en Redis.
   - Omitir validación CSRF (`Origin`/`Referer`) en mutaciones con cookie, o omitir `@fastify/rate-limit`, `@fastify/helmet`, CORS restringido o `bodyLimit` en Fastify.
   - Introducir columnas `TEXT` o `INTEGER` sin cota fuera de `DB_LIMITS` / `novios.max_invitaciones <= 1000`, o exportar archivos tabulares (`.xlsx`/`.csv`) sin neutralizar Formula Injection (`=`, `+`, `-`, `@`).
5. **Migración irreversible o desalineada:** Cambio en `src/db/schema.ts` sin su migración en `drizzle/` o pérdida silenciosa de datos sin estrategia explícita.
6. **Bloqueo de cola o reenvíos duplicados:** Envío masivo síncrono dentro del request HTTP o sin `Idempotency-Key` / verificación de `invitacion_enviada_at`.

## Rutas que siempre requieren revisión humana (Tier 2)

> Nota: Listarlas aquí orienta al revisor. Para que `rsc risk` eleve y exija aprobación automática a nivel de herramienta, reflejar estos patrones en `.rsc-risk.json` / configuración de sello cuando corresponda.

- `backend-tuinvitacionespecial/src/lib/auth.ts` y futuros middlewares de sesión/RBAC.
- `backend-tuinvitacionespecial/src/db/schema.ts` y `backend-tuinvitacionespecial/drizzle/**`.
- Lógica de transacciones R.S.V.P., cola de envíos masivos y manejo de `MASTER_API_KEY`.
- `backend-tuinvitacionespecial/.env*`, `backend-tuinvitacionespecial/docker-compose.yml` y configuración de proxy/TLS.

## Rutas a omitir en revisión

- `**/node_modules/**`
- `**/dist/**`, `**/.astro/**`
- `backend-tuinvitacionespecial/drizzle/meta/**`
- `backend-tuinvitacionespecial/Spec-Driven Development (SDD)/**` (fuente histórica de Notion)
- `.rsc/**` y `.antigravity/rsc/**`

## Convenciones de estilo (Nit)

- **Funciones con `function` (Principio 11):** Declarar funciones con nombre, utilidades, custom hooks o componentes React mediante `const fn = () => {}` o `React.FC` en lugar de `function fn() {}` se reporta como `nit` (`const` se reserva para valores, esquemas, alias y retornos de hooks como `useCallback`/`useMemo`).

## Límite de nits

- Máximo **3 nits** por revisión; descartar los excedentes para priorizar bloqueantes reales y trazabilidad frente a la spec.

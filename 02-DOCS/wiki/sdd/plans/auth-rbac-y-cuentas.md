---
type: plan
title: Plan — Autenticación, Roles y Aislamiento Multi-Boda
description: Plan técnico estructurado en 6 sub-bloques verificables, tareas TDD (T001–T023) y pronóstico de riesgo para auth-rbac-y-cuentas.
tags: [sdd, plan, auth, rbac]
timestamp: 2026-11-20T13:30:00Z
topic: sdd
slug: auth-rbac-y-cuentas
status: draft
---

# Plan — Autenticación, Roles y Aislamiento Multi-Boda

> Spec: [../specs/auth-rbac-y-cuentas.md](../specs/auth-rbac-y-cuentas.md) · Constitution: [../constitution.md](../constitution.md) · Contratos HTTP/Seguridad: [../notas-api-y-seguridad.md](../notas-api-y-seguridad.md) · Review Rules: [../../../REVIEW.md](../../../REVIEW.md) · Status: draft
> Last updated: 2026-11-20

## 0. Global Constraints

Los siguientes valores exactos aplican implícitamente a todas las tareas (`T001`–`T023`) para implementadores aislados y revisores:

- **Runtime y TypeScript (Backend):** Node.js `>=26.0.0`, ejecución nativa de TypeScript `7.0.2` con `"strict": true`, `"erasableSyntaxOnly": true`, `"verbatimModuleSyntax": true`, `"allowImportingTsExtensions": true` y `"type": "module"`. Todo import relativo de código fuente debe conservar extensión `.ts`; quedan prohibidos `enum`, `namespace` y parameter properties en constructores.
- **Stack cerrado Backend:** Fastify `^5.12.8`, Zod `^4.6.7`, `fastify-type-provider-zod ^7.0.0`, PostgreSQL `18.7` (`uuidv7()` nativo), Drizzle ORM `0.45.4` con `pg`, Redis `8.0` con `ioredis ^6.0.0`, BullMQ `^6.7.0`. Únicos plugins HTTP adicionales autorizados para esta spec: `@fastify/helmet`, `@fastify/cors`, `@fastify/cookie`, `@fastify/rate-limit`.
- **Stack cerrado Frontend (Bloque 6):** Astro `5.18.2` (`output: 'static'`), React `18.3.1`, Tailwind CSS `3.4.17`, TypeScript `5.7.2`.
- **Disciplina TDD y comandos de verificación (`config.yaml`):** `strict_tdd: true` (ciclo obligatorio Red → Green → Refactor). Verificación backend: `cd backend-tuinvitacionespecial && npm run build && npm test`. Verificación frontend: `cd frontend-tuinvitacionespecial && npm test && npx tsc --noEmit && npm run build`.
- **Presupuesto de revisión:** Máximo `400` líneas cambiadas y `12` archivos por bloque o entrega incremental (`02-DOCS/wiki/sdd/config.yaml`).
- **Sobre de error HTTP estándar:** Toda respuesta de error devuelve exactamente `{ "code": "SCREAMING_SNAKE_CASE", "message": "Mensaje claro en español", "details"?: unknown }`. Códigos HTTP obligatorios: `400` (esquema Zod o JSON inválido / parámetro faltante), `401` (credenciales ausentes, sesión expirada/revocada, Google ID Token inválido o `x-api-key` inválido), `403` (correo fuera de lista blanca o `activo = false`, aislamiento `BR-06`, fallo CSRF, novio intentando acción SuperAdmin), `404` (boda, admin o acceso inexistente), `409` (`BR-04` `max_accesos`, `max_familias` por debajo del conteo actual, o duplicado `uq_accesos_novios_email`), `413` (`bodyLimit` excedido), `429` (Rate Limit Redis excedido), `500` (error interno sin stack trace ni SQL crudo).
- **`bodyLimit` Fastify:** `65536` bytes (`64 KiB`) global en la instancia Fastify; constante exportada `BODY_LIMIT_BATCH_BYTES = 524288` (`512 KiB`) reservada exclusivamente para la ruta futura `POST /api/weddings/:noviosId/invitations/batch`.
- **Normalización de correos, `DB_LIMITS` e integridad esquema–migración:** Todo correo electrónico se normaliza con `.trim().toLowerCase()` y tope `DB_LIMITS.EMAIL_MAX = 160`. Prohibido usar columnas `PgText` (`TEXT`) o `PgInteger` (`INTEGER`) sin cota superior. Ajustes obligatorios de migración `0002`:
  - `novios.max_accesos`: `smallint NOT NULL DEFAULT 3` (`CHECK >= 1 AND <= 10`).
  - `novios.max_familias`: `smallint NOT NULL DEFAULT 1000` (`CHECK >= 1 AND <= 1000`).
  - `novios.timezone`: `varchar(64) NOT NULL DEFAULT 'America/Santiago'` (`DB_LIMITS.NOVIOS_TIMEZONE_MAX = 64`).
  - `familias_invitadas.email`: `varchar(160)` nullable (`NULL` permitido, sin restricción `UNIQUE`).
  - `familias_invitadas.whatsapp_enviado_at`: `timestamptz` nullable independiente de `invitacion_enviada_at`.
  - **Prohibido modificar `drizzle/0000_*.sql` o `drizzle/0001_slim_doorman.sql`**; los cambios se generan únicamente en la migración incremental `drizzle/0002_*.sql` y se sincronizan en `MD-PostgreeSQL.sql`.
- **Sesión stateful Redis (Camino B):** `sid = crypto.randomBytes(32).toString('base64url')` (256 bits). Clave principal `session:<sid>` con TTL fijo de `604800` segundos (`7` días, sin sliding expiration). Índice inverso `user_sessions:<email>` (Redis Set con `EXPIRE` actualizado a `604800` s en cada alta). Cookie `sid` emitida con `HttpOnly: true`, `SameSite: 'lax'`, `Path: '/'`, `MaxAge: 604800` y `Secure: true` cuando `NODE_ENV === 'production'` o `COOKIE_SECURE=true`. **Prohibido** guardar sesiones, cookies o `idToken` en `localStorage` o `sessionStorage`.
- **Validación CSRF en mutaciones con cookie:** Todo método mutador (`POST`, `PATCH`, `PUT`, `DELETE`) autenticado por cookie (incluidos `POST /api/auth/google` y `POST /api/auth/logout`) valida `Origin` (o `Referer` si `Origin` está ausente) exigiendo igualdad exacta `new URL(header).origin === env.FRONTEND_ORIGIN`; de lo contrario responde `403 CSRF_FORBIDDEN`. Excepción acotada: peticiones a `/api/admin/*` autenticadas únicamente mediante cabecera `x-api-key` válida (sin cookie `sid`).
- **Aislamiento Anti-IDOR (`BR-06`) y separación SuperAdmin:** Toda ruta `/api/weddings/:noviosId/*` exige `requireAuth` + `requireWeddingAccess(:noviosId)` consultando en SQL `accesos_autorizados.novios_id = $noviosId AND email_google = $email AND activo = true`; ante falta de acceso activo responde siempre `403 WEDDING_ACCESS_DENIED` (nunca `404` ni datos ajenos). `MASTER_API_KEY` se compara con `verifyMasterApiKey` (digest SHA-256 + `timingSafeEqual`) y aplica **exclusivamente** bajo `/api/admin/*`.
- **Rate Limiting en Redis 8.0 (`@fastify/rate-limit`):** `POST /api/auth/google`: `10` req/min por IP; `GET /api/auth/me`, `POST /api/auth/logout` y `/api/admin/*`: `60` req/min por IP; resto de rutas (excluyendo `/health`): `120` req/min por IP. Exceder el umbral responde `429 RATE_LIMIT_EXCEEDED`.
- **Cero secretos o PII en logs y autoría Git humana:** Redactar `req.headers.cookie`, `req.headers['x-api-key']`, `req.headers.authorization` en el logger de Fastify y no loguear correos ni `idToken`. No versionar `.env`. Prohibido añadir `Co-Authored-By` de IA o pies automáticos en commits.

---

## 1. Context & constraints

- **Criterios de aceptación que fijan el diseño:**
  - `AC1` (`spec §Acceptance #1`, `BR-04`): cupo inicial `max_accesos = 3`, rechazo al intentar autorizar un 4.º acceso activo sin ampliar cupo ni desactivar otro.
  - `AC2` (`spec §Acceptance #2`, `BR-04`): desactivar un acceso (`activo = false`) libera cupo de inmediato, revoca el acceso del usuario desactivado y conserva íntegro el historial (`familias_invitadas`, `respuestas_rsvp`, `accesos_autorizados`).
  - `AC3` (`spec §Acceptance #3`, `BR-06`): un planner activo en `>= 2` bodas recibe la lista de bodas activas y debe elegir una antes de operar.
  - `AC4` (`spec §Acceptance #4`, `BR-06`): un usuario autorizado en la Boda A que intenta operar sobre la Boda B recibe `403` sin fuga ni mutación.
  - `AC5` (`spec §Acceptance #5`): correo Google con `0` bodas activas o desactivado recibe rechazo explícito (`403` en login / sin acceso al panel).
  - `AC6` (`spec §Acceptance #6`): un novio autenticado no puede alterar `rsvp_deadline`, `max_accesos`, `max_familias` ni `slug_plantilla` (exclusivo de `/api/admin/*`).
  - `AC7` (`spec §Acceptance #7`, `P14`): `POST /api/auth/logout` o paso a `activo = false` revoca la sesión en Redis al instante sin esperar el vencimiento de ~1 h del JWT de Google.
- **Restricciones constitucionales y de contratos:**
  - [constitution.md](../constitution.md) Principios `1`–`18`, `20`, `22`–`23` (stack Fastify v5 + Zod v4 + Drizzle + PostgreSQL 18.7 + Redis 8.0, migraciones sincronizadas, Camino B `604 800` s, Anti-IDOR SQL, CSRF, Rate Limit, Helmet/CORS/`bodyLimit`, cero secretos).
  - [notas-api-y-seguridad.md](../notas-api-y-seguridad.md) §1.1 (`/api/auth/*`), §1.2 (`/api/admin/*`), §1.6 (sobre de error y códigos HTTP), §1.7 (deltas migración `0002`) y §2 (arquitectura de seguridad).
  - [decisions.md](../decisions.md) entradas del `2026-11-19` y `2026-11-20`, incluyendo la consolidación en la migración `0002` de los 4 ajustes de esquema (`max_accesos DEFAULT 3`, `familias_invitadas.email` nullable, `whatsapp_enviado_at`, `novios.timezone`).
  - [REVIEW.md](../../../REVIEW.md) Blockers `#1`, `#2` (`BR-04`), `#4` y `#5`, además de rutas Tier 2 sujetas a aprobación humana.
- **Fuera de alcance (`spec §Non-goals`):**
  - Registro público ("self-service sign up"), contraseñas propias o recuperación de clave.
  - Sub-roles granulares dentro de una misma boda.
  - Interfaz web `/panel/admin` (SuperAdmin opera por `/api/admin/*` y scripts/HTTP en v1).
  - Endpoints CRUD de familias, carga masiva, envío de correos, R.S.V.P. público y dashboard post-envío (pertenecen a las specs hermanas `panel-pre-envio-y-distribucion`, `rsvp-publico-invitados` y `dashboard-post-envio`; aquí solo se entregan el guard `requireWeddingAccess` y el cascarón multi-boda `/panel`).

---

## 2. Architecture

La arquitectura divide `auth-rbac-y-cuentas` en **6 sub-bloques incrementalmente verificables** (Bloque 1: esquema/migración `0002`; Bloque 2: blindaje HTTP perimetral; Bloque 3: motor de sesiones Redis; Bloque 4: rutas `/api/auth/*` y guard Anti-IDOR `BR-06`; Bloque 5: API SuperAdmin `/api/admin/*` y `BR-04`; Bloque 6: isla React `/panel` desacoplada).

```text
[ Google Identity Services ] (EXTERNAL)
             | idToken (once at login)
             v
[ Frontend /panel Astro+React (B6) ] (INTERNAL)   [ SuperAdmin CLI / Scripts ] (EXTERNAL)
             | Cookie sid + Origin                             | Cookie sid OR x-api-key
             +--------------------+----------------------------+
                                  | HTTPS / HTTP
                                  v
+----------------------------------------------------------------------------------+
| Fastify API Perimeter (B2): Helmet, CORS, Cookie, bodyLimit, RateLimit,          |
|                             CSRF Guard, Error Handler                 (INTERNAL) |
+-------------------+---------------------------------------------+----------------+
                    |                                             |
       /api/auth/* & /api/weddings/:noviosId/*               /api/admin/*
                    |                                             |
                    v                                             v
+---------------------------------------+     +------------------------------------+
| Auth Routes & Guards (B4)             |     | Admin Guard & Routes (B5)          |
| - POST /google, GET /me, POST /logout |     | - requireSuperAdmin (dual auth)    |
| - requireAuth, requireWeddingAccess   |     | - /weddings, /accesses (BR-04)     |
+--------+--------------------+---------+     +---------+-----------------+--------+
         |                    |                         |                 |
         v                    v                         |                 |
[ Google JWKS Verifier ]  [ Redis SessionStore (B3) ] <-+                 |
  (INTERNAL -> EXTERNAL)   (INTERNAL)                                     |
                               |                                          |
                               v                                          v
                     [ Redis 8.0 ] (EXTERNAL)        [ Domain Services: authAccess,
                                                       adminWeddings, adminAccesses ]
                                                                (INTERNAL)
                                                                    |
                                                                    v
                                                     [ PostgreSQL 18.7 / Drizzle (B1) ]
                                                                (EXTERNAL)
```

- **Schema & Migración `0002` (INTERNAL, B1):** Mantiene `schema.ts`, `DB_LIMITS`, `MD-PostgreeSQL.sql` y `drizzle/0002_*.sql` sincronizados con topes `SMALLINT`/`VARCHAR`, `max_accesos DEFAULT 3` y columnas diferidas.
- **Fastify Security Perimeter (INTERNAL, B2):** Aplica `@fastify/helmet`, `@fastify/cors`, `@fastify/cookie`, `@fastify/rate-limit` sobre Redis, `bodyLimit` (`64 KiB`), guard CSRF (`Origin`/`Referer`), redacción de secretos en logs y formato único de error `AppError`.
- **Redis SessionStore (INTERNAL, B3):** Administra `session:<sid>` (TTL fijo `604 800` s), el índice inverso `user_sessions:<email>` para revocación masiva instantánea y emisión/limpieza de cookie `sid`.
- **Google JWKS Verifier (`src/lib/auth.ts`, INTERNAL):** Verifica criptográficamente el Google ID Token (RS256, `iss`, `aud`, `exp`, `email_verified`) y compara `MASTER_API_KEY` en tiempo constante.
- **Auth Routes & Anti-IDOR Guards (INTERNAL, B4):** Expone `/api/auth/google`, `/api/auth/me`, `/api/auth/logout` y provee `requireAuth` + `requireWeddingAccess(:noviosId)` (`BR-06` en SQL).
- **SuperAdmin Guard & Services (INTERNAL, B5):** Resuelve autenticación dual (`admins` activo + CSRF o `MASTER_API_KEY`), administra bodas resolviendo `novios.admin_id NOT NULL` y gestiona accesos con bloqueo pesimista `FOR UPDATE` (`BR-04`) y revocación Redis post-commit.
- **Frontend `/panel` Auth & Selector (INTERNAL, B6):** Isla React sobre `/panel` que ejecuta flujo Google Identity Services, consulta `/api/auth/me` con cookies (`credentials: 'include'`), bloquea usuarios no autorizados y ofrece selector multi-boda o acceso directo con 1 boda.

### Decisiones arquitectónicas principales

1. **Top architectural decision — Sesión stateful revocable en Redis + verificación viva en PostgreSQL (Camino B):**
   Se elige almacenar sesiones opacas en Redis (`session:<sid>` + `user_sessions:<email>`, TTL fijo `7` días) combinadas con consulta SQL en vivo sobre `accesos_autorizados.activo = true` y `admins.activo = true` en los guards `requireWeddingAccess` y `requireSuperAdmin`, en lugar de emitir JWT stateless en cookies/headers (Camino A) o cachear la lista de bodas dentro de Redis sin reconsultar Postgres.
   - *Justificación:* Cumple literalmente `constitution.md` P14–P15 y `AC2`/`AC4`/`AC7`: si un SuperAdmin desactiva un acceso, el usuario pierde capacidad de operar **en la siguiente petición** incluso si otra instancia tuviera latencia en Redis, y al revocar `user_sessions:<email>` se invalidan todos sus dispositivos inmediatamente sin depender de la caducidad del token de Google.

2. **Resolución determinista de `novios.admin_id NOT NULL` bajo `MASTER_API_KEY` (Bloque 5):**
   En PostgreSQL, `novios.admin_id` es `NOT NULL REFERENCES admins(id) ON DELETE RESTRICT`, pero cuando el SuperAdmin automatizado opera vía `x-api-key: MASTER_API_KEY` no existe una sesión de administrador humana.
   - *Regla elegida:*
     - Cuando el actor entra por **cookie de sesión admin**, `novios.admin_id` se fija al `adminId` autenticado (si el body envía un `adminId` distinto, responde `403 ADMIN_OWNER_MISMATCH`).
     - Cuando el actor entra por **`MASTER_API_KEY`**, `adminId` se resuelve en este orden: (1) `body.adminId` explícito verificado en `admins WHERE id = $1 AND activo = true` (`404 ADMIN_NOT_FOUND` si no existe o está inactivo); (2) admin activo cuyo `email_google = env.DEFAULT_ADMIN_EMAIL` si la variable está configurada; (3) si no hay `DEFAULT_ADMIN_EMAIL`, autoselección únicamente cuando existe **exactamente 1** admin con `activo = true` en `admins`; (4) si hay `0` o `>= 2` admins activos sin resolver → `400 ADMIN_OWNER_REQUIRED`.
     - En todos los casos por `MASTER_API_KEY`, `accesos_autorizados.autorizado_por_admin_id` permanece `NULL` (permitido en `schema.ts` para dejar traza de automatización maestra).

---

## 3. Interfaces & contracts

### Bloque 1 — Migración `0002` y cotas compartidas (`src/schemas/common.ts`, `src/db/schema.ts`)

```text
DB_LIMITS (constante exportada en src/schemas/common.ts)
  + NOVIOS_TIMEZONE_MAX: 64
  + NOVIOS_MAX_ACCESOS_DEFAULT: 3   (rango mantenido 1..10)

ianaTimezoneSchema (Zod v4 en src/schemas/common.ts)
  - string.trim().min(1).max(64) validado con Intl.DateTimeFormat(undefined, { timeZone })

Delta de columnas en src/db/schema.ts & drizzle/0002_*.sql:
  - novios.max_accesos: smallint NOT NULL DEFAULT 3
  - novios.timezone: varchar(64) NOT NULL DEFAULT 'America/Santiago'
  - familias_invitadas.email: varchar(160) NULL (sin UNIQUE)
  - familias_invitadas.whatsapp_enviado_at: timestamp({ withTimezone: true }) NULL
```

### Bloque 2 — Blindaje perimetral Fastify y errores (`src/lib/errors.ts`, `src/middleware/csrf.ts`, `src/app.ts`)

```text
AppError(statusCode: 400 | 401 | 403 | 404 | 409 | 413 | 429 | 500, code: string, message: string, details?: unknown)
  - invariant: toda respuesta HTTP de error (incluyendo Zod validation errors, bodyLimit > 65536, 404 de ruta y 429)
    serializa exactamente { code, message, ...(details !== undefined ? { details } : {}) }.

isAllowedMutationOrigin(origin: string | undefined, referer: string | undefined, allowedOrigin: string) -> boolean
  - precondition: valida métodos HTTP en {'POST', 'PATCH', 'PUT', 'DELETE'}.
  - postcondition: true solo si Origin (prioritario) o new URL(Referer).origin === new URL(allowedOrigin).origin.

csrfGuard(request, reply) -> void | throws AppError(403, 'CSRF_FORBIDDEN', ...)
  - bypass explícito: solo si request.routeOptions.config?.skipCsrf === true (no usado en /api/auth/*)
    o si la ruta es /api/admin/* SIN cookie sid y CON cabecera x-api-key válida.

buildApp(deps?: AppDependencies) -> FastifyInstance
  - deps opcionales para testing sin I/O real:
    { db?, redis?, rateLimitRedis?, verifyGoogleIdToken?, logger? }
  - plugins globales: @fastify/helmet, @fastify/cors (origin: env.FRONTEND_ORIGIN, credentials: true),
    @fastify/cookie, @fastify/rate-limit (store Redis 8.0), bodyLimit: 65536.
```

### Bloque 3 — Motor de sesiones stateful en Redis (`src/lib/session.ts`)

```text
SessionRecord:
  { sid: string, sub: string, email: string, name: string | null, isAdmin: boolean, createdAt: string }

SESSION_TTL_SECONDS = 604800
SESSION_COOKIE_NAME = 'sid'

SessionStore.createSession(input: { sub: string, email: string, name: string | null, isAdmin: boolean }) -> Promise<SessionRecord>
  - invariant: email siempre normalizado (.trim().toLowerCase()); sid = 32 bytes random base64url.
  - atomicity: pipeline/MULTI Redis -> SET session:<sid> JSON EX 604800 + SADD user_sessions:<email> <sid> + EXPIRE user_sessions:<email> 604800.

SessionStore.getSession(sid: string) -> Promise<SessionRecord | null>
  - invariant: rechaza formato sid inválido antes de consultar Redis; NUNCA renueva el TTL de 604800s.

SessionStore.revokeSession(sid: string) -> Promise<void>
  - postcondition: lee session:<sid> si existe para obtener email, ejecuta DEL session:<sid> y SREM user_sessions:<email> <sid>.

SessionStore.revokeAllUserSessions(email: string) -> Promise<number>
  - postcondition: lee SMEMBERS user_sessions:<email>; si hay miembros, elimina todas las claves session:<sid> y borra user_sessions:<email> en pipeline/MULTI; devuelve cantidad revocada.

setSessionCookie(reply, sid: string) / clearSessionCookie(reply)
  - atributos obligatorios: httpOnly: true, sameSite: 'lax', path: '/', maxAge: 604800,
    secure: env.COOKIE_SECURE ?? (env.NODE_ENV === 'production').
```

### Bloque 4 — Endpoints `/api/auth/*` y guards RBAC + Anti-IDOR (`src/routes/auth.ts`, `src/middleware/auth.ts`, `src/services/authAccess.ts`)

```text
WeddingSummary:
  { id: uuid, nombresPareja: string, slugPlantilla: string, fechaEvento: string | null, rsvpDeadline: string, timezone: string }

AuthPayload:
  { user: { email: string, name: string | null, isAdmin: boolean }, weddings: WeddingSummary[] }

POST /api/auth/google  [CSRF origin check, Rate Limit 10/min/IP]
  Input:  { idToken: string (min 10, max 4096) }
  Output:
    200 AuthPayload + Set-Cookie: sid=...
    400 { code: 'VALIDATION_ERROR' }
    401 { code: 'INVALID_GOOGLE_TOKEN' }
    403 { code: 'ACCOUNT_NOT_AUTHORIZED' | 'CSRF_FORBIDDEN' }
    429 { code: 'RATE_LIMIT_EXCEEDED' }
  - invariant: si el correo no está activo en admins ni tiene >=1 fila activo=true en accesos_autorizados, NO crea sesión ni emite cookie.

GET /api/auth/me  [requireAuth, Rate Limit 60/min/IP]
  Output:
    200 AuthPayload (recalculado en vivo desde PostgreSQL)
    401 { code: 'AUTH_REQUIRED' | 'SESSION_INVALID' | 'SESSION_REVOKED' }
  - invariant: si en vivo perdió tanto isAdmin como toda boda activa, revoca la sesión y devuelve 401 SESSION_REVOKED (o 403 si aplica; definido 401 SESSION_REVOKED para forzar re-ingreso limpio en UI).

POST /api/auth/logout  [CSRF origin check, requireAuth, Rate Limit 60/min/IP]
  Output:
    204 (vacío) + Clear-Cookie: sid
    401 { code: 'AUTH_REQUIRED' | 'SESSION_INVALID' }
    403 { code: 'CSRF_FORBIDDEN' }

requireAuth(request, reply) -> adjunta request.session: SessionRecord | throws AppError(401, ...)
requireWeddingAccess(request, reply) -> lee params.noviosId (UUID), ejecuta:
  SELECT id FROM accesos_autorizados WHERE novios_id = $noviosId AND email_google = $session.email AND activo = true
  - postcondition: adjunta request.authorizedWeddingId = noviosId; si 0 filas -> throws AppError(403, 'WEDDING_ACCESS_DENIED').
  - invariant: nunca devuelve 404 para evitar enumeración de IDs de bodas ajenas (BR-06).
```

### Bloque 5 — Endpoints SuperAdmin (`/api/admin/*`, `src/middleware/auth-admin.ts`, `src/routes/admin.ts`, `src/services/admin*.ts`)

```text
requireSuperAdmin(request, reply) -> adjunta request.adminActor: AdminActor
  AdminActor =
    | { mode: 'master_key', adminId: null, email: null }
    | { mode: 'admin_session', adminId: uuid, email: string }
  - precedencia:
    1) Si cabecera x-api-key presente -> verifyMasterApiKey(x-api-key): true => master_key (sin cookie CSRF); false => 401 INVALID_API_KEY.
    2) Si no hay x-api-key -> exigir cookie sid válida en Redis -> verificar CSRF si método mutador -> consultar admins WHERE email_google = $email AND activo = true => si existe, admin_session; si no => 403 ADMIN_FORBIDDEN.
    3) Sin x-api-key ni cookie sid -> 401 AUTH_REQUIRED.

GET /api/admin/weddings  [requireSuperAdmin]
  -> 200 { weddings: Array<WeddingSummary & { adminId: uuid, maxAccesos: number, maxFamilias: number, activeAccessCount: number, familyCount: number, createdAt: string }> }

POST /api/admin/weddings  [requireSuperAdmin]
  Input: { nombresPareja, slugPlantilla, fechaEvento?: isoDatetime | null, rsvpDeadline: isoDatetime,
           maxAccesos?: int(1..10)=3, maxFamilias?: int(1..1000)=1000, plantillaMensaje?: string | null,
           timezone?: ianaTimezone='America/Santiago', adminId?: uuid }
  -> 201 { wedding } | 400 | 403 ADMIN_OWNER_MISMATCH | 404 ADMIN_NOT_FOUND

PATCH /api/admin/weddings/:noviosId  [requireSuperAdmin]
  Input: partial de campos editables (al menos 1 campo)
  - transaction ACID (FOR UPDATE sobre novios):
    - si maxAccesos < COUNT(accesos_autorizados WHERE novios_id = $1 AND activo = true) -> 409 MAX_ACCESSES_BELOW_ACTIVE
    - si maxFamilias < COUNT(familias_invitadas WHERE novios_id = $1) -> 409 MAX_FAMILIES_BELOW_CURRENT
  -> 200 { wedding } | 404 WEDDING_NOT_FOUND | 409

GET /api/admin/weddings/:noviosId/accesses  [requireSuperAdmin]
  -> 200 { accesses: AccessItem[] } | 404 WEDDING_NOT_FOUND

POST /api/admin/weddings/:noviosId/accesses  [requireSuperAdmin]
  Input: { emailGoogle: normalizedEmailSchema }
  - transaction ACID (SELECT ... FROM novios WHERE id = $1 FOR UPDATE):
    1) novios no existe -> 404 WEDDING_NOT_FOUND
    2) existe fila previa con mismo (novios_id, email_google) -> 409 ACCESS_ALREADY_EXISTS
    3) COUNT(activo = true) >= novios.max_accesos -> 409 MAX_ACCESSES_REACHED (BR-04)
    4) INSERT accesos_autorizados con autorizado_por_admin_id = adminActor.adminId (null si master_key)
  -> 201 { access }

PATCH /api/admin/weddings/:noviosId/accesses/:accessId  [requireSuperAdmin]
  Input: { activo: boolean }
  - transaction ACID (SELECT ... FROM novios WHERE id = $1 FOR UPDATE):
    1) fila en accesos_autorizados WHERE id = $accessId AND novios_id = $noviosId -> si no existe -> 404 ACCESS_NOT_FOUND (o WEDDING_NOT_FOUND si falta boda)
    2) si pasa de false -> true y COUNT(activo = true) >= novios.max_accesos -> 409 MAX_ACCESSES_REACHED
    3) UPDATE accesos_autorizados SET activo = $activo WHERE id = $accessId AND novios_id = $noviosId
  - post-commit: si activo === false -> sessionsRevoked = await sessionStore.revokeAllUserSessions(access.emailGoogle); else 0.
  -> 200 { access, sessionsRevoked: number }
```

### Bloque 6 — Frontend ingreso Google y selector multi-boda (`/panel`)

```text
panelAuthApi (frontend-tuinvitacionespecial/src/lib/panelAuthApi.ts)
  - fetchAuthMe(): Promise<AuthPayload | null>  (GET /api/auth/me, credentials: 'include'; 401 -> null)
  - loginWithGoogle(idToken: string): Promise<AuthPayload>  (POST /api/auth/google, credentials: 'include')
  - logoutSession(): Promise<void>  (POST /api/auth/logout, credentials: 'include')

resolvePanelViewState(input: { status: 'loading' | 'ready', user: PanelUser | null, weddings: WeddingSummary[], selectedWeddingId: string | null, authErrorCode: string | null })
  -> 'loading' | 'login' | 'unauthorized' | 'selector' | 'workspace'
  - rules:
    - authErrorCode === 'ACCOUNT_NOT_AUTHORIZED' o (user && weddings.length === 0) -> 'unauthorized'
    - !user -> 'login'
    - weddings.length === 1 -> 'workspace' (auto-selecciona weddings[0].id)
    - weddings.length >= 2 && selectedWeddingId está en weddings -> 'workspace'
    - weddings.length >= 2 -> 'selector'

formatWeddingCardDate(wedding: Pick<WeddingSummary, 'fechaEvento' | 'rsvpDeadline' | 'timezone'>)
  -> { label: 'Fecha del evento' | 'Cierre R.S.V.P.', formatted: string }
```

---

## 4. Data model & flow

### Entidades y cambios en la migración `0002`

- **`admins`:** `id` (uuidv7), `nombre` (`varchar(80)`), `email_google` (`varchar(160) UNIQUE`), `activo` (`boolean DEFAULT true`). Sin cambios de esquema en `0002`.
- **`novios`:** `id` (uuidv7), `admin_id` (`uuid NOT NULL REFERENCES admins`), `nombres_pareja` (`varchar(100)`), `slug_plantilla` (`varchar(50)`), `fecha_evento` (`timestamptz NULL`), `rsvp_deadline` (`timestamptz NOT NULL`), **`max_accesos` (`smallint NOT NULL DEFAULT 3`, `CHECK 1..10`)**, `max_familias` (`smallint NOT NULL DEFAULT 1000`, `CHECK 1..1000`), `plantilla_mensaje` (`varchar(1000) NULL`), **`timezone` (`varchar(64) NOT NULL DEFAULT 'America/Santiago'`)**.
- **`accesos_autorizados`:** `id` (uuidv7), `novios_id` (`uuid NOT NULL REFERENCES novios ON DELETE CASCADE`), `autorizado_por_admin_id` (`uuid NULL REFERENCES admins ON DELETE SET NULL`), `email_google` (`varchar(160)`), `activo` (`boolean NOT NULL DEFAULT true`), `UNIQUE (novios_id, email_google)` (`uq_accesos_novios_email`).
- **`familias_invitadas` (deltas de soporte para specs hermanas incluidos en migración `0002`):** **`email` pasa de `NOT NULL` a `NULL` permitido (sin `UNIQUE`)**, y se agrega **`whatsapp_enviado_at` (`timestamptz NULL`)** independiente de `invitacion_enviada_at`.
- **Almacén Redis 8.0:**
  - `session:<sid>` → String JSON (`SessionRecord`), TTL fijo `604 800` s.
  - `user_sessions:<email>` → Set de `<sid>`, TTL refrescado a `604 800` s al registrar sesión.
  - Claves internas de `@fastify/rate-limit` por IP y prefijo de ruta.

### Flujos primarios trazados

1. **Inicio de sesión con Google y selección de boda (`AC3`, `AC5`, `P14`):**
   1. El navegador en `/panel` obtiene el `idToken` desde Google Identity Services y llama `POST /api/auth/google` con `credentials: 'include'`.
   2. El perímetro Fastify valida rate limit (`10/min/IP`) y `Origin` CSRF contra `env.FRONTEND_ORIGIN`.
   3. `verifyGoogleIdToken` valida RS256, `iss`, `aud`, `exp`, `email_verified` y normaliza `email`.
   4. `authAccess.resolveUserAccess(email)` consulta `admins (activo = true)` y `accesos_autorizados JOIN novios (activo = true)` ordenado por `created_at`.
   5. Si `!isAdmin && weddings.length === 0` → responde `403 ACCOUNT_NOT_AUTHORIZED` sin escribir en Redis ni emitir cookie.
   6. Si está autorizado → `sessionStore.createSession(...)` graba en Redis `session:<sid>` y `user_sessions:<email>` con TTL `604 800` s, emite cookie `sid` (`HttpOnly; SameSite=Lax; Secure` según entorno) y devuelve `{ user, weddings }`.
   7. En frontend: `0` bodas → vista `unauthorized`; `1` boda → entra directo al shell de esa boda; `>= 2` bodas → muestra selector con nombres de pareja, plantilla y fecha (con fallback a `rsvpDeadline`), permitiendo cambiar de boda sin re-autenticarse.

2. **Revocación de acceso y liberación de cupo `BR-04` (`AC1`, `AC2`, `AC7`):**
   1. SuperAdmin llama `PATCH /api/admin/weddings/:noviosId/accesses/:accessId` con `{ activo: false }`.
   2. `adminAccesses` abre transacción SQL, bloquea la fila de `novios` (`FOR UPDATE`), verifica que el acceso pertenezca a `:noviosId` (`BR-06`) y actualiza `activo = false` conservando intactos el registro de auditoría, `familias_invitadas` y `respuestas_rsvp`.
   3. Tras `COMMIT`, ejecuta `sessionStore.revokeAllUserSessions(email)` eliminando todas las claves `session:<sid>` y `user_sessions:<email>` del correo desactivado.
   4. Cualquier petición posterior del usuario revocado falla en `401` (si perdió toda boda y admin) o `403 WEDDING_ACCESS_DENIED` (si conserva otras bodas e intenta entrar a la revocada).
   5. El cupo activo pasa de `3` a `2`, permitiendo `POST /api/admin/weddings/:noviosId/accesses` para el nuevo correo dentro del límite `max_accesos = 3`.

3. **Fronteras de consistencia e impacto de migración:**
   - **Transaccional ACID:** Toda mutación que afecta o compara cupos (`PATCH /weddings/:noviosId`, `POST /accesses`, `PATCH /accesses/:accessId`) usa transacción PostgreSQL con `SELECT ... FOR UPDATE` sobre `novios`.
   - **Eventualmente consistente acotada (Redis post-commit):** La revocación de `user_sessions:<email>` ocurre tras el `COMMIT` en Postgres para no invalidar sesiones si la transacción aborta; como defensa en profundidad ante un fallo transitorio de Redis, `GET /api/auth/me`, `requireWeddingAccess` y `requireSuperAdmin` siempre revalidan `activo = true` contra PostgreSQL.
   - **Impacto migración `0002`:** 100 % aditiva y no destructiva (`ALTER DEFAULT`, `DROP NOT NULL`, `ADD COLUMN ... NULL`, `ADD COLUMN ... NOT NULL DEFAULT 'America/Santiago'`). Sin pérdida de datos ni alteración de `0000_*` o `0001_*`.

---

## 5. Testing strategy

| Criterio / Requisito | Nivel | Qué afirma el test | Qué se simula vs qué es real |
| --- | --- | --- | --- |
| `AC1` (`BR-04` cupo 3) | unit + integration | Rechaza 4.º acceso activo con `409 MAX_ACCESSES_REACHED`; `max_accesos` default `3`; concurrencia paralela solo deja entrar 1 | `T018` simula repo transaccional; `T023` prueba `FOR UPDATE` real sobre PostgreSQL 18.7 |
| `AC2` (desactivar libera cupo + conserva datos) | integration | `activo = false` libera cupo para 4.º correo, conserva registro previo e historial de `familias_invitadas` / `respuestas_rsvp` intacto | `T018` con doble de store; `T023` verifica filas reales en PostgreSQL 18.7 |
| `AC3` (multi-boda planner) | contract + unit | `POST /api/auth/google` y `GET /api/auth/me` devuelven `N >= 2` bodas; frontend muestra selector para `>=2` y entra directo con `1` | `T012` usa JWKS stub + store; `T020` prueba lógica pura `resolvePanelViewState` en `node:test` |
| `AC4` (`BR-06` Anti-IDOR) | contract + integration | Usuario activo solo en Boda A recibe `403 WEDDING_ACCESS_DENIED` al llamar ruta con `noviosId` de Boda B | `T010` con Fastify `inject` + doble SQL verificando cláusula `novios_id`; `T023` end-to-end contra Postgres real |
| `AC5` (0 bodas o inactivo) | contract + unit | `POST /api/auth/google` responde `403 ACCOUNT_NOT_AUTHORIZED` sin cookie; frontend muestra estado `unauthorized` | `T012` y `T020` |
| `AC6` (novio bloqueado en admin) | contract | Cookie de novio normal contra `GET/POST/PATCH /api/admin/*` recibe `403 ADMIN_FORBIDDEN`; validación Zod rechaza campos ajenos en perfil novio | `T014`, `T016` con Fastify `inject` |
| `AC7` (revocación inmediata) | unit + integration | `POST /logout` limpia cookie y elimina `session:<sid>` + miembro de `user_sessions:<email>`; `activo = false` revoca todas las sesiones del email | `T008` (Redis fake/in-memory), `T012`/`T018`, `T023` sobre Redis 8.0 real |
| `P13`–`P18` (perímetro HTTP) | contract + integration | `helmet` headers, CORS estricto, `bodyLimit` `413`, CSRF `403`, error envelope uniforme, `rate-limit` `429` | `T004`, `T006` con Fastify `inject`; `T023` verifica rate-limit real en Redis 8.0 |
| Migración `0002` (`§1.7`) | schema + integration | Sin `PgText`/`PgInteger`, `max_accesos DEFAULT 3`, `timezone`, `email` nullable sin `UNIQUE`, `whatsapp_enviado_at` | `T001` introspección Drizzle; `T023` ejecuta `npm run db:migrate` sobre PostgreSQL 18.7 limpio |

- **Línea E2E y dependencias reales obligatorias (`T023`):**
  - **PostgreSQL 18.7 real** (Docker) para aplicar `0002`, verificar restricciones `CHECK`/`UNIQUE` y comprobar serialización `SELECT ... FOR UPDATE` bajo peticiones concurrentes reales en `BR-04`.
  - **Redis 8.0 real** (Docker) para comprobar TTL `604 800` s, índice inverso `user_sessions:<email>` y contadores `@fastify/rate-limit`.
  - **Frontend Bloque 6 (si se incluye):** el build estático Astro + React (`tsc --noEmit` + `astro build`) y una prueba interactiva en navegador contra backend local validan el flujo real de Google Sign-In/selector cuando el usuario habilite Bloque 6.

---

## 6. Sequencing & dependencies

La implementación se parte en **6 sub-bloques ordenados**, cada uno dentro del presupuesto `<= 400` líneas y `<= 12` archivos:

1. **Bloque 1 — Migración BD `0002` y esquema (`T001`–`T002`):**
   - Depende de: ninguno (fundación).
   - Verificación independiente: `cd backend-tuinvitacionespecial && npm run build && npm test` (+ `drizzle-kit generate` y `drizzle-kit migrate`).
2. **Bloque 2 — Blindaje perimetral Fastify y errores estándar (`T003`–`T007`):**
   - Depende de: Bloque 1 (`T002` por `package.json`/env estable; `T004`–`T007` son secuenciales Red→Green).
   - Verificación independiente: `npm run build && npm test` (incluyendo `errors.test.ts`, `csrf.test.ts`, `app.security.test.ts`).
3. **Bloque 3 — Motor de sesiones stateful en Redis (`T008`–`T009`):**
   - Depende de: `T003` (variables/configuración base). **Paralelizable con `T004`–`T007`** porque no comparte archivos con Bloque 2.
   - Verificación independiente: `node --test src/lib/session.test.ts && npm run build`.
4. **Bloque 4 — Endpoints `/api/auth/*` y guard Anti-IDOR (`T010`–`T013`):**
   - Depende de: Bloque 1 (`T002`), Bloque 2 (`T005`, `T007`) y Bloque 3 (`T009`).
   - Verificación independiente: `npm run build && npm test`.
5. **Bloque 5 — Endpoints SuperAdmin `/api/admin/*` (`T014`–`T019`):**
   - Sub-entrega **5A (`T014`–`T017`):** Guard dual `requireSuperAdmin` + CRUD `/api/admin/weddings` (`T014`–`T015` pueden correr en paralelo con `T012`–`T013` porque solo dependen de `T005` y `T011`).
   - Sub-entrega **5B (`T018`–`T019`):** `/api/admin/weddings/:noviosId/accesses` (`BR-04` `FOR UPDATE` + revocación post-commit Redis).
   - Verificación independiente: `npm run build && npm test`.
6. **Bloque 6 — Frontend ingreso Google y selector multi-boda `/panel` (`T020`–`T022`, desacoplado):**
   - Depende de: Bloque 4 (`T013` fija el contrato JSON de `/api/auth/*`). Puede quedar diferido o ejecutarse inmediatamente después de Bloques 1–5 según decisión explícita del usuario.
   - Verificación independiente: `cd frontend-tuinvitacionespecial && npm test && npx tsc --noEmit && npm run build`.
7. **Cierre integrado (`T023`):**
   - Depende de todos los bloques incluidos: suite completa sobre PostgreSQL 18.7 y Redis 8.0 reales + verificación de concurrencia `BR-04` + revisión de bloques Tier 2.

### Micro-cortes de revisión humana (`C1`–`C9`)

Para facilitar la lectura y aprobación entre sesiones sin revisar diffs extensos de golpe, `implement` se ejecuta en **micro-cortes atómicos (~40–220 líneas de lógica real por pausa)** mapeados sobre las tareas estables `T001`–`T023`. Tras cada micro-corte:

1. El agente ejecuta `Red → Green`, pasa `build + test` y realiza una auto-revisión previa contra [REVIEW.md](../../../REVIEW.md).
2. El agente se detiene y entrega una **Ficha de revisión de 5 minutos** separando líneas de lógica real, líneas de tests y archivos generados (`package-lock.json`, `drizzle/meta/`).
3. Solo tras el visto bueno explícito del usuario se consolida el corte en [progress/auth-rbac-y-cuentas.md](../progress/auth-rbac-y-cuentas.md) y se pasa al siguiente.

| Corte | Tareas | Alcance | Lógica real estimada |
| --- | --- | --- | --- |
| **C1** | `T001`–`T002` | Migración BD `0002`, `schema.ts`, `DB_LIMITS`, `MD-PostgreeSQL.sql` | `~40` líneas |
| **C2** | `T003`–`T005` | Plugins Fastify, `env.ts`, `errors.ts` y guard `csrf.ts` | `~130` líneas |
| **C3** | `T006`–`T007` | Blindaje perimetral en `src/app.ts` (`helmet`, `cors`, `rate-limit`, `bodyLimit`, DI) | `~100` líneas |
| **C4** | `T008`–`T009` | Motor de sesiones Redis (`session:<sid>`, `user_sessions:<email>`, cookie) | `~110` líneas |
| **C5** | `T010`–`T011` | Middlewares `requireAuth`, `requireWeddingAccess` (`BR-06`) y `authAccess.ts` | `~100` líneas |
| **C6** | `T012`–`T013` | Rutas `POST /api/auth/google`, `GET /api/auth/me` y `POST /api/auth/logout` | `~140` líneas |
| **C7** | `T014`–`T017` | Guard `requireSuperAdmin` + `/api/admin/weddings` | `~180` líneas |
| **C8** | `T018`–`T019` | `/api/admin/weddings/:noviosId/accesses` (`BR-04` `FOR UPDATE` + revocación Redis) | `~130` líneas |
| **C9** | `T020`–`T022` | *(Opcional)* Frontend ingreso Google y selector multi-boda `/panel` | `~220` líneas |
| **Cierre** | `T023` | Integración real PostgreSQL 18.7 + Redis 8.0 + concurrencia `BR-04` + cierre Tier 2 | Solo tests/verificación |

---

## 7. Risks & open decisions

### Riesgos rankeados

| Rank | Riesgo | Disparador (Trigger) | Impacto | Mitigación |
| --- | --- | --- | --- | --- |
| 1 | **Desfase entre rutas Tier 2 de `REVIEW.md` y ausencia de `.rsc-risk.json`** | `T005` (`csrf.ts`), `T017` (`adminWeddings`) y `T019` (`adminAccesses`) salen como Tier 1 en `rsc risk` por ser rutas nuevas fuera de `src/lib/auth.ts` | Revisión insuficiente sobre CSRF o lógica `BR-04` | Tratar `T005`, `T017` y `T019` como **Tier 2 efectivo** (panel de 3 refuters + aprobación humana) según `REVIEW.md`, y crear `.rsc-risk.json` en un ajuste separado si el usuario lo aprueba |
| 2 | **Condición de carrera `BR-04` al autorizar o reactivar accesos** | Dos peticiones paralelas `POST /accesses` o `PATCH { activo: true }` cuando queda `1` cupo disponible | Supera `novios.max_accesos` violando `AC1` | Bloqueo pesimista `SELECT id, max_accesos FROM novios WHERE id = $1 FOR UPDATE` antes de contar `activo = true`, validado con test concurrente real en Postgres 18.7 (`T023`) |
| 3 | **Cookie `Secure` y CORS bloqueando entorno local vs producción** | Navegador HTTP local (`http://localhost:4321`) rechaza cookie `Secure`, o proxy Caddy en HTTPS pierde `Origin` | Login en `/panel` falla en bucle con `401` o `403` | Fijar `Secure` en `NODE_ENV === 'production'` (con override `COOKIE_SECURE`), `FRONTEND_ORIGIN` explícito en `.env` y `trustProxy` configurable detrás de Caddy |
| 4 | **Fallo transitorio de Redis durante revocación post-commit** | `COMMIT` en Postgres marca `activo = false` pero Redis falla momentáneamente en `revokeAllUserSessions` | La clave `session:<sid>` seguiría existiendo en Redis hasta su TTL | `GET /api/auth/me`, `requireWeddingAccess` y `requireSuperAdmin` revalidan en vivo `activo = true` en PostgreSQL en cada petición (defensa en profundidad) + log estructurado del fallo Redis |
| 5 | **Acople de `buildApp()` a conexiones globales** | Importar singletons `db`/`redis` directamente en rutas sin inyección | Tests lentos o imposibles sin levantar Docker en cada cambio unitario | Definir `buildApp(deps?)` desde `T007` inyectando `db`, `redis`, `rateLimitRedis` y `verifyGoogleIdToken` |
| 6 | **Gate de `rsc risk` / `spec gate` al operar en rama `feat/*` con Tier 2** | `rsc risk` exige que la spec vinculada tenga `branch:` en frontmatter antes de push/PR si se trabaja en rama | Bloqueo en `ship` | Al crear la rama `feat/auth-rbac-y-cuentas` vía `worktrees`, actualizar `branch:` en la spec o aterrizar conforme a P11 (`--workflow main`) |

### Decisiones abiertas antes de `implement`

- **D1 — Alcance inicial de ejecución (Bloque 6):** Preguntar explícitamente al usuario si en la primera pasada de `implement` construimos **solo Bloques 1–5 (Backend)** o incluimos **Bloque 6 (`/panel` Frontend)** de inmediato.
- **D2 — Aislamiento en worktree/rama:** Proponer crear `.worktrees/auth-rbac-y-cuentas` sobre rama `feat/auth-rbac-y-cuentas` antes de editar código, dado que el repositorio está actualmente en `main`.
- **D3 — Registro formal en `decisions.md`:** Al iniciar `implement`, anexar en `02-DOCS/wiki/sdd/decisions.md` las reglas operativas refinadas en este plan (orden de resolución de `novios.admin_id` con `MASTER_API_KEY`, umbrales numéricos de `@fastify/rate-limit` y verificación `BR-04` al reactivar `activo: false -> true`).

---

## Tasks
<!-- generated by tasks on 2026-11-20; IDs are stable, do not renumber -->

> **Nota sobre riesgo:** La columna `Risk` registra la salida exacta de `npx @ericrisco/rsc@4.1.8 risk <rutas>` sobre el repositorio actual. Las tareas `T005`, `T017` y `T019` figuran como `1` en el clasificador por ruta pero **deben revisarse como Tier 2** (3 refuters + aprobación humana) conforme a [REVIEW.md](../../../REVIEW.md) por tocar middleware CSRF, `MASTER_API_KEY` y regla `BR-04`.

| ID | [P] | Task | Done-check | Depends-on | Trace | Risk |
| --- | --- | --- | --- | --- | --- | --- |
| T001 |  | Escribir tests fallidos de migración `0002` en `src/db/schema.test.ts` (Bloque 1 — Red) | `cd backend-tuinvitacionespecial && node --test src/db/schema.test.ts` falla esperando `novios.max_accesos DEFAULT 3`, `novios.timezone`, `familias_invitadas.email` nullable y `whatsapp_enviado_at` | — | AC1, §1.7 | 1 |
| T002 |  | Actualizar `DB_LIMITS`, `schema.ts`, generar migración `drizzle/0002_*.sql` y sincronizar `MD-PostgreeSQL.sql` (Bloque 1 — Green) | `cd backend-tuinvitacionespecial && npm run build && npm test` pasa (0 fallos); `git diff drizzle/0000_* drizzle/0001_*` vacío; existe `drizzle/0002_*.sql` | T001 | AC1, §1.7 | 2 |
| T003 |  | Instalar plugins Fastify (`helmet`, `cors`, `cookie`, `rate-limit`) y declarar env vars de seguridad en `env.ts` y `.env.example` (Bloque 2) | `cd backend-tuinvitacionespecial && npm run build` pasa; `package.json` lista los 4 plugins; `env.ts` valida `FRONTEND_ORIGIN`, `COOKIE_SECURE`, `TRUST_PROXY`, `DEFAULT_ADMIN_EMAIL` | T002 | P13–P18 | 2 |
| T004 |  | Escribir tests fallidos para `AppError` y guard CSRF en `src/lib/errors.test.ts` y `src/middleware/csrf.test.ts` (Bloque 2 — Red) | `cd backend-tuinvitacionespecial && node --test src/lib/errors.test.ts src/middleware/csrf.test.ts` falla por módulos inexistentes | T003 | P16, P18 | 1 |
| T005 |  | Implementar `src/lib/errors.ts` y middleware CSRF `src/middleware/csrf.ts` (Bloque 2 — Green) | `cd backend-tuinvitacionespecial && npm run build && node --test src/lib/errors.test.ts src/middleware/csrf.test.ts` pasa al 100% | T004 | P16, P18 | 1 *(Tier 2 por REVIEW.md)* |
| T006 |  | Escribir tests HTTP fallidos de blindaje perimetral en `src/app.security.test.ts` (Bloque 2 — Red) | `cd backend-tuinvitacionespecial && node --test src/app.security.test.ts` falla por ausencia de Helmet, CORS, `bodyLimit` `413`, sobre de error y `rate-limit` `429` | T005 | P16–P18 | 1 |
| T007 |  | Cablear plugins de seguridad, `bodyLimit`, redacción de logs, DI y error handler en `src/app.ts` (Bloque 2 — Green) | `cd backend-tuinvitacionespecial && npm run build && npm test` pasa con `app.security.test.ts` verde y `/health` intacto | T006 | P13–P18 | 1 |
| T008 | [P] | Escribir tests fallidos del motor de sesiones Redis en `src/lib/session.test.ts` (Bloque 3 — Red) | `cd backend-tuinvitacionespecial && node --test src/lib/session.test.ts` falla por módulo `session.ts` inexistente | T003 | AC2, AC7, P14 | 2 |
| T009 |  | Implementar `SessionStore` Redis (`session:<sid>`, `user_sessions:<email>`, TTL `604800` s) y helpers de cookie en `src/lib/session.ts` (Bloque 3 — Green) | `cd backend-tuinvitacionespecial && npm run build && node --test src/lib/session.test.ts` pasa verificando TTL fijo `604800`, revocación masiva y cookie `HttpOnly; SameSite=Lax` | T008 | AC2, AC7, P14 | 2 |
| T010 |  | Escribir tests fallidos de `requireAuth` y `requireWeddingAccess` (`BR-06`) en `src/middleware/auth.test.ts` (Bloque 4 — Red) | `cd backend-tuinvitacionespecial && node --test src/middleware/auth.test.ts` falla por módulos `auth.ts`/`authAccess.ts` inexistentes | T005, T009, T002 | AC4, AC7, P15 | 2 |
| T011 |  | Implementar `src/services/authAccess.ts` y middlewares `requireAuth` / `requireWeddingAccess` en `src/middleware/auth.ts` (Bloque 4 — Green) | `cd backend-tuinvitacionespecial && npm run build && node --test src/middleware/auth.test.ts` pasa verificando `401` sin sesión y `403` Anti-IDOR en SQL | T010 | AC4, AC7, P15 | 2 |
| T012 |  | Escribir tests fallidos de `/api/auth/google`, `/api/auth/me` y `/api/auth/logout` en `src/routes/auth.test.ts` (Bloque 4 — Red) | `cd backend-tuinvitacionespecial && node --test src/routes/auth.test.ts` falla por rutas `/api/auth/*` no registradas | T007, T011 | AC3, AC5, AC7, P14, P17 | 2 |
| T013 |  | Implementar `src/schemas/auth.ts`, `src/routes/auth.ts`, códigos en `src/lib/auth.ts` y registrar rutas en `src/app.ts` (Bloque 4 — Green) | `cd backend-tuinvitacionespecial && npm run build && npm test` pasa incluyendo `1` boda, `>=2` bodas, `0` bodas (`403`), logout (`204`) y CSRF (`403`) | T012 | AC3, AC5, AC7, P14, P17 | 2 |
| T014 | [P] | Escribir tests fallidos del guard dual `requireSuperAdmin` en `src/middleware/auth-admin.test.ts` (Bloque 5A — Red) | `cd backend-tuinvitacionespecial && node --test src/middleware/auth-admin.test.ts` falla por módulo `auth-admin.ts` inexistente | T011, T005 | AC6, P15, P18 | 2 |
| T015 |  | Implementar guard dual `requireSuperAdmin` (`admins` + CSRF o `MASTER_API_KEY`) en `src/middleware/auth-admin.ts` (Bloque 5A — Green) | `cd backend-tuinvitacionespecial && npm run build && node --test src/middleware/auth-admin.test.ts` pasa rechazando novios (`403`), key mala (`401`) y CSRF (`403`) | T014 | AC6, P15, P18 | 2 |
| T016 |  | Escribir tests fallidos de `GET/POST/PATCH /api/admin/weddings` en `src/routes/admin.weddings.test.ts` (Bloque 5A — Red) | `cd backend-tuinvitacionespecial && node --test src/routes/admin.weddings.test.ts` falla por rutas `/api/admin/weddings` no registradas | T013, T015 | AC1, AC6 | 1 |
| T017 |  | Implementar `src/schemas/admin.ts`, `src/services/adminWeddings.ts` y rutas weddings en `src/routes/admin.ts` + `src/app.ts` (Bloque 5A — Green) | `cd backend-tuinvitacionespecial && npm run build && node --test src/routes/admin.weddings.test.ts` pasa verificando `DEFAULT 3`, resolución `admin_id` y `409` al reducir cupos | T016 | AC1, AC6 | 1 *(Tier 2 por REVIEW.md)* |
| T018 |  | Escribir tests fallidos de `GET/POST/PATCH /api/admin/weddings/:noviosId/accesses` (`BR-04` + revocación) en `src/routes/admin.accesses.test.ts` (Bloque 5B — Red) | `cd backend-tuinvitacionespecial && node --test src/routes/admin.accesses.test.ts` falla por rutas accesses no implementadas | T017 | AC1, AC2, AC7 | 1 |
| T019 |  | Implementar `src/services/adminAccesses.ts` (`FOR UPDATE`, `activo=true`, revocación Redis post-commit) y rutas accesses en `src/routes/admin.ts` (Bloque 5B — Green) | `cd backend-tuinvitacionespecial && npm run build && npm test` pasa verificando `409 BR-04`, liberación al desactivar, conservación de datos y revocación Redis | T018 | AC1, AC2, AC7 | 1 *(Tier 2 por REVIEW.md)* |
| T020 | [P] | Escribir tests unitarios fallidos de vistas y fallback de fecha en `frontend-tuinvitacionespecial/src/utils/panelAuthUtils.test.ts` (Bloque 6 — Red) | `cd frontend-tuinvitacionespecial && node --test src/utils/panelAuthUtils.test.ts` falla por módulo `panelAuthUtils.ts` inexistente | T013 | AC3, AC5, AC7 | 1 |
| T021 |  | Implementar `panelAuth.ts`, `panelAuthUtils.ts`, `panelAuthApi.ts` y documentar `PUBLIC_API_URL`/`PUBLIC_GOOGLE_CLIENT_ID` en `frontend-tuinvitacionespecial/.env.example` (Bloque 6 — Green) | `cd frontend-tuinvitacionespecial && npm test && npx tsc --noEmit` pasa sin errores | T020 | AC3, AC5, AC7, P14 | 2 |
| T022 |  | Implementar isla React accesible (`/panel`: login Google, no autorizado, selector multi-boda, shell) y `src/pages/panel/index.astro` (Bloque 6 — Green) | `cd frontend-tuinvitacionespecial && npm test && npx tsc --noEmit && npm run build` genera `/panel/index.html` con `0` errores | T021 | AC3, AC5, AC7, P20 | 1 |
| T023 |  | Verificar suite completa contra PostgreSQL 18.7 y Redis 8.0 reales (migración `0002`, concurrencia `BR-04`, rate limit, builds y revisión Tier 2) | `docker compose up -d` saludable; `npm run db:migrate`; tests de integración y concurrencia `BR-04` verdes; `backend` y `frontend` builds/tests en `0` | T001–T019 *(y T020–T022 si aplica B6)* | AC1–AC7, P5–P18 | — |

### Per-task Interfaces

**T002 — Interfaces**
- Consumes: tests de `T001` y esquema previo en `backend-tuinvitacionespecial/src/db/schema.ts`.
- Produces:
  - `DB_LIMITS.NOVIOS_TIMEZONE_MAX = 64`, `DB_LIMITS.NOVIOS_MAX_ACCESOS_DEFAULT = 3`, `ianaTimezoneSchema` en `src/schemas/common.ts`.
  - `novios.maxAccesos` (`smallint`, `default(3)`, `notNull()`), `novios.timezone` (`varchar(64)`, `default('America/Santiago')`, `notNull()`).
  - `familiasInvitadas.email` (`varchar(160)` nullable sin `UNIQUE`), `familiasInvitadas.whatsappEnviadoAt` (`timestamp({ withTimezone: true })` nullable).
  - Migración incremental `drizzle/0002_*.sql` y espejo en `MD-PostgreeSQL.sql`.

**T003 — Interfaces**
- Consumes: `backend-tuinvitacionespecial/package.json` y `src/config/env.ts`.
- Produces:
  - Dependencias instaladas: `@fastify/helmet`, `@fastify/cors`, `@fastify/cookie`, `@fastify/rate-limit`.
  - Variables en `env.ts` + `.env.example`: `FRONTEND_ORIGIN` (default `'http://localhost:4321'`), `COOKIE_SECURE` (`'true' | 'false'` opcional), `TRUST_PROXY` (`boolean` default `false`), `DEFAULT_ADMIN_EMAIL` (`string` opcional normalizado).

**T005 — Interfaces**
- Consumes: `env.FRONTEND_ORIGIN` (de `T003`), `tests` de `T004`.
- Produces:
  - `AppError` en `src/lib/errors.ts`: `new AppError(statusCode, code, message, details?)` + `toErrorEnvelope(error)`.
  - `isAllowedMutationOrigin(origin, referer, allowedOrigin) -> boolean` y hook `csrfGuard(request, reply)` en `src/middleware/csrf.ts` → rechaza mutaciones con cookie desde origen no coincidente con `403 { code: 'CSRF_FORBIDDEN', message }`.

**T007 — Interfaces**
- Consumes: `AppError`, `csrfGuard` (de `T005`), `env` (de `T003`), `db`, `redis`, `verifyGoogleIdToken`.
- Produces:
  - `BODY_LIMIT_GLOBAL_BYTES = 65536`, `BODY_LIMIT_BATCH_BYTES = 524288`.
  - `buildApp(deps?: AppDependencies)` en `src/app.ts` con: redacción de `req.headers.cookie`, `req.headers['x-api-key']`, `req.headers.authorization`; `@fastify/helmet`; `@fastify/cors` restringido a `env.FRONTEND_ORIGIN` (`credentials: true`); `@fastify/cookie`; `@fastify/rate-limit` conectado a Redis 8.0 (`120/min/IP` por defecto, `/health` exento); hook CSRF; `setErrorHandler` y `setNotFoundHandler` devolviendo `{ code, message, details? }`.

**T009 — Interfaces**
- Consumes: `redis` (`ioredis` client), `env.NODE_ENV`, `env.COOKIE_SECURE` (de `T003`).
- Produces (`src/lib/session.ts`):
  - `SESSION_TTL_SECONDS = 604800`, `SESSION_COOKIE_NAME = 'sid'`.
  - `createSessionStore(redis)` exponiendo `createSession(identity)`, `getSession(sid)`, `revokeSession(sid)`, `revokeAllUserSessions(email)`.
  - `setSessionCookie(reply, sid)` y `clearSessionCookie(reply)` con `{ httpOnly: true, sameSite: 'lax', path: '/', maxAge: 604800, secure }`.

**T011 — Interfaces**
- Consumes: `SessionStore` (de `T009`), `AppError` (de `T005`), `schema` (`admins`, `novios`, `accesosAutorizados`), `uuidSchema` (`src/schemas/common.ts`).
- Produces:
  - `src/services/authAccess.ts`: `resolveUserAccess(db, email) -> { isAdmin: boolean, adminId: string | null, weddings: WeddingSummary[] }` y `hasActiveWeddingAccess(db, email, noviosId) -> boolean`.
  - `src/middleware/auth.ts`: `createAuthMiddleware({ sessionStore, db })` exponiendo `requireAuth` (adjunta `request.session`) y `requireWeddingAccess` (valida `:noviosId` UUID → `400`, verifica SQL `activo = true` → adjunta `request.authorizedWeddingId` o lanza `403 WEDDING_ACCESS_DENIED`).

**T013 — Interfaces**
- Consumes: `buildApp` (de `T007`), `createAuthMiddleware` + `resolveUserAccess` (de `T011`), `verifyGoogleIdToken` (`src/lib/auth.ts`), `SessionStore` (de `T009`).
- Produces:
  - `AuthError` en `src/lib/auth.ts` extendido con `code` (`INVALID_GOOGLE_TOKEN` / `GOOGLE_CONFIG_ERROR`).
  - `src/schemas/auth.ts` (Zod v4): `googleLoginBodySchema`, `authMeResponseSchema`, `weddingSummarySchema`.
  - `src/routes/auth.ts` registrado en `src/app.ts`:
    - `POST /api/auth/google` (rate limit `10/min/IP` + CSRF) → `200 { user, weddings } + Set-Cookie` | `401` | `403` | `429`.
    - `GET /api/auth/me` (rate limit `60/min/IP` + `requireAuth`) → `200 { user, weddings }` | `401`.
    - `POST /api/auth/logout` (rate limit `60/min/IP` + CSRF + `requireAuth`) → `204` + limpia cookie.

**T015 — Interfaces**
- Consumes: `verifyMasterApiKey` (`src/lib/auth.ts`), `SessionStore` (de `T009`), `csrfGuard` (de `T005`), `admins` table.
- Produces (`src/middleware/auth-admin.ts`):
  - `AdminActor = { mode: 'master_key', adminId: null, email: null } | { mode: 'admin_session', adminId: string, email: string }`.
  - `requireSuperAdmin` (adjunta `request.adminActor`): acepta `x-api-key` en tiempo constante (sin requerir cookie/CSRF; `401 INVALID_API_KEY` si falla) o cookie `sid` válida + CSRF en mutaciones + fila `admins (activo = true)` (`403 ADMIN_FORBIDDEN` si no es admin activo).

**T017 — Interfaces**
- Consumes: `requireSuperAdmin` (de `T015`), `schema` (`admins`, `novios`, `accesosAutorizados`, `familiasInvitadas`), `DB_LIMITS` + `ianaTimezoneSchema` (de `T002`).
- Produces:
  - `src/schemas/admin.ts`: `createWeddingBodySchema`, `updateWeddingBodySchema`, `weddingParamsSchema`, `adminWeddingResponseSchema`.
  - `src/services/adminWeddings.ts`: `listWeddings`, `createWedding` (incluye resolución determinista de `admin_id`), `updateWedding` (transacción `FOR UPDATE` validando `maxAccesos >= activos` y `maxFamilias >= familiasActuales` → `409`).
  - `src/routes/admin.ts` registrado en `src/app.ts`: `GET /api/admin/weddings`, `POST /api/admin/weddings`, `PATCH /api/admin/weddings/:noviosId`.

**T019 — Interfaces**
- Consumes: `requireSuperAdmin` (de `T015`), `SessionStore.revokeAllUserSessions` (de `T009`), `adminRoutes` (de `T017`).
- Produces:
  - `createAccessBodySchema`, `updateAccessBodySchema`, `accessParamsSchema` en `src/schemas/admin.ts`.
  - `src/services/adminAccesses.ts`: `listWeddingAccesses`, `authorizeWeddingAccess` (transacción `FOR UPDATE` contando solo `activo = true` vs `max_accesos` → `409 MAX_ACCESSES_REACHED` o `ACCESS_ALREADY_EXISTS`), `toggleWeddingAccess` (transacción `FOR UPDATE` + `409` al reactivar con cupo lleno + revocación post-commit `revokeAllUserSessions`).
  - Rutas en `src/routes/admin.ts`: `GET/POST /api/admin/weddings/:noviosId/accesses`, `PATCH /api/admin/weddings/:noviosId/accesses/:accessId`.

**T021 — Interfaces**
- Consumes: contrato JSON de `/api/auth/*` fijado en `T013` y `frontend-tuinvitacionespecial/.env.example`.
- Produces:
  - `src/types/panelAuth.ts`: `PanelUser`, `WeddingSummary`, `PanelAuthPayload`, `PanelApiError`, `PanelViewState`.
  - `src/utils/panelAuthUtils.ts`: `resolvePanelViewState(...)`, `formatWeddingCardDate(...)`, `mapAuthErrorMessage(code)`.
  - `src/lib/panelAuthApi.ts`: `fetchAuthMe()`, `loginWithGoogle(idToken)`, `logoutSession()` usando `credentials: 'include'` contra `PUBLIC_API_URL` (default `''` mismo origen).
  - Documentación en `frontend-tuinvitacionespecial/.env.example`: `PUBLIC_API_URL`, `PUBLIC_GOOGLE_CLIENT_ID`.

**T022 — Interfaces**
- Consumes: `panelAuthApi`, `panelAuthUtils` (de `T021`), `Layout.astro`.
- Produces:
  - `src/components/panel/PanelAuthApp.tsx` + `PanelLoginView.tsx` + `PanelUnauthorizedView.tsx` + `PanelWeddingSelector.tsx` + `PanelWorkspaceShell.tsx`.
  - `src/pages/panel/index.astro` montando `<PanelAuthApp client:load />` con identidad visual de marca, botón oficial Google Identity Services (`id_token`), selector multi-boda con nombre/plantilla/fecha (o cierre R.S.V.P. si `fechaEvento === null`), cambio de boda sin re-login y cierre de sesión accesible (`role="alert"` en errores).

---

## Review Workload Forecast

### Presupuesto por sub-bloque (control `<= 400` líneas / `<= 12` archivos)

| Sub-bloque | Tareas | Archivos estimados | Líneas estimadas | Max Tier (`rsc` / `REVIEW.md`) | Cumple presupuesto (400 / 12) |
| --- | --- | --- | --- | --- | --- |
| **B1 — Migración BD `0002`** | `T001`–`T002` | `5` | `~120–160` | Tier `2` (`T002`) | Sí |
| **B2 — Perímetro Fastify** | `T003`–`T007` | `8` | `~260–340` | Tier `2` (`T003` + `T005` por `REVIEW.md`) | Sí |
| **B3 — Motor sesiones Redis** | `T008`–`T009` | `2` | `~220–280` | Tier `2` (`T008`, `T009`) | Sí |
| **B4 — Auth y Anti-IDOR** | `T010`–`T013` | `7` | `~300–380` | Tier `2` (`T010`–`T013`) | Sí |
| **B5A — Guard + Weddings Admin** | `T014`–`T017` | `6` | `~220–270` | Tier `2` (`T014`–`T015` + `T017` por `REVIEW.md`) | Sí |
| **B5B — Accesses `BR-04` Admin** | `T018`–`T019` | `3` | `~140–180` | Tier `2` (`T019` por `REVIEW.md`) | Sí |
| **B6 — Frontend `/panel` (desacoplado)** | `T020`–`T022` | `11` | `~280–360` | Tier `2` (`T021`) | Sí |

### Pronóstico consolidado

| Dimension | Forecast | Why |
| --- | --- | --- |
| Estimated changed lines | `~1.260–1.560` (Bloques 1–5) · `~1.540–1.920` (Bloques 1–6) | Excede `400` líneas en entrega única; **debe integrarse por sub-bloque incremental** (`B1` → `B2` → `B3` → `B4` → `B5A` → `B5B`, y `B6` aparte) donde cada corte queda bajo `400` líneas y `12` archivos |
| Files / areas | `~29` backend + `11` frontend | Schema/migración (`0002`), plugins Fastify/CSRF, `SessionStore` Redis, middlewares `auth`/`auth-admin`, rutas `/api/auth/*` y `/api/admin/*`, tests TDD e isla `/panel` |
| Risk | Max Tier `2` · `11` tareas Tier 2 por `rsc risk` (`T002`, `T003`, `T008`–`T015`, `T021`) + `3` tareas elevadas por `REVIEW.md` (`T005`, `T017`, `T019`) | Cada tarea Tier 2 exige panel de 3 refuters (`correctness`, `security`, `tests`) y aprobación humana explícita |
| Suggested delivery | `ask-on-risk` por sub-bloque incremental | Alineado con `config.yaml` (`delivery_strategy.default: ask-on-risk`, `review_budget: 400 / 12`) |

---

```json result-envelope
{
  "status": "complete",
  "executive_summary": "Technical plan with 6 verifiable sub-blocks, 23 TDD tasks (T001-T023), exact per-task interfaces, and risk-calibrated review forecast appended.",
  "artifact": "02-DOCS/wiki/sdd/plans/auth-rbac-y-cuentas.md",
  "next_recommended": "analyze",
  "risk": "high",
  "skill_resolution": {
    "used": ["plan", "tasks"],
    "missing": [],
    "fallback": [],
    "compact_rules": [
      "The plan answers HOW; the spec owns WHAT.",
      "Every task needs a runnable done-check, a criterion trace and a risk forecast.",
      "Forecast review load before implementation and propose worktree isolation before code."
    ]
  },
  "evidence": [
    "plan file written at 02-DOCS/wiki/sdd/plans/auth-rbac-y-cuentas.md",
    "all 7 acceptance criteria and constitution P13-P18 mapped to T001-T023",
    "risk tiers computed via npx @ericrisco/rsc@4.1.8 risk",
    "each sub-block stays within <= 400 lines and <= 12 files"
  ]
}
```

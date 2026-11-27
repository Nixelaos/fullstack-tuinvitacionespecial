---
type: decision
title: Contratos HTTP y Arquitectura de Seguridad (Decidido)
description: Catálogo oficial de rutas, métodos, schemas Zod v4, códigos de error HTTP, deltas de esquema BD y arquitectura de seguridad decidida para la Fase 2 del backend.
tags: [sdd, api, security, contracts]
timestamp: 2026-11-20T11:25:00Z
topic: sdd
status: decided
---

# Contratos HTTP y Arquitectura de Seguridad

> Documento técnico de referencia para la Fase 2 del backend. Tanto el **Punto 1 (Contratos HTTP)** como el **Punto 2 (Seguridad)** están decididos e integrados con [constitution.md](./constitution.md) (`v1.0.0`) y las 4 specs ASDD.
> Fuente funcional original: [SDD HTML](../../../backend-tuinvitacionespecial/Spec-Driven%20Development%20%28SDD%29/T%C3%BA%20Invitaci%C3%B3n%20Especial%20Spec-Driven%20Development%204142fac3517e807a91d9d3ed20434feb.html) *(snapshot histórico congelado)*.

---

## Punto 1 — Catálogo de Contratos HTTP (Rutas, Métodos, Schemas y Errores) — **DECIDIDO**

### 1.1 Autenticación y Sesión (`/api/auth/*`)

| Método y Ruta | Protección | Propósito y Contrato clave |
|---|---|---|
| `GET /health` | Pública | *(Ya existe)* Estado PostgreSQL + Redis (`200` / `503`). |
| `POST /api/auth/google` | Pública + Rate Limit Redis | Recibe `{ idToken }`. Verifica firma RS256 (`verifyGoogleIdToken`), consulta `admins` y `accesos_autorizados` (`activo = true`). Si no es admin ni tiene bodas activas → `403`. Crea sesión en Redis (`session:<sid>`, TTL fijo `7` días / `604 800` s) + índice inverso `user_sessions:<email>` (revocación instantánea al desactivar `activo = false`) y emite cookie `HttpOnly; Secure; SameSite=Lax`. Devuelve `{ user, weddings[] }`. |
| `GET /api/auth/me` | Cookie `sid` | Devuelve `{ user, weddings[] }` vigentes. Si la sesión expiró o fue revocada → `401`. |
| `POST /api/auth/logout` | Cookie `sid` + CSRF | Borra `session:<sid>` y referencia en `user_sessions:<email>`, limpia cookie (`204`). |

### 1.2 SuperAdmin (`/api/admin/*`)

**Auth:** Cookie `sid` de usuario activo en `admins` (+ CSRF) o `x-api-key: MASTER_API_KEY` (comparación en tiempo constante; prefijo aislado por red/IP en Caddy en producción). En v1 se opera vía API/scripts.

| Método y Ruta | Propósito y Contrato clave |
|---|---|
| `GET /api/admin/weddings` | Lista bodas registradas. |
| `POST /api/admin/weddings` | Crea `novios` (`nombresPareja`, `slugPlantilla`, `fechaEvento?`, `rsvpDeadline`, `maxAccesos?` default `3` rango `1..10`, `maxInvitaciones?` default `1000`, `plantillaMensaje?`, `timezone?` default `'America/Santiago'`) validado contra `DB_LIMITS` (`201`). **Hallazgo técnico:** `novios.admin_id` es `NOT NULL` en BD; cuando se invoca con `MASTER_API_KEY` (sin sesión de admin), el body debe enviar `adminId` explícito o resolver un admin dueño por defecto. |
| `PATCH /api/admin/weddings/:noviosId` | Edita parámetros administrativos de la boda. Rechaza con `409` si reduce `maxAccesos` por debajo de accesos activos actuales o `maxInvitaciones` por debajo de familias actuales. |
| `GET /api/admin/weddings/:noviosId/accesses` | Lista `accesos_autorizados` de la boda. |
| `POST /api/admin/weddings/:noviosId/accesses` | Autoriza un correo Google normalizado (`BR-04` contando solo `activo = true` con `SELECT ... FOR UPDATE` sobre `novios`). `409` si alcanza `max_accesos` activos o correo repetido en la boda. |
| `PATCH /api/admin/weddings/:noviosId/accesses/:accessId` | Activa/desactiva `{ activo: boolean }`. Si pasa a `false`, libera cupo, conserva historial de auditoría y revoca al instante las sesiones Redis del correo vía `user_sessions:<email>`. |

### 1.3 Panel Novios — Pre-Envío y Distribución (`/api/weddings/:noviosId/*`)

**Auth:** Cookie `sid` + middleware `requireWeddingAccess(:noviosId)` (`BR-06` Anti-IDOR obligatorio en SQL) + CSRF en mutaciones.

| Método y Ruta | Propósito y Contrato clave |
|---|---|
| `GET /api/weddings/:noviosId/settings` | Datos visibles de la boda para novios (`nombresPareja`, `slugPlantilla`, `fechaEvento`, `rsvpDeadline`, `timezone`, `maxInvitaciones`, `plantillaMensaje`, conteo actual de familias). |
| `PATCH /api/weddings/:noviosId/message-template` | Actualiza solo `plantillaMensaje` (`<= 1000` chars). Asunto de correo fijo en v1 (`"¡Estás invitado a la boda de {nombres_pareja}!"`). Los novios nunca pueden modificar `rsvpDeadline`, `maxAccesos`, `maxInvitaciones` ni `slugPlantilla`. |
| `GET /api/weddings/:noviosId/families` | Lista `familias_invitadas` de la boda + estado/resumen de respuesta R.S.V.P. y **fechas de envío separadas por canal** (correo y WhatsApp). |
| `POST /api/weddings/:noviosId/families` | Alta individual validando `DB_LIMITS` (`email` opcional/`nullable` sin `UNIQUE`; teléfono saneado flexible `8..20` chars con `+` opcional) y cupo `max_invitaciones` (`<= 1000`) en transacción. Genera `token_enlace` (`slug <= 32` + `-` + `22` chars `crypto.randomBytes(16).toString('base64url')`, `<= 55` chars con 128 bits de entropía). |
| `PATCH /api/weddings/:noviosId/families/:familiaId` | Edita familia (`WHERE id = $1 AND novios_id = $2`). Aplica `BR-05` atómicamente: si nuevos pases `< cant_asistentes`, borra `respuestas_rsvp` (cascada borra `rsvp_menus`) y retorna `rsvpInvalidated: true`. |
| `PATCH /api/weddings/:noviosId/families/:familiaId/whatsapp-sent` | Registra o limpia la fecha de envío por WhatsApp de forma independiente a la de correo (usado en botón individual y en cola guiada Opción A `wa.me`). |
| `DELETE /api/weddings/:noviosId/families/:familiaId` | Elimina familia (`WHERE id = $1 AND novios_id = $2`, `204`). |
| `POST /api/weddings/:noviosId/invitations/batch` | Carga masiva atómica (`bodyLimit: 512 KiB`, array `1..1000`). Verifica `existentes + lote <= max_invitaciones` con `FOR UPDATE` sobre `novios` (`ROLLBACK` total ante fallo). Ruta con `:noviosId` explícito para evitar mezcla entre pestañas de planners. |
| `POST /api/weddings/:noviosId/invitations/send-emails` | Rate Limit estricto en Redis. Exige `{ confirmed: true }` y acepta `familyIds?: uuid[]`. Si se omite `familyIds`, preselecciona por defecto solo familias con `email IS NOT NULL` y fecha de envío por correo vacía (evita reenvíos accidentales; `familyIds` permite seleccionar subconjunto o reenviar). Encola en BullMQ con `Idempotency-Key` en Resend, responde `202 Accepted` y actualiza la fecha de envío por correo sin tocar la de WhatsApp. |

### 1.4 Panel Novios — Dashboard Post-Envío (`/api/weddings/:noviosId/dashboard/*`)

**Auth:** Cookie `sid` + `requireWeddingAccess(:noviosId)` (`BR-06`).

| Método y Ruta | Propósito y Contrato clave |
|---|---|
| `GET /api/weddings/:noviosId/dashboard` | Resumen ejecutivo devolviendo **personas/pases y familias** por categoría (Confirmados, Pendientes, No Asistirán —cuadrando cupos no usados de confirmaciones parciales— y Días Restantes según `America/Santiago` / `timezone`), desglose de los 5 `tipo_menu_enum`, alertas de alergias no vacías, canciones, muro de dedicatorias y tabla maestra (query opcional `?status=confirmed\|declined\|pending`). |
| `GET /api/weddings/:noviosId/dashboard/export` | Descarga **`.xlsx` nativo** con 2 hojas (`Resumen y Menús` y `Lista de Familias`), teléfonos como texto y neutralización obligatoria de Formula Injection (`=`, `+`, `-`, `@`). |
| `GET /api/weddings/:noviosId/dashboard/stream` | Canal SSE (`text/event-stream`) alimentado por Redis Pub/Sub (`wedding:<noviosId>:rsvp`) + heartbeats periódicos. |

### 1.5 Invitado Público (`/api/public/invitations/:token`)

**Auth:** Sin sesión (token opaco de alta entropía) + Rate Limit Redis por IP.

| Método y Ruta | Propósito y Contrato clave |
|---|---|
| `GET /api/public/invitations/:token` | Devuelve `wedding` (incluyendo `rsvpDeadlineIso` e `isDeadlinePassed` evaluado en servidor UTC / `America/Santiago`), `guest` y `existingResponse` — alineado 1:1 con `RsvpInitialState` de `rsvp.ts`. `404` genérico si no existe. |
| `PUT /api/public/invitations/:token/rsvp` | Upsert idempotente alineado con `RsvpSubmissionPayload` y `DB_LIMITS`. Bloquea fila con `FOR UPDATE`, valida `BR-03` (`403` si `now() > rsvp_deadline` en UTC) y `BR-01` (`422` si excede pases o `menus.length !== cantAsistentes`), hace Delete-Insert atómico de `rsvp_menus` y publica evento en Redis Pub/Sub tras `COMMIT`. |

### 1.6 Sobre de error estándar, `bodyLimit` y códigos HTTP

- **Formato único de error:** `{ "code": "SCREAMING_SNAKE_CASE", "message": "Mensaje claro en español", "details"?: ... }`
- **`bodyLimit` en Fastify:** `64 KiB` global y `512 KiB` exclusivo para `POST /api/weddings/:noviosId/invitations/batch`.
- **Códigos HTTP:**
  - `400`: error de esquema Zod o JSON inválido.
  - `401`: credenciales ausentes, sesión expirada/revocada o Google ID Token inválido.
  - `403`: correo fuera de lista blanca / `activo = false`, fallo de aislamiento `novios_id` (`BR-06`), fallo CSRF o plazo vencido `rsvp_deadline` (`BR-03`).
  - `404`: `token_enlace`, `novios_id` o `familia_id` inexistente.
  - `409`: `BR-04` (`max_accesos`), `max_invitaciones` alcanzado o correo duplicado en `accesos_autorizados`.
  - `413`: `bodyLimit` excedido.
  - `422`: `BR-01` (exceso de pases o cantidad de menús distinta a `cant_asistentes`).
  - `429`: Rate Limit excedido en Redis.

### 1.7 Deltas de esquema BD pendientes para la migración `0002` (en `plan`/`implement`)

*(No tocar la migración `0001_slim_doorman.sql` actual; aplicar estos 4 ajustes incrementales en la migración `0002` al iniciar `plan`/`implement`:)*

1. `novios.max_accesos`: subir valor por defecto de `2` a **`3`** (manteniendo `CHECK (1..10)`).
2. `familias_invitadas.email`: cambiar de `NOT NULL` a **`NULL` permitido**, manteniendo ausencia de `UNIQUE` por boda.
3. `familias_invitadas`: añadir columna separada para fecha de envío por WhatsApp (ej. `whatsapp_enviado_at timestamptz`) conservando independiente el envío por correo (`invitacion_enviada_at` o renombrado claro en `plan`).
4. `novios.timezone` *(opcional)*: `varchar(64) NOT NULL DEFAULT 'America/Santiago'`.

---

## Punto 2 — Recomendación de Seguridad ("Estándar de producción sin sobreingeniería") — **DECIDIDO**

Arquitectura aprobada el **2026-11-19** e incorporada en [constitution.md](./constitution.md) (principios 13–18) y [decisions.md](./decisions.md):

1. **[DECIDIDO — Camino B (2026-11-19)] Sesión Stateful en Redis + Cookie `HttpOnly` (TTL: 7 días / 604 800 s):**
   - El Google ID Token expira ~1 hora y almacenarlo en el navegador lo expone a XSS.
   - **Flujo aprobado:** El frontend envía el `id_token` **una sola vez** al endpoint de login. El backend lo valida con `verifyGoogleIdToken` (`src/lib/auth.ts`), resuelve rol y bodas activas en Postgres, genera un ID opaco criptográfico (`crypto.randomBytes(32)`), persiste la sesión en **Redis 8.0** con **TTL de 7 días (604 800 s)** y emite una cookie `HttpOnly; Secure; SameSite=Lax; Path=/`.
   - Permite revocación inmediata (al marcar `activo = false` o hacer logout) sin depender de la ventana de Google.
2. **[DECIDIDO (2026-11-19)] Protección CSRF ligera:**
   - Con Caddy enrutando frontend y `/api/*` bajo el mismo dominio, `SameSite=Lax` más validación estricta de `Origin`/`Referer` en métodos mutadores (`POST`, `PATCH`, `PUT`, `DELETE`) protege contra CSRF sin tokens complejos. (Si van en subdominios separados, evaluar double-submit token o BFF en Astro).
3. **[DECIDIDO (2026-11-19)] Aislamiento multi-tenant obligatorio en SQL (`BR-06` / Anti-IDOR):**
   - Nunca consultar ni mutar por `familiaId` aislado. Toda query del panel debe incluir `AND novios_id = $noviosId` validado desde la sesión del usuario para impedir ataques IDOR.
4. **[DECIDIDO (2026-11-19)] Rate Limiting en Redis (`@fastify/rate-limit`):**
   - Umbrales diferenciados sobre Redis 8.0 en:
     - Login Google (evita abuso de verificación).
     - Endpoints públicos por `token_enlace` (evita fuerza bruta de tokens o spam de envíos R.S.V.P.).
     - Disparo de correo masivo.
5. **[DECIDIDO (2026-11-19)] Hardening HTTP, `MASTER_API_KEY` y entropía de enlaces:**
   - Registrar `@fastify/helmet` y CORS restringido al origen exacto del frontend.
   - Restringir `MASTER_API_KEY` únicamente a `/api/admin/*` y bloquear ese prefijo al tráfico público o filtrarlo por red/IP en Caddy en producción.
   - Generar el sufijo aleatorio de `token_enlace` con `node:crypto` (alta entropía URL-safe) para impedir enumeración secuencial.

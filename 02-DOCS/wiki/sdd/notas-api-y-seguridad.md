---
type: note
title: Notas pendientes — Contratos HTTP y Arquitectura de Seguridad
description: Brechas técnicas detectadas al analizar el SDD funcional; diferidas para cerrarse en clarify/plan antes de implementar la Fase 2 del backend.
tags: [sdd, api, security, backlog]
timestamp: 2026-11-19T21:40:00Z
topic: sdd
status: deferred
---

# Notas Técnicas Diferidas: Contratos HTTP y Seguridad

> Documento puente generado tras el análisis del SDD funcional ([SDD HTML](../../../backend-tuinvitacionespecial/Spec-Driven%20Development%20%28SDD%29/T%C3%BA%20Invitaci%C3%B3n%20Especial%20Spec-Driven%20Development%204142fac3517e807a91d9d3ed20434feb.html)). Queda guardado para retomarse una vez ratificada la constitución y aprobadas las specs ASDD.

---

## Punto 1 — Catálogo de Contratos HTTP (Rutas, Métodos, Schemas y Errores)

El SDD funcional solo nombra explícitamente `POST /api/invitations/batch`. Antes de pasar a `implement`, hay que cerrar el contrato exacto en Fastify + Zod (`fastify-type-provider-zod`) para cada bloque:

### 1.1 Rutas y métodos por definir

- **Autenticación y sesión:**
  - Intercambio de Google ID Token por sesión (`POST /api/auth/google` o equivalente).
  - Consulta de sesión actual y lista de bodas activas (`GET /api/auth/me` / selector multi-boda).
  - Cierre de sesión (`POST /api/auth/logout`).
- **SuperAdmin (`/api/admin/*`):**
  - Alta / gestión de `admins` (opcional o vía seed/API).
  - Creación y actualización de cuentas `novios` (`rsvp_deadline`, `fecha_evento`, `max_accesos`, `slug_plantilla`).
  - Alta, activación/desactivación y listado de `accesos_autorizados` respetando `max_accesos` (`BR-04`).
- **Panel Novios Pre-Envío (con scope por `novios_id`, `BR-06`):**
  - Lectura y actualización de `plantilla_mensaje`.
  - CRUD individual de `familias_invitadas` (validación `BR-05` al reducir pases).
  - Carga masiva atómica: `POST /api/invitations/batch`.
  - Disparo de envío masivo por correo (`POST` hacia cola BullMQ + Resend).
- **Panel Novios Post-Envío / Dashboard (con scope por `novios_id`, `BR-06`):**
  - Resumen ejecutivo, desglose de menús, alertas de alergias, canciones, muro de mensajes y tabla maestra filtrable.
  - Exportación CSV (si se genera en backend o se consume desde datos estructurados).
  - Canal en tiempo real (SSE `GET /api/.../stream` respaldado por Redis Pub/Sub).
- **Invitado Público (`token_enlace`):**
  - Lectura de invitación y estado R.S.V.P. actual + vigencia de `rsvp_deadline`.
  - Creación / actualización idempotente de respuesta R.S.V.P. (`BR-01`, `BR-03`).

### 1.2 Schemas Request / Response y Errores

- Definir esquemas Zod v4 compartibles/documentables para `params`, `query`, `body` y respuestas `200`/`201`.
- Estandarizar un sobre de error uniforme (`{ code, message, details? }`) y el mapeo exacto de códigos HTTP:
  - `400` / `422`: error de validación de contrato Zod o regla `BR-01` (exceso de pases, cantidad de menús distinta a `cant_asistentes`).
  - `401`: credenciales ausentes, sesión expirada o Google ID Token inválido.
  - `403`: correo fuera de lista blanca / `activo = false`, fallo de aislamiento `novios_id` (`BR-06`), o plazo vencido `rsvp_deadline` (`BR-03` — evaluar `403` vs `410`/`422`).
  - `404`: `token_enlace`, `novios_id` o `familia_id` inexistente.
  - `409`: duplicado de correo en la misma boda o límite `max_accesos` alcanzado (`BR-04`).

---

## Punto 2 — Recomendación de Seguridad ("Estándar de producción sin sobreingeniería")

Arquitectura alineada con el stack existente (Fastify 5 + Redis 8.0 + PostgreSQL 18.7 + Astro/React + Caddy):

1. **Sesión Stateful en Redis + Cookie `HttpOnly` (evitar Google ID Token en `localStorage`):**
   - El Google ID Token expira ~1 hora y almacenarlo en el navegador lo expone a XSS.
   - **Flujo recomendado:** El frontend envía el `id_token` **una sola vez** al endpoint de login. El backend lo valida con `verifyGoogleIdToken` (`src/lib/auth.ts`), resuelve rol y bodas activas en Postgres, genera un ID opaco criptográfico (`crypto.randomBytes(32)`), persiste la sesión en **Redis 8.0** con TTL (ej. 7 días) y emite una cookie `HttpOnly; Secure; SameSite=Lax; Path=/`.
   - Permite revocación inmediata (al marcar `activo = false` o hacer logout) sin depender de la ventana de Google.
2. **Protección CSRF ligera:**
   - Con Caddy enrutando frontend y `/api/*` bajo el mismo dominio, `SameSite=Lax` más validación estricta de `Origin`/`Referer` en métodos mutadores (`POST`, `PATCH`, `PUT`, `DELETE`) protege contra CSRF sin tokens complejos. (Si van en subdominios separados, evaluar double-submit token o BFF en Astro).
3. **Aislamiento multi-tenant obligatorio en SQL (`BR-06`):**
   - Nunca consultar ni mutar por `familiaId` aislado. Toda query del panel debe incluir `AND novios_id = $noviosId` validado desde la sesión del usuario para impedir ataques IDOR.
4. **Rate Limiting en Redis (`@fastify/rate-limit`):**
   - Umbrales diferenciados sobre Redis 8.0 en:
     - Login Google (evita abuso de verificación).
     - Endpoints públicos por `token_enlace` (evita fuerza bruta de tokens o spam de envíos R.S.V.P.).
     - Disparo de correo masivo.
5. **Hardening HTTP, `MASTER_API_KEY` y entropía de enlaces:**
   - Registrar `@fastify/helmet` y CORS restringido al origen exacto del frontend.
   - Restringir `MASTER_API_KEY` únicamente a `/api/admin/*` y bloquear ese prefijo al tráfico público o filtrarlo por red/IP en Caddy en producción.
   - Generar el sufijo aleatorio de `token_enlace` con `node:crypto` (alta entropía URL-safe) para impedir enumeración secuencial.

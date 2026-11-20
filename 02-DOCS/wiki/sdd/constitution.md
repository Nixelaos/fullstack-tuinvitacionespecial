---
type: constitution
title: tuinvitacionespecial — Constitution
description: Principios innegociables del proyecto derivados del SDD funcional y la configuración real del monorepo.
tags: [sdd, constitution]
timestamp: 2026-11-20T11:25:00Z
topic: sdd
version: v1.0.0
ratified: 2026-11-20
---

# tuinvitacionespecial — Constitution

> **Constitución ratificada (`v1.0.0`, 2026-11-20)** junto con [REVIEW.md](../../../REVIEW.md). Toda modificación futura sigue el protocolo append-only del Amendment log.
> Fuente funcional de origen: [SDD Funcional HTML](../../../backend-tuinvitacionespecial/Spec-Driven%20Development%20%28SDD%29/T%C3%BA%20Invitaci%C3%B3n%20Especial%20Spec-Driven%20Development%204142fac3517e807a91d9d3ed20434feb.html) *(snapshot histórico congelado)*.

## Known facts (from onboarding)

- Goal: Vender invitaciones de boda digitales creadas con imaginación y soluciones de organización para novios (R.S.V.P., gestión de mesas, etc.).
- Project kind: software · software scope: growing.
- How code changes land: straight on the default branch (`--workflow main`).

## 1. Stack canon

1. **Runtime y lenguaje backend:** Node.js `>=26.0.0` con ejecución nativa de TypeScript (`7.0.2`, `erasableSyntaxOnly` y `verbatimModuleSyntax` activos). Fijado en [backend package.json](../../../backend-tuinvitacionespecial/package.json) y [tsconfig.json](../../../backend-tuinvitacionespecial/tsconfig.json).
2. **Frameworks y librerías backend cerradas:** Fastify v5 + Zod v4 (`fastify-type-provider-zod`), PostgreSQL 18.7 (`uuidv7()` nativo) con Drizzle ORM `0.45.4`, Redis 8.0 con BullMQ `6.7.0` e `ioredis`, y `resend` `6.38.0` para correo transaccional. Cambiar una pieza mayor requiere enmienda `MAJOR`.
3. **Frontend fijo:** Astro 5 (`Islands Architecture`) + React 18 + Tailwind CSS 3.4 + TypeScript `5.7.x`. Fijado en [frontend package.json](../../../frontend-tuinvitacionespecial/package.json).
4. **Gestor de paquetes y despliegue objetivo:** `npm` con `package-lock.json` versionado por paquete, contenedorizado sobre Docker y proxy inverso Caddy en `linux/arm64` (Ubuntu 22.04 LTS).

## 2. Quality bar

5. **Chequeo estricto de tipos antes de integrar:** Todo cambio en backend pasa `npm run build` (`tsc --noEmit`) y en frontend pasa `npx tsc --noEmit` y `npm run build` (`astro build`) con `0` errores.
6. **Pruebas obligatorias por cambio:** Toda regla de negocio, validación Zod, hook RBAC, transacción SQL o utilidad pura de dominio (backend y frontend, vía `npm test` / `node --test`) lleva tests automatizados; ningún cambio entra con tests en rojo.
7. **Integridad esquema–migración:** El código de [schema.ts](../../../backend-tuinvitacionespecial/src/db/schema.ts) y las migraciones SQL en [drizzle/](../../../backend-tuinvitacionespecial/drizzle/) deben permanecer sincronizados mediante `drizzle-kit` y reflejar restricciones (`CHECK`, `UNIQUE`, `FK`, índices) en la base de datos, no solo en memoria.

## 3. Conventions

8. **Contratos Zod como única fuente de verdad:** Toda entrada y salida HTTP del backend se valida y serializa con esquemas Zod v4 mediante `fastify-type-provider-zod`; correos electrónicos se normalizan con `.trim().toLowerCase()`.
9. **Consistencia transaccional de dominio:** Las cargas masivas de invitados y las escrituras de confirmación R.S.V.P. (bloqueo de fila / serialización y reemplazo Delete-Insert de menús) se ejecutan en transacciones ACID atómicas.
10. **Separación de responsabilidades en monorepo y frontend multi-plantilla:** La presentación, utilidades de parseo en cliente y capa lógica reutilizable de R.S.V.P. viven en `frontend-tuinvitacionespecial/`, separando la **capa lógica 100% global** (`src/types/rsvp.ts`, `src/data/rsvpDefaults.ts`, `src/utils/rsvpUtils.ts`, `src/hooks/useInvitationParams.ts`, `src/hooks/useRsvpForm.ts`, `src/hooks/useModal.ts`, `src/hooks/useRsvp.ts`, con contrato `RsvpAdapter` demo/API y flags `RsvpFeatureFlags`) de la **capa visual aislada por plantilla** (`src/components/<plantilla>/`); la autoridad de reglas de negocio, RBAC, persistencia y colas viven en `backend-tuinvitacionespecial/`.

## 4. Branching & shipping

11. **Flujo en rama principal (vigente por onboarding):** El trabajo aterriza en la rama por defecto (`--workflow main`), manteniendo commits atómicos y verificados localmente antes de integrarse.
12. **La autoría Git es humana:** Todos los commits y PRs llevan al usuario Git responsable como autor; queda prohibido añadir `Co-Authored-By` de IA o pies de generación automática (verificado en `ship`).

## 5. Security & privacy floor

13. **Cero secretos en el repositorio:** Ninguna clave (`MASTER_API_KEY`, `RESEND_API_KEY`, credenciales DB/Google) se versiona; se cargan desde archivos `.env` ignorados por Git (referencia en [.env.example](../../../backend-tuinvitacionespecial/.env.example)).
14. **Sesión revocable en Redis con cookie `HttpOnly` y TTL de 7 días (Camino B):** La identidad de Google (JWT) se verifica criptográficamente una sola vez al iniciar sesión para generar un token opaco (`crypto.randomBytes(32)`) guardado en **Redis 8.0** con **TTL de 7 días (604 800 s)** y emitido mediante cookie `HttpOnly; Secure; SameSite=Lax`; queda prohibido almacenar tokens en `localStorage` o `sessionStorage`, y la sesión debe revocarse al instante en logout o al marcar `activo = false`.
15. **Aislamiento estricto por cuenta y Anti-IDOR (`BR-06`):** Toda ruta del panel exige acceso `activo = true` para el `novios_id` solicitado y filtra explícitamente en SQL por el `novios_id` autorizado en la sesión (`WHERE id = $id AND novios_id = $noviosId`), prohibiendo consultas por ID aislado; las operaciones de SuperAdmin exigen lista blanca en `admins` o `MASTER_API_KEY` validada en tiempo constante.
16. **Protección CSRF en mutaciones con cookies:** Además de `SameSite=Lax`, toda petición HTTP mutadora autenticada por cookie (`POST`, `PATCH`, `PUT`, `DELETE`) valida estrictamente las cabeceras `Origin`/`Referer` contra el dominio oficial del frontend.
17. **Enlaces públicos de alta entropía y Rate Limiting en Redis:** Los `token_enlace` se generan con aleatoriedad criptográfica (`node:crypto`), bloqueando mutaciones tras vencer `rsvp_deadline` (`BR-03`), y la API aplica limitación de tasa en Redis (`@fastify/rate-limit`) sobre el login de Google, las rutas públicas de R.S.V.P. y el disparo de envíos masivos.
18. **Blindaje perimetral HTTP, CORS, `MASTER_API_KEY`, cotas y exportaciones:** La API aplica cabeceras de seguridad mediante `@fastify/helmet`, restringe CORS exclusivamente al dominio oficial del frontend, aplica `bodyLimit` estricto en Fastify (`64 KiB` global y `512 KiB` exclusivo para el endpoint `batch`), hace cumplir en BD y Zod las cotas de `DB_LIMITS` y `novios.max_familias <= 1000` (prohibiendo nuevas columnas `TEXT`/`INTEGER` sin cota), neutraliza CSV/Spreadsheet Formula Injection (`=`, `+`, `-`, `@`) en toda exportación tabular (`.xlsx`/`.csv`) y acota `MASTER_API_KEY` únicamente a rutas administrativas (`/api/admin/*`, protegidas por red/IP en proxy en producción).

## 6. UX / accessibility floor

19. **Usabilidad tolerante para usuarios no técnicos:** La importación masiva (`.xlsx`/`.csv`) valida en cliente antes de confirmar, soporta codificación UTF-8 y Windows-1252 con delimitadores `,`/`;`, ofrece edición en celda y nunca falla de forma opaca.
20. **Invitación accesible y móvil primero:** Los flujos públicos de invitación, modales (`useModal` con focus trap `Tab`/`Shift+Tab`, `Escape` y restauración de foco) y formularios R.S.V.P. (`radiogroup` con flechas y roving `tabIndex`) deben operar en dispositivos móviles con foco visible, navegación por teclado y estados de error claros (`role="alert"`) y en español.

## 7. Performance budgets

21. **Asincronía en envíos masivos:** El despacho de correos masivos nunca bloquea el hilo HTTP de Fastify; se encola en BullMQ con rate-limiting y clave de idempotencia en Resend.
22. **Consultas indexadas:** Toda clave foránea y filtro frecuente de panel/OAuth mantiene índice B-Tree en PostgreSQL.

## 8. Knowledge & decisions

23. **Registro continuo de decisiones:** Toda decisión arquitectónica, cambio de contrato o excepción de riesgo se registra con fecha, alternativas y motivo en [decisions.md](./decisions.md).

## Definition of Done (umbral de verificación en `verify`)

Una funcionalidad o cambio queda terminado solo cuando cumple **todos** estos puntos:

- [ ] Chequeo de tipos limpio (`tsc --noEmit` en backend; `npx tsc --noEmit` y `astro build` si toca frontend) (principio 5).
- [ ] Tests automatizados verdes (`npm test` / `node --test` en backend y frontend cuando aplique) cubriendo casos válidos, límites (`BR-01`–`BR-06`) y errores (principio 6).
- [ ] Esquema Drizzle y migraciones SQL alineados si hubo cambios de datos (principio 7).
- [ ] Contratos HTTP validados con Zod y transacciones ACID aplicadas en mutaciones críticas (principios 8–9).
- [ ] Sin secretos expuestos, sesión revocable, anti-IDOR, CSRF, rate limiting y cabeceras HTTP verificadas (principios 13–18).
- [ ] Revisión completada según [REVIEW.md](../../../REVIEW.md) (incluyendo aprobación humana en cambios Tier 2).
- [ ] Decisiones relevantes anotadas en [decisions.md](./decisions.md) y autoría Git humana respetada (principios 12, 23).

## Amendment log (append-only)

| Date | Version | Change | Why |
|------|---------|--------|-----|
| 2026-11-19 | draft | Draft generated by `rsc onboard`. | The SDD floor needs a constitution; ratification is the `constitution` phase's. |
| 2026-11-19 | draft | Populated principles from functional SDD and monorepo config; pending user ratification. | Bridge business SDD into ASDD base rules before writing plans and code. |
| 2026-11-19 | draft | Added global frontend RSVP logic/visual boundary (P10), modal/radiogroup a11y floor (P20), and frontend `tsc`/`node --test` gates (P5–P6). | Sync constitution draft with the global RSVP architecture and `useModal` refactor in `frontend-tuinvitacionespecial/`. |
| 2026-11-19 | draft | Fixed 7-day Redis session TTL (Camino B) and added security floor pieces 1–4 (CSRF, Anti-IDOR, Rate Limiting, Helmet/CORS/Admin isolation). | User approved security posture before ratification. |
| 2026-11-20 | v1.0.0 | Ratified constitution v1.0.0 alongside REVIEW.md; expanded P18 with Fastify bodyLimit, DB_LIMITS/max_familias <= 1000, and Formula Injection neutralization. | Explicit user ratification after closing security, DB limits, and export hardening. |

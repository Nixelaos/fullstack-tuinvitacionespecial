---
type: constitution
title: tuinvitacionespecial — Constitution
description: Principios innegociables del proyecto derivados del SDD funcional y la configuración real del monorepo (borrador pendiente de ratificación).
tags: [sdd, constitution]
timestamp: 2026-11-19T21:40:00Z
topic: sdd
status: draft
version: draft
---

# tuinvitacionespecial — Constitution

> **Borrador pendiente de ratificación explícita.** Reemplaza el esqueleto inicial de `rsc onboard`. Al aprobarlo, retira `status: draft`, fija `version: v1.0.0` y registra la ratificación en el Amendment log.
> Fuente funcional de origen: [SDD Funcional HTML](../../../backend-tuinvitacionespecial/Spec-Driven%20Development%20%28SDD%29/T%C3%BA%20Invitaci%C3%B3n%20Especial%20Spec-Driven%20Development%204142fac3517e807a91d9d3ed20434feb.html).

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

5. **Chequeo estricto de tipos antes de integrar:** Todo cambio en backend pasa `npm run build` (`tsc --noEmit`) y en frontend `npm run build` (`astro build`) con `0` errores.
6. **Pruebas obligatorias por cambio:** Toda regla de negocio, validación Zod, hook RBAC o transacción SQL lleva tests automatizados (`node --test` en backend); ningún cambio entra con tests en rojo.
7. **Integridad esquema–migración:** El código de [schema.ts](../../../backend-tuinvitacionespecial/src/db/schema.ts) y las migraciones SQL en [drizzle/](../../../backend-tuinvitacionespecial/drizzle/) deben permanecer sincronizados mediante `drizzle-kit` y reflejar restricciones (`CHECK`, `UNIQUE`, `FK`, índices) en la base de datos, no solo en memoria.

## 3. Conventions

8. **Contratos Zod como única fuente de verdad:** Toda entrada y salida HTTP del backend se valida y serializa con esquemas Zod v4 mediante `fastify-type-provider-zod`; correos electrónicos se normalizan con `.trim().toLowerCase()`.
9. **Consistencia transaccional de dominio:** Las cargas masivas de invitados y las escrituras de confirmación R.S.V.P. (bloqueo de fila / serialización y reemplazo Delete-Insert de menús) se ejecutan en transacciones ACID atómicas.
10. **Separación de responsabilidades en monorepo:** La presentación y utilidades de parseo de hojas de cálculo en cliente viven en `frontend-tuinvitacionespecial/`; la lógica de negocio, autoridad RBAC, persistencia y colas viven en `backend-tuinvitacionespecial/`.

## 4. Branching & shipping

11. **Flujo en rama principal (vigente por onboarding):** El trabajo aterriza en la rama por defecto (`--workflow main`), manteniendo commits atómicos y verificados localmente antes de integrarse.
12. **La autoría Git es humana:** Todos los commits y PRs llevan al usuario Git responsable como autor; queda prohibido añadir `Co-Authored-By` de IA o pies de generación automática (verificado en `ship`).

## 5. Security & privacy floor

13. **Cero secretos en el repositorio:** Ninguna clave (`MASTER_API_KEY`, `RESEND_API_KEY`, credenciales DB/Google) se versiona; se cargan desde archivos `.env` ignorados por Git (referencia en [.env.example](../../../backend-tuinvitacionespecial/.env.example)).
14. **Aislamiento estricto por cuenta (`BR-06`) y verificación criptográfica:** Toda ruta del panel de novios exige identidad Google autenticada con `activo = true` para el `novios_id` solicitado y filtra explícitamente por `novios_id` en base de datos; las operaciones de SuperAdmin exigen lista blanca en `admins` o `MASTER_API_KEY` validada en tiempo constante.
15. **Privacidad de enlaces públicos:** El acceso público del invitado se limita al ámbito de su `token_enlace` único de alta entropía y bloquea mutaciones tras vencer `rsvp_deadline` (`BR-03`).

## 6. UX / accessibility floor

16. **Usabilidad tolerante para usuarios no técnicos:** La importación masiva (`.xlsx`/`.csv`) valida en cliente antes de confirmar, soporta codificación UTF-8 y Windows-1252 con delimitadores `,`/`;`, ofrece edición en celda y nunca falla de forma opaca.
17. **Invitación accesible y móvil primero:** Los flujos públicos de invitación y R.S.V.P. deben operar en dispositivos móviles con foco visible, navegación por teclado y estados de error claros y en español.

## 7. Performance budgets

18. **Asincronía en envíos masivos:** El despacho de correos masivos nunca bloquea el hilo HTTP de Fastify; se encola en BullMQ con rate-limiting y clave de idempotencia en Resend.
19. **Consultas indexadas:** Toda clave foránea y filtro frecuente de panel/OAuth mantiene índice B-Tree en PostgreSQL.

## 8. Knowledge & decisions

20. **Registro continuo de decisiones:** Toda decisión arquitectónica, cambio de contrato o excepción de riesgo se registra con fecha, alternativas y motivo en [decisions.md](./decisions.md).

## Definition of Done (umbral de verificación en `verify`)

Una funcionalidad o cambio queda terminado solo cuando cumple **todos** estos puntos:

- [ ] Chequeo de tipos limpio (`tsc --noEmit` en backend y `astro build` si toca frontend) (principio 5).
- [ ] Tests automatizados verdes cubriendo casos válidos, límites (`BR-01`–`BR-06`) y errores (principio 6).
- [ ] Esquema Drizzle y migraciones SQL alineados si hubo cambios de datos (principio 7).
- [ ] Contratos HTTP validados con Zod y transacciones ACID aplicadas en mutaciones críticas (principios 8–9).
- [ ] Sin secretos expuestos y con validación RBAC / aislamiento por `novios_id` verificado (principios 13–15).
- [ ] Revisión completada según [REVIEW.md](../../../REVIEW.md) (incluyendo aprobación humana en cambios Tier 2).
- [ ] Decisiones relevantes anotadas en [decisions.md](./decisions.md) y autoría Git humana respetada (principios 12, 20).

## Amendment log (append-only)

| Date | Version | Change | Why |
|------|---------|--------|-----|
| 2026-11-19 | draft | Draft generated by `rsc onboard`. | The SDD floor needs a constitution; ratification is the `constitution` phase's. |
| 2026-11-19 | draft | Populated principles from functional SDD and monorepo config; pending user ratification. | Bridge business SDD into ASDD base rules before writing plans and code. |

---
type: progress
title: Progreso de Implementación — auth-rbac-y-cuentas
description: Registro persistente por micro-cortes (C1–C9) y cola de decisiones para retomar la Etapa 4 entre sesiones sin perder contexto.
tags: [sdd, progress, auth, rbac]
timestamp: 2026-11-20T13:47:00Z
topic: sdd
slug: auth-rbac-y-cuentas
status: in-progress
---

# Progreso — `auth-rbac-y-cuentas`

> **Spec:** [../specs/auth-rbac-y-cuentas.md](../specs/auth-rbac-y-cuentas.md) (`approved`) · **Plan & Tasks:** [../plans/auth-rbac-y-cuentas.md](../plans/auth-rbac-y-cuentas.md) · **Analyze:** [../analysis/auth-rbac-y-cuentas.md](../analysis/auth-rbac-y-cuentas.md) (`GATE: PASS`)

## Cómo retomar en otra sesión

Para continuar este desarrollo en cualquier sesión futura, indica únicamente:

> *"Continúa `auth-rbac-y-cuentas` en el siguiente micro-corte pendiente."*

Regla de trabajo por micro-corte:
1. Ejecutar `Red → Green` solo para el siguiente micro-corte marcado `[ ]`.
2. Correr verificación (`npm run build && npm test` en backend; más `npx tsc --noEmit && npm run build` si toca frontend) y pasar auto-revisión interna contra [REVIEW.md](../../../REVIEW.md).
3. Pausar y entregar al usuario la **Ficha de revisión de 5 minutos** (separando lógica real, tests y archivos generados) antes de pasar al siguiente corte.

---

## Micro-cortes (`C1`–`C9` + Cierre `T023`)

- [x] **C1 (`T001`–`T002` — Tier 2):** Migración BD `0002`, `schema.ts`, `DB_LIMITS`, `MD-PostgreeSQL.sql` y `schema.test.ts` *(~40 líneas de lógica real)*.
- [ ] **C2 (`T003`–`T005` — Tier 2):** Plugins Fastify en `package.json`, `env.ts`, `.env.example`, `src/lib/errors.ts` y `src/middleware/csrf.ts` *(~130 líneas de lógica real)*.
- [ ] **C3 (`T006`–`T007` — Tier 1):** Cableado perimetral en `src/app.ts` (`helmet`, `cors`, `cookie`, `rate-limit`, `bodyLimit`, redacción logs, DI) *(~100 líneas de lógica real)*.
- [ ] **C4 (`T008`–`T009` — Tier 2):** Motor de sesiones stateful Redis `src/lib/session.ts` (`session:<sid>`, `user_sessions:<email>`, TTL `604 800` s, cookies) *(~110 líneas de lógica real)*.
- [ ] **C5 (`T010`–`T011` — Tier 2):** Servicio `src/services/authAccess.ts` y middlewares `requireAuth` / `requireWeddingAccess` (`BR-06`) en `src/middleware/auth.ts` *(~100 líneas de lógica real)*.
- [ ] **C6 (`T012`–`T013` — Tier 2):** Endpoints `POST /api/auth/google`, `GET /api/auth/me` y `POST /api/auth/logout` *(~140 líneas de lógica real)*.
- [ ] **C7 (`T014`–`T017` — Tier 2):** Guard dual `requireSuperAdmin` (`src/middleware/auth-admin.ts`) y rutas `GET/POST/PATCH /api/admin/weddings` *(~180 líneas de lógica real)*.
- [ ] **C8 (`T018`–`T019` — Tier 2 por REVIEW.md):** Rutas `GET/POST/PATCH /api/admin/weddings/:noviosId/accesses` (`BR-04` `FOR UPDATE` + revocación post-commit Redis) *(~130 líneas de lógica real)*.
- [ ] **C9 (`T020`–`T022` — Tier 2 / Opcional según decisión):** Frontend ingreso Google y selector multi-boda en `/panel` *(~220 líneas de lógica real)*.
- [ ] **Cierre (`T023`):** Verificación integral sobre PostgreSQL `18.7` y Redis `8.0` reales (migración `0002`, concurrencia `BR-04`, rate limit, builds completos y aprobación final Tier 2).

---

## Decision queue

*(Vacía al cierre de Etapa 3; registrar aquí ítems `[blocking]` y `[review-after]` que aparezcan durante la Etapa 4).*

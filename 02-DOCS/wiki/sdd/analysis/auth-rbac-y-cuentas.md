---
type: analysis
title: Análisis de Consistencia — auth-rbac-y-cuentas
description: Compuerta pre-implementación cruzando constitution v1.0.0, REVIEW.md, notas-api-y-seguridad.md, spec, plan y tareas T001–T023.
tags: [sdd, analyze, auth, rbac]
timestamp: 2026-11-20T13:35:00Z
topic: sdd
slug: auth-rbac-y-cuentas
verdict: PASS
---

# Análisis de Consistencia — `auth-rbac-y-cuentas`

> **Veredicto:** `GATE: PASS (0 CRITICAL, 0 HIGH, 3 MEDIUM, 3 LOW)`
> **Fecha:** 2026-11-20 · **Artefactos auditados:** [constitution.md](../constitution.md) (`v1.0.0`), [REVIEW.md](../../../REVIEW.md) (`v1.0.0`), [notas-api-y-seguridad.md](../notas-api-y-seguridad.md), [specs/auth-rbac-y-cuentas.md](../specs/auth-rbac-y-cuentas.md) (`approved`), [plans/auth-rbac-y-cuentas.md](../plans/auth-rbac-y-cuentas.md) (incluyendo `## Tasks` `T001`–`T023` y `## Review Workload Forecast`).

---

## 1. Cobertura de requisitos (`spec` → `plan` → `tasks`)

| REQ-ID | Requisito en spec / piso constitucional | Sección en Plan | Tareas | Estado |
| --- | --- | --- | --- | --- |
| `AC1` | `max_accesos` default `3`; rechaza 4.º acceso activo sin ampliar cupo (`BR-04`) | §0, §3 (B1, B5), §4 | `T001`, `T002`, `T016`, `T017`, `T018`, `T019`, `T023` | `covered` |
| `AC2` | Desactivar acceso (`activo = false`) libera cupo, bloquea correo e intacta historial | §3 (B3, B5), §4 | `T008`, `T009`, `T018`, `T019`, `T023` | `covered` |
| `AC3` | Planner en `>= 2` bodas entra a selector; `1` boda entra directo sin re-login | §3 (B4, B6), §4 | `T012`, `T013`, `T020`, `T021`, `T022` | `covered` |
| `AC4` | Usuario Boda A bloqueado al leer/mutar Boda B (`BR-06` Anti-IDOR en SQL) | §0, §3 (B4), §4 | `T010`, `T011`, `T023` | `covered` |
| `AC5` | Usuario Google con `0` bodas activas o inactivo recibe rechazo explícito | §3 (B4, B6), §4 | `T012`, `T013`, `T020`, `T021`, `T022` | `covered` |
| `AC6` | Novio autenticado rechazado si intenta mutar `rsvp_deadline` o `max_accesos` | §0, §3 (B5) | `T014`, `T015`, `T016`, `T017` | `covered` |
| `AC7` | Logout o `activo = false` revoca sesión Redis al instante sin esperar Google JWT | §0, §3 (B3, B4, B5), §4 | `T008`, `T009`, `T012`, `T013`, `T018`, `T019`, `T023` | `covered` |
| `R8` | Blindaje HTTP (`helmet`, CORS, `cookie`, `rate-limit` Redis, CSRF, `bodyLimit`, error envelope) | §0, §3 (B2) | `T003`, `T004`, `T005`, `T006`, `T007`, `T023` | `covered` |
| `R9` | Casos borde: correo normalizado, único por boda, auditoría admin, `fecha_evento` nullable en selector | §0, §3 (B4–B6) | `T013`, `T017`, `T019`, `T020`, `T022` | `covered` |
| `D1` | Deltas migración `0002` (`email` nullable, `whatsapp_enviado_at`, `novios.timezone`) | §0, §1, §3 (B1), §4 | `T001`, `T002` | `DRIFT controlado (autorizado)` |

---

## 2. Evaluación por las 6 dimensiones de `analyze`

1. **Cumplimiento constitucional (`constitution.md` `v1.0.0`):** `PASS` (`0 CRITICAL`, `0 HIGH`). Stack cerrado respetado (`Node >=26`, `TypeScript 7.0.2` con `erasableSyntaxOnly` y `verbatimModuleSyntax`, Fastify v5 + Zod v4, Drizzle `0.45.4`, PostgreSQL `18.7`, Redis `8.0`, Astro 5 + React 18). Sesión stateful Camino B (`604 800` s + `user_sessions:<email>` + cookie `HttpOnly; SameSite=Lax; Secure`), CSRF `Origin`/`Referer`, Anti-IDOR SQL, `MASTER_API_KEY` en tiempo constante acotada a `/api/admin/*`, `bodyLimit` `64 KiB` / `512 KiB`, `DB_LIMITS` y `strict_tdd: true` quedan reflejados con valores literales en `§0`.
2. **Cobertura de requisitos (`spec` → `plan` → `tasks`):** `100 %` cubierta (`0 GAP`). Cada criterio `AC1`–`AC7` y caso borde trazan a una sección de diseño, una prueba TDD fallida (`Red`), su implementación (`Green`) y una verificación real contra PostgreSQL `18.7` y Redis `8.0` (`T023`).
3. **Deriva de alcance (*Scope drift*):** Un único `DRIFT` consciente (`F-01`, `MEDIUM`): la consolidación en la migración `0002` (`T001`–`T002`) de columnas pertenecientes a specs hermanas (`familias_invitadas.email` nullable, `whatsapp_enviado_at`, `novios.timezone`), autorizada en [decisions.md](../decisions.md), [notas-api-y-seguridad.md](../notas-api-y-seguridad.md) §1.7 y en el desglose aprobado para esta etapa.
4. **Contradicciones:** `0 CRITICAL`, `0 HIGH`. Dos condiciones operativas de severidad `MEDIUM` (`F-02` sobre el corte opcional de Bloque 6 y `F-03` sobre la clasificación automatizada de `rsc risk` frente a `REVIEW.md`).
5. **Duplicación:** `F-05` (`LOW`) — los puntos resueltos de la spec en `§Points to clarify` conviven con el detalle completo en `notas-api-y-seguridad.md` y hacen que `rsc spec gate` reporte `5 open point(s), 0 typed` en formato texto heredado (aunque devuelve `PASS`).
6. **Ambigüedad y completitud para implementadores aislados (*Carrier completeness*):** `PASS`. El plan incluye `§0. Global Constraints` con todos los valores exactos verificables y `### Per-task Interfaces` detalla `Consumes` / `Produces` con rutas, códigos HTTP, claves Redis y esquemas exactos para todas las tareas no triviales (`T002`, `T003`, `T005`, `T007`, `T009`, `T011`, `T013`, `T015`, `T017`, `T019`, `T021`, `T022`). Solo resta registrar 3 refinamientos tácticos en `decisions.md` (`F-06`, `LOW`).

---

## 3. Tabla de hallazgos

| # | Severity | Type | Artifact A (loc) | Artifact B (loc) | Conflict / Observation | Resolve in (phase) |
| --- | --- | --- | --- | --- | --- | --- |
| `F-01` | `MEDIUM` | `DRIFT` | [specs/auth-rbac-y-cuentas.md](../specs/auth-rbac-y-cuentas.md) (`§What it must respect`) | [plans/auth-rbac-y-cuentas.md](../plans/auth-rbac-y-cuentas.md) (`§4`, `T001`–`T002`) | La migración `0002` incluye `familias_invitadas.email` nullable, `whatsapp_enviado_at` y `novios.timezone`, usados por las specs hermanas. *Trade-off:* aceptado explícitamente en `decisions.md` y `notas-api-y-seguridad.md §1.7` para evitar 3 migraciones separadas sin riesgo para `auth-rbac-y-cuentas`. | Consciente / Aceptado (`decisions.md` 2026-11-20) |
| `F-02` | `MEDIUM` | `CONDITIONAL GAP` | [specs/auth-rbac-y-cuentas.md](../specs/auth-rbac-y-cuentas.md) (`AC3`, `AC5`) | [plans/auth-rbac-y-cuentas.md](../plans/auth-rbac-y-cuentas.md) (`§6 Bloque 6`, `T020`–`T022`) | Si el usuario opta por ejecutar primero solo Bloques 1–5 (backend), `AC3` (redirección visual a selector) y `AC5` (aviso visual de correo no autorizado) quedan cubiertos a nivel API en `T012`–`T013`, pero no en UI navegador hasta correr Bloque 6. *Trade-off:* entrega backend incremental válida, sin cerrar `archive` de la spec hasta completar `T020`–`T022`. | Decisión del usuario antes de `implement` |
| `F-03` | `MEDIUM` | `GOVERNANCE GAP` | [REVIEW.md](../../../REVIEW.md) (`L28-36`) | [plans/auth-rbac-y-cuentas.md](../plans/auth-rbac-y-cuentas.md) (`T005`, `T017`, `T019`) | No existe `.rsc-risk.json` en la raíz; por ello `npx @ericrisco/rsc@4.1.8 risk` marca `T005` (`csrf.ts`), `T017` (`adminWeddings.ts`) y `T019` (`adminAccesses.ts`) como Tier 1 aunque `REVIEW.md` exige revisión humana Tier 2 para middlewares de sesión/RBAC, `MASTER_API_KEY` y reglas `BR-04`. *Trade-off:* mitigado en el plan marcándolas como Tier 2 efectivo; conviene crear `.rsc-risk.json` si se quiere automatizar el bloqueo en `rsc risk`. | `implement` / ajuste de `.rsc-risk.json` |
| `F-04` | `LOW` | `WORDING` | [constitution.md](../constitution.md) (`P11`) | [plans/auth-rbac-y-cuentas.md](../plans/auth-rbac-y-cuentas.md) (`§7 D2`) | `P11` fija aterrizaje en `main` (`--workflow main`), mientras `plan`/`worktrees` exigen aislar primero en worktree (`feat/auth-rbac-y-cuentas`). *Trade-off:* compatible; el worktree aísla la construcción y se integra en `main` al cerrar. | `worktrees` antes de `implement` |
| `F-05` | `LOW` | `DUPLICATION` | [specs/auth-rbac-y-cuentas.md](../specs/auth-rbac-y-cuentas.md) (`§Points to clarify`) | [notas-api-y-seguridad.md](../notas-api-y-seguridad.md) (`§1.1`, `§1.2`) | Los 5 ítems `**resuelto**` en formato texto hacen que `rsc spec gate` imprima `5 open point(s), 0 typed` aunque retorna `PASS`, y duplican parámetros ya cerrados en `notas-api-y-seguridad.md`. *Trade-off:* inofensivo porque el gate pasa en `0`. | `clarify` (opcional) |
| `F-06` | `LOW` | `AMBIGUITY / LOG` | [plans/auth-rbac-y-cuentas.md](../plans/auth-rbac-y-cuentas.md) (`§0`, `§2 #2`, `§7 D3`) | [decisions.md](../decisions.md) (`P23`) | Tres concreciones de `plan` (orden de resolución de `novios.admin_id` bajo `MASTER_API_KEY`, umbrales numéricos `10`/`60`/`120` req/min/IP en `@fastify/rate-limit`, y chequeo `BR-04` al reactivar `activo: false -> true`) aún no están registradas en `decisions.md`. *Trade-off:* definidas con precisión en el plan; anexar a `decisions.md` al aprobar `implement`. | `implement` (`§7 D3`) |

---

## 4. Enrutamiento recomendado

- **Compuerta:** **`GATE: PASS`** — no existen bloqueos `CRITICAL` ni `HIGH` que impidan avanzar a `implement`.
- **Acciones antes del primer archivo de código:**
  1. **Decidir alcance inicial:** confirmar si iniciamos `implement` con **Bloques 1–5 (Backend)** únicamente o con **Bloques 1–6 (Backend + `/panel` Frontend)**.
  2. **Aislar en worktree/rama:** estando actualmente en `main`, crear `.worktrees/auth-rbac-y-cuentas` sobre `feat/auth-rbac-y-cuentas` (`worktrees`).
  3. **Sincronizar decisiones y regla Tier 2:** al arrancar `implement`, anexar las 3 concreciones de `F-06` en [decisions.md](../decisions.md) y exigir panel de 3 refuters + aprobación humana tanto en las `11` tareas Tier 2 de `rsc risk` como en `T005`, `T017` y `T019` (`F-03`).

---

```json result-envelope
{
  "status": "complete",
  "executive_summary": "Pre-implementation consistency gate passed: GATE PASS with 0 CRITICAL, 0 HIGH, 3 MEDIUM, and 3 LOW findings across constitution v1.0.0, REVIEW.md, API/security notes, spec, plan, and T001-T023.",
  "artifact": "02-DOCS/wiki/sdd/analysis/auth-rbac-y-cuentas.md",
  "next_recommended": "implement",
  "risk": "high",
  "skill_resolution": {
    "used": ["analyze"],
    "missing": [],
    "fallback": [],
    "compact_rules": [
      "Read adversarially across artifacts, not inside one.",
      "A finding without a location is an opinion.",
      "Report only; do not start runtime code edits."
    ]
  },
  "evidence": [
    "coverage map covers AC1-AC7, R8, R9 with 0 gaps",
    "carrier completeness verified: §0 Global Constraints and per-task Interfaces present",
    "controlled migration 0002 drift and REVIEW.md Tier 2 enforcement gaps documented"
  ]
}
```

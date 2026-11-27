---
name: asdd
description: >-
  Flujo Spec-Driven Development (ASDD) para cambios grandes, nuevas funcionalidades complejas
  o decisiones que afectan autenticación, base de datos o múltiples módulos entre sí.
---

# ASDD — Spec-Driven Development (Cambios complejos)

Usa este flujo cuando el cambio sea grande, toque autenticación/persistencia/arquitectura o tenga decisiones que se afecten entre sí. Ejecuta cada fase leyendo su guía en `references/` solo cuando llegues a ella.

## Fases

1. **Specify:** lee [specify.md](./references/specify.md) y crea/actualiza `02-DOCS/wiki/sdd/specs/<slug>.md`.
2. **Clarify:** lee [clarify.md](./references/clarify.md) y resuelve ambigüedades con el usuario antes de diseñar.
3. **Plan:** lee [plan.md](./references/plan.md) y redacta `02-DOCS/wiki/sdd/plans/<slug>.md`.
4. **Tasks:** lee [tasks.md](./references/tasks.md) y descompone el plan en tareas verificables (`T001`, `T002`...).
5. **Analyze:** lee [analyze.md](./references/analyze.md) y valida coherencia en `02-DOCS/wiki/sdd/analysis/<slug>.md` (`GATE: PASS` obligatorio antes de implementar).
6. **Aprobación:** espera confirmación explícita del usuario sobre spec y plan (elige ejecución manual paso a paso o autopilot).
7. **Implement & Verify:** implementa por bloques pequeños con TDD, verifica con `npm test` y `npm run build` en la carpeta afectada y registra avances en `02-DOCS/wiki/sdd/progress/<slug>.md`.
8. **Review & Cierre:** ejecuta `/review` contra `REVIEW.md` y actualiza `MEMORY.md` (máximo 50 líneas).

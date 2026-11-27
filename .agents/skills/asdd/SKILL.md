---
name: asdd
description: >-
  Flujo Spec-Driven Development (ASDD) para cambios grandes, nuevas funcionalidades complejas
  o decisiones que afectan autenticación, base de datos o múltiples módulos entre sí.
---

# ASDD — Spec-Driven Development (Cambios complejos)

Usa este flujo cuando el cambio sea grande, toque autenticación/persistencia/arquitectura o tenga decisiones que se afecten entre sí.

## Fases

1. **Specify (`02-DOCS/wiki/sdd/specs/<slug>.md`):** define objetivo, requisitos funcionales, criterios de aceptación y qué queda fuera de alcance.
2. **Clarify:** detecta ambigüedades o decisiones abiertas y haz preguntas concretas al usuario antes de diseñar.
3. **Plan (`02-DOCS/wiki/sdd/plans/<slug>.md`):** detalla archivos a crear/modificar, cambios en esquemas/APIs, casos límite y estrategia de pruebas.
4. **Aprobación:** espera confirmación explícita del usuario sobre la spec y el plan (el usuario elige ejecución manual paso a paso o autopilot).
5. **Implement & Verify:** ejecuta por bloques pequeños, valida con `npm test` y `npm run build` en la carpeta afectada y registra el progreso en `02-DOCS/wiki/sdd/progress/<slug>.md`.
6. **Review & Cierre:** revisa seguridad/regresiones y actualiza `MEMORY.md` (máximo 50 líneas).

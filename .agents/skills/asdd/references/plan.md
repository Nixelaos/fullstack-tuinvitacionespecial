# Fase 3: Plan

Objetivo: traducir la spec aprobada a diseño técnico concreto en `02-DOCS/wiki/sdd/plans/<slug>.md`.

## Qué debe incluir el plan
1. **Archivos afectados:** rutas exactas a crear o modificar en `backend-tuinvitacionespecial/` y/o `frontend-tuinvitacionespecial/`.
2. **Datos y contratos:** cambios en `src/db/schema.ts`, migraciones `drizzle/`, esquemas Zod y endpoints HTTP.
3. **Riesgos y mitigaciones:** concurrencia (`SELECT ... FOR UPDATE`), seguridad (`BR-06` IDOR, CSRF, límites) y rollback si aplica.
4. **Estrategia de pruebas:** qué tests unitarios/integración cubrirán cada criterio de aceptación.

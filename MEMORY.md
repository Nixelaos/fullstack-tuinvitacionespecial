# MEMORY.md — Tu Invitación Especial

## Estado actual
- **Harness:** Migrado a configuración propia local (`AGENTS.md`, `MEMORY.md`, `.agents/skills/ftd`, `.agents/skills/asdd`). Se eliminó `.antigravity/AGENTS.md` para evitar reglas duplicadas.
- **Auth, RBAC y Cuentas (`02-DOCS/wiki/sdd/`):** Spec `approved`, análisis `GATE: PASS`, progreso `ready` (`C1`–`C9` + `T023`).
- **FTD R.S.V.P. global (`02-DOCS/wiki/ftd/rsvp-logica-global.md`):** `in-progress` (frontend `BR-01`, `BR-03`, `useRsvp`, `useModal`, `papel-rasgado`).
- **Specs en `draft`:** `panel-pre-envio-y-distribucion.md`, `rsvp-publico-invitados.md`, `dashboard-post-envio.md`.

## Decisiones clave
- El conocimiento extenso del proyecto (specs, planes, contratos HTTP y seguridad) permanece en `02-DOCS/wiki/` (`index.md`) y se lee bajo demanda para no saturar el contexto.
- Todas las customizaciones del agente se mantienen locales al repositorio.

## Aprendizajes
- `.rsc/auto-update.mjs` no está presente tras limpiar `rsc-harness`; no referenciar scripts inexistentes en `AGENTS.md`.

## Próximos pasos
- Ajustar los marcadores `[...]` en `AGENTS.md` (idioma del código, estilo y commits).
- Retomar la implementación de `auth-rbac-y-cuentas` o del FTD `rsvp-logica-global`.

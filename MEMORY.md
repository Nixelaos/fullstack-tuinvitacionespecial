# MEMORY.md — Tu Invitación Especial

## Estado actual
- **Harness:** Migrado a configuración propia local (`AGENTS.md`, `MEMORY.md`, `.agents/skills/ftd`, `.agents/skills/asdd`). Se eliminó `.antigravity/AGENTS.md` para evitar reglas duplicadas.
- **Auth, RBAC y Cuentas (`02-DOCS/wiki/sdd/`):** Spec `approved`, análisis `GATE: PASS` (`0 CRITICAL, 0 HIGH, 3 MEDIUM, 3 LOW` — `F-01` migración `0002`, `F-02` corte Bloque 6, `F-03` Tier 2 en `T005/T017/T019`, `F-06` pendiente en `decisions.md`). Progreso `in-progress`: `C1`–`C2` `[x]`, `C3` (`T006`–`T007`) en `ab4ac5d` pendiente de revisión/cierre; faltan `C4`–`C9` + `T023`.
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

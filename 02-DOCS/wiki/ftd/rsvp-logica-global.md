---
author: N1coG4bo
branch: main
status: in-progress
---
# Refactorización de la capa lógica global del RSVP (alineada a BR-01 y BR-03)

## Intent
Desacoplar el 100% de la lógica, tipos, defaults, validación y orquestación del RSVP hacia módulos globales del frontend (`src/types/`, `src/data/`, `src/utils/`, `src/hooks/`) para reutilizarlos en futuras plantillas de invitaciones, manteniendo la capa visual dentro de `src/components/papel-rasgado/` y alineando el modelo a las reglas del SDD (`BR-01`, `BR-03`, `tipo_menu_enum` con `'Celíaco'`, tokens opacos y accesibilidad de modales).

## Scope
**Incluido:**
- Alinear `src/types/rsvp.ts` y `src/data/rsvpDefaults.ts` al enum canónico (`'Celíaco'`) y soporte de `RsvpFeatureFlags`, `RsvpSubmissionPayload` y `RsvpAdapter`.
- Agregar `rsvpDeadlineIso` y `formatRsvpDeadlineLabels` a `src/utils/dateUtils.ts` y `PAPEL_RASGADO_RSVP_CONFIG`.
- Crear `src/utils/rsvpUtils.ts` con reglas puras de `BR-01` (1 plato por asistente), normalización (`0` y `[]` cuando no asiste), numeración dinámica de pasos, evaluación de `BR-03` y parseo seguro de query params / tokens opacos.
- Actualizar `src/utils/whatsappUtils.ts` para respetar `features` y formatear cantidades de menú.
- Actualizar `src/hooks/useInvitationParams.ts` (corrigiendo bug de tokens opacos y techo `<= 10`) y `src/hooks/useRsvpForm.ts` (`BR-01`, `BR-03`, normalización y adaptador inyectable).
- Crear `src/hooks/useModal.ts` (independiente de RSVP, con focus trap `Tab`/`Shift+Tab`, `Escape`, scroll lock seguro y restauración de foco) y `src/hooks/useRsvp.ts` (fachada ligera de composición SSR-safe).
- Actualizar `PapelRasgadoRsvp.tsx`, `PapelRasgadoRsvpForm.tsx` y `PapelRasgadoRsvpSuccess.tsx` (manteniéndolos en `src/components/papel-rasgado/`) y `GuestStepper.tsx` para consumir `useRsvp` + `useModal` y reflejar `BR-01`, `BR-03`, `features` y accesibilidad WAI-ARIA.
- Pruebas unitarias con `node --test` sobre la lógica pura y verificación de build con `npm run build` (`astro build`) y `npx tsc --noEmit`.

**Excluido:**
- Endpoints HTTP reales del backend (`rsvp-publico-invitados`) y conexión `apiRsvpAdapter` contra Fastify.
- Migrar `PapelRasgadoGift` y `PapelRasgadoPhotoAlbum` a `useModal` (queda listo para reusarse después).
- Cambios en `backend-tuinvitacionespecial/`.

## Checklist
- [x] Tipos globales (`src/types/rsvp.ts`), defaults (`src/data/rsvpDefaults.ts`) y `rsvpDeadlineIso` / `formatRsvpDeadlineLabels` en `dateUtils.ts` y `papelRasgadoData.ts` — probado por `tsc --noEmit` y `node --test`.
- [x] Utilidades puras (`src/utils/rsvpUtils.ts`, `src/utils/whatsappUtils.ts`) cubriendo `BR-01`, normalización `0`/`[]`, `BR-03`, `features` y parseo de tokens — probado por `node --test` (`17/17`).
- [x] Hooks globales (`useInvitationParams.ts`, `useRsvpForm.ts`, `useModal.ts`, `useRsvp.ts`) con estabilización de adaptador inline, evaluación SSR-safe + en vivo de `BR-03` y focus trap — probado por `tsc --noEmit`, `astro build` y revisión en contexto fresco.
- [x] Capa visual en `src/components/papel-rasgado/` (`PapelRasgadoRsvp.tsx`, `PapelRasgadoRsvpForm.tsx`, `PapelRasgadoRsvpSuccess.tsx`) y `GuestStepper.tsx` integradas con `useRsvp` + `useModal` y accesibilidad WAI-ARIA (`radiogroup` con flechas/roving `tabIndex`, `role="dialog"` en contenedor enfocado) — probado por `astro build` sin errores y revisión en contexto fresco.
- [x] Verificación de riesgo (`npx @ericrisco/rsc risk --base HEAD`: Tier 1) y revisión en contexto fresco (`APROBADO` tras corregir 4 bloqueantes + 5 menores + filtro `el.tabIndex >= 0`).

## Evidence
- `npx @ericrisco/rsc risk --base HEAD`: `tier 1`, `classes: default, docs`, `reviewers: 1`, `human approval: not required`. *(Nota: contra `origin/main` aparece `tier 2` por 2 commits previos locales no subidos ajenos a esta refactorización.)*
- `node --test src/utils/rsvpUtils.test.ts`: `17` tests en `6` suites — `17 pass`, `0 fail` (`96.98ms`).
- `npx tsc --noEmit` (en `frontend-tuinvitacionespecial/`): `0` errores (exit code `0`).
- `npm run build` (`astro build` en `frontend-tuinvitacionespecial/`): `6 page(s) built in 2.63s`, `Complete!` (exit code `0`).
- Revisión en contexto fresco (subagente `research`): primera pasada `CAMBIOS REQUERIDOS` (4 bloqueantes + 5 menores); tras aplicar todas las correcciones y re-verificar, veredicto final `APROBADO` (y aplicado además el ajuste opcional `el.tabIndex >= 0` en `useModal.ts` con re-ejecución verde completa).
- Escaneo de seguridad / pruebas E2E en navegador: no ejecutados (solo refactorización cliente sin secretos ni llamadas HTTP).

## Next
Probar visualmente `/disenos/papel-rasgado` en local (`npm run dev`), revisar el `git diff` y hacer commit cuando el usuario lo confirme (o conectar `apiRsvpAdapter` al implementar `rsvp-publico-invitados`).

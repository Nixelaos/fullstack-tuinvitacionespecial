---
author: N1coG4bo
branch: main
status: in-progress
---
# Refactorización de la capa lógica global del RSVP y reutilización de `useModal` (alineada a BR-01 y BR-03)

## Intent
Desacoplar el 100% de la lógica, tipos, defaults, validación y orquestación del RSVP hacia módulos globales del frontend (`src/types/`, `src/data/`, `src/utils/`, `src/hooks/`) para reutilizarlos en futuras plantillas de invitaciones, mantener la capa visual dentro de `src/components/papel-rasgado/`, unificar el comportamiento modal accesible (`useModal`) en RSVP, Regalo y Álbum de Fotos, validar visualmente en navegador y mantener sincronizados el SDD HTML y el harness `rsc-harness`.

## Scope
**Incluido:**
- Alinear `src/types/rsvp.ts` y `src/data/rsvpDefaults.ts` al enum canónico (`'Celíaco'`) y soporte de `RsvpFeatureFlags`, `RsvpSubmissionPayload` y `RsvpAdapter`.
- Agregar `rsvpDeadlineIso` y `formatRsvpDeadlineLabels` a `src/utils/dateUtils.ts` y `PAPEL_RASGADO_RSVP_CONFIG`.
- Crear `src/utils/rsvpUtils.ts` y `src/utils/rsvpUtils.test.ts` (más script `"test"` en `frontend-tuinvitacionespecial/package.json`) cubriendo `BR-01` (1 plato por asistente), normalización (`0` y `[]` cuando no asiste), relleno `'Estándar'` con `showMenu: false`, numeración dinámica de pasos, evaluación `BR-03` y parseo seguro de tokens opacos.
- Actualizar `src/utils/whatsappUtils.ts` para respetar `features` y formatear cantidades de menú.
- Actualizar `src/hooks/useInvitationParams.ts` y `src/hooks/useRsvpForm.ts`, y crear `src/hooks/useModal.ts` y `src/hooks/useRsvp.ts`.
- Integrar `useRsvp` + `useModal` en `PapelRasgadoRsvp.tsx`, `PapelRasgadoRsvpForm.tsx`, `PapelRasgadoRsvpSuccess.tsx` y `GuestStepper.tsx`, y migrar `PapelRasgadoGift.tsx` y `PapelRasgadoPhotoAlbum.tsx` a `useModal`.
- Verificación visual e interactiva en navegador sobre `/disenos/papel-rasgado` (`3` pases y `1` pase, los 3 modales).
- Sincronización documental de `ESQUEMA_SECCION_RSVP.md`, `02-DOCS/wiki/sdd/constitution.md`, `config.yaml`, `decisions.md`, `specs/rsvp-publico-invitados.md` y `02-DOCS/wiki/index.md` (congelando el HTML de Notion como snapshot histórico de solo lectura).

**Excluido:**
- Endpoints HTTP reales del backend (`rsvp-publico-invitados`) y `apiRsvpAdapter` contra Fastify.
- Commits Git (el usuario indicó explícitamente no hacer commits).
- Corrección del warning preexistente `fetchPriority` en `PapelRasgadoEnvelope.tsx` (fuera de alcance, reportado al usuario).

## Checklist
- [x] Tipos globales (`src/types/rsvp.ts`), defaults (`src/data/rsvpDefaults.ts`) y `rsvpDeadlineIso` / `formatRsvpDeadlineLabels` en `dateUtils.ts` y `papelRasgadoData.ts` — probado por `tsc --noEmit` y `npm test`.
- [x] Utilidades puras (`src/utils/rsvpUtils.ts`, `src/utils/whatsappUtils.ts`) cubriendo `BR-01`, normalización `0`/`[]`, `BR-03`, `features` y parseo de tokens — probado por `npm test` (`17/17`).
- [x] Hooks globales (`useInvitationParams.ts`, `useRsvpForm.ts`, `useModal.ts`, `useRsvp.ts`) con estabilización de adaptador inline, evaluación SSR-safe + en vivo de `BR-03` y focus trap — probado por `tsc --noEmit`, `astro build` y revisión en contexto fresco.
- [x] Capa visual en `src/components/papel-rasgado/` (`PapelRasgadoRsvp`, `PapelRasgadoRsvpForm`, `PapelRasgadoRsvpSuccess`, `PapelRasgadoGift`, `PapelRasgadoPhotoAlbum`) y `GuestStepper.tsx` integradas con `useRsvp` y `useModal` — probado por `astro build` y verificación en navegador.
- [x] Verificación visual e interactiva en navegador (`http://localhost:4321/disenos/papel-rasgado`) cubriendo Gift modal, PhotoAlbum QR modal, RSVP con `3` pases (contadores `BR-01`, alerta `role="alert"`, éxito y cambio a `"No podré asistir"`) y RSVP con `1` pase (chips `role="radio"` con `'Celíaco'`).
- [x] Actualización sincronizada de `ESQUEMA_SECCION_RSVP.md` y harness `rsc-harness` (`constitution.md`, `config.yaml`, `decisions.md`, `specs/rsvp-publico-invitados.md`, `wiki/index.md`), manteniendo el SDD HTML congelado como snapshot histórico + `rsc doctor` saludable.

## Evidence
- `npm test` (`node --test src/utils/*.test.ts` en `frontend-tuinvitacionespecial/`): `17` tests en `6` suites — `17 pass`, `0 fail`.
- `npx tsc --noEmit` (en `frontend-tuinvitacionespecial/`): `0` errores.
- `npm run build` (`astro build` en `frontend-tuinvitacionespecial/`): `6 page(s) built in 3.62s`, `Complete!`.
- Revisión en contexto fresco (subagente `research`): veredicto final `APROBADO` tras corregir los 4 bloqueantes + 5 mejoras menores + `el.tabIndex >= 0` en `useModal.ts`.
- Verificación en navegador (subagente `browser` sobre `http://localhost:4321`, origen verificado por host):
  - `?n=Familia+Gomez&pases=3`: apertura de sobre OK; modal Gift (`role="dialog"`, cierre con `Escape`) OK; modal PhotoAlbum QR (`role="dialog"`, cierre con `Cerrar`) OK; modal RSVP (`3 personas`, contadores `3/3`, `+ Celíaco` → `2 Estándar + 1 Celíaco`, `- Estándar` → `2/3` + alerta `role="alert"`, `+ Vegano` + alergia `"Maní"` → éxito `1× Estándar, 1× Vegano, 1× Celíaco` y `Maní`; edición a `"No podré asistir"` + `"Un abrazo"` → éxito con dedicatoria y botón WhatsApp sin pases ni menús) OK.
  - `?n=Valentina&pases=1`: chips `role="radio"` con `'Celíaco'` exacto verificado en captura visual (`final_step_28.png`).
  - Consola: `0` errores JS y `0` errores de hidratación; 1 warning preexistente en `PapelRasgadoEnvelope.tsx` (`fetchPriority` → `fetchpriority`).
- `npx @ericrisco/rsc doctor`: `Harness health: healthy` (CLI `4.1.8`, pendiente únicamente ratificación explícita de `constitution.md` en fase `constitution`).
- Escaneo de seguridad automatizado: no ejecutado (cambios acotados a frontend estático y documentación).

## Next
Revisar el `git diff` local (sin commits automáticos) y, cuando el usuario decida, ratificar `constitution.md` o iniciar la implementación backend de `rsvp-publico-invitados` + `apiRsvpAdapter`.

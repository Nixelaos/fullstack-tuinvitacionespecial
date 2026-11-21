# Knowledge Map — tuinvitacionespecial

Mapa de documentación viva del proyecto bajo `02-DOCS/wiki/`.

## Harness (`02-DOCS/wiki/harness/`)

| Documento | Ruta |
|---|---|
| Perfil de usuario | [user-profile.md](./harness/user-profile.md) |
| Plan de instalación | [installation-plan.md](./harness/installation-plan.md) |
| Decisiones del harness | [decisions.md](./harness/decisions.md) |

## ASDD (`02-DOCS/wiki/sdd/`)

| Documento | Rol | Ruta |
|---|---|---|
| Configuración runtime ASDD | Calibración de stack, comandos y modo | [config.yaml](./sdd/config.yaml) |
| Constitución del proyecto *(v1.1.0)* | Principios innegociables y Definition of Done | [constitution.md](./sdd/constitution.md) |
| Reglas de revisión *(v1.0.0)* | Bloqueantes, rutas Tier 2 y formato de review | [REVIEW.md](../../REVIEW.md) |
| Log de decisiones SDD | Registro append-only de decisiones | [decisions.md](./sdd/decisions.md) |
| Contratos HTTP y Seguridad *(decided)* | Catálogo de endpoints, códigos HTTP y arquitectura de seguridad | [notas-api-y-seguridad.md](./sdd/notas-api-y-seguridad.md) |

### Specs de producto (`02-DOCS/wiki/sdd/specs/`)

| Spec | Dominio | Estado | Ruta |
|---|---|---|---|
| Autenticación, RBAC y Cuentas | SuperAdmin, Google OAuth, multi-boda y `BR-04`/`BR-06` | approved | [auth-rbac-y-cuentas.md](./sdd/specs/auth-rbac-y-cuentas.md) |
| Panel Pre-Envío y Distribución | Importación `.xlsx`/`.csv`, CRUD, `BR-05`, WhatsApp y correo masivo `BR-02` | draft | [panel-pre-envio-y-distribucion.md](./sdd/specs/panel-pre-envio-y-distribucion.md) |
| Formulario Público R.S.V.P. | Invitación personalizada, `BR-01`, `BR-03` y concurrencia | draft | [rsvp-publico-invitados.md](./sdd/specs/rsvp-publico-invitados.md) |
| Dashboard Post-Envío | Métricas en vivo, menús, alergias, playlist, muro y exportación | draft | [dashboard-post-envio.md](./sdd/specs/dashboard-post-envio.md) |

### Planes de implementación (`02-DOCS/wiki/sdd/plans/`)

| Plan | Alcance | Estado | Ruta |
|---|---|---|---|
| Autenticación, RBAC y Cuentas | 6 sub-bloques, tareas TDD `T001`–`T023` y pronóstico de riesgo | draft | [auth-rbac-y-cuentas.md](./sdd/plans/auth-rbac-y-cuentas.md) |

### Análisis de consistencia (`02-DOCS/wiki/sdd/analysis/`)

| Análisis | Veredicto | Fecha | Ruta |
|---|---|---|---|
| Autenticación, RBAC y Cuentas | `GATE: PASS` (`0 CRITICAL`, `0 HIGH`, `3 MEDIUM`, `3 LOW`) | 2026-11-20 | [auth-rbac-y-cuentas.md](./sdd/analysis/auth-rbac-y-cuentas.md) |

### Progreso de implementación (`02-DOCS/wiki/sdd/progress/`)

| Progreso | Estado | Alcance | Ruta |
|---|---|---|---|
| Autenticación, RBAC y Cuentas | ready | Micro-cortes `C1`–`C9` + cierre `T023` | [auth-rbac-y-cuentas.md](./sdd/progress/auth-rbac-y-cuentas.md) |

## FTD (`02-DOCS/wiki/ftd/`)

| Cambio | Alcance | Estado | Ruta |
|---|---|---|---|
| Capa lógica global R.S.V.P. y `useModal` | Frontend (`BR-01`, `BR-03`, `useRsvp`, `useModal`, `papel-rasgado`) | in-progress | [rsvp-logica-global.md](./ftd/rsvp-logica-global.md) |

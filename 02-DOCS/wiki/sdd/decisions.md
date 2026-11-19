# SDD Decisions Log

Registro append-only de decisiones arquitectónicas, de alcance y de gobernanza dentro del flujo ASDD.

---

## 2026-11-19 — Traspaso del SDD funcional de negocio al flujo ASDD

- **Contexto:** El proyecto cuenta con un blueprint funcional detallado en `backend-tuinvitacionespecial/Spec-Driven Development (SDD)/Tú Invitación Especial Spec-Driven Development 4142fac3517e807a91d9d3ed20434feb.html` y con una Fase 1 de backend ya implementada (Docker, Drizzle schema, `/health`, verificación base de Google ID Token y `MASTER_API_KEY`).
- **Decisión:**
  1. Calibrar el runtime ASDD en `02-DOCS/wiki/sdd/config.yaml` (`execution_mode: interactive`, `models.enabled: false`, `strict_tdd: true`).
  2. Completar el borrador de `02-DOCS/wiki/sdd/constitution.md` y redactar `REVIEW.md` a partir de las reglas verificadas del SDD funcional y del monorepo, manteniendo `status: draft` hasta ratificación explícita del usuario.
  3. Descomponer el alcance funcional pendiente en 4 sub-specs independientes (WHAT/WHY) dentro de `02-DOCS/wiki/sdd/specs/`:
     - `auth-rbac-y-cuentas`
     - `panel-pre-envio-y-distribucion`
     - `rsvp-publico-invitados`
     - `dashboard-post-envio`
  4. Diferir el diseño detallado de contratos HTTP (rutas/métodos/schemas/errores) y la arquitectura de seguridad (sesión stateful en Redis + cookie `HttpOnly`, CSRF, rate limit) a `02-DOCS/wiki/sdd/notas-api-y-seguridad.md` para resolverlos tras aprobar las specs y antes de `plan`.
- **Alternativas descartadas:**
  - Crear una sola mega-spec monolítica (descartada porque mezcla 4 dominios independientes y dificulta la validación incremental por riesgo Tier 2).
  - Ratificar la constitución sin aprobación del usuario (descartada por regla del flujo `constitution`).
- **Nota sobre el sitio estático:** La landing de venta, catálogo y vista visual de `/papel-rasgado` ya existen en `frontend-tuinvitacionespecial/`; las nuevas specs cubren los flujos pendientes y la integración de datos reales.

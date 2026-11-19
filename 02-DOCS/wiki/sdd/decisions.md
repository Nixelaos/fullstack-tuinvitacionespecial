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

---

## 2026-11-19 — Sesión gestionada en Redis + Cookie HttpOnly (Camino B sobre Google ID Token)

- **Contexto:** El Google ID Token (JWT) emitido al autenticarse con Google expira en ~1 hora, almacenarlo en `localStorage` o `sessionStorage` expone la sesión a ataques XSS, y no permite revocar accesos en tiempo real sin validar en PostgreSQL cada petición.
- **Decisión (Camino B aprobado por el usuario):**
  1. El frontend envía el Google ID Token **una única vez** al endpoint de inicio de sesión.
  2. El backend valida criptográficamente el token (`verifyGoogleIdToken` en `src/lib/auth.ts`), consulta `admins` y `accesos_autorizados` (`activo = true`), genera un identificador de sesión opaco con `crypto.randomBytes(32)` y almacena el estado de sesión en **Redis 8.0** con TTL configurable.
  3. El backend emite una cookie `HttpOnly; Secure; SameSite=Lax` para las peticiones subsecuentes del panel y permite revocación inmediata al cerrar sesión o desactivar un acceso (`activo = false`).
- **Alternativas descartadas:** Camino A (enviar el JWT de Google en cada petición HTTP desde almacenamiento accesible por JavaScript).
- **Pendiente relacionado:** Definir el TTL exacto de sesión (ej. 7 días) y confirmar las otras 4 capas de seguridad en `02-DOCS/wiki/sdd/notas-api-y-seguridad.md` (CSRF, anti-IDOR SQL, rate limiting en Redis, Helmet/CORS y aislamiento de `MASTER_API_KEY`).

---

## 2026-11-19 — Fijación de TTL de sesión (7 días) y adopción de las 4 piezas de seguridad

- **Contexto:** Tras revisar las 4 capas de seguridad pendientes en `notas-api-y-seguridad.md`, el usuario aprobó incorporarlas al piso de seguridad de `constitution.md` y fijar la vigencia de la sesión de Camino B.
- **Decisión:**
  1. Fijar el **TTL de sesión en Redis 8.0 en 7 días (604 800 s)**, con revocación inmediata ante logout o `activo = false`.
  2. Adoptar obligatoriamente las 4 piezas de seguridad:
     - **CSRF:** `SameSite=Lax` + validación de `Origin`/`Referer` en mutaciones con cookie.
     - **Anti-IDOR / Aislamiento (`BR-06`):** filtro obligatorio por `novios_id` validado en sesión dentro de toda consulta SQL del panel.
     - **Enlaces públicos y Rate Limiting:** `token_enlace` con entropía criptográfica (`node:crypto`) + `@fastify/rate-limit` sobre Redis 8.0.
     - **Blindaje perimetral:** `@fastify/helmet`, CORS restringido al dominio del frontend y aislamiento de `MASTER_API_KEY` en `/api/admin/*`.
  3. Actualizar el HTML del SDD funcional (`Tú Invitación Especial Spec-Driven Development...html`) para reflejar el Camino B y mantener alineada la documentación origen.
- **Pendiente restante:** Cerrar el **Punto 1** de `notas-api-y-seguridad.md` (catálogo exacto de rutas, métodos, schemas Zod y códigos de error HTTP).

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

## 2026-11-19 — Capa lógica global de R.S.V.P. y `useModal` desacoplados de la plantilla `papel-rasgado`

- **Contexto:** La plantilla `papel-rasgado` contenía acoplados en sus componentes visuales la configuración del evento (`PAPEL_RASGADO_RSVP_CONFIG`), el catálogo de menús (`DEFAULT_MENU_OPTIONS`, con `'Celíaco / Sin Gluten'` desalineado frente a `tipo_menu_enum`), lógica duplicada de modales en RSVP/Gift/PhotoAlbum y un modelo de menús tipo checkboxes únicos incompatible con `BR-01`. Además, futuras plantillas de invitaciones reutilizarán el mismo motor lógico de R.S.V.P. pudiendo ocultar bloques opcionales.
- **Decisión:**
  1. **Capa lógica 100% global en `frontend-tuinvitacionespecial/src/`:**
     - `types/rsvp.ts`: `TipoMenu` alineado 1:1 con `tipo_menu_enum` (`'Celíaco'` exacto), `RsvpSubmissionPayload`, `RsvpFeatureFlags`, `RsvpStepNumbers` y contrato `RsvpAdapter` (`demo` hoy, `api` al conectar Fastify).
     - `data/rsvpDefaults.ts`: `DEFAULT_MENU_OPTIONS`, `DEFAULT_RSVP_FEATURES`, `RSVP_DEADLINE_EXPIRED_MESSAGE` y `demoRsvpAdapter`.
     - `utils/rsvpUtils.ts` + `utils/rsvpUtils.test.ts` (`npm test` vía `node --test`): aritmética `BR-01` (1 plato por asistente, reemplazo inteligente de `'Estándar'`, prioridad a restricciones alimentarias al reducir pases), normalización a `cantAsistentes: 0` / `menusSeleccionados: []` cuando `attendance === 'no'` (manteniendo dedicatoria opcional), relleno con `'Estándar'` si `showMenu: false` para no romper `BR-01`, vigencia `BR-03` (`rsvpDeadlineIso` + `formatRsvpDeadlineLabels`), numeración correlativa de pasos y parseo seguro de tokens opacos (`source: 'token' | 'demo' | 'default'`, eliminando el fallback que convertía tokens en nombre y subiendo el límite demo de `10` a `50`).
     - Hooks compuestos sin "God Hook": `useInvitationParams`, `useRsvpForm`, `useModal` (headless con focus trap `Tab`/`Shift+Tab`, `Escape`, scroll lock con contador y restauración de foco) y `useRsvp` (fachada ligera SSR-safe con verificación en vivo de `BR-03`).
  2. **Capa visual conservada en `src/components/papel-rasgado/`:**
     - `PapelRasgadoRsvp`, `PapelRasgadoRsvpForm` (chips `radiogroup` accesibles para 1 asistente y contadores `- / +` por plato para `> 1` asistentes) y `PapelRasgadoRsvpSuccess` mantienen su dirección de arte propia recibiendo configuración, `features` y `adapter` por props.
     - `PapelRasgadoGift` y `PapelRasgadoPhotoAlbum` migran también al hook global `useModal`, eliminando el boilerplate duplicado y unificando accesibilidad de diálogos.
- **Alternativas descartadas:**
  - Mover `PapelRasgadoRsvp` y su estética visual a una carpeta global compartida (descartada para no acoplar futuras plantillas a la estética de sobre flotante, flores y paleta arena de Papel Rasgado).
  - Construir un único "God Hook" monolítico con estado de modal + URL + formulario + API (descartada por acoplamiento y dificultad de pruebas unitarias).
  - Relajar `BR-01` en backend para permitir `0` menús cuando una plantilla oculta `showMenu` (descartada; el frontend rellena `'Estándar'` por asistente hasta que exista un flag explícito de dominio en `novios` si algún evento sin banquete lo requiere).
- **Gobernanza documental:** El archivo `backend-tuinvitacionespecial/Spec-Driven Development (SDD)/Tú Invitación Especial Spec-Driven Development 4142fac3517e807a91d9d3ed20434feb.html` queda congelado como snapshot histórico de solo lectura (origen de Notion); `02-DOCS/wiki/` es la única fuente de verdad viva del proyecto.

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

---

## 2026-11-20 — Endurecimiento de topes en base de datos y límite de 1.000 registros de invitados por boda

- **Contexto:** La Fase 1 del esquema PostgreSQL incluía columnas `TEXT` sin límite (`plantilla_mensaje`, `mensaje_personalizado`, `alergias`, `mensaje_novios`), columnas `INTEGER` sin cota superior (`max_accesos`, `num_adultos`, `num_ninos`, `cant_asistentes`), `VARCHAR` sobredimensionados y carecía de tope de registros de invitados por boda, exponiendo el sistema a amplificación de filas (`rsvp_menus`), abuso de almacenamiento y consumo desmedido de envíos en Resend.
- **Decisión:**
  1. **Acotar longitudes de texto y rangos numéricos en `schema.ts`, migración Drizzle (`0001_slim_doorman.sql`), `MD-PostgreeSQL.sql`, `DB_LIMITS` (`src/schemas/common.ts`) y `RSVP_FIELD_LIMITS` (`frontend-tuinvitacionespecial/`):**
     - Eliminar todas las columnas `TEXT` e `INTEGER` sin cota, reemplazándolas por `VARCHAR(N)` y `SMALLINT` con restricciones `CHECK` explícitas (`max_accesos` `1..10`, `num_adultos` `1..20`, `num_ninos` `0..15`, `num_adultos + num_ninos <= 30`, `cant_asistentes` `0..30`, `alergias` `300`, `cancion_favorita` `120`, `mensaje_novios` `500`, `mensaje_personalizado` `300`, `plantilla_mensaje` `1000`, correos `160`, nombres `80`/`100`, `slug_plantilla` `50`, `token_enlace` `80`, `telefono` `20`).
     - Añadir restricción SQL de consistencia `chk_respuestas_asistencia_consistente` en `respuestas_rsvp` (`asistencia_confirmada = false` requiere `cant_asistentes = 0`; `true` requiere `>= 1`).
  2. **Tope de 1.000 familias invitadas por boda (`novios.max_familias`):**
     - Añadir columna `max_familias` (`SMALLINT DEFAULT 1000 NOT NULL`, `CHECK (1..1000)`) en `novios`.
     - En la importación masiva `.xlsx`/`.csv` (`panel-pre-envio-y-distribucion.md`), si el archivo supera `1.000` filas de datos (1.001 o más) o excede el cupo disponible restante hasta `1.000`, el cliente muestra un aviso claro indicando que solo se importarán los primeros `1.000` registros (o los restantes disponibles) y recorta el excedente antes de previsualizar/confirmar; el servidor valida además este tope dentro de la transacción.
- **Alternativas descartadas:** Mantener `TEXT` e `INTEGER` abiertos confiando solo en validación en memoria o `maxLength` del navegador (descartada por riesgo de DoS y falta de integridad en base de datos).

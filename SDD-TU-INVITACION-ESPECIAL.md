# Tú Invitación Especial Spec-Driven Development

🛠️ Blueprint de Especificación Funcional (Enfoque SDD)
[Buenas Prácticas de Desarrollo de Software con IA (MoureDev)](https://app.notion.com/p/Buenas-Pr-cticas-de-Desarrollo-de-Software-con-IA-MoureDev-4182fac3517e8014bab3f1f26170593c?pvs=21)
## CAPA 1: CONTEXTO Y DELIMITACIÓN (El Qué y El Quién)

1. Alcance Operativo Actual (Current State)

- **Capacidad Core:** La aplicación funciona como una **Landing Page de venta y catálogo**, vinculada a **una única plantilla de invitación digital interactiva**. El sistema permite a los novios gestionar su lista de invitados antes del envío y visualizar las confirmaciones, menús y datos analíticos en tiempo real después de que los invitados responden.

- **Objetivo de la Función:** Centralizar la venta de invitaciones mediante un catálogo web cotizado por WhatsApp, y automatizar el flujo de confirmación de asistencia (R.S.V.P.) eliminando las planillas manuales de los novios.

- **Beneficio del Usuario: **Los novios obtienen una invitación moderna que recopila automáticamente asistencias, restricciones alimentarias y canciones, organizando toda la información en un panel de control limpio y descargable.

**2. Matriz de Fronteras (In/Out/Next)**

| **Características IN (Esta Versión)** | **Características NO (Excluido Hoy)** | **Fuera de Alcance Permanente** |
| --- | --- | --- |
| • Catálogo web estático con sección de FAQs. | • Pasarela de pagos automatizada en la web. | • Procesamiento o timbrado de invitaciones físicas/impresas. |
| • Botón de contacto directo a WhatsApp para cotizar. | • Editor autogestionable de plantillas (Drag & Drop). | • Panel de administración para proveedores de banquetes externos. |
| • Panel R.S.V.P. Pre-Envío (Carga manual, plantilla descargable e importación inteligente .xlsx/.csv). | • Envío directo de invitaciones desde la web por WhatsApp API. |  |
| • Panel R.S.V.P. Post-Envío con analíticas y tablas. | • Recordatorios automáticos de asistencia. |  |
| • Formulario interactivo de confirmación para invitados. | • Gestión de múltiples eventos por cuenta (ej. Civil + Fiesta). |  |
| * • *Distribución dual de invitaciones: envío granular manual vía WhatsApp Web (`wa.me`) y envío masivo transaccional por Correo Electrónico con confirmación previa". |  |  |

---

## **CAPA 2: CONTRATO DE DATOS Y REGLAS (El Cómo)**

### **3. Modelo de Datos y Validación (Contrato de Entrada/Salida)**

**A. Esquema Relacional Físico (PostgreSQL 18.7 — 6 Tablas Normalizadas + 1 Enum)**
[MD-PostgreeSQL.sql](MD-PostgreeSQL.sql)

-   
Todas las claves primarias utilizan generación nativa `uuidv7()` de PostgreSQL 18.7 para mantener orden secuencial en índices B-Tree sin exponer identificadores predecibles:  
• **Tipo Enumerado (**`**tipo_menu_enum**`**):** `'Estándar'`, `'Vegetariano'`, `'Vegano'`, `'Celíaco'`, `'Menú Infantil'`.   
**1. **`**admins**`** (Lista blanca de SuperAdmins):**  
• `id`: `uuid` — `PK`, `NOT NULL`, `DEFAULT uuidv7()`  
• `nombre`: `varchar(100)` — `NOT NULL`  
• `email_google`: `varchar(255)` — `UNIQUE`, `NOT NULL` *(normalizado a minúsculas mediante `.trim().toLowerCase()` en validación Zod)*  
• `activo`: `boolean` — `NOT NULL`, `DEFAULT true`  
• `created_at`: `timestamptz` — `NOT NULL`, `DEFAULT now()`  
**2. **`**novios**`** (Cuentas de boda y configuración principal):**  
• `id`: `uuid` — `PK`, `NOT NULL`, `DEFAULT uuidv7()`  
• `admin_id`: `uuid` — `FK -> admins.id` (`ON DELETE RESTRICT`), `NOT NULL`  
• `nombres_pareja`: `varchar(150)` — `NOT NULL`  
• `slug_plantilla`: `varchar(100)` — `NOT NULL` (identificador de la plantilla del catálogo)  
• `fecha_evento`: `timestamptz` — `NULL` (opcional; permite diferir o automatizar la creación de invitaciones cuando la fecha vive en el diseño)  
• `rsvp_deadline`: `timestamptz` — `NOT NULL` (fecha límite para bloquear modificaciones de invitados)   
`**max_accesos**` : `integer` — `NOT NULL`, `DEFAULT 2`, `CHECK (max_accesos >= 1)` *(cupo máximo de correos Google habilitados para administrar esta boda)*.  
• `created_at`: `timestamptz` — `NOT NULL`, `DEFAULT now()`

- `plantilla_mensaje: text NULL` (plantilla compartida de mensaje con variables `{familia}`, `{enlace}`, `{pases}`)  
  
  
**3. **`**accesos_autorizados**`** (Correos Google OAuth habilitados por boda — Relación **`**1:N**`** con **`**novios**`**):**

- `id`: `uuid` — `PK`, `NOT NULL`, `DEFAULT uuidv7()`

- `novios_id`: `uuid` — `FK -> novios.id` (`ON DELETE CASCADE`), `NOT NULL`

- `autorizado_por_admin_id`: `uuid` FK -> `admins.id` (ON DELETE SET NULL), NULL *(Actualizado: Registra qué SuperAdmin aprobó el correo; permite **`NULL`** cuando se ejecuta mediante **`MASTER_API_KEY`**)*  
• `**email_google**` : `varchar(255)` — `NOT NULL` *(Actualizado: se reemplaza el **`UNIQUE`** global por la restricción compuesta **`UNIQUE (novios_id, email_google)`** para permitir que un mismo correo Google administre múltiples bodas sin duplicarse dentro de la misma boda; normalizado a minúsculas mediante **`.trim().toLowerCase()`** en validación Zod)*.**  
**

- `activo`: `boolean` — `NOT NULL`, `DEFAULT true`

- `created_at`: `timestamptz` — `NOT NULL`, `DEFAULT now()`  
**4. **`**familias_invitadas**`** (Datos Pre-Envío inmutables por el invitado — Relación **`**1:N**`** con **`**novios**`**):**  
• `id`: `uuid` — `PK`, `NOT NULL`, `DEFAULT uuidv7()`  
• `novios_id`: `uuid` — `FK -> novios.id` (`ON DELETE CASCADE`), `NOT NULL`  
• `token_enlace`: `varchar(120)` — `UNIQUE`, `NOT NULL` (slug amigable único para acceso público con sufijo aleatorio de 12 caracteres, ej. `familia-perez-8x9k2m7p4q1z`)   
• `familia_nombre`: `varchar(150)` — `NOT NULL`   
• `email`: `varchar(255)` — `NOT NULL` *(normalizado a minúsculas mediante `.trim().toLowerCase()` en validación Zod)*   
• `telefono`: `varchar(30)` — `NULL` (opcional; preparado para futura integración de envíos por WhatsApp)

- `**num_adultos**` : `integer` — `NOT NULL`, `CHECK (num_adultos >= 1)` *(mínimo 1)*.

- `**num_ninos**` : `integer` — `NOT NULL`, `DEFAULT 0`, `CHECK (num_ninos >= 0)` *(mínimo 0)*.  
• `mensaje_personalizado`: `text` — `NULL`

- `invitacion_enviada_at: timestamptz -- NULL`   
**5. **`**respuestas_rsvp**`** (Confirmación Post-Envío — Relación **`**1:1**`** con **`**familias_invitadas**`**):**  
• `id`: `uuid` — `PK`, `NOT NULL`, `DEFAULT uuidv7()`  
• `familia_id`: `uuid` — `UNIQUE`, `FK -> familias_invitadas.id` (`ON DELETE CASCADE`), `NOT NULL` (la ausencia de fila indica estado *"Pendiente"*)  
• `asistencia_confirmada`: `boolean` — `NOT NULL` (`true` = Asiste, `false` = No asiste)   
• `**cant_asistentes**` : `integer` — `NOT NULL`, `CHECK (cant_asistentes >= 0)`.**  
**• `alergias`: `text` — `NULL`   
• `cancion_favorita`: `varchar(200)` — `NULL`   
• `mensaje_novios`: `text` — `NULL`   
• `updated_at`: `timestamptz` — `NOT NULL`, `DEFAULT now()`  
**6. **`**rsvp_menus**`** (Desglose individual de platos — Relación **`**1:N**`** con **`**respuestas_rsvp**`**):**  
• `id`: `uuid` — `PK`, `NOT NULL`, `DEFAULT uuidv7()`  
• `respuesta_id`: `uuid` — `FK -> respuestas_rsvp.id` (`ON DELETE CASCADE`), `NOT NULL`  
• `tipo_menu`: `tipo_menu_enum` — `NOT NULL`
[Tu Invitación Especial_2026-11-14T17_38_34.792Z.sql](Tu_Invitacin_Especial_2026-11-14T17_38_34.792Z.sql)
**B. Datos de Entrada (Inputs)**

**Formulario de Configuración (Panel Novios PRE-Envío):**

- `familia_nombre` (String, Requerido): Nombre identificador de la invitación (Ej: "Familia Pérez Silva").

- `email` (String, Requerido): Email validado con estructura estándar (`user@domain.com`).

- `telefono` (String, Opcional): Número de celular de contacto de la familia (preparado para futura integración de envíos por WhatsApp). 

- `num_adultos` (Integer, Requerido): Cantidad de pases de adulto asignados (Mínimo 1).

- `num_ninos` (Integer, Requerido): Cantidad de pases de niños asignados (Mínimo 0).

- `mensaje_personalizado` (String, Opcional): Mensaje único para esa familia.

- `archivo_csv` (Estructura delimitada por `,` o `;`): Archivo para la acción "Importar desde Excel". Soporta autodetección de delimitadores y mapeo inteligente de cabeceras (reconoce variaciones como `"Familia"`, `"Invitado"`, `"Correo"`, `"Teléfono"`, `"Adultos"`, etc.) generando una vista previa editable antes del guardado definitivo.  
.

**Formulario de Confirmación (Vista del Invitado):**

- `asistencia_confirmada` (Boolean, Requerido): `True` (Sí) o `False` (No).

- `cant_asistentes` (Integer, Requerido si asistencia es `True`): No puede exceder la suma de pases asignados (`num_adultos + num_ninos`).

- `menus_seleccionados` (Arreglo de `tipo_menu_enum`, Requerido si asiste): Lista con el menú elegido para cada asistente confirmado, persistida como filas individuales en `rsvp_menus`. La cantidad de elementos seleccionados debe coincidir exactamente con `cant_asistentes`. Valores permitidos por persona: `Estándar`, `Vegetariano`, `Vegano`, `Celíaco`, `Menú Infantil`. 

- `alergias` (String, Opcional): Texto libre para especificar restricciones médicas.

- `cancion_favorita` (String, Opcional): Texto con formato sugerido `Canción - Artista`.

- `mensaje_novios` (String, Opcional): Dedicatoria para el Libro de Visitas.

> **Índices B-Tree de Rendimiento y Claves Foráneas (**`**[NUEVO]**`**):**  
Dado que PostgreSQL solo crea índices automáticos en `PRIMARY KEY` y `UNIQUE`, se agregan índices B-Tree explícitos sobre claves foráneas y columnas de filtro frecuente para optimizar consultas del Panel/Dashboard, autenticación OAuth y borrados `ON DELETE CASCADE` / `SET NULL`:

- `idx_novios_admin_id` sobre `novios(admin_id)`

- `idx_accesos_autorizados_novios_id` sobre `accesos_autorizados(novios_id)`

- `idx_accesos_autorizados_email_google` sobre `accesos_autorizados(email_google)`

- `idx_accesos_autorizados_admin_id` sobre `accesos_autorizados(autorizado_por_admin_id)`

- `idx_familias_invitadas_novios_id` sobre `familias_invitadas(novios_id)`

- `idx_rsvp_menus_respuesta_id` sobre `rsvp_menus(respuesta_id)`

**B. Datos de Salida (Outputs / Vistas Generadas)**

**Landing Page Principal:**

- **Hero Section:** Propuesta de valor y llamado a la acción inicial.

- **Catálogo:** Galería visual de los diseños de invitaciones disponibles.

- **Functions:** Bloque explicativo detallando las ventajas tecnológicas de la invitación.

- **FAQ:** Acordeón de preguntas frecuentes para resolver dudas de clientes.

> **Invitación Interactiva (Vista del Invitado — Endpoint **`**/papel-rasgado**`**):**

1. **Sobre Interactivo (**`**BeachEnvelope**`**):** Apertura animada de sobre artesanal con solapa.

1. **Hero Section (**`**BeachHero**`**):** Fotografía principal con efecto de particulas.

1. **Cuenta Regresiva (**`**BeachCountdown**`**):** Anuncio de fecha/hora y contador en vivo (toma `novios.fecha_evento` si está definida, o la fecha configurada en la plantilla si es `NULL`). **[actualizado]**

1. **Frase Romántica (**`**BeachQuote**`**):** Cita emotiva de la pareja enmarcada.

1. **Galería de Recuerdos (**`**BeachGallery**`**):** Carrusel de fotos con marco artesanal.

1. **Ubicación & Acceso (**`**BeachLocation**`**):** Dirección del recinto con google maps button.

1. **Itinerario del Evento (**`**BeachItinerary**`**):** Línea de tiempo vertical con guía dorada.

1. **Código de Vestimenta (**`**BeachDressCode**`**):** Estilo sugerido con guía visual.

1. **Mesa de Regalos (**`**BeachGift**`**):** Caja de regalo interactiva que abre modal con datos.

1. **Álbum de Fotos Compartido (**`**BeachPhotoAlbum**`**):** Código QR dinámico y enlace directo.

1. **Confirmación de Asistencia (**`**BeachRsvp**`**):** Formulario R.S.V.P. vinculado al `token_enlace`. **[actualizado]**

1. **Firma & Despedida (**`**BeachSignature**`**):** Cierre caligráfico con los nombres de los novios.

1. **Separadores Rasgados (**`**ArtisanTornDivider**`** / **`**BeachTornDivider**`**):** Divisores visuales de papel rasgado.

**Panel R.S.V.P. PRE-Envío (Configuración de Invitados):**

- **Descarga de Plantilla Oficial:** Botón visible *"Descargar plantilla de ejemplo (.xlsx / .csv)"* que entrega un archivo preconfigurado con las cabeceras oficiales (`familia_nombre`, `email`, `**telefono**`, `num_adultos`, `num_ninos`, `mensaje_personalizado`) y 2 filas de muestra para guiar a los novios.

- **Zona de Carga Masiva (Dropzone):** Área de arrastrar y soltar para archivos `.xlsx` y `.csv` con asistente de mapeo y tabla de previsualización editable (*Staging*).

- **Formulario de Carga Individual:** Campos manuales para agregar familias una por una sin necesidad de usar Excel.

- **Constructor de Mensaje Unificado y Borrador en Vivo:** Editor de texto compartido entre ambos novios (`novios.plantilla_mensaje`) que soporta variables dinámicas (`{familia}`, `{enlace}`, `{pases}`) y una casilla/selector de previsualización en tiempo real para visualizar cómo quedará el mensaje exacto antes de enviarlo. 

- **Tabla Maestra Pre-Envío (Gestión CRUD y Distribución Granular WhatsApp):** Lista interactiva de `familias_invitadas` con indicador de estado de envío (`invitacion_enviada_at`) y enlace amigable individual (`token_enlace`). Cada fila integra acciones directas para: 

  - **Distribuir por WhatsApp:** Botón de apertura directa en WhatsApp Web (`[https://wa.me/](https://wa.me/){telefono}?text=...`) con el mensaje interpolado y botón de copia rápida. 

  - **Gestionar registros (CRUD):** Acciones para **editar** datos (nombre, correo, teléfono, cantidad de adultos/niños, mensaje personalizado) y **eliminar** familias de la lista (con confirmación visual si la familia ya tiene un R.S.V.P. registrado, ya que `ON DELETE CASCADE` eliminará su respuesta y platos asociados).

- **Acción de Envío Masivo por Correo (1-Click con Modal de Confirmación):** Botón principal *"Enviar invitaciones por Correo"* que abre un **modal de confirmación obligatorio** detallando: cantidad exacta de destinatarios seleccionados (o pendientes de envío), asunto del correo y una vista previa del borrador interpolado. Al confirmar, despacha los correos en segundo plano sin bloquear la interfaz.

#### **Panel R.S.V.P. POST-Envío (Dashboard de los Novios):**

- **Resumen Ejecutivo:** Tarjetas numéricas con Total Invitados Confirmados, Invitados Pendientes / en Duda (registros de `familias_invitadas` sin fila en `respuestas_rsvp`), No Asistirán y un contador de Días Restantes para la boda (calculado desde `fecha_evento`, o mostrando los días restantes hasta `rsvp_deadline` si `fecha_evento` es `NULL`). 

- **Gestión de Menús:** Gráfico o lista que agrupa `rsvp_menus` por `tipo_menu` con la Cantidad Seleccionada acumulada. 

- **Caja de Alertas Alergias:** Tarjeta de UI destacada que renderiza exclusivamente las filas donde `alergias` no esté vacío, mostrando `familia_nombre` junto a su texto de alerta.

- **Lista de Reproducción:** Tabla con columnas `Canción / Artista` y `Quién la pidió` (mapeado desde `familia_nombre`).

- **Libro de Visitas Digital:** Grid dinámico tipo muro con tarjetas que muestran los `mensaje_novios`.

- **Tabla Maestra de Invitados:** Grilla interactiva con filtros rápidos (`Confirmados`, `No asistentes`, `Pendientes`). Columnas requeridas: `Familia/Invitado`, `Pases Totales`, `Asistentes Confirmados`, `Tipo de Menú`, `Canción`, `Mensaje`, y `Fecha de Respuesta` (`updated_at`). 

- **Archivo CSV de Salida:** Botón "Descargar Excel" que genera un archivo estructurado con toda la Tabla Maestra.

#### **4. Permisos de Usuario (RBAC) y Reglas de Negocio**

- **Permiso SuperAdmin (Propietario de la Plataforma):** Acceso exclusivo mediante inicio de sesión con Google validado contra la lista blanca de la tabla `admins` (y respaldo de `MASTER_API_KEY` para scripts administrativos) para dar de alta nuevas bodas en `novios`, definir su fecha límite (`rsvp_deadline`), fecha opcional del evento (`fecha_evento`), el límite de accesos (`max_accesos`) y autorizar los correos de los novios en `accesos_autorizados` tras cerrar la venta por WhatsApp **[Actualizado: registrando su **`**admin.id**`** en **`**autorizado_por_admin_id**`** para auditoría, o **`**NULL**`** si se ejecuta vía API Key]**

**Permiso Novios (Cliente — Acceso Compartido y Multi-Boda):** Acceso exclusivo mediante Inicio de Sesión con Google (Google OAuth) en las rutas del frontend (`/panel/login`, `/panel/seleccionar-boda`, `/panel/pre-envio`, `/panel/dashboard`). El sistema consulta todas las filas activas en `accesos_autorizados` (`activo = true`) vinculadas al correo autenticado:

- **0 bodas activas:** Acceso denegado (`403 Forbidden` / pantalla de correo no autorizado).

- **1 boda activa:** Resolución automática de su único `novios_id` e ingreso directo al panel sin pasos intermedios.

- **2 o más bodas activas:** Redirección a `/panel/seleccionar-boda` para elegir la boda a administrar (mostrando `nombres_pareja`, `fecha_evento` y `slug_plantilla`), permitiendo cambiar de boda desde el panel sin cerrar sesión.

Tienen privilegios completos de creación, lectura, edición y eliminación (CRUD) exclusivamente sobre los registros de `familias_invitadas` vinculados al `novios_id` activo seleccionado, además de poder editar su plantilla de mensaje (`novios.plantilla_mensaje`). No pueden modificar fechas límite (`rsvp_deadline`), cupos de acceso (`max_accesos`) ni el catálogo general.

**Gestión de Sesión y Revocación (Camino B — Sesión Stateful en Redis + Cookie HttpOnly):** El frontend envía el Google ID Token (JWT) **una única vez** en el login. El servidor lo verifica criptográficamente (`verifyGoogleIdToken`), consulta `admins` y `accesos_autorizados` (`activo = true`), genera un identificador opaco criptográfico (`crypto.randomBytes(32)`), guarda el estado de sesión en **Redis 8.0** con un **TTL de 7 días (604 800 s)** y emite una cookie `HttpOnly; Secure; SameSite=Lax` (sin exponer tokens en `localStorage`). Al cerrar sesión o marcar `activo = false`, la sesión se revoca de inmediato en Redis sin esperar a la expiración del JWT de Google.

- **Permiso Invitado:**Acceso público a través del enlace amigable de su invitación (ej. `/papel-rasgado?t=familia-perez-8x9k2m7p4q1z`) para leer los datos del evento y enviar o modificar su confirmación mientras el plazo siga vigente *(reemplaza "una única vez")*.

- **Regla de Negocio (BR-01 — Límite de Pases y Menús):** Un invitado no puede confirmar una cantidad de asistentes (`cant_asistentes`) superior a los pases totales asignados en la fase Pre-Envío (`num_adultos + num_ninos`), y debe seleccionar exactamente un menú por cada asistente confirmado (`COUNT(rsvp_menus) == cant_asistentes`).

- **Regla de Negocio (BR-02 - Distribución Dual: WhatsApp Granular y Correo Masivo):** El sistema soporta dos canales de distribución utilizando la misma plantilla dinámica (`novios.plantilla_mensaje`):  
1. **Canal WhatsApp (Granular):** Acción por fila que interpola los datos de la familia y redirige a `wa.me` para distribución manual (sin usar WhatsApp API).   
2. **Canal Email (Masivo):** Ejecución en 1 clic tras superar una ventana de confirmación explícita. El backend encola el lote en **BullMQ** (aprovechando la instancia de Redis 8.0 ya definida en el stack) para enviar los correos de forma asíncrona con control de tasa (rate-limiting), reintentos automáticos y actualización de `invitacion_enviada_at`. 

- **Regla de Negocio (BR-03 — Ventana de Edición de R.S.V.P.):** El invitado puede modificar su respuesta todas las veces que desee antes de la fecha límite del evento (`rsvp_deadline`). Una vez cumplida esa fecha, el formulario pasa a estado de solo lectura y rechaza nuevas modificaciones.

- **Regla de Negocio (BR-04 — Control de Accesos Compartidos por Boda):** Cada registro en `novios` establece un cupo `max_accesos` (valor por defecto `2`). El sistema impide vincular nuevos correos en `accesos_autorizados` a una misma boda si se alcanza dicho límite, salvo que el SuperAdmin amplíe el cupo de la cuenta.

- **Regla de Negocio (BR-05 - Consistencia al Editar Pases de Invitados Confirmados):** Si los novios editan una familia y reducen su total de pases asignados (`num_adultos + num_ninos`) por debajo de los `cant_asistentes` que esa familia ya había confirmado, el sistema invalida su confirmación previa (eliminando el registro en `respuestas_rsvp` y `rsvp_menus`) para que la familia vuelva a confirmar dentro de su nuevo cupo

- **Regla de Negocio (BR-06 — Acceso Multi-Boda y Aislamiento por Cuenta):** Un mismo correo Google puede estar autorizado en múltiples bodas mediante la restricción compuesta `UNIQUE (novios_id, email_google)` en `accesos_autorizados`, sin poder repetirse dentro de una misma boda. Si el usuario tiene 1 boda activa ingresa automáticamente; si tiene 2 o más debe seleccionar una antes de operar. En cada petición al backend del panel, el servidor debe validar obligatoriamente que el correo autenticado tenga `activo = true` para el `novios_id` específico solicitado (*tenant isolation*).  
  
  

---

---

## **CAPA 3: MANEJO DE EXCEPCIONES Y PRUEBAS (Resiliencia y Verificación)**

### **5. Casos Límite y Estrategia de Errores (Edge Cases)**

- **Importación Tolerante de Listas (**`**.xlsx**`** / **`**.csv**`**) y Pipeline de Saneamiento (Patrón *****Upload → Mapping → Staging → Commit*****): **Para evitar errores de formato típicos de herramientas ofimáticas en español y garantizar que usuarios no técnicos puedan cargar su lista sin fricciones, el sistema separa el procesamiento del archivo en el navegador del guardado transaccional en el servidor mediante las siguientes 5 etapas:

### **Soporte Multi-Formato, Codificación y Plantilla Oficial:**

- El área de carga acepta archivos nativos de Excel (`.xlsx`) y archivos planos (`.csv`), incluyendo un botón visible de **"Descargar plantilla de ejemplo (**`**.xlsx**`** / **`**.csv**`**)"** con la estructura oficial preconfigurada (`familia_nombre`, `email`, `telefono`, `num_adultos`, `num_ninos`, `mensaje_personalizado`).

- Para archivos `.csv`, el lector en el navegador (frontend) detecta automáticamente tanto el delimitador (coma `,` o punto y coma `;`) como la codificación de caracteres (`UTF-8` o `ANSI / Windows-1252`), evitando la corrupción de tildes y eñes (ej. Pérez, Muñoz) exportadas desde Excel en Windows.

### **Mapeo Inteligente con Confirmación Humana:**

- El algoritmo normaliza las cabeceras del archivo subido (convierte a minúsculas, elimina tildes y espacios extra) y las empareja automáticamente con los campos del contrato mediante un diccionario de sinónimos (ej. `"Familia"`, `"Invitado"`, `"Grupo"` $\rightarrow$ `familia_nombre`; `"Correo"`, `"Mail"`, `"E-mail"` $\rightarrow$ `email`; `"Teléfono"`, `"Celular"`, `"WhatsApp"` $\rightarrow$ `telefono`; `"Adultos"`, `"Cupos"` $\rightarrow$ `num_adultos`).

- Antes de procesar los registros, se presenta una vista intermedia de asignación donde los novios pueden verificar el emparejamiento sugerido y corregir manualmente cualquier columna mediante selectores desplegables (dropdowns) en caso de ambigüedad. 

### **Saneamiento Silencioso y Detección de Duplicados:**

- Antes de ejecutar las validaciones estrictas, el sistema limpia automáticamente errores comunes de digitación: elimina espacios en blanco residuales al inicio o final de cada texto (`trim`) y transforma celdas vacías o con guiones (`-`) en `num_ninos` al valor numérico `0` (y celdas vacías de `telefono` en `null`). 

- Simultáneamente, escanea la lista completa en busca de registros repetidos dentro del mismo archivo (coincidencia de `email` o `familia_nombre`), marcándolos con una advertencia visual amarilla (`"Posible invitado duplicado"`)

### **Tabla de Previsualización Tolerante (*****Staging***** e *****Inline Edit*****):**

Cada fila se valida en memoria en el navegador utilizando el mismo esquema de reglas del servidor (Zod). En lugar de rechazar todo el archivo por un error aislado, se despliega una tabla interactiva con las siguientes herramientas:

- **Filtro rápido de errores:** Botón *"Mostrar solo filas con errores (N)"* para aislar de inmediato los registros problemáticos.

- **Edición directa en celda (*****Inline Edit*****):** Las celdas inválidas (ej. texto en un campo numérico o email mal formado) se resaltan en rojo y permiten hacer clic para corregir el dato directamente en pantalla sin volver a subir el archivo.

- **Descarte selectivo:** Cada fila incluye una acción para eliminarla de la importación, permitiendo guardar las filas válidas si los novios deciden omitir temporalmente un registro incompleto.

### **Contrato JSON Limpio y Guardado Atómico en Backend:**

- El servidor nunca recibe ni parsea archivos planos directamente. Una vez que los novios confirman la tabla de previsualización sin errores bloqueantes, el cliente envía un arreglo **JSON limpio y tipado** al endpoint `POST /api/invitations/batch`.

-  Fastify revalida el lote completo en el servidor por seguridad y ejecuta una inserción masiva en `familias_invitadas` dentro de una única transacción ACID (`COMMIT` total o `ROLLBACK` ante fallos inesperados), generando los `token_enlace` amigables correspondientes. 

- **Confirmaciones Simultáneas y Edición de Respuesta (Patrón Transaccional *****Delete-Insert*****):** Si dos miembros de una misma familia abren el enlace al mismo tiempo, el sistema garantiza la consistencia serializando las escrituras por `familia_id` mediante bloqueo a nivel de fila en PostgreSQL (`SELECT ... FOR UPDATE` sobre `respuestas_rsvp`) o mediante encolamiento secuencial por familia en BullMQ (Redis 8.0), asegurando que persista únicamente el último envío recibido. Cuando una familia modifica una confirmación previa (ej. cambia de 4 a 2 asistentes o altera sus platos), la transacción actualiza la fila única en `respuestas_rsvp` (`updated_at = now()`), ejecuta un reemplazo atómico en `rsvp_menus` (`DELETE` de los platos previos asociados a ese `respuesta_id` seguido de `INSERT` de los nuevos platos) y **recalcula desde cero** los contadores totales de la boda para evitar duplicidades en el panel.

- **Intento de Confirmación Fuera de Plazo (**`**Fecha Actual supera Fecha Límite**`**):** Si el invitado abre su enlace o intenta guardar cambios después de la fecha límite configurada para la boda, la interfaz deshabilita los controles de edición y muestra el aviso: *"El plazo para confirmar o modificar tu asistencia ha finalizado"*.

- **Asistencia Negativa (**`**asistencia_confirmada = false**`**):** Cuando el invitado marca que no asistirá, los selectores de menú se deshabilitan automáticamente en la interfaz y el sistema guarda `asistencia_confirmada = false` y `cant_asistentes = 0` en `respuestas_rsvp`, eliminando cualquier fila previa (o insertando 0 filas) en `rsvp_menus` y moviendo el registro al filtro de `"No asistentes"` del panel de control.   
  

### **6. Criterios de Aceptación (Escenarios Executables BDD)**

**Escenario 1: Descarga de plantilla e importación inteligente de invitados (Pre-Envío)**

- **Dado** que los novios han iniciado sesión con su cuenta de Google en su Panel Pre-Envío 

- **Y** opcionalmente han descargado la plantilla oficial de ejemplo (`.xlsx` o `.csv`) para estructurar su lista 

- **Cuando** arrastran su archivo `"lista_invitados.xlsx"` o `"lista_invitados.csv"` con 50 familias, validan el mapeo de columnas en la vista de previsualización y confirman el guardado 

- **Entonces** el sistema inserta las 50 familias en `familias_invitadas` dentro de una transacción atómica y genera sus respectivos enlaces amigables (`token_enlace`)

**Escenario 2: Invitado intenta exceder sus pases permitidos (Formulario Invitado)**

Dado que un invitado abre su enlace personalizado (`/papel-rasgado?t=familia-perez-8x9k2m7p4q1z`) antes de la fecha límite, donde tiene asignados 2 pases de adulto y 0 niños  
Cuando marca "Sí asistiré"  
Y cambia el contador de asistentes a "3" personas  
Entonces el formulario bloquea el botón de envío  
Y muestra un mensaje de validación interactivo que indica "No puedes exceder el máximo de 2 pases"

**Escenario 3: Selección de menús individuales y recuento en tiempo real (Post-Envío)**

- **Dado** que la `"Familia Gómez"` tiene una invitación con 4 pases y decide confirmar la asistencia de 3 personas 

- **Cuando** el formulario les despliega 3 selectores de menú individuales y eligen 2 menús `"Vegano"` y 1 menú `"Estándar"` 

- **Entonces** el sistema guarda la respuesta en `respuestas_rsvp`, inserta las 3 filas correspondientes en `rsvp_menus` y recalcula los totales actuales de la boda.

- **Y** el contador del Dashboard `"Total Invitados Confirmados"` refleja exactamente los 3 asistentes de esa familia 

- **Y** la sección `"Gestión de Menús"` refleja `+2` en la categoría `"Vegano"` y `+1` en la categoría `"Estándar"` 

- **Y** si mañana la Familia Gómez edita su respuesta antes de la fecha límite, el sistema reemplaza sus platos en `rsvp_menus` y el Dashboard actualiza sus valores anteriores sin duplicar sumas. 

**Escenario 4: Bloqueo por fecha límite vencida (Formulario Invitado)**

Dado que la fecha límite de confirmación de la boda era el 25 de Octubre  
Cuando un invitado abre su enlace personalizado el 26 de Octubre e intenta modificar su asistencia  
Entonces el formulario se muestra bloqueado en modo lectura con el mensaje "El plazo de confirmación ha finalizado"  
Y el servidor rechaza cualquier intento de envío para proteger el cierre de listas de los novios

**Escenario 5 (WhatsApp Granular + Borrador en Vivo):** Validar que al redactar el mensaje con variables y elegir una familia en la casilla de vista previa, el borrador muestra el texto real y el botón de WhatsApp de esa fila abre `wa.me` con el mensaje listo.  
  
**Escenario 6 (Envío Masivo por Correo con Confirmación):**  
• **Dado** que los novios tienen 50 familias cargadas con correos válidos y su plantilla de mensaje configurada   
• **Cuando** presionan *"Enviar masivamente por correo"*  
• **Entonces** el sistema despliega un modal de confirmación indicando el total de destinatarios (ej. *"Se enviarán 50 correos personalizados"*) y el borrador de muestra  
• **Y** solo cuando los novios hacen clic en *"Confirmar y Enviar"*, el servidor encola el envío en BullMQ y actualiza el estado de cada fila a enviado.

**Escenario 7 (Acceso Multi-Boda y Aislamiento de Cuenta):**

- **Dado** que el correo `planner@gmail.com` está autorizado con `activo = true` en 2 bodas distintas en `accesos_autorizados`

- **Cuando** inicia sesión con Google en `/panel/login`

- **Entonces** el sistema detecta más de una boda activa y lo redirige a `/panel/seleccionar-boda` para elegir qué boda administrar (mientras que un usuario con exactamente 1 boda activa ingresa automáticamente al panel)

- **Y** cualquier petición a la API con un `novios_id` para el cual el correo no tenga `activo = true` es rechazada con `403 Forbidden`.

## **CAPA 4: INFRAESTRUCTURA Y ARQUITECTURA**

**7. Stack Tecnológico Sugerido para SDD**

- **Naturaleza de la Información:** Datos relacionales estructurados para el control de asistencia y métricas del dashboard; archivos planos de intercambio (CSV).

- **Definición Tecnológica:**
## **Frontend (Capa de Presentación):** 

  - Astro 5 (Islands Architecture) + React 18 (TypeScript) + Tailwind CSS 3.4 + SVG Vectorial Shaders / Primitivas

## **Backend (API / Contratos):**

### **📋 Matriz de Versiones Cerradas**

| Capa / Rol | Tecnología | Versión Cerrada | Justificación Técnica y Soporte en `linux/arm64` |
| --- | --- | --- | --- |
| **Sistema Operativo** | **Ubuntu Server LTS (ARM64)** | `**22.04.5 LTS**` *(Jammy)* | Estabilidad probada en OCI Ampere A1 (`aarch64`) con Kernel HWE 6.8 y soporte `io_uring`. |
| **Contenerización** | **Docker Engine** | `**29.9.2**` *(Rama 29) ****Not LTS*** | Motor de contenedores aislado con soporte nativo multi-arquitectura `linux/arm64`. |
| **Orquestación Local** | **Docker Compose** | `**v5.7.1**` *(Rama 5)**** Not LTS*** | Gestión declarativa de servicios, redes internas, volúmenes NVMe y cuotas de RAM/CPU. |
| **Reverse Proxy / TLS** | **Caddy Server (ARM64)** | `**2.11.9 **`***Not LTS*** | Binario nativo `arm64`, HTTPS/HTTP3 automático y soporte *zero-config* para streaming SSE. |
| **Frontend** | **Astro + React + Tailwind** | `Astro 5.18` / `React 18.3` / `TW 3.4 `***Not LTS*** | Islands Architecture con TypeScript (`5.7.2+`, independiente del backend) y shaders SVG. |
| **Runtime Backend** | **Node.js LTS** | `**v26 LTS**` *(Fallback: **`v24 LTS`**) * | Soporte activo hasta **Abril 2029**, ejecución TS nativa y optimización V8 para ARM64. |
| **Lenguaje Backend** | **TypeScript** | `**7.0.x **`***Not LTS*** | Compilador nativo en Go (`tsgo`), y y que Node 26 LTS ejecuta TS de forma nativa. |
| **Framework API** | **Fastify** | `**v5.x LTS**` *(Estable) * | Serialización JSON de alta velocidad, bajo uso de CPU en 2 OCPU y arquitectura modular. |
| **Motor de Contratos SDD** | **Zod** + `fastify-type-provider-zod` | `**v4.x**` *(Estable) ****Not LTS*** | Validación ultrarrápida de contratos de Capa 2 (`BR-01`, enums) y parseo masivo de filas CSV. |
| **Base de Datos** | **PostgreSQL** | `**18.7 LTS **`*(Lanzamiento 19 Nov 2026)* | `uuidv7()` nativo, I/O asíncrono (AIO), transacciones ACID (Rollback CSV) y `SELECT ... FOR UPDATE`. |
| **ORM / Migraciones** | **Drizzle ORM** + `drizzle-kit` | `**v0.45.4**` *(Estable) ****Not LTS*** | Consultas SQL *type-safe* de cero sobrecarga en TS 7.0.2 sin motores binarios pesados en ARM64. |
| **Gestor de Colas** | **BullMQ** | `**v6.7.0**` * ****Not LTS*** | Colas de trabajo asíncronas, reintentos exponenciales y desacoplamiento de analíticas post-RSVP. |
| **Motor In-Memory** | **Redis** | `**8.0 LTS**` *(**`redis:8.0-alpine`**)* | Ejecución atómica de scripts Lua para BullMQ, almacenamiento de sesiones stateful (Camino B con TTL de 7 días) y bus *Pub/Sub* para el Dashboard en tiempo real. |
| **Correo Transaccional (Email SDK)** | `resend` (SDK oficial Node.js) | **v6.38.0** *(Estable — Not LTS; sin rama LTS propia)* | Paquete TypeScript puro sin binarios nativos (100% agnóstico a la arquitectura `linux/arm64`), utiliza la API `fetch` nativa de Node 26 LTS, soporta envío por lotes (`POST /emails/batch` de hasta 100 correos por petición) y cabeceras `Idempotency-Key` para evitar duplicados en reintentos de BullMQ. |

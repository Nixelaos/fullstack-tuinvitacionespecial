---
type: spec
title: Spec — Autenticación, Roles y Aislamiento Multi-Boda
description: WHAT y WHY para el alta de cuentas de boda por SuperAdmin, control de cupos de acceso, inicio de sesión con Google y aislamiento estricto entre bodas.
tags: [sdd, spec, auth, rbac]
timestamp: 2026-11-19T21:40:00Z
topic: sdd
slug: auth-rbac-y-cuentas
status: draft
---

# Spec — Autenticación, Roles y Aislamiento Multi-Boda

> Slug: `auth-rbac-y-cuentas` · Status: draft · Created: 2026-11-19
> Inherits: [constitution](../constitution.md)

## Problem & why

Los novios y wedding planners necesitan acceder a su propio panel sin crear contraseñas nuevas ni ver o alterar por error datos de otras bodas, mientras el propietario de la plataforma requiere dar de alta cuentas tras cerrar la venta y controlar quién puede administrarlas. Sin un sistema explícito de autorización y aislamiento por cuenta, un correo no autorizado podría ingresar o un planner multi-boda podría mezclar invitados de dos eventos distintos.

## Cost of not building it

Cada boda tendría que gestionarse de forma manual por soporte o compartir credenciales genéricas inseguras, exponiendo listas privadas de invitados, correos, teléfonos y alergias entre clientes distintos e impidiendo delegar la gestión en un wedding planner con varias bodas activas.

## The cheapest alternative

Proteger el panel con una contraseña compartida por boda o un enlace secreto sin inicio de sesión. No es suficiente porque las contraseñas compartidas se filtran, no permiten saber qué usuario autorizado realizó cambios, ni permiten a un mismo planner alternar entre varias bodas con una sola cuenta de Google.

## Goals

- Permitir al propietario de la plataforma (SuperAdmin) dar de alta bodas con su plantilla, fecha límite y cupo máximo de administradores autorizados.
- Permitir a novios y planners autenticarse con su cuenta de Google sin contraseñas propias de la plataforma.
- Soportar que un mismo correo de Google administre una o varias bodas activas sin fricción y con aislamiento estricto entre cuentas.
- Impedir que los novios modifiquen parámetros administrativos propios de la venta (fecha límite de confirmación, cupo de accesos o catálogo).

## Non-goals / out of scope

- Registro público abierto ("self-service sign up") sin previa venta o aprobación del SuperAdmin.
- Recuperación manual de contraseñas o autenticación con usuario y clave propios.
- Roles granulares internos dentro de una misma boda (por ejemplo, permisos de solo lectura frente a edición entre los dos novios).
- Panel de administración para proveedores externos de banquetes.

## Users & context

- **SuperAdmin (propietario de la plataforma):** Opera tras cerrar una venta por WhatsApp; crea la boda y habilita los correos Google de los novios o su planner, ya sea autenticado como administrador habilitado o mediante automatización administrativa autorizada.
- **Novios / Wedding Planner:** Acceden al panel privado desde escritorio o móvil con su cuenta de Google para preparar y consultar su evento. Un planner puede estar autorizado en múltiples bodas simultáneamente.

## What the user can do

- El SuperAdmin puede crear una nueva cuenta de boda definiendo los nombres de la pareja, el diseño elegido, la fecha opcional del evento, la fecha límite de confirmación obligatoria y el límite máximo de accesos autorizados (mínimo 1, valor inicial 2), así como autorizar o desactivar correos Google para esa boda dentro del cupo permitido.
- Un novio o planner autenticado con Google puede ingresar al panel de la boda si su correo está autorizado y activo: entra directo si tiene 1 boda activa, o elige cuál administrar en un selector de bodas si tiene 2 o más, pudiendo cambiar de boda sin cerrar sesión.
- Un usuario con 0 bodas activas no puede acceder al panel y ve un aviso claro de cuenta no autorizada.
- Ni los novios ni los planners pueden alterar la fecha límite, el cupo máximo de accesos ni el catálogo de diseños.

## What result they get

- El ingreso con Google lleva al usuario autorizado directamente al panel de su única boda, o a la pantalla de selección mostrando nombre de la pareja, fecha del evento y plantilla de cada boda activa disponible.
- Todo intento de operar sobre una boda donde el correo no tiene acceso activo es rechazado sin exponer ni modificar información de esa cuenta.
- El usuario no autorizado recibe una pantalla o rechazo explícito indicando que su correo no tiene acceso habilitado.

## What it must respect

- Los principios de seguridad y aislamiento de [constitution.md](../constitution.md) (principios 13 y 14).
- La regla `BR-04` del blueprint original (cupo `max_accesos` por boda) y `BR-06` (acceso multi-boda y aislamiento estricto por cuenta).
- Las decisiones registradas en [decisions.md](../decisions.md) y los pendientes técnicos de sesión diferidos en [notas-api-y-seguridad.md](../notas-api-y-seguridad.md).

## How it proves it

- Pruebas automatizadas de unidad e integración que verifiquen: verificación criptográfica de identidad Google con normalización de correo, rechazo de correos no habilitados o inactivos, bloqueo al superar el cupo máximo de accesos por boda (`BR-04`), resolución automática con 1 boda vs. selector con 2 o más bodas, y rechazo sistemático (`403`) ante intentos cruzados de acceso entre bodas (`BR-06`, Escenario 7).

## Behaviour

- **Main path:**
  - El SuperAdmin registra la boda y autoriza hasta `max_accesos` correos de Google normalizados, dejando traza de qué administrador autorizó cada acceso (o vacío si provino de automatización maestra).
  - El novio o planner inicia sesión con Google; el sistema consulta sus bodas activas: con exactamente 1 boda activa ingresa directo al panel; con 2 o más bodas activas visualiza el selector para elegir la boda activa y puede conmutar entre ellas sin re-autenticarse.
- **Edge cases:**
  - Un mismo correo puede autorizarse en distintas bodas, pero no duplicarse dentro de la misma boda.
  - Si un acceso pasa de activo a inactivo mientras el usuario tenía una boda asignada, sus nuevas acciones sobre esa boda quedan bloqueadas.
  - Si la fecha del evento queda sin definir al crear la boda, el selector y los paneles siguen operando apoyándose en la fecha límite de confirmación.
- **Error paths:**
  - Si un correo inicia sesión con Google y tiene 0 bodas activas (no existe o fue desactivado), el sistema deniega el ingreso sin revelar qué otros correos están registrados en la plataforma.
  - Si el SuperAdmin intenta autorizar un nuevo correo cuando la boda ya alcanzó su `max_accesos`, el sistema rechaza la operación hasta que el cupo sea ampliado.
  - Cualquier solicitud de panel dirigida a una boda para la cual el correo autenticado no está activo falla de forma explícita sin devolver datos de la boda ajena.

## Acceptance criteria

- Given un SuperAdmin autenticado y una boda con cupo `max_accesos = 2` que ya tiene 2 accesos registrados, When intenta autorizar un tercer correo sin ampliar el cupo, Then el sistema rechaza la incorporación y conserva exactamente los 2 accesos existentes.
- Given un correo `planner@gmail.com` autorizado y activo en 2 bodas distintas, When inicia sesión con Google, Then el sistema lo redirige al selector de bodas mostrando ambas bodas activas y no lo deja operar sin elegir una.
- Given un usuario autorizado únicamente en la Boda A, When intenta leer o modificar recursos pertenecientes a la Boda B, Then el sistema rechaza la petición por falta de permisos y no filtra ni altera datos de la Boda B.
- Given un usuario autenticado con Google cuyo correo tiene 0 bodas activas o fue marcado inactivo, When intenta acceder al panel, Then el acceso es denegado con aviso de correo no autorizado.
- Given un novio autenticado en su panel, When intenta modificar la fecha límite de confirmación o el cupo máximo de accesos de su boda, Then la acción es rechazada.

## Points to clarify

- **pregunta abierta** — ¿Cuánto tiempo debe permanecer vigente la sesión iniciada con Google antes de pedir re-autenticación y cómo debe propagarse la revocación cuando un acceso se marca inactivo? *(Mecanismo candidato documentado en [notas-api-y-seguridad.md](../notas-api-y-seguridad.md)).*
- **pregunta abierta** — ¿El SuperAdmin administrará altas de bodas y accesos desde una interfaz web privada dentro de `/panel` o mediante llamadas/scripts administrativos en la primera versión?
- **suposición tomada** — Al contar el cupo `max_accesos`, solo se consideran los accesos activos (o todos los registros vinculados a la boda). *Base:* evitar que alguien desactivado consuma permanentemente uno de los 2 cupos gratuitos de la pareja. *Riesgo:* confirmar si un acceso desactivado libera cupo o si debe eliminarse para liberar espacio.
- **decisión diferida** — Esquemas HTTP exactos, nombres de cookie/cabeceras y política de rate-limiting quedan diferidos para `plan` según [notas-api-y-seguridad.md](../notas-api-y-seguridad.md).

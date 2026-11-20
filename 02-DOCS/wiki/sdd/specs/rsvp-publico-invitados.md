---
type: spec
title: Spec — Formulario Público R.S.V.P. de Invitados
description: WHAT y WHY para el acceso de invitados mediante enlace amigable, reglas de pases y menús, ventana editable hasta fecha límite y consistencia ante envíos concurrentes.
tags: [sdd, spec, rsvp, invitados]
timestamp: 2026-11-19T21:40:00Z
topic: sdd
slug: rsvp-publico-invitados
status: draft
---

# Spec — Formulario Público R.S.V.P. de Invitados

> Slug: `rsvp-publico-invitados` · Status: draft · Created: 2026-11-19
> Inherits: [constitution](../constitution.md)

## Problem & why

Los invitados necesitan confirmar su asistencia, elegir un menú individual por persona y dejar alergias o dedicatorias desde el enlace de su invitación sin crear cuentas ni instalar aplicaciones, mientras los novios necesitan garantías estrictas de que nadie confirme más pases de los asignados ni cambie su respuesta después del cierre de listas.

## Cost of not building it

Los invitados seguirían confirmando por chat o teléfono sin estructura, obligando a los novios a consolidar manualmente pases, menús especiales, alergias y canciones, con alto riesgo de sobrecupo y errores en el banquete.

## The cheapest alternative

Incrustar un formulario externo genérico (como Google Forms) enlazado desde la invitación. No basta porque no valida automáticamente el cupo personalizado por familia, no restringe por fecha límite con modo lectura mostrando el estado previo, ni vincula los platos elegidos directamente con la tabla de invitados y el panel en tiempo real.

## Goals

- Reconocer automáticamente a la familia y su cupo máximo de pases a través de su enlace amigable personalizado.
- Garantizar la paridad exacta entre asistentes confirmados y menús seleccionados dentro del cupo permitido (`BR-01`).
- Permitir al invitado editar su confirmación libremente hasta la fecha límite configurada y bloquear el formulario automáticamente tras ese cierre (`BR-03`).
- Asegurar consistencia exacta cuando dos integrantes de la misma familia responden al mismo tiempo o modifican una respuesta previa.

## Non-goals / out of scope

- Inicio de sesión o contraseña adicional para los invitados.
- Acompañantes adicionales (+1) no asignados en Pre-Envío o solicitud de ampliación de pases desde el formulario.
- Confirmación separada por sub-eventos (ej. ceremonia civil frente a recepción).
- Recordatorios automáticos antes del vencimiento de la fecha límite.

## Users & context

- **Invitado público:** Abre desde su móvil o navegador el enlace único recibido por WhatsApp o correo (por ejemplo `/papel-rasgado?t=<token_enlace>`), lee la invitación interactiva y completa o actualiza la confirmación de su grupo familiar.

## What the user can do

- Abrir su invitación personalizada para ver los datos del evento (usando la fecha del evento si fue definida o la fecha del diseño si no lo fue), su saludo/mensaje personalizado, sus pases asignados y su respuesta actual si ya había respondido.
- Confirmar que sí asistirá indicando la cantidad de asistentes entre `1` y su total de pases asignados (`adultos + niños`), eligiendo exactamente un tipo de menú por cada asistente (`Estándar`, `Vegetariano`, `Vegano`, `Celíaco`, `Menú Infantil`) y opcionalmente ingresando alergias, canción favorita y dedicatoria para los novios.
- Confirmar que no asistirá sin seleccionar menús ni asistentes.
- Modificar su respuesta todas las veces que necesite mientras la fecha límite siga vigente.

## What result they get

- Antes de la fecha límite, cada envío válido confirma de inmediato la respuesta guardada y refleja los valores actualizados si recarga su enlace o vuelve más tarde.
- Si intenta exceder sus pases asignados o dejar menús sin completar, el envío se bloquea con un mensaje claro en pantalla y el servidor lo rechaza igualmente.
- Pasada la fecha límite, la invitación muestra su última respuesta en modo de solo lectura junto al aviso `"El plazo para confirmar o modificar tu asistencia ha finalizado"`.

## What it must respect

- Regla `BR-01` (tope de pases y `COUNT(rsvp_menus) == cant_asistentes`).
- Regla `BR-03` (ventana editable hasta `rsvp_deadline` y bloqueo posterior en cliente y servidor).
- La regla de reemplazo atómico y serialización por familia ante envíos simultáneos definida en Capa 3 del SDD funcional y los principios de integridad transaccional de [constitution.md](../constitution.md).

## How it proves it

- Pruebas automatizadas en backend que cubran: carga por enlace válido e inexistente, rechazo cuando excede pases o faltan/sobran menús (`BR-01`), guardado de respuesta negativa limpiando menús previos, reemplazo limpio de menús al editar de N a M asistentes sin duplicar sumas, bloqueo tras `rsvp_deadline` (`BR-03`), y concurrencia simulada sobre la misma familia.
- Verificación de formulario en frontend cubriendo los Escenarios BDD 2, 3 y 4.

## Behaviour

- **Main path:**
  - Al abrir el enlace válido dentro del plazo, el formulario precarga el estado existente (o valores por defecto dentro del cupo). Si marca asistencia positiva para `N` personas, despliega selección de exactamente `N` platos (chips de selección única para `1` asistente o contadores `- / +` por plato con contador `X / N` y reemplazo inteligente de `'Estándar'` para `> 1` asistentes); al enviar, guarda la respuesta y reemplaza el conjunto de menús asociados dentro de una operación atómica.
  - Si una plantilla oculta el selector de menú (`features.showMenu = false`), el cliente completa automáticamente `'Estándar'` por asistente en el payload para preservar `BR-01` sin mostrar menús en la UI.
- **Edge cases:**
  - Si el invitado marca `"No asistiré"`, los controles de pases, menús, alergias y canción se ocultan/deshabilitan (manteniendo opcionalmente el campo de dedicatoria `mensaje_novios` si está activo), el payload se normaliza a `cant_asistentes = 0` y `menus_seleccionados = []`, y cualquier selección de menús de una confirmación previa se elimina.
  - Si la familia edita una confirmación previa (por ejemplo cambia de `4` asistentes a `2` o cambia sus platos), sus platos anteriores se reemplazan por completo por los nuevos sin dejar residuos ni duplicar totales en el dashboard.
  - Si dos miembros de la misma familia envían el formulario simultáneamente, las escrituras se serializan para que persista íntegra únicamente la última confirmación recibida sin mezclar menús de ambas peticiones.
- **Error paths:**
  - Si cambia el contador por encima de sus pases disponibles, el cliente bloquea el envío mostrando `"No puedes exceder el máximo de N pases"` y el servidor rechaza la petición si se forzara.
  - Si la fecha actual supera `rsvp_deadline`, tanto la interfaz como el servidor rechazan la modificación mostrando el aviso de plazo finalizado.
  - Si el enlace no existe o es inválido, se muestra un estado de invitación no encontrada sin exponer datos de otras familias.

## Acceptance criteria

- Given una familia con `2` pases de adulto y `0` niños que abre su enlace antes de la fecha límite, When marca `"Sí asistiré"` e intenta indicar `3` asistentes, Then el formulario impide enviar y muestra `"No puedes exceder el máximo de 2 pases"`.
- Given una familia con `4` pases que confirma `3` asistentes y selecciona `2` menús `"Vegano"` y `1` `"Estándar"`, When envía el formulario, Then quedan registrados `3` asistentes y exactamente esos `3` menús individuales; y si luego edita a `2` asistentes antes del plazo, los platos previos se reemplazan completamente por los `2` nuevos.
- Given una boda cuya fecha límite de confirmación venció ayer, When un invitado abre su enlace hoy e intenta confirmar o editar su asistencia, Then ve el formulario en modo lectura con el aviso `"El plazo para confirmar o modificar tu asistencia ha finalizado"` y el servidor rechaza cualquier mutación.
- Given una familia que previamente había confirmado `2` asistentes con `2` menús, When edita su respuesta marcando `"No asistiré"`, Then los selectores de menú se deshabilitan, el conteo de asistentes queda en `0` y no queda ningún menú asociado a la familia.

## Points to clarify

- **resuelto (frontend)** — Cuando un invitado marca `"No asistiré"`, se ocultan pases, menús, alergias y canción (normalizando el payload a `cant_asistentes = 0`, `menus_seleccionados = []`, `alergias = ''`, `cancion_favorita = ''`), y se mantiene disponible el campo opcional de dedicatoria (`mensaje_novios`) si la plantilla tiene `features.showDedication` activo.
- **pregunta abierta (backend)** — ¿Con qué zona horaria canónica se fija y valida `rsvp_deadline` en servidor (UTC explícito o zona horaria de Chile `America/Santiago`)? *(Nota: la capa cliente `isRsvpDeadlinePassed` ya soporta ISO local y timestamps con zona horaria `Z`/`±HH:MM`, priorizando siempre la bandera `isDeadlinePassed` devuelta por la API.)*
- **resuelto (frontend)** — El formulario en `frontend-tuinvitacionespecial/` ya fue migrado a `BR-01` (`useRsvpForm`, `rsvpUtils.ts`, `PapelRasgadoRsvpForm.tsx`) con valor canónico exacto `'Celíaco'`, selección única para 1 asistente y contadores `- / +` por plato para `> 1` asistentes (permitiendo repetir menús, ej. `2× Vegano` + `1× Estándar`).
- **resuelto en capa lógica (multi-plantilla)** — Toda la lógica R.S.V.P. quedó desacoplada a módulos globales (`types/rsvp.ts`, `data/rsvpDefaults.ts`, `utils/rsvpUtils.ts`, `hooks/useInvitationParams.ts`, `hooks/useRsvpForm.ts`, `hooks/useModal.ts`, `hooks/useRsvp.ts`) con adaptador inyectable `RsvpAdapter` y `RsvpFeatureFlags`, dejando la capa visual aislada en cada plantilla (`src/components/<plantilla>/`). Queda diferido únicamente el diseño de nuevas plantillas visuales y la implementación de `apiRsvpAdapter` contra los endpoints de Fastify.

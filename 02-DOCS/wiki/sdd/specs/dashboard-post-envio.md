---
type: spec
title: Spec — Dashboard Post-Envío, Analíticas en Tiempo Real y Exportación
description: WHAT y WHY para el panel de seguimiento de confirmaciones, menús, alertas de alergias, playlist, libro de visitas y descarga tabular para los novios.
tags: [sdd, spec, dashboard, analytics, export]
timestamp: 2026-11-19T21:40:00Z
topic: sdd
slug: dashboard-post-envio
status: draft
---

# Spec — Dashboard Post-Envío, Analíticas en Tiempo Real y Exportación

> Slug: `dashboard-post-envio` · Status: draft · Created: 2026-11-19
> Inherits: [constitution](../constitution.md)

## Problem & why

Tras enviar las invitaciones, los novios necesitan saber al instante cuántas personas asistirán, qué cantidad exacta de cada menú deben contratar con el banquetero, qué invitados reportaron alergias médicas, qué canciones pidieron y qué mensajes dejaron, sin tener que cruzar respuestas ni sumar platos a mano cada vez que un invitado modifica su confirmación.

## Cost of not building it

Los novios tendrían que revisar registros crudos o planillas manuales para contar menús y restricciones alimentarias, con riesgo de pasar por alto alergias médicas graves, duplicar conteos tras ediciones de invitados o entregar cifras desactualizadas al servicio de catering.

## The cheapest alternative

Mostrar únicamente una tabla plana sin agregaciones ni filtros y obligar a los novios a contar menús y alergias en Excel tras descargar los datos. No resuelve la necesidad porque requiere trabajo manual repetitivo y no ofrece visibilidad inmediata en vivo ni alertas destacadas de alergias.

## Goals

- Presentar un resumen ejecutivo claro de asistencias, pendientes, ausencias y cuenta regresiva de días restantes para la boda.
- Agregar con exactitud matemática los menús elegidos, reflejando de inmediato altas y modificaciones sin duplicar sumas.
- Destacar alertas de alergias médicas, agrupar canciones solicitadas y mostrar un muro de dedicatorias.
- Permitir filtrar a todas las familias en una tabla maestra y descargar la información estructurada para el banquetero o la organización.

## Non-goals / out of scope

- Acceso externo de lectura para proveedores de catering (los novios descargan y entregan el archivo).
- Gestión visual de mesas / asignación de asientos (seating chart — queda como evolución futura fuera de esta versión).
- Envío de recordatorios automáticos desde el dashboard hacia invitados pendientes.
- Edición manual por parte de los novios de los menús o respuestas que envió un invitado.

## Users & context

- **Novios / Wedding Planner autenticados:** Consultan periódicamente (y en tiempo real tras el envío de invitaciones) el panel Post-Envío de su boda activa para seguir confirmaciones y preparar los insumos finales del evento.

## What the user can do

- Consultar tarjetas de resumen ejecutivo (Confirmados, Pendientes/en Duda, No Asistirán y Días Restantes).
- Revisar el desglose acumulado de platos agrupado por los 5 tipos de menú oficiales.
- Inspeccionar la caja destacada de alertas de alergias, la tabla de canciones solicitadas con su autor y el muro de dedicatorias.
- Filtrar la tabla maestra de invitados por estado (`Confirmados`, `No asistentes`, `Pendientes`) y descargar un archivo tabular con toda la tabla maestra.

## What result they get

- Al confirmarse o editarse una respuesta en el formulario público, las métricas, desglose de menús y tabla se actualizan en el panel en tiempo real sin recargar la página ni duplicar cifras anteriores.
- Las alertas de alergias muestran únicamente a las familias que reportaron restricciones no vacías, evitando ruido visual.
- La descarga genera un archivo listo para abrir en hojas de cálculo con todas las columnas de la tabla maestra.

## What it must respect

- Aislamiento estricto por cuenta (`BR-06`): todas las métricas, alertas, canciones, dedicatorias y descargas pertenecen exclusivamente a la boda activa del usuario.
- Regla de recálculo consistente al editar menús o invalidar respuestas (`BR-05` y Escenario 3).
- El stack y principios de rendimiento/consulta de [constitution.md](../constitution.md).

## How it proves it

- Pruebas automatizadas de agregación sobre múltiples estados (familias sin respuesta, confirmadas con múltiples menús, editadas y negativas) verificando que las sumas coinciden exactamente con el estado actual sin duplicidades.
- Prueba de aislamiento asegurando que los contadores y exportaciones de la Boda A nunca incluyen datos de la Boda B.
- Prueba de descarga tabular validando cabeceras y contenido esperado con caracteres en español.

## Behaviour

- **Main path:**
  - El dashboard calcula y entrega en una vista unificada: tarjetas de resumen, conteo por categoría de menú, listado filtrado de alergias no vacías, lista de canciones (`Canción / Artista` + `Familia`), muro de mensajes (`mensaje_novios`) y tabla maestra con `Familia/Invitado`, `Pases Totales`, `Asistentes Confirmados`, `Tipo de Menú`, `Canción`, `Mensaje` y `Fecha de Respuesta`.
  - Cuando llega o cambia una confirmación R.S.V.P. en la boda activa, el panel recibe la actualización en tiempo real para refrescar indicadores y filas.
  - Al pulsar `"Descargar Excel"`, el sistema entrega un archivo estructurado con todas las filas de la tabla maestra respetando tildes y eñes.
- **Edge cases:**
  - Si `fecha_evento` no fue definida al crear la boda, el indicador de `Días Restantes` calcula los días faltantes hasta `rsvp_deadline` e indica claramente a qué fecha corresponde.
  - Si ninguna familia ha reportado alergias o canciones todavía, las tarjetas muestran un estado vacío claro sin errores.
  - Una familia que confirmó `3` personas de `4` pases asignados refleja `3` en `Asistentes Confirmados` y `4` en `Pases Totales`, y su desglose de menús suma exactamente `3`.
- **Error paths:**
  - Si la sesión del usuario no tiene acceso activo a esa boda, no recibe ni datos iniciales ni eventos en tiempo real.
  - Si la conexión en tiempo real se interrumpe momentáneamente, la interfaz puede reconectar o recargar los totales desde la fuente actual sin desincronizar contadores.

## Acceptance criteria

- Given una boda con familias pendientes, confirmadas y no asistentes, When una familia de `4` pases confirma `3` asistentes (`2` Veganos y `1` Estándar), Then el total de confirmados sube en `3`, la categoría `"Vegano"` suma `+2`, `"Estándar"` suma `+1` y la familia desaparece del estado `"Pendientes"`.
- Given la misma familia del criterio anterior que antes de la fecha límite cambia su respuesta a `1` asistente (`1` Celíaco), When guarda el cambio, Then el total de confirmados refleja la reducción neta (`-2`), `"Vegano"` y `"Estándar"` descuentan sus platos previos y `"Celíaco"` suma `+1` sin duplicar valores antiguos.
- Given 2 familias con alergias registradas y 10 sin alergias, When los novios visualizan la caja de alertas de alergias, Then aparecen exclusivamente las 2 familias con alergias junto a su texto descriptivo.
- Given una boda sin `fecha_evento` configurada y con `rsvp_deadline` dentro de 10 días, When el usuario abre el resumen ejecutivo, Then el contador de días restantes muestra `10` días respecto al cierre de confirmación sin fallar por fecha nula.
- Given una boda con respuestas mixtas en la tabla maestra, When los novios pulsan `"Descargar Excel"`, Then obtienen un archivo tabular con todas las familias, sus pases, asistentes confirmados, menús, canción, mensaje y fecha de actualización.

## Points to clarify

- **pregunta abierta** — En el resumen ejecutivo, ¿las cifras de `"Pendientes"` y `"No Asistirán"` cuentan cantidad de **personas/pases** (ej. suma de `num_adultos + num_ninos` sin responder) o cantidad de **familias** (o conviene mostrar ambos datos)?
- **pregunta abierta** — Para `"Descargar Excel"`, ¿se prefiere formato `.csv` (con BOM UTF-8 para abrir limpio en Excel) o `.xlsx` nativo con hojas/estilos?
- **suposición tomada** — En la tabla maestra, la columna `"Tipo de Menú"` para una familia con múltiples platos distintos muestra un resumen agregado (ej. `"2 Vegano, 1 Estándar"`) para mantener una fila por familia. *Base:* las filas de la tabla maestra representan familias invitadas. *Riesgo:* si el catering prefiere una fila por persona al exportar, convendría añadir esa segunda vista o columna en el exportable.
- **área no formulable** — Alcance de la futura funcionalidad de "Gestión de mesas" mencionada en el perfil del proyecto: queda fuera de este ciclo y se especificará aparte cuando toque.

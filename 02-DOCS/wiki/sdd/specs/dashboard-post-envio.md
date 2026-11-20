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

- Consultar tarjetas de resumen ejecutivo (Confirmados, Pendientes/en Duda, No Asistirán y Días Restantes) mostrando la cantidad de **personas/pases como cifra principal** y la cantidad de **familias como subtítulo** (por ejemplo: `84 personas (28 familias)`).
- Revisar el desglose acumulado de platos agrupado por los 5 tipos de menú oficiales.
- Inspeccionar la caja destacada de alertas de alergias, la tabla de canciones solicitadas con su autor y el muro de dedicatorias.
- Filtrar la tabla maestra de invitados por estado (`Confirmados`, `No asistentes`, `Pendientes`) y descargar un archivo **`.xlsx` nativo** con toda la información estructurada para el banquetero.

## What result they get

- Al confirmarse o editarse una respuesta en el formulario público, las métricas, desglose de menús y tabla se actualizan en el panel en tiempo real sin recargar la página ni duplicar cifras anteriores.
- Las alertas de alergias muestran únicamente a las familias que reportaron restricciones no vacías, evitando ruido visual.
- La descarga genera un archivo **`.xlsx` nativo** listo para abrir con doble clic en Excel, Google Sheets o Numbers, con dos hojas (`Resumen y Menús` y `Lista de Familias`), cabeceras destacadas, anchos legibles y teléfonos conservados como texto.

## What it must respect

- Aislamiento estricto por cuenta (`BR-06`): todas las métricas, alertas, canciones, dedicatorias y descargas pertenecen exclusivamente a la boda activa del usuario.
- Regla de recálculo consistente al editar menús o invalidar respuestas (`BR-05` y Escenario 3).
- Neutralización obligatoria de Formula Injection (`=`, `+`, `-`, `@`) en toda celda de texto exportada en `.xlsx` (Principio 18 de [constitution.md](../constitution.md)).
- El stack y principios de rendimiento/consulta de [constitution.md](../constitution.md).

## How it proves it

- Pruebas automatizadas de agregación sobre múltiples estados (familias sin respuesta, confirmadas con múltiples menús, editadas y negativas) verificando que las sumas coinciden exactamente con el estado actual sin duplicidades.
- Prueba de aislamiento asegurando que los contadores y exportaciones de la Boda A nunca incluyen datos de la Boda B.
- Prueba de descarga tabular validando cabeceras y contenido esperado con caracteres en español.

## Behaviour

- **Main path:**
  - El dashboard calcula y entrega en una vista unificada: tarjetas de resumen (cifra principal en **personas/pases** y subtítulo con cantidad de **familias**, ej. `84 personas (28 familias)`), conteo por categoría de menú, listado filtrado de alergias no vacías, lista de canciones (`Canción / Artista` + `Familia`), muro de mensajes (`mensaje_novios`) y tabla maestra con `Familia/Invitado`, `Pases Totales`, `Asistentes Confirmados`, `Tipo de Menú`, `Canción`, `Mensaje` y `Fecha de Respuesta`.
  - Cuando llega o cambia una confirmación R.S.V.P. en la boda activa, el panel recibe la actualización en tiempo real para refrescar indicadores y filas.
  - Al pulsar `"Descargar Excel"`, el sistema entrega un archivo **`.xlsx` nativo** con dos hojas (`Resumen y Menús` y `Lista de Familias`), cabeceras destacadas, anchos legibles, tildes/eñes preservadas y teléfonos guardados como texto (sin notación científica).
- **Edge cases:**
  - Si `fecha_evento` no fue definida al crear la boda, el indicador de `Días Restantes` calcula los días faltantes hasta `rsvp_deadline` e indica claramente a qué fecha corresponde.
  - Si ninguna familia ha reportado alergias o canciones todavía, las tarjetas muestran un estado vacío claro sin errores.
  - Una familia que confirmó `3` personas de `4` pases asignados refleja `3` en `Asistentes Confirmados` y `4` en `Pases Totales`, y su desglose de menús suma exactamente `3`; en el resumen ejecutivo, esos `3` pases suman a `Confirmados` y el `1` pase no usado se contabiliza en `No asistirán` / cupos no usados para que `Confirmados + Pendientes + No asistirán` cuadre exactamente con el total de pases invitados.
- **Error paths:**
  - Si la sesión del usuario no tiene acceso activo a esa boda, no recibe ni datos iniciales ni eventos en tiempo real.
  - Si la conexión en tiempo real se interrumpe momentáneamente, la interfaz puede reconectar o recargar los totales desde la fuente actual sin desincronizar contadores.

## Acceptance criteria

- Given una boda con familias pendientes, confirmadas y no asistentes, When una familia de `4` pases confirma `3` asistentes (`2` Veganos y `1` Estándar), Then el total de personas confirmadas sube en `3`, el contador de cupos no usados/no asistentes incorpora el `1` pase restante para cuadrar el total de pases invitados, las tarjetas muestran personas como cifra principal y familias como subtítulo, la categoría `"Vegano"` suma `+2`, `"Estándar"` suma `+1` y la familia desaparece del estado `"Pendientes"`.
- Given la misma familia del criterio anterior que antes de la fecha límite cambia su respuesta a `1` asistente (`1` Celíaco), When guarda el cambio, Then el total de confirmados refleja la reducción neta (`-2`), `"Vegano"` y `"Estándar"` descuentan sus platos previos y `"Celíaco"` suma `+1` sin duplicar valores antiguos.
- Given 2 familias con alergias registradas y 10 sin alergias, When los novios visualizan la caja de alertas de alergias, Then aparecen exclusivamente las 2 familias con alergias junto a su texto descriptivo.
- Given una boda sin `fecha_evento` configurada y con `rsvp_deadline` dentro de 10 días, When el usuario abre el resumen ejecutivo, Then el contador de días restantes muestra `10` días respecto al cierre de confirmación sin fallar por fecha nula.
- Given una boda con respuestas mixtas, teléfonos chilenos (ej. `+56912345678`) y valores de texto iniciados con `=`, `+`, `-` o `@` (ej. en dedicatorias o nombres) en la tabla maestra, When los novios pulsan `"Descargar Excel"`, Then obtienen un archivo **`.xlsx` nativo** descargable con dos hojas (`Resumen y Menús` y `Lista de Familias`), tildes/eñes correctas, teléfonos preservados como texto sin notación científica y neutralización de Formula Injection (`=`, `+`, `-`, `@`).

## Points to clarify

- **resuelto** — En el resumen ejecutivo, las cifras principales de `Confirmados`, `Pendientes` y `No Asistirán` cuentan **personas/pases** y cada tarjeta muestra la cantidad de **familias** como subtítulo (ej. `84 personas (28 familias)`); en confirmaciones parciales, los pases no utilizados de una familia confirmada se suman a `No asistirán` / cupos no usados para cuadrar con el total de pases invitados.
- **resuelto** — `"Descargar Excel"` genera un archivo **`.xlsx` nativo** (con dos hojas: `Resumen y Menús` y `Lista de Familias`, cabeceras en negrita, columnas ajustadas y teléfonos como texto) en lugar de `.csv`.
- **suposición tomada** — En la tabla maestra, la columna `"Tipo de Menú"` para una familia con múltiples platos distintos muestra un resumen agregado (ej. `"2 Vegano, 1 Estándar"`) para mantener una fila por familia. *Base:* las filas de la tabla maestra representan familias invitadas. *Riesgo:* si el catering prefiere una fila por persona al exportar, convendría añadir esa segunda vista o columna en el exportable.
- **área no formulable** — Alcance de la futura funcionalidad de "Gestión de mesas" mencionada en el perfil del proyecto: queda fuera de este ciclo y se especificará aparte cuando toque.

## Clarifications

- **2026-11-20:** *Métrica principal de las tarjetas de resumen* → contar **personas/pases como cifra principal** con subtítulo de **familias** y cuadrar los cupos no usados de confirmaciones parciales en `No asistirán` → porque el dato operativo crítico para banquetería son las personas reales y el subtítulo por familia facilita el seguimiento.
- **2026-11-20:** *Formato de `"Descargar Excel"`* → **`.xlsx` nativo** con hojas `Resumen y Menús` y `Lista de Familias` → porque evita errores de delimitador, codificación UTF-8/Windows-1252 y teléfonos en notación científica para novios sin perfil técnico al abrir en Excel.

---
type: spec
title: Spec — Panel Pre-Envío, Importación Tolerante y Distribución Dual
description: WHAT y WHY para la gestión previa de familias invitadas, carga manual y masiva tolerante, edición de plantilla de mensaje y envío por WhatsApp o correo masivo.
tags: [sdd, spec, pre-envio, importacion, email, whatsapp]
timestamp: 2026-11-19T21:40:00Z
topic: sdd
slug: panel-pre-envio-y-distribucion
status: draft
---

# Spec — Panel Pre-Envío, Importación Tolerante y Distribución Dual

> Slug: `panel-pre-envio-y-distribucion` · Status: draft · Created: 2026-11-19
> Inherits: [constitution](../constitution.md)

## Problem & why

Los novios suelen organizar su lista de invitados en hojas de cálculo con formatos irregulares, tildes corruptas o columnas con nombres distintos, y luego invierten horas armando y enviando enlaces personalizados uno por uno. Sin una carga tolerante con previsualización editable ni un sistema dual de distribución con variables dinámicas, los novios abandonan el panel por errores de formato o envían enlaces equivocados.

## Cost of not building it

Los novios tendrían que digitar decenas o cientos de familias una por una o depender del equipo de soporte para importar su Excel, además de redactar manualmente cada mensaje de WhatsApp o correo con riesgo de duplicados, enlaces rotos y omisiones.

## The cheapest alternative

Aceptar únicamente un formulario manual fila por fila y dar un enlace genérico copiable. No resuelve la fricción real porque las bodas suelen superar las 40–100 familias ya listadas en Excel y el enlace personalizado por familia es indispensable para controlar pases y prellenar el saludo.

## Goals

- Permitir cargar familias manualmente (CRUD completo) o masivamente mediante plantilla oficial e importación tolerante de hojas de cálculo y CSV.
- Detectar errores, variaciones de columnas y posibles duplicados antes de guardar nada, permitiendo corregirlos directamente en pantalla.
- Mantener una plantilla de mensaje compartida por boda con vista previa real y envío dual: WhatsApp granular por familia y correo masivo asíncrono previa confirmación explícita.
- Garantizar la coherencia entre los pases asignados en Pre-Envío y cualquier confirmación R.S.V.P. ya recibida (`BR-05`).

## Non-goals / out of scope

- Envío automatizado por la API oficial de WhatsApp Business ni recordatorios automáticos programados.
- Creación o edición visual drag & drop de las plantillas de invitación.
- Parseo de archivos planos no validados directamente en el servidor sin paso previo de revisión humana.
- Seguimiento de apertura o lectura ("pixel tracking") de correos electrónicos.

## Users & context

- **Novios / Wedding Planner autenticados:** En la etapa previa al envío (y durante ajustes de última hora), cargan invitados, configuran el texto de invitación y despachan enlaces desde un panel web dentro de su boda activa.

## What the user can do

- Descargar una plantilla de ejemplo oficial (`.xlsx` y `.csv`) con las cabeceras esperadas y dos filas de muestra.
- Subir un archivo `.xlsx` o `.csv` en una zona de carga masiva, revisar y corregir el mapeo de columnas sugerido, previsualizar y editar en línea las celdas con error, descartar filas no deseadas y confirmar el guardado atómico de toda la lista válida.
- Crear, editar y eliminar familias individualmente; si la familia ya confirmó asistencia, ver una advertencia al intentar eliminarla.
- Editar una plantilla de mensaje compartida con variables dinámicas (`{familia}`, `{enlace}`, `{pases}`) y elegir cualquier familia para previsualizar el mensaje exacto antes de enviarlo.
- Abrir el envío granular por WhatsApp para cualquier fila con el mensaje pre-rellenado (o copiar el texto), y lanzar el envío masivo por correo en un clic pasando antes por un modal obligatorio de confirmación.

## What result they get

- Cada familia guardada obtiene un identificador de enlace único amigable para su invitación personalizada y aparece en la tabla maestra con su estado de envío.
- Al confirmar la importación masiva, se guardan todas las familias válidas en bloque sin registros a medias.
- Al confirmar el envío masivo por correo, el sistema despacha los mensajes en segundo plano sin bloquear la pantalla y marca en cada fila la fecha y hora de envío cuando se procesa.

## What it must respect

- La regla `BR-02` (distribución dual WhatsApp granular / correo masivo en segundo plano tras modal obligatorio de confirmación).
- La regla `BR-05` (si se editan los pases de una familia y `num_adultos + num_ninos` cae por debajo de los asistentes ya confirmados, se invalida su confirmación previa y sus menús para que vuelva a confirmar dentro del nuevo cupo).
- El tope máximo de **1.000 registros de familias invitadas (`familias_invitadas`) por boda** (`novios.max_familias`, valor inicial y máximo `1000`) y los límites seguros de longitud y pases de la base de datos (máximo `20` adultos, `15` niños y `30` pases totales por familia), verificados tanto en la previsualización del cliente como dentro de la transacción ACID en el servidor.
- El aislamiento por boda (`BR-06`) definido en [auth-rbac-y-cuentas.md](./auth-rbac-y-cuentas.md) y los principios de usabilidad y asincronía de [constitution.md](../constitution.md).

## How it proves it

- Pruebas unitarias en cliente para autodetección de delimitador/codificación CSV, mapeo de cabeceras, saneamiento silencioso, detección de duplicados y validación fila a fila.
- Pruebas automatizadas en servidor que verifiquen: rechazo ante filas inválidas, inserción masiva atómica con rollback ante fallo, unicidad del enlace generado, invalidación de confirmación por `BR-05`, interpolación de plantilla de mensaje y encolado/actualización de estado de correo sin duplicados tras confirmación.

## Behaviour

- **Main path:**
  - En importación masiva, el usuario sube su archivo; el navegador detecta delimitador (coma o punto y coma) y codificación (UTF-8 o Windows-1252) para preservar tildes y eñes, normaliza nombres de columna con un diccionario de sinónimos y muestra un asistente de mapeo editable.
  - El saneamiento automático limpia espacios sobrantes, convierte niños vacíos o `-` en `0` y teléfonos vacíos en ausentes, resalta posibles duplicados por correo o nombre de familia, y muestra una tabla de previsualización donde se pueden filtrar solo las filas con error, editarlas en celda o descartarlas antes de enviar el lote limpio para guardado atómico.
  - En distribución, al redactar el mensaje compartido se actualiza una vista previa usando los datos reales de la familia seleccionada; el botón de WhatsApp abre `wa.me` con el teléfono (si existe) y el mensaje codificado; el botón de correo masivo abre un modal con total de destinatarios, asunto y borrador de ejemplo, y solo tras confirmar ejecuta el envío en segundo plano actualizando el estado de envío de cada fila.
- **Edge cases:**
  - Si un archivo CSV proviene de Excel en español en Windows (separado por `;` y ANSI/Windows-1252), los caracteres como `ñ` y tildes se conservan sin corrupción.
  - Si un archivo `.xlsx` o `.csv` contiene **más de 1.000 filas de datos** (`1.001` o más registros, sin contar la fila de encabezados) o supera el cupo disponible restante hasta `1.000` (`novios.max_familias`), el asistente debe mostrar un aviso claro indicando que **solo se importarán los primeros 1.000 registros** (o los `N` restantes disponibles hasta alcanzar `1.000`), recortando el excedente antes de pasar a la previsualización y confirmación; además, el servidor valida el tope de `max_familias` dentro de la transacción de guardado.
  - Si una familia no tiene teléfono cargado, no impide guardar el registro ni enviar por correo, aunque la apertura directa por WhatsApp requiere teléfono o copiado manual.
  - Si los novios editan los pases de una familia confirmada aumentándolos o manteniéndolos iguales o superiores a lo confirmado, la confirmación R.S.V.P. se conserva intacta; solo si el nuevo tope es menor se invalida (`BR-05`).
- **Error paths:**
  - Si la tabla de previsualización aún contiene errores de validación bloqueantes, no se permite confirmar el guardado definitivo hasta corregir o descartar esas filas.
  - Si falla el guardado de una familia dentro del lote en el servidor, se revierte todo el lote para no dejar importaciones parciales.
  - Si un envío individual de correo falla temporalmente en segundo plano, no marca la invitación como enviada hasta completarse con éxito y reintenta de forma segura sin duplicar entregas.

## Acceptance criteria

- Given un novio autenticado en el panel Pre-Envío, When importa un archivo `.csv` o `.xlsx` válido con 50 familias (tras revisar mapeo y staging), Then las 50 familias quedan guardadas de forma atómica con enlaces amigables únicos y estado pendiente de envío.
- Given un archivo `.csv` en codificación Windows-1252 con delimitador `;` y apellidos con tildes o `ñ`, When se carga en el asistente de importación, Then los nombres aparecen correctamente acentuados sin caracteres corruptos y con las columnas detectadas.
- Given un archivo `.xlsx` o `.csv` con `1005` filas de datos (sin contar encabezados) para una boda con `0` familias previas, When el usuario lo carga en el asistente de importación, Then el sistema muestra un aviso claro indicando que solo se importarán los primeros `1000` registros y recorta el lote a exactamente esas primeras `1000` filas antes de previsualizar y confirmar.
- Given una familia que ya confirmó `3` asistentes y tiene asignados `3` adultos y `1` niño, When los novios editan la familia a `2` adultos y `0` niños, Then su confirmación R.S.V.P. previa y sus platos asociados quedan eliminados para que vuelva a confirmar dentro de sus `2` nuevos pases.
- Given una plantilla de mensaje con `{familia}`, `{enlace}` y `{pases}` y una familia seleccionada en la vista previa, When el usuario observa el borrador o pulsa el botón de WhatsApp, Then ve los datos reales interpolados y se abre `wa.me` con el mensaje listo.
- Given 50 familias con correo válido cargadas, When el usuario pulsa "Enviar invitaciones por Correo", Then aparece primero el modal de confirmación con el conteo de destinatarios y el borrador de muestra, y solo tras confirmar se encola el envío y se registra la fecha de envío por fila.

## Points to clarify

- **pregunta abierta** — Al ejecutar "Enviar invitaciones por Correo", ¿el lote incluye únicamente a las familias con envío pendiente (`invitacion_enviada_at` vacío), o también permite seleccionar manualmente un subconjunto o reenviar a familias ya notificadas?
- **pregunta abierta** — Cuando una familia se distribuye manualmente por WhatsApp (`wa.me`), ¿el usuario debe contar con un botón/toggle manual para marcarla como enviada o se deja `invitacion_enviada_at` solo para trazabilidad de envíos por correo (o ambos)?
- **suposición tomada** — El asunto del correo masivo utiliza un formato estándar generado con `nombres_pareja` o permite editarse junto con la plantilla de mensaje antes de confirmar. *Base:* Escenario 6 menciona mostrar "asunto del correo y vista previa del borrador". *Riesgo:* si se requiere asunto editable en la nube, habrá que contemplarlo al definir el contrato de plantilla.
- **decisión diferida** — La validación detallada de sintaxis internacional de teléfonos WhatsApp (código de país obligatorio vs. libre) queda para `clarify` / `plan`.

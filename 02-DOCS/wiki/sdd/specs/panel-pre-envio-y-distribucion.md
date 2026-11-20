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
- Subir un archivo `.xlsx` o `.csv` en una zona de carga masiva, revisar y corregir el mapeo de columnas sugerido, previsualizar y editar en línea las celdas con error, descartar filas no deseadas y confirmar el guardado atómico de toda la lista válida (`POST /api/weddings/:noviosId/invitations/batch`).
- Crear, editar y eliminar familias individualmente (con `email` opcional/`nullable` sin restricción única por boda y teléfono saneado flexible de `8..20` caracteres con `+` opcional); si la familia ya confirmó asistencia, ver una advertencia al intentar eliminarla.
- Editar una plantilla de mensaje compartida con variables dinámicas (`{familia}`, `{enlace}`, `{pases}`) reutilizable tanto para correo como para WhatsApp, y elegir cualquier familia para previsualizar el mensaje exacto antes de enviarlo.
- Despachar la invitación por WhatsApp usando **Opción A** (individual por fila o en lote mediante **cola guiada paso a paso sobre `wa.me` oficial**, validando teléfonos faltantes y mostrando al iniciar el lote un aviso preventivo para los novios), y lanzar el envío masivo por correo (que preselecciona por defecto **solo familias con correo válido y envío pendiente**, permitiendo filtrar o seleccionar manualmente filas para reenvío) con asunto fijo en v1 (`"¡Estás invitado a la boda de {nombres_pareja}!"`) y modal obligatorio de confirmación.

## What result they get

- Cada familia guardada obtiene un identificador de enlace único amigable para su invitación personalizada y aparece en la tabla maestra con **fechas de envío separadas por canal** (correo y WhatsApp).
- Al confirmar la importación masiva, se guardan todas las familias válidas en bloque sin registros a medias.
- Al confirmar el envío por correo, el sistema despacha los mensajes en segundo plano sin bloquear la pantalla hacia las familias elegidas con correo válido y registra la fecha y hora de envío de correo en cada fila procesada, sin alterar el estado de envío por WhatsApp; al confirmar cada envío de WhatsApp, se registra su fecha independiente.

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
  - El saneamiento automático limpia espacios sobrantes, convierte niños vacíos o `-` en `0`, sanea teléfonos de forma flexible (`8..20` caracteres con `+` opcional) y teléfonos vacíos o correos vacíos (`NULL` permitido en `familias_invitadas.email`) como ausentes, resalta posibles duplicados por correo o nombre de familia sin bloquear correos compartidos por grupo familiar, y muestra una tabla de previsualización donde se pueden filtrar solo las filas con error, editarlas en celda o descartarlas antes de enviar el lote limpio a `POST /api/weddings/:noviosId/invitations/batch` para guardado atómico.
  - En distribución, al redactar el mensaje compartido (con variables dinámicas `{familia}`, `{enlace}`, `{pases}`) se actualiza una vista previa usando los datos reales de la familia seleccionada; ese mismo mensaje sirve tanto para correo como para WhatsApp:
    - **WhatsApp (Opción A):** permite abrir `wa.me` individualmente por fila o lanzar una **cola guiada paso a paso sobre `wa.me` oficial** desde el WhatsApp personal de los novios. Antes de empezar, valida qué filas seleccionadas carecen de teléfono y muestra un aviso preventivo visible para los novios recomendando enviar en tandas tranquilas a invitados conocidos (ej. 20–30 contactos) para proteger su cuenta personal frente a filtros anti-spam; al confirmar cada envío se registra su fecha independiente vía `PATCH .../whatsapp-sent`.
    - **Correo masivo (`BR-02`):** preselecciona por defecto **solo familias con `email` cargado y envío de correo pendiente** (equivalente a todas en el primer envío, evitando reenvíos accidentales luego), permitiendo filtrar o seleccionar manualmente filas (`familyIds`) para reenviar o elegir un subconjunto. Abre el modal con conteo exacto, asunto fijo (`"¡Estás invitado a la boda de {nombres_pareja}!"`) y borrador de muestra; al confirmar ejecuta el envío en segundo plano y registra la fecha de envío por correo independiente de la de WhatsApp.
- **Edge cases:**
  - Si un archivo CSV proviene de Excel en español en Windows (separado por `;` y ANSI/Windows-1252), los caracteres como `ñ` y tildes se conservan sin corrupción.
  - Si un archivo `.xlsx` o `.csv` contiene **más de 1.000 filas de datos** (`1.001` o más registros, sin contar la fila de encabezados) o supera el cupo disponible restante hasta `1.000` (`novios.max_familias`), el asistente debe mostrar un aviso claro indicando que **solo se importarán los primeros 1.000 registros** (o los `N` restantes disponibles hasta alcanzar `1.000`), recortando el excedente antes de pasar a la previsualización y confirmación; además, el servidor valida el tope de `max_familias` dentro de la transacción de guardado.
  - Si una familia no tiene `email` cargado (`NULL`), se guarda normalmente para distribución por WhatsApp y queda excluida automáticamente del lote de envío por correo; si dos grupos familiares comparten el mismo correo, la importación muestra alerta de posible duplicado sin impedir el guardado.
  - Si una familia no tiene teléfono cargado, no impide guardar el registro ni enviar por correo, aunque al intentar despachar por WhatsApp el panel advierte qué filas seleccionadas no tienen teléfono registrado.
  - Si los novios editan los pases de una familia confirmada aumentándolos o manteniéndolos iguales o superiores a lo confirmado, la confirmación R.S.V.P. se conserva intacta; solo si el nuevo tope es menor se invalida (`BR-05`).
- **Error paths:**
  - Si la tabla de previsualización aún contiene errores de validación bloqueantes, no se permite confirmar el guardado definitivo hasta corregir o descartar esas filas.
  - Si falla el guardado de una familia dentro del lote en el servidor, se revierte todo el lote para no dejar importaciones parciales.
  - Si un envío individual de correo falla temporalmente en segundo plano, no marca la invitación como enviada hasta completarse con éxito y reintenta de forma segura sin duplicar entregas.

## Acceptance criteria

- Given un novio autenticado en el panel Pre-Envío, When importa un archivo `.csv` o `.xlsx` válido con 50 familias (tras revisar mapeo y staging) vía `POST /api/weddings/:noviosId/invitations/batch`, Then las 50 familias quedan guardadas de forma atómica con enlaces amigables únicos y estado pendiente de envío en ambos canales.
- Given un archivo `.csv` en codificación Windows-1252 con delimitador `;` y apellidos con tildes o `ñ`, When se carga en el asistente de importación, Then los nombres aparecen correctamente acentuados sin caracteres corruptos y con las columnas detectadas.
- Given un archivo `.xlsx` o `.csv` con `1005` filas de datos (sin contar encabezados) para una boda con `0` familias previas, When el usuario lo carga en el asistente de importación, Then el sistema muestra un aviso claro indicando que solo se importarán los primeros `1000` registros y recorta el lote a exactamente esas primeras `1000` filas antes de previsualizar y confirmar.
- Given una boda con familias sin correo (`email = null`) o dos familias distintas compartiendo un correo familiar, When se importan y luego se abre el modal de envío por correo, Then ambas se guardan correctamente (con aviso no bloqueante de posible duplicado), las familias sin `email` quedan excluidas del envío por correo y disponibles para WhatsApp.
- Given una familia que ya confirmó `3` asistentes y tiene asignados `3` adultos y `1` niño, When los novios editan la familia a `2` adultos y `0` niños, Then su confirmación R.S.V.P. previa y sus platos asociados quedan eliminados para que vuelva a confirmar dentro de sus `2` nuevos pases.
- Given una plantilla de mensaje compartida con `{familia}`, `{enlace}` y `{pases}` y un lote para WhatsApp en cola guiada (Opción A) donde 2 filas carecen de teléfono, When el usuario inicia el despacho por WhatsApp, Then ve el aviso exacto de qué filas no tienen teléfono y un aviso preventivo para enviar en tandas tranquilas a contactos conocidos, abre `wa.me` con el mensaje interpolado idéntico al de correo y registra la fecha de envío por WhatsApp de forma independiente a la de correo.
- Given 50 familias con correo válido donde 30 ya fueron enviadas por correo y 20 están pendientes, When el usuario abre "Enviar invitaciones por Correo", Then preselecciona por defecto las 20 pendientes (permitiendo también filtrar o seleccionar manualmente `familyIds` para reenviar), muestra el modal con conteo exacto y asunto fijo `"¡Estás invitado a la boda de {nombres_pareja}!"`, y solo tras confirmar encola el envío y registra la fecha de envío de correo por fila sin sobrescribir la fecha de WhatsApp.

## Points to clarify

- **resuelto** — Al ejecutar "Enviar invitaciones por Correo", la selección premarca por defecto **solo familias con `email` cargado y envío de correo pendiente**, permitiendo filtrar o seleccionar manualmente filas (`familyIds`) para reenviar o elegir un subconjunto, siempre tras el modal de confirmación.
- **resuelto** — WhatsApp y correo comparten la misma plantilla interpolada (`{familia}`, `{enlace}`, `{pases}`), validan teléfonos faltantes antes de despachar por WhatsApp y registran **fechas de envío separadas por canal** (correo y WhatsApp independientes).
- **resuelto** — El despacho en lote por WhatsApp en v1 usa la **Opción A** (cola guiada paso a paso sobre `wa.me` oficial desde el WhatsApp personal de los novios, \$0, texto libre y sin aprobación de Meta, con aviso preventivo anti-spam integrado en la UI). La API oficial de WhatsApp Business permanece en *Non-goals / out of scope*.
- **resuelto** — El asunto del correo masivo usa en v1 un formato fijo generado en backend (`"¡Estás invitado a la boda de {nombres_pareja}!"`).
- **resuelto** — El teléfono se sanea de forma flexible (`8..20` caracteres con dígitos y `+` opcional) y `familias_invitadas.email` es opcional (`NULL` permitido) sin `UNIQUE` por boda (solo alerta visual de posible duplicado en importación; ajuste `email` nullable diferido a migración `0002`).

## Clarifications

- **2026-11-20:** *Preselección de destinatarios de correo masivo* → por defecto solo pendientes con `email IS NOT NULL`, permitiendo filtrar/seleccionar manualmente `familyIds` (incluido reenvío) → porque en el primer envío coincide con todos y en envíos posteriores evita reenvíos accidentales.
- **2026-11-20:** *Plantilla compartida, validación de teléfonos y trazabilidad por canal* → usar la misma plantilla interpolada para correo y WhatsApp, validar teléfonos faltantes antes de despachar por WhatsApp y guardar **fechas de envío separadas por canal** → porque los novios distribuyen por ambos canales y necesitan saber exactamente por qué medio ya enviaron cada invitación sin sobrescribir estados.
- **2026-11-20:** *Despacho por WhatsApp (Opción A vs. B)* → Opción A (cola guiada sobre `wa.me` oficial con aviso preventivo anti-spam para los novios en la UI) → porque es lícita bajo los TdS de WhatsApp, cuesta \$0, permite texto libre y sale del número personal reconocido por los invitados.
- **2026-11-20:** *`email` opcional sin `UNIQUE`, teléfono flexible y asunto fijo en v1* → `email` nullable sin restricción única, teléfono `8..20` chars con `+` opcional y asunto fijo `"¡Estás invitado a la boda de {nombres_pareja}!"` → porque soporta invitados solo-WhatsApp, correos familiares compartidos y Excel locales sin bloquear la carga ni agregar complejidad innecesaria en v1.

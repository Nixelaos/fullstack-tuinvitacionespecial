# Fase 2: Clarify

Objetivo: eliminar ambigüedades **antes** de diseñar la solución técnica.

## Pasos
1. Revisa la spec en `02-DOCS/wiki/sdd/specs/<slug>.md` buscando:
   - Reglas de negocio con bordes sin definir (límites numéricos, fechas, permisos).
   - Casos de error, concurrencia o idempotencia sin especificar.
   - Decisiones de UX o flujo que admitan más de una interpretación.
2. Si hay dudas reales, haz **preguntas concretas** (idealmente con opciones) al usuario y espera respuesta.
3. Incorpora las respuestas en la spec antes de pasar a `plan`.

---
name: ftd
description: >-
  Flujo ligero Feature-Document (FTD) para cambios simples o acotados en el proyecto.
  Úsala cuando la tarea sea una mejora, ajuste o feature pequeña que no requiera arquitectura compleja.
---

# FTD — Feature Document (Cambios simples)

Usa este flujo cuando el cambio sea acotado y no involucre decisiones acopladas de arquitectura, autenticación o migraciones complejas.

## Pasos

1. **Crear o actualizar el documento** en `02-DOCS/wiki/ftd/<nombre-feature>.md` con:
   - **Intención:** qué problema resuelve en 1-2 frases.
   - **Alcance:** archivos o módulos a tocar (y qué queda fuera).
   - **Checklist:** lista breve de tareas concretas.
   - **Evidencia:** resultados reales de `npm test` y `npm run build` tras los cambios.
   - **Siguiente paso:** qué queda pendiente (si aplica).
2. **Implementar** siguiendo las reglas de `AGENTS.md`.
3. **Verificar y marcar:** solo marca `[x]` en el checklist cuando tengas prueba observada (tests/build pasando).
4. **Actualizar `MEMORY.md`** al cerrar la tarea.

# AGENTS.md — Tu Invitación Especial

## 1. Descripción
Plataforma fullstack para crear y vender invitaciones de boda digitales interactivas y soluciones de organización para novios (RSVP, gestión de mesas, etc.).

## 2. Stack y estructura
- `frontend-tuinvitacionespecial/`: Astro 5, React 18, Tailwind CSS, TypeScript.
  - Comandos: `npm run dev` | `npm run build` | `npm test`
- `backend-tuinvitacionespecial/`: Fastify v5, Zod v4, Drizzle ORM, PostgreSQL, BullMQ + Redis.
  - Comandos: `npm run dev` | `npm run build` (`tsc --noEmit`) | `npm test` | `npm run db:migrate`

## 3. Convenciones
- Idioma del código e identificadores: [inglés / español]. Documentación y respuestas: español.
- Estilo y arquitectura: [ej. validar requests con Zod en `schemas/`, mantener lógica separada de vistas].
- Commits: [ej. Conventional Commits (`feat:`, `fix:`, `docs:`)].
- Claridad: define cada término al primer uso y explica qué hace cada comando, flag o ruta que menciones.
- Orientación: usa frases cortas y cierra cada turno con un bloque-brújula (📍 dónde estás · ➡️ siguiente en pregunta; ✅/🧭 si aplica).

## 4. Límites y prohibiciones
- Si solo hago una pregunta o pido análisis, **no modifiques ni crees archivos**.
- Ramas: trabaja en la rama actual si está abierta; si el flujo usa ramas/PR o CI, pregunta antes de cada cambio (actual, nueva rama o `.worktrees/<rama>`); nunca ramifiques solo.
- Nunca instales dependencias externas ni modifiques `.env`, configuraciones o migraciones SQL sin aprobación previa.
- Para cambios grandes o de arquitectura, presenta primero un plan breve y espera confirmación.
- [Añade aquí otras restricciones críticas de tu proyecto].

## 5. Memoria y verificación
- **Al iniciar:** Lee `MEMORY.md` antes de proponer o ejecutar cambios.
- **Al terminar:** Ejecuta `npm test` y `npm run build` en la carpeta afectada para verificar que todo compila y pasa.
- **Al cerrar:** Actualiza `MEMORY.md` (tope máximo de 50 líneas; resume o elimina lo obsoleto).

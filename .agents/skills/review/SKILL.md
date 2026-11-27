---
name: review
description: >-
  Revisión integral de código contra REVIEW.md, auditoría de seguridad, limpieza/simplificación
  y verificación de tests y build antes de cerrar o hacer commit.
---

# Review — Auditoría, limpieza y verificación

Usa esta skill antes de dar por terminada una feature, PR o cambio importante.

## Pasos

1. **Inspeccionar cambios:** revisa `git status` y `git diff` (omitiendo rutas excluidas en `REVIEW.md`).
2. **Auditoría de bloqueantes y seguridad (`REVIEW.md`):**
   - Verifica los 6 bloqueantes críticos: IDOR / aislamiento por `novios_id` (`BR-06`), reglas `BR-01`–`BR-05`, concurrencia/ACID, auth/cookies/CSRF/rate-limit/Formula Injection, migraciones `drizzle/` alineadas y colas idempotentes.
   - Señala si se tocaron rutas **Tier 2** que requieren revisión humana obligatoria.
3. **Limpieza (`simplify-code` / `unslop`):**
   - Detecta lógica duplicada, complejidad innecesaria o estilo `function fn()` vs `const fn = () => {}` (reporta como `nit`, máximo **3 nits** en total).
4. **Verificación real:** ejecuta `npm test` y `npm run build` en cada proyecto afectado (`backend-tuinvitacionespecial/` y/o `frontend-tuinvitacionespecial/`).
5. **Reporte:** abre siempre con el conteo exacto:
   `<N> findings: <X> blockers, <Y> nits`
   y detalla archivo, línea y corrección recomendada para cada hallazgo.

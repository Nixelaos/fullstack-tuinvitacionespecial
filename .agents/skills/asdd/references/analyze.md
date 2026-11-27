# Fase 5: Analyze

Objetivo: auditar consistencia antes de escribir código y emitir `GATE: PASS` o `GATE: FAIL`.

## Qué verificar en `02-DOCS/wiki/sdd/analysis/<slug>.md`
1. **Trazabilidad:** cada requisito de la spec tiene su diseño en el plan y su tarea (`T*`).
2. **Constitución y seguridad:** cumple `02-DOCS/wiki/sdd/constitution.md` y `REVIEW.md` (sin IDOR `BR-06`, sin secretos expuestos, límites definidos).
3. **Veredicto:**
   - Lista hallazgos por severidad (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`).
   - Emite `GATE: PASS` solo si hay `0 CRITICAL` y `0 HIGH`. Si falla, corrige spec/plan antes de implementar.

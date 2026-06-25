-- Fase 1.4 — Reporte automático "Artículos a Comprar"
-- Lista productos cuyo stock disponible (físico - reservado) cayó por debajo
-- del stock crítico, donde el stock crítico considera el lead time del proveedor.
--
-- criticalStock se mantiene precalculado en Product, pero aquí también se
-- recalcula al vuelo para reflejar cambios de lead time sin esperar al job.
--
-- :tenant_id lo inyecta la app; RLS lo refuerza igual.

SELECT
    p.id,
    p.sku,
    p.name,
    fc.name                                   AS categoria,
    m.value                                   AS medida,
    mf.value                                  AS material_acabado,
    p."stockQty"                              AS stock_fisico,
    p."reservedQty"                           AS reservado,
    (p."stockQty" - p."reservedQty")          AS disponible,
    s.name                                    AS proveedor,
    s."leadTimeDays"                          AS lead_time_dias,
    -- Punto de reorden = demanda durante el lead time + 30% de seguridad
    CEIL(p."avgDailySales" * s."leadTimeDays" * 1.3) AS stock_critico_calculado,
    -- Cuánto comprar para cubrir lead time + 15 días de colchón
    GREATEST(
        CEIL(p."avgDailySales" * (s."leadTimeDays" + 15))
          - (p."stockQty" - p."reservedQty"),
        0
    )                                          AS sugerido_comprar
FROM "Product" p
JOIN "MaterialFinish"     mf ON mf.id = p."materialFinishId"
JOIN "Measure"            m  ON m.id  = mf."measureId"
JOIN "FunctionalCategory" fc ON fc.id = m."categoryId"
LEFT JOIN "Supplier"      s  ON s.id  = p."supplierId"
WHERE p."tenantId" = :tenant_id
  AND p.active = TRUE
  AND (p."stockQty" - p."reservedQty")
      <= CEIL(p."avgDailySales" * COALESCE(s."leadTimeDays", 7) * 1.3)
ORDER BY (p."stockQty" - p."reservedQty") ASC,
         sugerido_comprar DESC;

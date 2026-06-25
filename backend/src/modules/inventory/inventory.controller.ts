import { Response } from 'express';
import { TenantRequest } from '../../middleware/tenant';

/**
 * Fase 1 — Controladores de inventario.
 * Jerarquía (categoría→medida→material), múltiples unidades y stock crítico.
 */

/** Árbol de inventario de 3 niveles para que el cliente navegue como compra. */
export async function getInventoryTree(req: TenantRequest, res: Response) {
  const db = req.db!;
  const tree = await db.functionalCategory.findMany({
    where: { tenantId: req.tenantId },
    include: {
      measures: {
        include: {
          materialFinishes: {
            include: {
              products: {
                where: { active: true },
                include: { units: true, supplier: true },
              },
            },
          },
        },
      },
    },
    orderBy: { name: 'asc' },
  });
  res.json(tree);
}

/** Alta de producto con sus unidades de venta (caja, metro, litro, …). */
export async function createProduct(req: TenantRequest, res: Response) {
  const db = req.db!;
  const { materialFinishId, supplierId, sku, name, baseUnit, stockQty, units } = req.body;

  const product = await db.product.create({
    data: {
      tenantId: req.tenantId!,
      materialFinishId,
      supplierId,
      sku,
      name,
      baseUnit: baseUnit ?? 'UNIDAD',
      stockQty: stockQty ?? 0,
      units: {
        create: (units ?? []).map((u: any) => ({
          unit: u.unit,
          factor: u.factor,
          price: u.price,
          barcode: u.barcode ?? null,
        })),
      },
    },
    include: { units: true },
  });
  res.status(201).json(product);
}

/**
 * Recalcula el stock crítico de un producto a partir del lead time del
 * proveedor y la venta promedio diaria.  criticalStock = avgDaily * lead * 1.3
 */
export async function recalcCriticalStock(req: TenantRequest, res: Response) {
  const db = req.db!;
  const { productId } = req.params;

  const product = await db.product.findFirst({
    where: { id: productId, tenantId: req.tenantId },
    include: { supplier: true },
  });
  if (!product) return res.status(404).json({ error: 'Producto no encontrado' });

  const leadTime = product.supplier?.leadTimeDays ?? 7;
  const critical = Math.ceil(product.avgDailySales * leadTime * 1.3);

  const updated = await db.product.update({
    where: { id: product.id },
    data: { criticalStock: critical },
  });
  res.json({ id: updated.id, criticalStock: updated.criticalStock });
}

/**
 * Fase 1.4 — Reporte "Artículos a Comprar".
 * Devuelve productos cuyo disponible cayó bajo el punto de reorden (lead time).
 */
export async function getPurchaseReport(req: TenantRequest, res: Response) {
  const db = req.db!;
  const rows = await db.$queryRawUnsafe(
    `
    SELECT p.id, p.sku, p.name,
           fc.name  AS categoria,
           m.value  AS medida,
           mf.value AS material_acabado,
           p."stockQty" AS stock_fisico,
           (p."stockQty" - p."reservedQty") AS disponible,
           s.name AS proveedor,
           s."leadTimeDays" AS lead_time_dias,
           CEIL(p."avgDailySales" * COALESCE(s."leadTimeDays", 7) * 1.3) AS stock_critico,
           GREATEST(
             CEIL(p."avgDailySales" * (COALESCE(s."leadTimeDays", 7) + 15))
               - (p."stockQty" - p."reservedQty"), 0
           ) AS sugerido_comprar
    FROM "Product" p
    JOIN "MaterialFinish"     mf ON mf.id = p."materialFinishId"
    JOIN "Measure"            m  ON m.id  = mf."measureId"
    JOIN "FunctionalCategory" fc ON fc.id = m."categoryId"
    LEFT JOIN "Supplier"      s  ON s.id  = p."supplierId"
    WHERE p."tenantId" = $1
      AND p.active = TRUE
      AND (p."stockQty" - p."reservedQty")
          <= CEIL(p."avgDailySales" * COALESCE(s."leadTimeDays", 7) * 1.3)
    ORDER BY disponible ASC, sugerido_comprar DESC
    `,
    req.tenantId,
  );
  res.json(rows);
}

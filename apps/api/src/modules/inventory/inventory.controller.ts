import { Router, Request, Response } from 'express';
import { prisma, adminPrisma } from '../../core/prisma';
import { tenantContext } from '../../core/tenantContext';
import { requirePermission } from '../../middleware/auth';
import { enforceProductLimit } from '../billing/planGuard';
import { PERMISSIONS as P } from '../auth/roles';

/**
 * Inventario (Fase 1) sobre la arquitectura definitiva.
 * Lecturas vía cliente tenant-scoped (RLS automático); escrituras setean
 * tenantId desde el contexto. Altas con guard de límite por plan.
 */
const router = Router();

const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response) =>
    fn(req, res).catch((e) => {
      console.error(e);
      res.status(e.status ?? 500).json({ error: e.message ?? 'Error interno' });
    });

/** Árbol jerárquico Categoría → Medida → Material → Producto. */
router.get(
  '/tree',
  requirePermission(P.PRODUCT_READ),
  wrap(async (_req, res) => {
    const tree = await prisma.functionalCategory.findMany({
      include: {
        measures: {
          include: {
            materialFinishes: {
              include: { products: { where: { active: true }, include: { units: true } } },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });
    res.json(tree);
  }),
);

/** Alta de producto con unidades de venta (limitada por plan). */
router.post(
  '/products',
  requirePermission(P.PRODUCT_WRITE),
  enforceProductLimit(),
  wrap(async (req, res) => {
    const { materialFinishId, supplierId, sku, name, baseUnit, stockQty, units } = req.body;
    const product = await prisma.product.create({
      data: {
        tenantId: tenantContext.tenantId(),
        materialFinishId,
        supplierId: supplierId ?? null,
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
  }),
);

/**
 * Reporte "Artículos a Comprar": disponible (físico − reservado) bajo el punto
 * de reorden calculado con el lead time del proveedor.
 */
router.get(
  '/purchase-report',
  requirePermission(P.PRODUCT_READ),
  wrap(async (_req, res) => {
    const tenantId = tenantContext.tenantId();
    const rows = await adminPrisma.$queryRawUnsafe(
      `
      SELECT p.id, p.sku, p.name,
             fc.name AS categoria, m.value AS medida, mf.value AS material,
             p."stockQty" AS stock, (p."stockQty" - p."reservedQty") AS disponible,
             s.name AS proveedor, s."leadTimeDays" AS lead_time,
             CEIL(p."avgDailySales" * COALESCE(s."leadTimeDays", 7) * 1.3) AS critico,
             GREATEST(CEIL(p."avgDailySales" * (COALESCE(s."leadTimeDays",7) + 15))
                      - (p."stockQty" - p."reservedQty"), 0) AS sugerido_comprar
      FROM "Product" p
      JOIN "MaterialFinish" mf ON mf.id = p."materialFinishId"
      JOIN "Measure" m ON m.id = mf."measureId"
      JOIN "FunctionalCategory" fc ON fc.id = m."categoryId"
      LEFT JOIN "Supplier" s ON s.id = p."supplierId"
      WHERE p."tenantId" = $1::uuid AND p.active = TRUE
        AND (p."stockQty" - p."reservedQty")
            <= CEIL(p."avgDailySales" * COALESCE(s."leadTimeDays", 7) * 1.3)
      ORDER BY disponible ASC, sugerido_comprar DESC
      `,
      tenantId,
    );
    res.json(rows);
  }),
);

export default router;

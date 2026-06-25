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

/**
 * Alta de producto (limitada por plan). Acepta `materialFinishId` directo o,
 * para una UX simple, los nombres `categoria`/`medida`/`material`: en ese caso
 * upsertea la jerarquía Categoría→Medida→Material y luego crea el producto.
 */
router.post(
  '/products',
  requirePermission(P.PRODUCT_WRITE),
  enforceProductLimit(),
  wrap(async (req, res) => {
    const b = req.body;
    const tenantId = tenantContext.tenantId();

    let materialFinishId: string = b.materialFinishId;
    if (!materialFinishId) {
      if (!b.categoria || !b.medida || !b.material) {
        return res.status(400).json({ error: 'Indicá materialFinishId o categoria+medida+material' });
      }
      materialFinishId = await findOrCreateHierarchy(tenantId, b.categoria, b.medida, b.material);
    }

    const product = await prisma.product.create({
      data: {
        tenantId,
        materialFinishId,
        supplierId: b.supplierId ?? null,
        sku: b.sku,
        name: b.name,
        emoji: b.emoji ?? null,
        baseUnit: b.baseUnit ?? 'UNIDAD',
        stockQty: b.stockQty ?? 0,
        criticalStock: b.criticalStock ?? 0,
        units: {
          create: (b.units ?? []).map((u: any) => ({
            unit: u.unit, factor: u.factor, price: u.price, barcode: u.barcode ?? null,
          })),
        },
      },
      include: { units: true },
    });
    res.status(201).json(product);
  }),
);

/** Upsert idempotente de la jerarquía funcional; devuelve el materialFinishId. */
async function findOrCreateHierarchy(tenantId: string, categoria: string, medida: string, material: string) {
  const category =
    (await prisma.functionalCategory.findFirst({ where: { name: categoria } })) ??
    (await prisma.functionalCategory.create({ data: { tenantId, name: categoria } }));
  const measure =
    (await prisma.measure.findFirst({ where: { categoryId: category.id, value: medida } })) ??
    (await prisma.measure.create({ data: { categoryId: category.id, value: medida } }));
  const mf =
    (await prisma.materialFinish.findFirst({ where: { measureId: measure.id, value: material } })) ??
    (await prisma.materialFinish.create({ data: { measureId: measure.id, value: material } }));
  return mf.id;
}

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

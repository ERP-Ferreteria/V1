import { Router, Response } from 'express';
import { adminPrisma } from '../../core/prisma';
import { tenantResolver, ResolvedRequest } from '../../middleware/tenantResolver';

/**
 * Storefront público B2B (sin autenticación, resuelto por host).
 * Devuelve branding + catálogo navegable del tenant. Pensado para alto tráfico:
 * respuesta cacheable en CDN (Cache-Control), y la resolución de tenant ya
 * viene cacheada en memoria por tenantResolver.
 */
const router = Router();
router.use(tenantResolver);

/** Branding para que el frontend pinte la tienda white-label antes del catálogo. */
router.get('/branding', async (req: ResolvedRequest, res: Response) => {
  const branding = await adminPrisma.tenantBranding.findUnique({
    where: { tenantId: req.resolvedTenantId },
  });
  res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
  res.json(branding);
});

/** Catálogo jerárquico (Categoría → Medida → Material → Producto). */
router.get('/catalog', async (req: ResolvedRequest, res: Response) => {
  const tenantId = req.resolvedTenantId!;
  const products = await adminPrisma.product.findMany({
    where: { tenantId, active: true },
    select: {
      id: true, sku: true, name: true, imageUrl: true, stockQty: true,
      units: { select: { id: true, unit: true, price: true } },
      materialFinish: {
        select: {
          value: true,
          measure: { select: { value: true, category: { select: { name: true } } } },
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  // Aplanar a la jerarquía de 3 niveles que consume el storefront.
  const catalog = products.map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    imageUrl: p.imageUrl,
    inStock: p.stockQty > 0,
    categoria: p.materialFinish.measure.category.name,
    medida: p.materialFinish.measure.value,
    material: p.materialFinish.value,
    units: p.units,
  }));

  res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');
  res.json(catalog);
});

export default router;

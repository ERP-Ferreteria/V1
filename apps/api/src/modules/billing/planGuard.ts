import { Request, Response, NextFunction } from 'express';
import { adminPrisma } from '../../core/prisma';
import { tenantContext } from '../../core/tenantContext';

/**
 * Enforcement de límites por plan (la capa que hace que el SaaS sea rentable).
 * Guards declarativos que se anteponen a las rutas de escritura:
 *   - enforceProductLimit  → bloquea altas si se superó maxProducts
 *   - enforceOrderLimit    → bloquea órdenes si se superó maxOrdersMonth
 *   - requireFeature       → gating de features premium (dominio propio, API)
 * Además bloquea tenants en estado no operativo (PAST_DUE/SUSPENDED).
 */

async function loadSubscription(tenantId: string) {
  const sub = await adminPrisma.subscription.findUnique({
    where: { tenantId },
    include: { plan: true, tenant: true },
  });
  if (!sub) throw new Error('Suscripción no encontrada');
  return sub;
}

export function blockIfNotOperational() {
  return async (_req: Request, res: Response, next: NextFunction) => {
    const tenantId = tenantContext.tenantId();
    const sub = await loadSubscription(tenantId);
    if (sub.tenant.status === 'SUSPENDED' || sub.tenant.status === 'CANCELLED') {
      return res.status(403).json({ error: 'Cuenta suspendida. Regulariza tu suscripción.' });
    }
    next();
  };
}

export function enforceProductLimit() {
  return async (_req: Request, res: Response, next: NextFunction) => {
    const tenantId = tenantContext.tenantId();
    const sub = await loadSubscription(tenantId);
    const count = await adminPrisma.product.count({ where: { tenantId } });
    if (count >= sub.plan.maxProducts) {
      return res.status(402).json({
        error: `Límite del plan ${sub.plan.code} alcanzado (${sub.plan.maxProducts} productos). Actualiza tu plan.`,
        code: 'PLAN_LIMIT_PRODUCTS',
      });
    }
    next();
  };
}

export function enforceOrderLimit() {
  return async (_req: Request, res: Response, next: NextFunction) => {
    const tenantId = tenantContext.tenantId();
    const sub = await loadSubscription(tenantId);
    if (sub.ordersThisPeriod >= sub.plan.maxOrdersMonth) {
      return res.status(402).json({
        error: `Límite mensual de órdenes alcanzado en el plan ${sub.plan.code}.`,
        code: 'PLAN_LIMIT_ORDERS',
      });
    }
    next();
  };
}

export function requireFeature(feature: 'allowCustomDomain' | 'allowApiAccess') {
  return async (_req: Request, res: Response, next: NextFunction) => {
    const sub = await loadSubscription(tenantContext.tenantId());
    if (!sub.plan[feature]) {
      return res.status(402).json({ error: 'Función disponible en planes superiores', code: 'PLAN_FEATURE' });
    }
    next();
  };
}

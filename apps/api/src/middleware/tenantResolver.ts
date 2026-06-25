import { Request, Response, NextFunction } from 'express';
import { adminPrisma } from '../core/prisma';

/**
 * Resolución de tenant por host (White-Label).
 *  - <slug>.ferremax.app        → tenant.slug
 *  - dominio propio del comercio → tenant.customDomain
 * Inyecta el tenant resuelto en req para el storefront público y para que el
 * frontend reciba el branding correcto. Cacheado en memoria con TTL corto para
 * evitar un hit a DB por request en el catálogo público (alto tráfico).
 */
const ROOT_DOMAIN = process.env.ROOT_DOMAIN || 'ferremax.app';
const cache = new Map<string, { tenantId: string; slug: string; at: number }>();
const TTL = 60_000;

export interface ResolvedRequest extends Request {
  resolvedTenantId?: string;
  resolvedSlug?: string;
}

export async function tenantResolver(req: ResolvedRequest, res: Response, next: NextFunction) {
  const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || '';
  const hostname = host.split(':')[0].toLowerCase();

  const cached = cache.get(hostname);
  if (cached && Date.now() - cached.at < TTL) {
    req.resolvedTenantId = cached.tenantId;
    req.resolvedSlug = cached.slug;
    return next();
  }

  let tenant = null;
  if (hostname.endsWith(`.${ROOT_DOMAIN}`)) {
    const slug = hostname.replace(`.${ROOT_DOMAIN}`, '');
    tenant = await adminPrisma.tenant.findUnique({ where: { slug } });
  } else {
    tenant = await adminPrisma.tenant.findUnique({ where: { customDomain: hostname } });
  }

  if (!tenant) return res.status(404).json({ error: 'Tienda no encontrada' });
  if (tenant.status === 'SUSPENDED' || tenant.status === 'CANCELLED') {
    return res.status(403).json({ error: 'Tienda no disponible' });
  }

  cache.set(hostname, { tenantId: tenant.id, slug: tenant.slug, at: Date.now() });
  req.resolvedTenantId = tenant.id;
  req.resolvedSlug = tenant.slug;
  next();
}

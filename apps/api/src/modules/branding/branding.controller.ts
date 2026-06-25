import { Router, Request, Response } from 'express';
import { prisma } from '../../core/prisma';
import { tenantContext } from '../../core/tenantContext';
import { requirePermission } from '../../middleware/auth';
import { PERMISSIONS as P } from '../auth/roles';

/**
 * Autogestión del branding White-Label por el propio comercio.
 * Es la contraparte server-side del panel "Personalizar" del MVP: persiste la
 * identidad del tenant que luego sirve el storefront público.
 */
const router = Router();

const ALLOWED = [
  'logoUrl', 'faviconUrl', 'primaryColor', 'accentColor', 'fontFamily',
  'storeTitle', 'whatsappPhone', 'bankName', 'bankAccount', 'bankHolder',
] as const;

const HEX = /^#[0-9a-fA-F]{6}$/;

router.get('/', requirePermission(P.PRODUCT_READ), async (_req, res) => {
  const branding = await prisma.tenantBranding.findUnique({ where: { tenantId: tenantContext.tenantId() } });
  res.json(branding);
});

router.put('/', requirePermission(P.BRANDING_WRITE), async (req: Request, res: Response) => {
  const data: Record<string, unknown> = {};
  for (const k of ALLOWED) if (k in req.body) data[k] = req.body[k];

  if (data.primaryColor && !HEX.test(String(data.primaryColor))) {
    return res.status(400).json({ error: 'primaryColor debe ser hex #RRGGBB' });
  }
  if (data.accentColor && !HEX.test(String(data.accentColor))) {
    return res.status(400).json({ error: 'accentColor debe ser hex #RRGGBB' });
  }

  const updated = await prisma.tenantBranding.update({
    where: { tenantId: tenantContext.tenantId() },
    data,
  });
  res.json(updated);
});

export default router;

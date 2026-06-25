import { Router, Request, Response } from 'express';
import { prisma } from '../../core/prisma';
import { tenantContext } from '../../core/tenantContext';
import { requirePermission } from '../../middleware/auth';
import { storage, decodeDataUrl } from '../../core/storage';
import { PERMISSIONS as P } from '../auth/roles';

/**
 * Autogestión del branding White-Label por ferretería.
 * Contraparte server-side del panel "Personalizar": persiste identidad
 * (colores, fuente, títulos, datos de cobro) y gestiona el LOGO como asset
 * (upload validado, almacenado por-tenant en S3/disco).
 */
const router = Router();

const TEXT_FIELDS = [
  'primaryColor', 'accentColor', 'fontFamily', 'storeTitle',
  'whatsappPhone', 'bankName', 'bankAccount', 'bankHolder',
] as const;
const HEX = /^#[0-9a-fA-F]{6}$/;

const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response) =>
    fn(req, res).catch((e) => res.status(e.status ?? 500).json({ error: e.message ?? 'Error interno' }));

/** Branding actual del tenant. */
router.get(
  '/',
  requirePermission(P.PRODUCT_READ),
  wrap(async (_req, res) => {
    const branding = await prisma.tenantBranding.findUnique({ where: { tenantId: tenantContext.tenantId() } });
    res.json(branding);
  }),
);

/** Actualiza colores, fuente, títulos y datos de cobro. */
router.put(
  '/',
  requirePermission(P.BRANDING_WRITE),
  wrap(async (req, res) => {
    const data: Record<string, unknown> = {};
    for (const k of TEXT_FIELDS) if (k in req.body) data[k] = req.body[k];

    for (const c of ['primaryColor', 'accentColor'] as const) {
      if (data[c] && !HEX.test(String(data[c]))) {
        return res.status(400).json({ error: `${c} debe ser hex #RRGGBB` });
      }
    }
    const updated = await prisma.tenantBranding.update({
      where: { tenantId: tenantContext.tenantId() },
      data,
    });
    res.json(updated);
  }),
);

/**
 * Sube el LOGO de la ferretería (data URL base64 en el body).
 * Valida tipo/tamaño, almacena por-tenant (tenants/{id}/logo.<ext>) y persiste
 * la URL pública. Reemplaza el logo anterior.
 */
router.post(
  '/logo',
  requirePermission(P.BRANDING_WRITE),
  wrap(async (req, res) => {
    const tenantId = tenantContext.tenantId();
    const { buffer, contentType, ext } = decodeDataUrl(req.body?.dataUrl);
    const key = `tenants/${tenantId}/logo-${Date.now()}.${ext}`;
    const url = await storage.put(key, buffer, contentType);
    const updated = await prisma.tenantBranding.update({
      where: { tenantId },
      data: { logoUrl: url },
    });
    res.status(201).json({ logoUrl: updated.logoUrl });
  }),
);

export default router;

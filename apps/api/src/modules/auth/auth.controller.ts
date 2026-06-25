import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { adminPrisma } from '../../core/prisma';
import { signAccessToken } from '../../middleware/auth';
import { provisionTenant, HttpError } from '../tenants/provisioning.service';

/**
 * Auth: signup (provisioning), login y refresh.
 * - Access token corto (15 min) con permisos embebidos.
 * - Refresh token largo (7 d), rotado y guardado como hash en DB → revocable.
 * Login es cross-tenant por slug+email (multi-tenant: el mismo email puede
 * existir en varias tiendas).
 */
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret';
const router = Router();

const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response) =>
    fn(req, res).catch((e) => {
      if (e instanceof HttpError) return res.status(e.status).json({ error: e.message });
      console.error(e);
      res.status(500).json({ error: 'Error interno' });
    });

router.post(
  '/signup',
  wrap(async (req, res) => {
    const { tenant, owner } = await provisionTenant(req.body);
    res.status(201).json({ tenant: { slug: tenant.slug }, ownerId: owner.id });
  }),
);

router.post(
  '/login',
  wrap(async (req, res) => {
    const { slug, email, password } = req.body;
    const tenant = await adminPrisma.tenant.findUnique({ where: { slug } });
    if (!tenant) return res.status(401).json({ error: 'Credenciales inválidas' });

    const user = await adminPrisma.user.findUnique({
      where: { tenantId_email: { tenantId: tenant.id, email: String(email).toLowerCase() } },
      include: { role: true },
    });
    if (!user || !user.active || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const tokens = await issueTokens(user.id, tenant.id, user.role.name, user.role.permissions);
    await adminPrisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    res.json({ ...tokens, user: { id: user.id, name: user.name, role: user.role.name } });
  }),
);

router.post(
  '/refresh',
  wrap(async (req, res) => {
    const { refreshToken } = req.body;
    let payload: { sub: string; jti: string };
    try {
      payload = jwt.verify(refreshToken, REFRESH_SECRET) as any;
    } catch {
      return res.status(401).json({ error: 'Refresh inválido' });
    }
    const hash = sha256(refreshToken);
    const stored = await adminPrisma.refreshToken.findUnique({ where: { tokenHash: hash } });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      return res.status(401).json({ error: 'Sesión expirada' });
    }
    await adminPrisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });

    const user = await adminPrisma.user.findUnique({
      where: { id: payload.sub },
      include: { role: true },
    });
    if (!user) return res.status(401).json({ error: 'Usuario no encontrado' });

    const tokens = await issueTokens(user.id, user.tenantId, user.role.name, user.role.permissions);
    res.json(tokens);
  }),
);

async function issueTokens(userId: string, tenantId: string, role: string, permissions: string[]) {
  const accessToken = signAccessToken({ tenantId, userId, role, permissions });
  const jti = crypto.randomUUID();
  const refreshToken = jwt.sign({ sub: userId, jti }, REFRESH_SECRET, { expiresIn: '7d' });
  await adminPrisma.refreshToken.create({
    data: {
      userId,
      tokenHash: sha256(refreshToken),
      expiresAt: new Date(Date.now() + 7 * 86_400_000),
    },
  });
  return { accessToken, refreshToken };
}

const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

export default router;

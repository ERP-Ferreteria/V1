import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { tenantContext } from '../core/tenantContext';

/**
 * Identidad + RBAC. El access token (corto, 15 min) lleva tenantId, userId,
 * role y permisos. Toda la cadena de la request corre dentro del
 * tenantContext, así el cliente Prisma aplica RLS y los guards leen permisos
 * sin volver a la DB.
 */
const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'dev-access-secret';

interface AccessClaims {
  tenantId: string;
  userId: string;
  role: string;
  permissions: string[];
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  try {
    const claims = jwt.verify(header.slice(7), ACCESS_SECRET) as AccessClaims;
    // Ejecutar el resto del pipeline dentro del contexto del tenant.
    tenantContext.run(
      {
        tenantId: claims.tenantId,
        userId: claims.userId,
        roleName: claims.role,
        permissions: claims.permissions ?? [],
      },
      () => next(),
    );
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

/** Guard declarativo de permiso fino: requirePermission('order:approve'). */
export function requirePermission(...needed: string[]) {
  return (_req: Request, res: Response, next: NextFunction) => {
    const ok = needed.every((p) => tenantContext.has(p) || tenantContext.has('*'));
    if (!ok) return res.status(403).json({ error: `Falta permiso: ${needed.join(', ')}` });
    next();
  };
}

export function signAccessToken(claims: AccessClaims): string {
  return jwt.sign(claims, ACCESS_SECRET, { expiresIn: '15m' });
}

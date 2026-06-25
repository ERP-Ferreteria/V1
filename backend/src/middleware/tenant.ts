import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

export interface TenantRequest extends Request {
  tenantId?: string;
  userId?: string;
  userRole?: 'ADMIN' | 'CAJERO';
  /** Prisma client con el tenant ya configurado en la sesión (RLS). */
  db?: PrismaClient;
}

interface JwtPayload {
  tenantId: string;
  userId: string;
  role: 'ADMIN' | 'CAJERO';
}

/**
 * Middleware multi-tenant.
 * 1. Valida el JWT y extrae tenantId/userId/role.
 * 2. Setea `app.current_tenant` en la sesión de Postgres para que las
 *    políticas RLS aíslen automáticamente las filas de cada inquilino.
 */
export async function tenantMiddleware(
  req: TenantRequest,
  res: Response,
  next: NextFunction,
) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token requerido' });
  }

  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as JwtPayload;
    req.tenantId = payload.tenantId;
    req.userId = payload.userId;
    req.userRole = payload.role;

    // RLS: toda query de este request queda acotada al tenant.
    // set_config(..., true) lo hace local a la transacción/conexión actual.
    await prisma.$executeRawUnsafe(
      `SELECT set_config('app.current_tenant', $1, false)`,
      payload.tenantId,
    );

    req.db = prisma;
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

/** Restringe un endpoint a administradores (p.ej. validar pagos). */
export function requireAdmin(req: TenantRequest, res: Response, next: NextFunction) {
  if (req.userRole !== 'ADMIN') {
    return res.status(403).json({ error: 'Requiere rol ADMIN' });
  }
  next();
}

export { prisma };

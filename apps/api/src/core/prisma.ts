import { PrismaClient } from '@prisma/client';
import { tenantContext } from './tenantContext';

/**
 * Cliente Prisma con aislamiento multi-tenant transparente.
 *
 * Cada query se envuelve en una transacción donde se setea
 * `app.current_tenant`, de modo que las políticas RLS (0001_rls_policies.sql)
 * filtran las filas a nivel de motor. Es defensa en profundidad: aunque un
 * `where` olvide el tenantId, Postgres no devuelve filas de otros inquilinos.
 *
 * La extensión usa el tenantId del AsyncLocalStorage; si no hay contexto
 * (jobs/seed), corre sin scoping y debe usarse solo con conexión privilegiada.
 */
const base = new PrismaClient({
  log: process.env.NODE_ENV === 'production' ? ['warn', 'error'] : ['query', 'warn', 'error'],
});

export const prisma = base.$extends({
  query: {
    async $allOperations({ args, query }) {
      const ctx = tenantContext.get();
      if (!ctx?.tenantId) return query(args); // contexto admin/jobs

      return base.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.current_tenant', ${ctx.tenantId}, true)`;
        return query(args);
      });
    },
  },
});

/** Conexión sin scoping para el plano de control SaaS (provisioning, billing webhooks). */
export const adminPrisma = base;

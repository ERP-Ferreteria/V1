import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Contexto de ejecución por request, propagado sin pasar `req` por todas las capas.
 * Lo setea el middleware de auth/tenant y lo lee el cliente Prisma (RLS) y los guards.
 */
export interface RequestContext {
  tenantId: string;
  userId?: string;
  roleName?: string;
  permissions: string[];
}

const storage = new AsyncLocalStorage<RequestContext>();

export const tenantContext = {
  run<T>(ctx: RequestContext, fn: () => T): T {
    return storage.run(ctx, fn);
  },
  get(): RequestContext | undefined {
    return storage.getStore();
  },
  /** tenantId garantizado o error: usar dentro de rutas ya autenticadas. */
  tenantId(): string {
    const ctx = storage.getStore();
    if (!ctx?.tenantId) throw new Error('Tenant context ausente');
    return ctx.tenantId;
  },
  has(permission: string): boolean {
    return storage.getStore()?.permissions.includes(permission) ?? false;
  },
};

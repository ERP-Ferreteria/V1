import { adminPrisma } from '../../core/prisma';

/** Catálogo de planes SaaS. Idempotente: correr en deploy/seed. */
export const PLAN_CATALOG = [
  { code: 'FREE', name: 'Free', priceMonthly: 0, maxProducts: 50, maxUsers: 2, maxOrdersMonth: 100, allowCustomDomain: false, allowApiAccess: false },
  { code: 'PRO', name: 'Pro', priceMonthly: 29, maxProducts: 1000, maxUsers: 10, maxOrdersMonth: 5000, allowCustomDomain: true, allowApiAccess: false },
  { code: 'BUSINESS', name: 'Business', priceMonthly: 99, maxProducts: 50000, maxUsers: 100, maxOrdersMonth: 100000, allowCustomDomain: true, allowApiAccess: true },
];

export async function seedPlans() {
  for (const p of PLAN_CATALOG) {
    await adminPrisma.plan.upsert({ where: { code: p.code }, update: p, create: p });
  }
}

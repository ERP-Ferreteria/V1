import bcrypt from 'bcryptjs';
import { adminPrisma } from '../core/prisma';
import { seedPlans } from '../modules/billing/plans.seed';
import { SYSTEM_ROLES } from '../modules/auth/roles';

/**
 * Seed end-to-end: planes SaaS + tenant demo "El Tornillo" con jerarquía
 * funcional, productos (2 bajo stock crítico), proveedor, roles y usuario OWNER.
 * Idempotente por slug. Correr: npm run db:seed
 *   Login demo → slug: el-tornillo · admin@eltornillo.com · demo1234
 */

type Cat = { name: string; lead: number; medidas: { value: string; materiales: { value: string; productos: Prod[] }[] }[] };
type Prod = { sku: string; name: string; stock: number; critico: number; avg: number; units: { unit: any; factor: number; price: number }[] };

const DATA: Cat[] = [
  {
    name: 'Tornillería', lead: 5,
    medidas: [{
      value: '1/4 pulgada',
      materiales: [{
        value: 'Galvanizado',
        productos: [
          { sku: 'TOR-14-GAL', name: 'Tornillo Hexagonal', stock: 480, critico: 200, avg: 22, units: [{ unit: 'UNIDAD', factor: 1, price: 12 }, { unit: 'CAJA', factor: 100, price: 1050 }] },
          { sku: 'TUE-14-GAL', name: 'Tuerca Hexagonal', stock: 620, critico: 250, avg: 25, units: [{ unit: 'UNIDAD', factor: 1, price: 8 }] },
        ],
      }],
    }, {
      value: '3/8 pulgada',
      materiales: [{
        value: 'Acero Inoxidable',
        productos: [{ sku: 'TOR-38-INOX', name: 'Tornillo Autorroscante', stock: 90, critico: 150, avg: 18, units: [{ unit: 'UNIDAD', factor: 1, price: 25 }, { unit: 'CAJA', factor: 50, price: 1100 }] }],
      }],
    }],
  },
  {
    name: 'Plomería', lead: 7,
    medidas: [{
      value: '1/2 pulgada',
      materiales: [{
        value: 'PVC',
        productos: [
          { sku: 'CAN-12-PVC', name: 'Caño Roscado', stock: 75, critico: 40, avg: 6, units: [{ unit: 'METRO', factor: 1, price: 320 }] },
          { sku: 'COD-12-PVC', name: 'Codo 90°', stock: 18, critico: 30, avg: 4, units: [{ unit: 'UNIDAD', factor: 1, price: 145 }] },
        ],
      }],
    }],
  },
  {
    name: 'Electricidad', lead: 10,
    medidas: [{
      value: '2.5 mm²',
      materiales: [{
        value: 'Cobre',
        productos: [{ sku: 'CAB-25-COB', name: 'Cable Unipolar', stock: 850, critico: 300, avg: 30, units: [{ unit: 'METRO', factor: 1, price: 280 }, { unit: 'ROLLO', factor: 100, price: 26500 }] }],
      }],
    }],
  },
];

async function main() {
  await seedPlans();
  const free = await adminPrisma.plan.findUniqueOrThrow({ where: { code: 'FREE' } });

  const slug = 'el-tornillo';
  if (await adminPrisma.tenant.findUnique({ where: { slug } })) {
    console.log('Tenant demo ya existe — nada que hacer.');
    return;
  }

  const tenant = await adminPrisma.tenant.create({
    data: {
      slug, name: 'Ferretería El Tornillo', status: 'TRIAL',
      branding: { create: { storeTitle: 'Ferretería El Tornillo', whatsappPhone: '5491122334455', bankName: 'Banco Nación', bankAccount: 'CBU 0110599520000012345678', bankHolder: 'El Tornillo S.R.L.' } },
      subscription: { create: { planId: free.id, status: 'TRIALING', trialEndsAt: days(14), currentPeriodEnd: days(14) } },
    },
  });

  const roles = await Promise.all(
    SYSTEM_ROLES.map((r) => adminPrisma.role.create({ data: { tenantId: tenant.id, name: r.name, permissions: r.permissions, isSystem: true } })),
  );
  await adminPrisma.user.create({
    data: { tenantId: tenant.id, email: 'admin@eltornillo.com', passwordHash: await bcrypt.hash('demo1234', 12), name: 'Pedro Dueño', roleId: roles.find((r) => r.name === 'OWNER')!.id },
  });

  for (const cat of DATA) {
    const supplier = await adminPrisma.supplier.create({ data: { tenantId: tenant.id, name: `Proveedor ${cat.name}`, leadTimeDays: cat.lead } });
    const category = await adminPrisma.functionalCategory.create({ data: { tenantId: tenant.id, name: cat.name } });
    for (const med of cat.medidas) {
      const measure = await adminPrisma.measure.create({ data: { categoryId: category.id, value: med.value } });
      for (const mat of med.materiales) {
        const material = await adminPrisma.materialFinish.create({ data: { measureId: measure.id, value: mat.value } });
        for (const p of mat.productos) {
          await adminPrisma.product.create({
            data: {
              tenantId: tenant.id, materialFinishId: material.id, supplierId: supplier.id,
              sku: p.sku, name: p.name, stockQty: p.stock, criticalStock: p.critico, avgDailySales: p.avg,
              units: { create: p.units.map((u) => ({ unit: u.unit, factor: u.factor, price: u.price })) },
            },
          });
        }
      }
    }
  }

  console.log('✅ Seed listo. Login: slug=el-tornillo · admin@eltornillo.com · demo1234');
}

const days = (n: number) => new Date(Date.now() + n * 86_400_000);

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => adminPrisma.$disconnect());

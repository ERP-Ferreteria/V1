import bcrypt from 'bcryptjs';
import { adminPrisma } from '../../core/prisma';
import { SYSTEM_ROLES } from '../../modules/auth/roles';

/**
 * Provisioning de un nuevo tenant (onboarding self-service tipo Shopify).
 * Atómico: tenant + branding por defecto + suscripción trial + roles del
 * sistema + usuario OWNER. Si algo falla, no queda un tenant a medias.
 * Usa adminPrisma (sin RLS): es plano de control, antes de que exista sesión.
 */
export interface SignupInput {
  storeName: string;
  slug: string;
  ownerName: string;
  ownerEmail: string;
  ownerPassword: string;
}

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;
const RESERVED = new Set(['www', 'api', 'admin', 'app', 'dashboard', 'static']);

export async function provisionTenant(input: SignupInput) {
  const slug = input.slug.trim().toLowerCase();
  if (!SLUG_RE.test(slug) || RESERVED.has(slug)) {
    throw new HttpError(400, 'Subdominio inválido o reservado');
  }
  if (input.ownerPassword.length < 8) {
    throw new HttpError(400, 'La contraseña debe tener al menos 8 caracteres');
  }

  const exists = await adminPrisma.tenant.findUnique({ where: { slug } });
  if (exists) throw new HttpError(409, 'Ese subdominio ya está en uso');

  const freePlan = await adminPrisma.plan.findUnique({ where: { code: 'FREE' } });
  if (!freePlan) throw new HttpError(500, 'Planes no inicializados (seed pendiente)');

  const passwordHash = await bcrypt.hash(input.ownerPassword, 12);

  return adminPrisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        slug,
        name: input.storeName,
        status: 'TRIAL',
        branding: {
          create: { storeTitle: input.storeName }, // colores/fuente por defecto del schema
        },
        subscription: {
          create: {
            planId: freePlan.id,
            status: 'TRIALING',
            trialEndsAt: addDays(14),
            currentPeriodEnd: addDays(14),
          },
        },
      },
    });

    // Roles base del sistema (no editables).
    const roles = await Promise.all(
      SYSTEM_ROLES.map((r) =>
        tx.role.create({
          data: { tenantId: tenant.id, name: r.name, permissions: r.permissions, isSystem: true },
        }),
      ),
    );
    const ownerRole = roles.find((r) => r.name === 'OWNER')!;

    const owner = await tx.user.create({
      data: {
        tenantId: tenant.id,
        email: input.ownerEmail.toLowerCase(),
        passwordHash,
        name: input.ownerName,
        roleId: ownerRole.id,
      },
    });

    return { tenant, owner };
  });
}

function addDays(n: number): Date {
  return new Date(Date.now() + n * 86_400_000);
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

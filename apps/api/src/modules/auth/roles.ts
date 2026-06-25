/**
 * Catálogo de permisos y roles del sistema (RBAC).
 * Permisos como strings "recurso:acción" → simples de evaluar y de extender.
 * '*' = comodín total (solo OWNER).
 */
export const PERMISSIONS = {
  PRODUCT_READ: 'product:read',
  PRODUCT_WRITE: 'product:write',
  ORDER_READ: 'order:read',
  ORDER_APPROVE: 'order:approve',
  ORDER_REJECT: 'order:reject',
  POS_SELL: 'pos:sell',
  BRANDING_WRITE: 'branding:write',
  USER_MANAGE: 'user:manage',
  BILLING_MANAGE: 'billing:manage',
} as const;

const P = PERMISSIONS;

export const SYSTEM_ROLES: { name: string; permissions: string[] }[] = [
  { name: 'OWNER', permissions: ['*'] },
  {
    name: 'ADMIN',
    permissions: [
      P.PRODUCT_READ, P.PRODUCT_WRITE, P.ORDER_READ, P.ORDER_APPROVE,
      P.ORDER_REJECT, P.POS_SELL, P.BRANDING_WRITE, P.USER_MANAGE,
    ],
  },
  {
    name: 'CAJERO',
    permissions: [P.PRODUCT_READ, P.ORDER_READ, P.ORDER_APPROVE, P.POS_SELL],
  },
  { name: 'BODEGA', permissions: [P.PRODUCT_READ, P.PRODUCT_WRITE] },
];

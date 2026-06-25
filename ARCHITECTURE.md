# Ferremax — Arquitectura SaaS Multi-Tenant White-Label (definitiva)

Monorepo por dominio. La app cliente es **una sola** que se pinta con la
identidad de cada comercio (White-Label) resuelta por host.

```
ERP-Ferreteria/
├── packages/
│   ├── db/                      # Fuente de verdad del modelo de datos
│   │   ├── schema.prisma        # 6 dominios, multi-tenant + índices compuestos
│   │   └── migrations/0001_rls_policies.sql   # Row-Level Security
│   └── shared/                  # Tipos TS compartidos api ↔ web
├── apps/
│   ├── api/                     # Backend modular (Express + Prisma)
│   │   └── src/
│   │       ├── core/            # prisma (RLS), tenantContext (ALS)
│   │       ├── middleware/      # auth (JWT+RBAC), tenantResolver (white-label)
│   │       └── modules/
│   │           ├── auth/        # signup/login/refresh + roles RBAC
│   │           ├── tenants/     # provisioning / onboarding
│   │           ├── billing/     # planes + enforcement de límites
│   │           ├── storefront/  # catálogo público B2B por tenant
│   │           └── orders/      # checkout + reserva + validación
│   ├── web-storefront/          # Tienda pública white-label (React)
│   │   └── src/branding/        # ThemeProvider dinámico (Zustand)
│   └── web-admin/               # Panel autogestión del comercio
│       └── src/store/           # Sesión + RBAC en cliente (Zustand+persist)
│
├── backend/  (legacy)           # Scaffold inicial — superseded por apps/api
├── frontend/ (legacy)           # Scaffold inicial — superseded por apps/web-*
└── mvp/                          # Demo clickable para el cliente (sigue válido)
```

## Planos de ejecución del API

| Plano | Ruta | Auth | Aislamiento |
|---|---|---|---|
| Público (storefront) | `/storefront/*` | No | Resuelto por **Host** → `tenantResolver` |
| Control de cuenta | `/auth/*` | No | `adminPrisma` (plano de control) |
| Privado por tenant | `/api/*` | JWT | `tenantContext` (ALS) → **RLS** + RBAC + planes |

## Decisiones críticas

1. **Aislamiento en 2 capas.** App siempre filtra por `tenantId`, y Postgres lo
   **fuerza** con RLS (`FORCE ROW LEVEL SECURITY`). Un `where` olvidado no filtra datos.
   El tenant viaja por `AsyncLocalStorage`, no como parámetro manual.
2. **White-Label por host.** Subdominio (`<slug>.ferremax.app`) o dominio propio →
   un único frontend que carga branding (colores/logo/fuente) como CSS variables.
   Resolución cacheada en memoria (TTL 60s) por ser ruta de alto tráfico.
3. **RBAC con permisos planos** (`recurso:acción`) embebidos en el access token →
   evaluación O(1) sin round-trip a DB. Roles del sistema creados en el provisioning.
4. **Tokens:** access corto (15 min) + refresh rotativo guardado como **hash**
   (revocable). El email es único **por tenant**, no global.
5. **Billing como guard.** `planGuard` antepone límites (productos, órdenes, features)
   a las rutas de escritura y bloquea tenants `PAST_DUE/SUSPENDED` → monetización real.
6. **Provisioning atómico.** signup crea tenant + branding + trial + roles + owner en
   una transacción: nunca queda un tenant a medias.

## Puesta en marcha

```bash
# 1. Base de datos
cd packages/db && npx prisma migrate dev
psql "$DATABASE_URL" -f migrations/0001_rls_policies.sql

# 2. API
cd apps/api && npm i && npm run db:generate && npm run db:seed && npm run dev
```

## Estado de portado

`apps/api` tiene el núcleo SaaS (tenancy, identidad, white-label, billing,
storefront) production-grade. Los controladores de **inventario** y **órdenes**
ya existen en `backend/src/modules/` y se enganchan en los stubs marcados
`501` de `apps/api/src/app.ts` (misma lógica de reserva/validación, ahora bajo
`tenantContext` + RLS + guards de plan).

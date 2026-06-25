# Ferremax — SaaS ERP + POS para Ferreterías

Plataforma **multi-tenant** (multi-inquilino) con backend API-First (monolito modular) y
frontend POS **offline-first** con checkout por **WhatsApp / Transferencia**.

## Stack

| Capa        | Tecnología                                              |
|-------------|---------------------------------------------------------|
| Backend     | Node 20 + TypeScript + Express (monolito modular)       |
| ORM / DB    | Prisma + PostgreSQL (aislamiento por `tenantId` + RLS)  |
| Frontend    | React 18 + Vite + TypeScript                            |
| Offline     | IndexedDB (Dexie) + Service Worker (Workbox)            |
| Auth        | JWT con claim `tenantId`                                |

## Estructura

```
backend/
  prisma/schema.prisma          # Fase 1: modelo de datos multi-tenant
  src/middleware/tenant.ts      # Aislamiento multi-inquilino
  src/modules/inventory/        # Fase 1: jerarquía, unidades, stock crítico
  src/modules/orders/           # Fase 2: checkout WhatsApp, reserva, validación
frontend/
  src/db/localDb.ts             # Fase 3: IndexedDB local
  src/components/Cart.tsx       # Fase 3: checkout + redirección wa.me
  src/components/PosTerminal.tsx# Fase 3: POS táctil offline
  src/components/KanbanBoard.tsx# Fase 3: dashboard de órdenes
  src/sync/syncEngine.ts        # Fase 3: reconciliación por timestamp
  src/service-worker.ts         # Fase 3: sync en background
docs/ARQUITECTURA.md            # ERD + decisiones de diseño
```

## Las 3 Fases

- **Fase 1 — Datos:** Inventario jerárquico de 3 niveles (Categoría Funcional → Medida →
  Material/Acabado), múltiples unidades de venta por producto, y alerta de *stock crítico*
  que considera el *lead time* del proveedor.
- **Fase 2 — Órdenes:** Flujo de pago WhatsApp con orden `PENDIENTE_VALIDACION`, reserva
  temporal de stock con liberación automática, y validación del cajero con referencia bancaria.
- **Fase 3 — Frontend:** POS táctil offline (IndexedDB), checkout `wa.me`, Service Worker con
  reconciliación de conflictos, y dashboard Kanban.

Ver [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) para el ERD y el detalle de cada decisión.

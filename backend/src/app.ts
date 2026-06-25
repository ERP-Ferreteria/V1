import express from 'express';
import cors from 'cors';
import { tenantMiddleware, requireAdmin, prisma } from './middleware/tenant';
import * as inventory from './modules/inventory/inventory.controller';
import * as orders from './modules/orders/orders.controller';
import { syncOfflineSales } from './modules/sync/sync.controller';
import { expireStaleReservations } from './modules/orders/reservation.service';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));

// Todas las rutas de negocio pasan por el aislamiento multi-tenant.
app.use('/api', tenantMiddleware);

// ── Fase 1: Inventario ──
app.get('/api/inventory/tree', inventory.getInventoryTree);
app.post('/api/inventory/products', requireAdmin, inventory.createProduct);
app.post('/api/inventory/products/:productId/recalc-critical', requireAdmin, inventory.recalcCriticalStock);
app.get('/api/inventory/purchase-report', inventory.getPurchaseReport);

// ── Fase 2: Órdenes ──
app.post('/api/orders', orders.createOrder);
app.get('/api/orders', orders.listOrders);
app.post('/api/orders/:orderId/approve', requireAdmin, orders.approveOrder);
app.post('/api/orders/:orderId/reject', requireAdmin, orders.rejectOrder);

// ── Fase 3: Sincronización offline ──
app.post('/api/sync/offline-sales', syncOfflineSales);

// Job: liberar reservas vencidas cada 10 minutos.
setInterval(() => {
  expireStaleReservations(prisma)
    .then((n) => n && console.log(`[reservas] ${n} órdenes vencidas liberadas`))
    .catch(console.error);
}, 10 * 60 * 1000);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Ferremax API en http://localhost:${PORT}`));

export default app;

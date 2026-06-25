import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { authenticate, requirePermission } from './middleware/auth';
import { blockIfNotOperational, enforceProductLimit, enforceOrderLimit } from './modules/billing/planGuard';
import authController from './modules/auth/auth.controller';
import storefrontController from './modules/storefront/storefront.controller';
import { PERMISSIONS as P } from './modules/auth/roles';

/**
 * Composición de la API. Tres planos:
 *  1. Público sin auth  → /storefront (resuelto por host, white-label)
 *  2. Control de cuenta → /auth (signup/login/refresh)
 *  3. Privado por tenant→ /api/* (authenticate → tenantContext + RLS + RBAC + planes)
 */
const app = express();
app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));

// 1 + 2
app.use('/storefront', storefrontController);
app.use('/auth', authController);

// 3 — todo lo de /api corre dentro del contexto del tenant (RLS automático).
app.use('/api', authenticate, blockIfNotOperational());

// Ejemplos de rutas privadas con RBAC + límites de plan
// (los controladores de inventario/órdenes/branding se enganchan aquí):
app.post('/api/products', requirePermission(P.PRODUCT_WRITE), enforceProductLimit(), (_req, res) =>
  res.status(501).json({ error: 'inventory.controller pendiente de portar' }),
);
app.post('/api/orders', requirePermission(P.POS_SELL), enforceOrderLimit(), (_req, res) =>
  res.status(501).json({ error: 'orders.controller pendiente de portar' }),
);
app.post('/api/orders/:id/approve', requirePermission(P.ORDER_APPROVE), (_req, res) =>
  res.status(501).json({ error: 'orders.controller pendiente de portar' }),
);

// Handler de errores centralizado.
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(err.status ?? 500).json({ error: err.message ?? 'Error interno' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Ferremax API (definitiva) en :${PORT}`));

export default app;

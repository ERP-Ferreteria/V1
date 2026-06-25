import { Router, Request, Response } from 'express';
import { prisma, adminPrisma, tenantTransaction } from '../../core/prisma';
import { tenantContext } from '../../core/tenantContext';
import { requirePermission } from '../../middleware/auth';
import { enforceOrderLimit } from '../billing/planGuard';
import { PERMISSIONS as P } from '../auth/roles';
import { reserveStock, releaseReservations, consumeReservations, reservationExpiry } from './reservation.service';

/**
 * Órdenes (Fase 2): checkout WhatsApp → PENDIENTE_VALIDACION con reserva;
 * validación del cajero → COMPLETADA (consume stock) con referencia bancaria;
 * rechazo → libera. Todo atómico vía tenantTransaction (un solo set_config).
 */
const router = Router();
const code = () => `ORD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response) =>
    fn(req, res).catch((e) => {
      console.error(e);
      res.status(e.status ?? 500).json({ error: e.message ?? 'Error interno' });
    });

/** Procesa el carrito y reserva stock (con límite de órdenes por plan). */
router.post(
  '/',
  requirePermission(P.POS_SELL),
  enforceOrderLimit(),
  wrap(async (req, res) => {
    const { items, customerName, customerPhone, clientId, source } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Carrito vacío' });
    }
    const tenantId = tenantContext.tenantId();

    if (clientId) {
      const dup = await prisma.order.findFirst({ where: { clientId }, include: { items: true } });
      if (dup) return res.status(200).json(dup);
    }

    const order = await tenantTransaction(async (tx) => {
      let total = 0;
      const lines = [];
      for (const it of items) {
        const unit = await tx.productUnit.findFirst({
          where: { id: it.productUnitId },
          include: { product: true },
        });
        if (!unit) throw Object.assign(new Error('Unidad inválida'), { status: 400 });
        const baseQuantity = Math.round(Number(unit.factor) * it.quantity);
        total += Number(unit.price) * it.quantity;
        lines.push({
          productId: unit.productId,
          productUnitId: unit.id,
          quantity: it.quantity,
          unitPrice: unit.price,
          baseQuantity,
        });
      }
      const created = await tx.order.create({
        data: {
          tenantId,
          code: code(),
          total,
          customerName,
          customerPhone,
          clientId: clientId ?? null,
          source: source === 'POS_OFFLINE' ? 'POS_OFFLINE' : 'ONLINE',
          reservationExpiresAt: reservationExpiry(),
          items: { create: lines },
        },
        include: { items: true },
      });
      await reserveStock(tx, created.id, lines.map((l) => ({ productId: l.productId, baseQuantity: l.baseQuantity })));
      return created;
    });

    // Contador de plan (control-plane).
    await adminPrisma.subscription.update({
      where: { tenantId },
      data: { ordersThisPeriod: { increment: 1 } },
    });

    res.status(201).json(order);
  }),
);

/** Listado por estado (Kanban). */
router.get(
  '/',
  requirePermission(P.ORDER_READ),
  wrap(async (req, res) => {
    const orders = await prisma.order.findMany({
      where: req.query.status ? { status: req.query.status as any } : {},
      include: { items: { include: { product: true, productUnit: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(orders);
  }),
);

/** Aprobar pago: COMPLETADA + consume stock. Referencia bancaria obligatoria. */
router.post(
  '/:id/approve',
  requirePermission(P.ORDER_APPROVE),
  wrap(async (req, res) => {
    const { bankReference } = req.body;
    if (!bankReference?.trim()) return res.status(400).json({ error: 'Referencia bancaria obligatoria' });

    const order = await prisma.order.findFirst({ where: { id: req.params.id } });
    if (!order) return res.status(404).json({ error: 'Orden no encontrada' });
    if (order.status !== 'PENDIENTE_VALIDACION') return res.status(409).json({ error: `Orden ya ${order.status}` });

    const updated = await tenantTransaction(async (tx) => {
      await consumeReservations(tx, order.id);
      return tx.order.update({
        where: { id: order.id },
        data: {
          status: 'COMPLETADA',
          bankReference: bankReference.trim(),
          validatedById: tenantContext.get()?.userId,
          validatedAt: new Date(),
        },
      });
    });
    res.json(updated);
  }),
);

/** Rechazar: libera el stock reservado. */
router.post(
  '/:id/reject',
  requirePermission(P.ORDER_REJECT),
  wrap(async (req, res) => {
    const order = await prisma.order.findFirst({ where: { id: req.params.id } });
    if (!order) return res.status(404).json({ error: 'Orden no encontrada' });
    if (order.status !== 'PENDIENTE_VALIDACION') return res.status(409).json({ error: `Orden ya ${order.status}` });

    const updated = await tenantTransaction(async (tx) => {
      await releaseReservations(tx, order.id);
      return tx.order.update({ where: { id: order.id }, data: { status: 'RECHAZADA' } });
    });
    res.json(updated);
  }),
);

export default router;

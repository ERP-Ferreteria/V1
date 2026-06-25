import { Response } from 'express';
import { TenantRequest } from '../../middleware/tenant';
import {
  reserveStock,
  releaseReservations,
  consumeReservations,
  reservationExpiry,
} from './reservation.service';

/**
 * Fase 2 — Controladores de órdenes.
 * Flujo de pago WhatsApp/Transferencia (sin pasarela): la orden nace
 * PENDIENTE_VALIDACION con stock reservado y el admin la valida con la
 * referencia bancaria del comprobante.
 */

function generateOrderCode(): string {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `ORD-${Date.now().toString(36).toUpperCase()}-${rand}`;
}

/**
 * Fase 2.1 + 2.2 — Procesa el carrito.
 * Crea la orden PENDIENTE_VALIDACION y reserva stock en una sola transacción.
 * Soporta `clientId` para idempotencia desde el POS offline.
 */
export async function createOrder(req: TenantRequest, res: Response) {
  const db = req.db!;
  const { items, customerName, customerPhone, clientId, source } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'El carrito está vacío' });
  }

  // Idempotencia: si la orden offline ya se sincronizó, devolverla tal cual.
  if (clientId) {
    const existing = await db.order.findFirst({
      where: { tenantId: req.tenantId, clientId },
      include: { items: true },
    });
    if (existing) return res.status(200).json(existing);
  }

  try {
    const order = await db.$transaction(async (tx) => {
      // Resolver precios y factores desde ProductUnit (no confiar en el cliente).
      const resolved = [];
      let total = 0;
      for (const it of items) {
        const unit = await tx.productUnit.findFirst({
          where: { id: it.productUnitId, product: { tenantId: req.tenantId } },
          include: { product: true },
        });
        if (!unit) throw new Error(`Unidad ${it.productUnitId} inválida`);

        const baseQuantity = Math.round(Number(unit.factor) * it.quantity);
        const lineTotal = Number(unit.price) * it.quantity;
        total += lineTotal;
        resolved.push({
          productId: unit.productId,
          productUnitId: unit.id,
          quantity: it.quantity,
          unitPrice: unit.price,
          baseQuantity,
        });
      }

      const created = await tx.order.create({
        data: {
          tenantId: req.tenantId!,
          code: generateOrderCode(),
          status: 'PENDIENTE_VALIDACION',
          total,
          customerName,
          customerPhone,
          clientId: clientId ?? null,
          source: source === 'POS_OFFLINE' ? 'POS_OFFLINE' : 'ONLINE',
          reservationExpiresAt: reservationExpiry(),
          items: { create: resolved },
        },
        include: { items: true },
      });

      await reserveStock(
        tx,
        created.id,
        resolved.map((r) => ({ productId: r.productId, baseQuantity: r.baseQuantity })),
      );
      return created;
    });

    res.status(201).json(order);
  } catch (err: any) {
    res.status(409).json({ error: err.message });
  }
}

/** Lista órdenes por estado (para el Kanban del cajero). */
export async function listOrders(req: TenantRequest, res: Response) {
  const db = req.db!;
  const { status } = req.query;
  const orders = await db.order.findMany({
    where: {
      tenantId: req.tenantId,
      ...(status ? { status: status as any } : {}),
    },
    include: { items: { include: { product: true, productUnit: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(orders);
}

/**
 * Fase 2.3 — Validación del cajero/admin.
 * Pasa la orden a COMPLETADA, consume las reservas (descuenta stock real) y
 * exige el número de referencia bancaria del comprobante de WhatsApp.
 */
export async function approveOrder(req: TenantRequest, res: Response) {
  const db = req.db!;
  const { orderId } = req.params;
  const { bankReference } = req.body;

  if (!bankReference || !String(bankReference).trim()) {
    return res.status(400).json({ error: 'La referencia bancaria es obligatoria' });
  }

  const order = await db.order.findFirst({
    where: { id: orderId, tenantId: req.tenantId },
  });
  if (!order) return res.status(404).json({ error: 'Orden no encontrada' });
  if (order.status !== 'PENDIENTE_VALIDACION') {
    return res.status(409).json({ error: `La orden ya está ${order.status}` });
  }

  const updated = await db.$transaction(async (tx) => {
    await consumeReservations(tx, order.id);
    return tx.order.update({
      where: { id: order.id },
      data: {
        status: 'COMPLETADA',
        bankReference: String(bankReference).trim(),
        validatedById: req.userId,
        validatedAt: new Date(),
      },
    });
  });

  res.json(updated);
}

/** Rechaza la orden y devuelve el stock reservado a disponible. */
export async function rejectOrder(req: TenantRequest, res: Response) {
  const db = req.db!;
  const { orderId } = req.params;

  const order = await db.order.findFirst({
    where: { id: orderId, tenantId: req.tenantId },
  });
  if (!order) return res.status(404).json({ error: 'Orden no encontrada' });
  if (order.status !== 'PENDIENTE_VALIDACION') {
    return res.status(409).json({ error: `La orden ya está ${order.status}` });
  }

  const updated = await db.$transaction(async (tx) => {
    await releaseReservations(tx, order.id);
    return tx.order.update({ where: { id: order.id }, data: { status: 'RECHAZADA' } });
  });

  res.json(updated);
}

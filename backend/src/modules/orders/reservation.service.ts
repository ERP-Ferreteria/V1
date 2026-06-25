import { PrismaClient, Prisma } from '@prisma/client';

/**
 * Fase 2.2 — Reserva temporal de stock.
 * El stock disponible de un producto es: stockQty - reservedQty.
 * Al crear una orden reservamos; al completar consumimos; al rechazar/expirar liberamos.
 */

const RESERVATION_TTL_HOURS = 24;

/** Reserva stock para todos los items dentro de una transacción. Lanza si no alcanza. */
export async function reserveStock(
  tx: Prisma.TransactionClient,
  orderId: string,
  items: { productId: string; baseQuantity: number }[],
) {
  for (const item of items) {
    const product = await tx.product.findUnique({ where: { id: item.productId } });
    if (!product) throw new Error(`Producto ${item.productId} no existe`);

    const available = product.stockQty - product.reservedQty;
    if (available < item.baseQuantity) {
      throw new Error(
        `Stock insuficiente para ${product.sku}: disponible ${available}, pedido ${item.baseQuantity}`,
      );
    }

    await tx.product.update({
      where: { id: item.productId },
      data: { reservedQty: { increment: item.baseQuantity } },
    });
    await tx.stockReservation.create({
      data: { orderId, productId: item.productId, baseQuantity: item.baseQuantity },
    });
    await tx.stockMovement.create({
      data: { productId: item.productId, delta: -item.baseQuantity, reason: 'RESERVA', orderId },
    });
  }
}

/** Libera (devuelve a disponible) las reservas activas de una orden. Para RECHAZO/expiración. */
export async function releaseReservations(tx: Prisma.TransactionClient, orderId: string) {
  const active = await tx.stockReservation.findMany({
    where: { orderId, releasedAt: null },
  });
  for (const r of active) {
    await tx.product.update({
      where: { id: r.productId },
      data: { reservedQty: { decrement: r.baseQuantity } },
    });
    await tx.stockMovement.create({
      data: { productId: r.productId, delta: r.baseQuantity, reason: 'LIBERACION', orderId },
    });
  }
  await tx.stockReservation.updateMany({
    where: { orderId, releasedAt: null },
    data: { releasedAt: new Date() },
  });
}

/** Consume las reservas: descuenta del stock físico. Para COMPLETAR la orden. */
export async function consumeReservations(tx: Prisma.TransactionClient, orderId: string) {
  const active = await tx.stockReservation.findMany({
    where: { orderId, releasedAt: null },
  });
  for (const r of active) {
    await tx.product.update({
      where: { id: r.productId },
      data: {
        stockQty: { decrement: r.baseQuantity },
        reservedQty: { decrement: r.baseQuantity },
      },
    });
    await tx.stockMovement.create({
      data: { productId: r.productId, delta: -r.baseQuantity, reason: 'VENTA', orderId },
    });
  }
  await tx.stockReservation.updateMany({
    where: { orderId, releasedAt: null },
    data: { releasedAt: new Date() },
  });
}

export function reservationExpiry(): Date {
  return new Date(Date.now() + RESERVATION_TTL_HOURS * 3600 * 1000);
}

/**
 * Job periódico: libera reservas de órdenes pendientes vencidas (>24h) para que
 * el stock vuelva a estar disponible automáticamente.
 */
export async function expireStaleReservations(prisma: PrismaClient) {
  const stale = await prisma.order.findMany({
    where: {
      status: 'PENDIENTE_VALIDACION',
      reservationExpiresAt: { lt: new Date() },
    },
    select: { id: true },
  });

  for (const order of stale) {
    await prisma.$transaction(async (tx) => {
      await releaseReservations(tx, order.id);
      await tx.order.update({ where: { id: order.id }, data: { status: 'RECHAZADA' } });
    });
  }
  return stale.length;
}

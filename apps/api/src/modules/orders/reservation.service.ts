/**
 * Reserva temporal de stock (Fase 2) — opera sobre un `tx` ya acotado al tenant.
 * disponible = stockQty − reservedQty. Reservar → consumir (venta) / liberar (rechazo).
 */
type Tx = any; // Prisma.TransactionClient — laxo para evitar fricción de tipos

const TTL_HOURS = 24;

export async function reserveStock(
  tx: Tx,
  orderId: string,
  items: { productId: string; baseQuantity: number }[],
) {
  for (const item of items) {
    const p = await tx.product.findUnique({ where: { id: item.productId } });
    if (!p) throw Object.assign(new Error('Producto inexistente'), { status: 404 });
    if (p.stockQty - p.reservedQty < item.baseQuantity) {
      throw Object.assign(new Error(`Stock insuficiente para ${p.sku}`), { status: 409 });
    }
    await tx.product.update({
      where: { id: item.productId },
      data: { reservedQty: { increment: item.baseQuantity } },
    });
    await tx.stockReservation.create({
      data: { orderId, productId: item.productId, baseQuantity: item.baseQuantity },
    });
  }
}

export async function releaseReservations(tx: Tx, orderId: string) {
  const active = await tx.stockReservation.findMany({ where: { orderId, releasedAt: null } });
  for (const r of active) {
    await tx.product.update({
      where: { id: r.productId },
      data: { reservedQty: { decrement: r.baseQuantity } },
    });
  }
  await tx.stockReservation.updateMany({
    where: { orderId, releasedAt: null },
    data: { releasedAt: new Date() },
  });
}

export async function consumeReservations(tx: Tx, orderId: string) {
  const active = await tx.stockReservation.findMany({ where: { orderId, releasedAt: null } });
  for (const r of active) {
    await tx.product.update({
      where: { id: r.productId },
      data: { stockQty: { decrement: r.baseQuantity }, reservedQty: { decrement: r.baseQuantity } },
    });
  }
  await tx.stockReservation.updateMany({
    where: { orderId, releasedAt: null },
    data: { releasedAt: new Date() },
  });
}

export const reservationExpiry = () => new Date(Date.now() + TTL_HOURS * 3_600_000);

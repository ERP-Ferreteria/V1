import { Response } from 'express';
import { TenantRequest } from '../../middleware/tenant';
import { reserveStock, consumeReservations } from '../orders/reservation.service';

/**
 * Fase 3.3 — Reconciliación de ventas offline.
 * El POS envía un lote de ventas hechas sin internet. Cada una trae:
 *   - clientId  (UUID idempotente generado en el dispositivo)
 *   - clientUpdatedAt (timestamp local, base del Last-Write-Wins)
 *   - items[]
 * Reglas:
 *   1. Idempotencia: si clientId ya existe, no se duplica.
 *   2. Las ventas de mostrador ya cobradas llegan como COMPLETADA: se intenta
 *      descontar stock directo. Si el stock no alcanza (mismo producto vendido
 *      en dos cajas a la vez), gana la de timestamp menor y la otra se marca
 *      REQUIERE_REVISION para que el admin la concilie.
 */
export async function syncOfflineSales(req: TenantRequest, res: Response) {
  const db = req.db!;
  const { sales } = req.body as { sales: OfflineSale[] };

  if (!Array.isArray(sales)) {
    return res.status(400).json({ error: 'Formato inválido' });
  }

  // Orden determinista: la venta más antigua se procesa primero (LWW por timestamp).
  const ordered = [...sales].sort(
    (a, b) => new Date(a.clientUpdatedAt).getTime() - new Date(b.clientUpdatedAt).getTime(),
  );

  const results: SyncResult[] = [];

  for (const sale of ordered) {
    try {
      const existing = await db.order.findFirst({
        where: { tenantId: req.tenantId, clientId: sale.clientId },
        select: { id: true, code: true, status: true },
      });
      if (existing) {
        results.push({ clientId: sale.clientId, status: 'DUPLICADO', serverId: existing.id });
        continue;
      }

      const outcome = await db.$transaction(async (tx) => {
        // Resolver líneas y detectar si hay stock suficiente.
        let total = 0;
        let conflict = false;
        const lines = [];
        for (const it of sale.items) {
          const unit = await tx.productUnit.findFirst({
            where: { id: it.productUnitId, product: { tenantId: req.tenantId } },
            include: { product: true },
          });
          if (!unit) throw new Error(`Unidad ${it.productUnitId} inválida`);
          const baseQuantity = Math.round(Number(unit.factor) * it.quantity);
          if (unit.product.stockQty - unit.product.reservedQty < baseQuantity) conflict = true;
          total += Number(unit.price) * it.quantity;
          lines.push({
            productId: unit.productId,
            productUnitId: unit.id,
            quantity: it.quantity,
            unitPrice: unit.price,
            baseQuantity,
          });
        }

        const order = await tx.order.create({
          data: {
            tenantId: req.tenantId!,
            code: sale.code ?? `POS-${sale.clientId.slice(0, 8).toUpperCase()}`,
            clientId: sale.clientId,
            source: 'POS_OFFLINE',
            total,
            // Conflicto de stock → marcar para revisión manual del admin.
            status: conflict ? 'REQUIERE_REVISION' : 'COMPLETADA',
            bankReference: sale.bankReference ?? 'EFECTIVO_OFFLINE',
            validatedAt: conflict ? null : new Date(),
            items: { create: lines },
          },
        });

        if (!conflict) {
          // Reservar y consumir en el acto: fue una venta de mostrador ya cobrada.
          const resv = lines.map((l) => ({ productId: l.productId, baseQuantity: l.baseQuantity }));
          await reserveStock(tx, order.id, resv);
          await consumeReservations(tx, order.id);
        }

        return { id: order.id, conflict };
      });

      results.push({
        clientId: sale.clientId,
        status: outcome.conflict ? 'REQUIERE_REVISION' : 'CONFIRMADO',
        serverId: outcome.id,
      });
    } catch (err: any) {
      results.push({ clientId: sale.clientId, status: 'ERROR', error: err.message });
    }
  }

  res.json({ processed: results.length, results });
}

interface OfflineSale {
  clientId: string;
  clientUpdatedAt: string;
  code?: string;
  bankReference?: string;
  items: { productUnitId: string; quantity: number }[];
}

interface SyncResult {
  clientId: string;
  status: 'CONFIRMADO' | 'DUPLICADO' | 'REQUIERE_REVISION' | 'ERROR';
  serverId?: string;
  error?: string;
}

import { db, PendingSale } from '../db/localDb';

/**
 * Fase 3.3 — Motor de reconciliación (lado cliente).
 * Envía al backend las ventas offline pendientes y aplica las reglas de
 * resolución de conflictos basadas en marcas de tiempo.
 *
 * Estrategia:
 *  - Last-Write-Wins por `clientUpdatedAt`: ordenamos por timestamp ascendente
 *    para que el servidor procese primero la venta más antigua. Si el mismo
 *    producto se vendió en dos cajas a la vez y el stock no alcanza para ambas,
 *    la más reciente vuelve como REQUIERE_REVISION.
 *  - Idempotencia por `clientId`: reintentar el sync nunca duplica ventas.
 */

const API = import.meta.env.VITE_API_URL ?? '/api';

export async function syncPendingSales(token: string): Promise<SyncSummary> {
  const pending = await db.pendingSales
    .where('syncStatus')
    .anyOf('PENDIENTE', 'ERROR')
    .toArray();

  if (pending.length === 0) return { sent: 0, confirmed: 0, conflicts: 0 };

  const payload = {
    sales: pending
      .slice()
      .sort(
        (a, b) =>
          new Date(a.clientUpdatedAt).getTime() - new Date(b.clientUpdatedAt).getTime(),
      )
      .map((s) => ({
        clientId: s.clientId,
        clientUpdatedAt: s.clientUpdatedAt,
        code: s.code,
        bankReference: s.bankReference,
        items: s.items,
      })),
  };

  const res = await fetch(`${API}/sync/offline-sales`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Sync falló: ${res.status}`);

  const { results } = (await res.json()) as {
    results: { clientId: string; status: string; serverId?: string }[];
  };

  let confirmed = 0;
  let conflicts = 0;

  await db.transaction('rw', db.pendingSales, async () => {
    for (const r of results) {
      const local = await db.pendingSales.get(r.clientId);
      if (!local) continue;
      const next: PendingSale['syncStatus'] =
        r.status === 'CONFIRMADO' || r.status === 'DUPLICADO'
          ? 'CONFIRMADO'
          : r.status === 'REQUIERE_REVISION'
            ? 'REQUIERE_REVISION'
            : 'ERROR';
      if (next === 'CONFIRMADO') confirmed++;
      if (next === 'REQUIERE_REVISION') conflicts++;
      await db.pendingSales.put({ ...local, syncStatus: next, serverId: r.serverId });
    }
  });

  return { sent: pending.length, confirmed, conflicts };
}

interface SyncSummary {
  sent: number;
  confirmed: number;
  conflicts: number;
}

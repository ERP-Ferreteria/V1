import { useEffect, useState } from 'react';

/**
 * Fase 3.4 — Dashboard Kanban del cajero.
 * Dos columnas: 'Pendientes de Validación' y 'Completadas'. El botón
 * 'Aprobar Pago' pide la referencia bancaria y libera/consume el inventario
 * reservado en Fase 2 (POST /orders/:id/approve).
 */

interface Order {
  id: string;
  code: string;
  status: 'PENDIENTE_VALIDACION' | 'COMPLETADA' | 'RECHAZADA' | 'REQUIERE_REVISION';
  total: number;
  customerName?: string;
  bankReference?: string;
  items: { quantity: number; productUnit: { unit: string }; product: { name: string } }[];
}

const API = import.meta.env.VITE_API_URL ?? '/api';

export default function KanbanBoard({ token }: { token: string }) {
  const [pending, setPending] = useState<Order[]>([]);
  const [done, setDone] = useState<Order[]>([]);

  async function load() {
    const headers = { Authorization: `Bearer ${token}` };
    const [p, d] = await Promise.all([
      fetch(`${API}/orders?status=PENDIENTE_VALIDACION`, { headers }).then((r) => r.json()),
      fetch(`${API}/orders?status=COMPLETADA`, { headers }).then((r) => r.json()),
    ]);
    setPending(p);
    setDone(d);
  }

  useEffect(() => {
    load();
    // Refrescar cuando el Service Worker termina un sync.
    const onMsg = (e: MessageEvent) => e.data?.type === 'SYNC_DONE' && load();
    navigator.serviceWorker?.addEventListener('message', onMsg);
    return () => navigator.serviceWorker?.removeEventListener('message', onMsg);
  }, []);

  async function approve(order: Order) {
    const bankReference = window.prompt(
      `Aprobar ${order.code}\nIngresa la referencia bancaria del comprobante:`,
    );
    if (!bankReference?.trim()) return; // referencia obligatoria
    const res = await fetch(`${API}/orders/${order.id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ bankReference }),
    });
    if (res.ok) load();
    else alert((await res.json()).error);
  }

  async function reject(order: Order) {
    if (!window.confirm(`¿Rechazar ${order.code}? El stock volverá a estar disponible.`)) return;
    await fetch(`${API}/orders/${order.id}/reject`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    load();
  }

  return (
    <div className="kanban">
      <section className="kanban-col">
        <h2>🕒 Pendientes de Validación ({pending.length})</h2>
        {pending.map((o) => (
          <article key={o.id} className="order-card pending">
            <header>
              <strong>{o.code}</strong>
              <span>${o.total.toFixed(2)}</span>
            </header>
            {o.customerName && <p className="muted">{o.customerName}</p>}
            <ul>
              {o.items.map((it, i) => (
                <li key={i}>
                  {it.quantity} {it.productUnit.unit} · {it.product.name}
                </li>
              ))}
            </ul>
            <div className="order-actions">
              <button className="btn-approve" onClick={() => approve(o)}>
                ✓ Aprobar Pago
              </button>
              <button className="btn-reject" onClick={() => reject(o)}>
                ✕ Rechazar
              </button>
            </div>
          </article>
        ))}
      </section>

      <section className="kanban-col">
        <h2>✅ Completadas ({done.length})</h2>
        {done.map((o) => (
          <article key={o.id} className="order-card done">
            <header>
              <strong>{o.code}</strong>
              <span>${o.total.toFixed(2)}</span>
            </header>
            <p className="muted">Ref: {o.bankReference}</p>
          </article>
        ))}
      </section>
    </div>
  );
}

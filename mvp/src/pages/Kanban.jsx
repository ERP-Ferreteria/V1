import { useStore } from '../store/useStore.js';

// PILAR 4 — Tablero Kanban de órdenes para el administrador.
// Columna 'Pendientes' (vienen del checkout) y 'Completadas'.
// 'Aprobar Pago' mueve la tarjeta y descuenta el stock global.
export default function Kanban() {
  const ordenes = useStore((s) => s.ordenes);
  const aprobar = useStore((s) => s.aprobarPago);

  const pendientes = ordenes.filter((o) => o.status === 'PENDIENTE');
  const completadas = ordenes.filter((o) => o.status === 'COMPLETADA');

  function handleAprobar(orden) {
    const ref = window.prompt(
      `Aprobar pago de ${orden.code}\n\nIngresá la referencia bancaria del comprobante recibido por WhatsApp:`,
    );
    if (ref === null) return; // canceló
    aprobar(orden.code, ref.trim() || 'S/REF');
  }

  return (
    <div className="kanban-wrap">
      <div className="kanban-head">
        <h2>📋 Gestión de Órdenes</h2>
        <p className="muted">
          Los pedidos del catálogo entran como <em>Pendientes</em>. Al aprobar el pago se
          descuenta el stock definitivamente.
        </p>
      </div>

      <div className="kanban">
        {/* PENDIENTES */}
        <section className="kanban-col col-pending">
          <h3>🕒 Órdenes Pendientes <span className="count">{pendientes.length}</span></h3>
          {pendientes.length === 0 && <p className="muted">No hay pendientes</p>}
          {pendientes.map((o) => (
            <article key={o.code} className="order-card">
              <header>
                <strong>{o.code}</strong>
                <span className="badge-origen">{o.origen}</span>
              </header>
              <div className="order-cliente">{o.cliente}</div>
              <ul className="order-items">
                {o.items.map((it, i) => (
                  <li key={i}>
                    {it.cantidad} {it.unit} · {it.nombre}
                  </li>
                ))}
              </ul>
              <div className="order-foot">
                <span className="order-total">${o.total.toLocaleString('es-AR')}</span>
                <button className="btn-approve" onClick={() => handleAprobar(o)}>
                  ✓ Aprobar Pago
                </button>
              </div>
            </article>
          ))}
        </section>

        {/* COMPLETADAS */}
        <section className="kanban-col col-done">
          <h3>✅ Órdenes Completadas <span className="count">{completadas.length}</span></h3>
          {completadas.length === 0 && <p className="muted">Aún no hay órdenes aprobadas</p>}
          {completadas.map((o) => (
            <article key={o.code} className="order-card done">
              <header>
                <strong>{o.code}</strong>
                <span className="badge-origen">{o.origen}</span>
              </header>
              <div className="order-cliente">{o.cliente}</div>
              <div className="order-ref">Ref. bancaria: <strong>{o.ref}</strong></div>
              <div className="order-foot">
                <span className="order-total">${o.total.toLocaleString('es-AR')}</span>
                <span className="tag-ok">Stock descontado</span>
              </div>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}

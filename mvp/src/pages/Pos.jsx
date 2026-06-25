import { useState } from 'react';
import { useStore } from '../store/useStore.js';
import { useUI } from '../store/useUI.js';
import { CATEGORIAS } from '../data/products.js';

// PILAR 2 — Vista del Cajero: POS táctil.
// Botones grandes, navegación por categorías visuales, un toque agrega al carrito.
export default function Pos() {
  const productos = useStore((s) => s.productos);
  const carrito = useStore((s) => s.carrito);
  const agregar = useStore((s) => s.agregarAlCarrito);
  const cambiarCantidad = useStore((s) => s.cambiarCantidad);
  const vaciar = useStore((s) => s.vaciarCarrito);
  const cobrar = useStore((s) => s.cobrarEnMostrador);
  const total = useStore((s) => s.totalCarrito());
  const toast = useUI((s) => s.toast);

  const [cat, setCat] = useState('Tornillería');
  const visibles = productos.filter((p) => p.activo !== false && p.categoria === cat);

  function finalizar() {
    const orden = cobrar();
    if (orden) toast('success', `Venta ${orden.code} cobrada · stock actualizado`);
  }

  return (
    <div className="pos-layout">
      <div className="pos-main">
        {/* Categorías visuales (botones grandes) */}
        <div className="cat-bar">
          {CATEGORIAS.map((c) => (
            <button
              key={c.nombre}
              className={`cat-btn ${cat === c.nombre ? 'active' : ''}`}
              style={{ '--cat-color': c.color }}
              onClick={() => setCat(c.nombre)}
            >
              <span className="cat-emoji">{c.emoji}</span>
              {c.nombre}
            </button>
          ))}
        </div>

        {/* Grilla de productos */}
        <div className="prod-grid">
          {visibles.map((p) => {
            const bajo = p.stock_actual < p.stock_critico;
            return (
              <div key={p.id} className="prod-card">
                <div className="prod-top">
                  <span className="prod-emoji">{p.emoji}</span>
                  {bajo && <span className="chip-alert">⚠ Stock bajo</span>}
                </div>
                <div className="prod-nombre">{p.nombre}</div>
                <div className="prod-meta">
                  {p.medida} · {p.material}
                </div>
                <div className="prod-stock">Stock: {p.stock_actual}</div>
                <div className="unit-row">
                  {p.unidades.map((u) => (
                    <button
                      key={u.unit}
                      className="unit-btn"
                      onClick={() => agregar(p, u)}
                    >
                      <span>{u.unit}</span>
                      <strong>${u.precio}</strong>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Ticket lateral */}
      <aside className="ticket">
        <h3>🧾 Venta actual</h3>
        {carrito.length === 0 && <p className="muted">Tocá un producto para agregarlo</p>}
        <ul className="ticket-list">
          {carrito.map((l) => (
            <li key={l.key}>
              <div className="ticket-info">
                <span className="ticket-name">{l.nombre}</span>
                <small>{l.unit} · ${l.precio}</small>
              </div>
              <div className="qty">
                <button onClick={() => cambiarCantidad(l.key, -1)}>−</button>
                <span>{l.cantidad}</span>
                <button onClick={() => cambiarCantidad(l.key, +1)}>+</button>
              </div>
              <strong className="ticket-line">${l.precio * l.cantidad}</strong>
            </li>
          ))}
        </ul>
        <div className="ticket-total">
          <span>Total</span>
          <span>${total.toLocaleString('es-AR')}</span>
        </div>
        <button className="btn-cobrar" disabled={!carrito.length} onClick={finalizar}>
          💵 Cobrar en efectivo
        </button>
        {carrito.length > 0 && (
          <button className="btn-link" onClick={vaciar}>
            Vaciar
          </button>
        )}
      </aside>
    </div>
  );
}

import { useState } from 'react';
import { useStore } from '../store/useStore.js';
import { CATEGORIAS } from '../data/products.js';

// PILAR 3 — Vista del Cliente: catálogo + checkout por WhatsApp.
// Número de la ferretería (demo). Cambiar por el real en producción.
const WHATSAPP_FERRETERIA = '5491122334455';

function armarMensaje(orden) {
  const lineas = orden.items
    .map((l) => `• ${l.cantidad} ${l.unit} ${l.nombre} — $${l.precio * l.cantidad}`)
    .join('\n');
  const msg =
    `🧾 *Pedido ${orden.code}*\n` +
    `Cliente: ${orden.cliente}\n\n` +
    `${lineas}\n\n` +
    `*TOTAL: $${orden.total.toLocaleString('es-AR')}*\n\n` +
    `Quiero pagar por transferencia. Por favor envíenme los datos bancarios; ` +
    `adjunto el comprobante para validar el pedido. ¡Gracias!`;
  return encodeURIComponent(msg);
}

export default function Catalog() {
  const productos = useStore((s) => s.productos);
  const carrito = useStore((s) => s.carrito);
  const agregar = useStore((s) => s.agregarAlCarrito);
  const cambiarCantidad = useStore((s) => s.cambiarCantidad);
  const total = useStore((s) => s.totalCarrito());
  const crearOrden = useStore((s) => s.crearOrdenPendiente);

  const [filtro, setFiltro] = useState('Todas');
  const [cliente, setCliente] = useState('');
  const [enviado, setEnviado] = useState(null);

  const visibles = productos.filter((p) => filtro === 'Todas' || p.categoria === filtro);

  function confirmarPorWhatsapp() {
    if (carrito.length === 0) return;
    const orden = crearOrden(cliente.trim() || 'Consumidor Final', 'WhatsApp');
    const url = `https://wa.me/${WHATSAPP_FERRETERIA}?text=${armarMensaje(orden)}`;
    window.open(url, '_blank'); // simula apertura de WhatsApp
    setEnviado(orden.code);
    setCliente('');
  }

  return (
    <div className="catalog-layout">
      <div className="catalog-main">
        <div className="store-hero">
          <h2>🛒 Ferretería El Tornillo — Catálogo Online</h2>
          <p>Armá tu pedido y confirmalo por WhatsApp. Te pasamos los datos para transferir.</p>
        </div>

        <div className="filtros">
          <button
            className={filtro === 'Todas' ? 'active' : ''}
            onClick={() => setFiltro('Todas')}
          >
            Todas
          </button>
          {CATEGORIAS.map((c) => (
            <button
              key={c.nombre}
              className={filtro === c.nombre ? 'active' : ''}
              onClick={() => setFiltro(c.nombre)}
            >
              {c.emoji} {c.nombre}
            </button>
          ))}
        </div>

        <div className="store-grid">
          {visibles.map((p) => (
            <div key={p.id} className="store-card">
              <div className="store-emoji">{p.emoji}</div>
              <div className="store-nombre">{p.nombre}</div>
              <div className="store-meta">
                {p.categoria} · {p.medida} · {p.material}
              </div>
              <div className="store-units">
                {p.unidades.map((u) => (
                  <button key={u.unit} className="store-add" onClick={() => agregar(p, u)}>
                    + {u.unit} <strong>${u.precio}</strong>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <aside className="cart">
        <h3>Tu pedido</h3>
        {carrito.length === 0 && <p className="muted">Tu carrito está vacío</p>}
        <ul className="cart-list">
          {carrito.map((l) => (
            <li key={l.key}>
              <div className="cart-info">
                <span>{l.nombre}</span>
                <small>{l.unit}</small>
              </div>
              <div className="qty">
                <button onClick={() => cambiarCantidad(l.key, -1)}>−</button>
                <span>{l.cantidad}</span>
                <button onClick={() => cambiarCantidad(l.key, +1)}>+</button>
              </div>
              <strong>${l.precio * l.cantidad}</strong>
            </li>
          ))}
        </ul>

        <input
          className="cliente-input"
          placeholder="Tu nombre (opcional)"
          value={cliente}
          onChange={(e) => setCliente(e.target.value)}
        />

        <div className="cart-total">
          <span>Total</span>
          <span>${total.toLocaleString('es-AR')}</span>
        </div>

        <button
          className="btn-whatsapp"
          disabled={!carrito.length}
          onClick={confirmarPorWhatsapp}
        >
          <span className="wa-icon">🟢</span> Confirmar pedido por WhatsApp
        </button>

        {enviado && (
          <div className="ok-banner">
            ✅ Pedido <strong>{enviado}</strong> generado en estado <em>Pendiente</em>.
            <br />
            Ya aparece en el Kanban del cajero.
          </div>
        )}
      </aside>
    </div>
  );
}

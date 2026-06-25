import { useState } from 'react';
import { useStore } from '../store/useStore.js';
import { useUI } from '../store/useUI.js';
import { CATEGORIAS } from '../data/products.js';
import ProductFormModal from '../components/ProductFormModal.jsx';

// /admin — Panel de control de la ferretería.
// KPIs en vivo + gestión de inventario (ABM): editar stock, stock crítico,
// precio base y activar/desactivar productos (impacta el catálogo y el POS).
export default function Admin() {
  const productos = useStore((s) => s.productos);
  const actualizar = useStore((s) => s.actualizarProducto);
  const reponer = useStore((s) => s.reponerStock);
  const m = useStore((s) => s.metricas());
  const toast = useUI((s) => s.toast);

  const [q, setQ] = useState('');
  const [cat, setCat] = useState('Todas');
  const [nuevoOpen, setNuevoOpen] = useState(false);

  const visibles = productos.filter(
    (p) =>
      (cat === 'Todas' || p.categoria === cat) &&
      (!q ||
        p.nombre.toLowerCase().includes(q.toLowerCase()) ||
        p.sku.toLowerCase().includes(q.toLowerCase())),
  );

  const money = (n) => `$${Math.round(n).toLocaleString('es-AR')}`;

  const KPIS = [
    { label: 'Productos activos', value: m.totalProductos, icon: '📦', tone: 'primary' },
    { label: 'Valor de inventario', value: money(m.valorInventario), icon: '💰', tone: 'primary' },
    { label: 'Ingresos cobrados', value: money(m.ingresos), icon: '📈', tone: 'green' },
    { label: 'Órdenes pendientes', value: m.pendientes, icon: '🕒', tone: 'amber' },
    { label: 'Órdenes completadas', value: m.completadas, icon: '✅', tone: 'green' },
    { label: 'Artículos a comprar', value: m.aComprar, icon: '⚠️', tone: m.aComprar ? 'red' : 'muted' },
  ];

  return (
    <div className="admin">
      <div className="admin-head">
        <h2>📊 Panel de administración</h2>
        <p className="muted">Métricas en vivo y gestión de inventario de tu ferretería.</p>
      </div>

      {/* KPIs */}
      <div className="kpi-grid">
        {KPIS.map((k) => (
          <div key={k.label} className={`kpi-card kpi-${k.tone}`}>
            <span className="kpi-icon">{k.icon}</span>
            <div className="kpi-body">
              <span className="kpi-value">{k.value}</span>
              <span className="kpi-label">{k.label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Inventario */}
      <div className="admin-inv">
        <div className="admin-inv-head">
          <h3>Inventario · {visibles.length} productos</h3>
          <div className="admin-filters">
            <input
              className="admin-search"
              placeholder="Buscar producto o SKU…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select className="admin-select" value={cat} onChange={(e) => setCat(e.target.value)}>
              <option>Todas</option>
              {CATEGORIAS.map((c) => (
                <option key={c.nombre}>{c.nombre}</option>
              ))}
            </select>
            <button className="btn-new" onClick={() => setNuevoOpen(true)}>➕ Nuevo producto</button>
          </div>
        </div>

        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Categoría</th>
                <th className="num">Stock</th>
                <th className="num">Crítico</th>
                <th className="num">Precio base</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((p) => {
                const bajo = p.activo !== false && p.stock_actual < p.stock_critico;
                const inactivo = p.activo === false;
                return (
                  <tr key={p.id} className={`${bajo ? 'row-low' : ''} ${inactivo ? 'row-off' : ''}`}>
                    <td>
                      <div className="cell-prod">
                        <span className="cell-emoji">{p.emoji}</span>
                        <div>
                          <div className="cell-name">{p.nombre}</div>
                          <div className="cell-meta">{p.sku} · {p.medida} · {p.material}</div>
                        </div>
                      </div>
                    </td>
                    <td>{p.categoria}</td>
                    <td className="num">
                      <input
                        type="number"
                        className={`cell-input ${bajo ? 'danger' : ''}`}
                        value={p.stock_actual}
                        onChange={(e) => actualizar(p.id, { stock_actual: Number(e.target.value) })}
                      />
                    </td>
                    <td className="num">
                      <input
                        type="number"
                        className="cell-input"
                        value={p.stock_critico}
                        onChange={(e) => actualizar(p.id, { stock_critico: Number(e.target.value) })}
                      />
                    </td>
                    <td className="num">
                      <input
                        type="number"
                        className="cell-input price"
                        value={p.unidades[0]?.precio ?? 0}
                        onChange={(e) => actualizar(p.id, { precioBase: Number(e.target.value) })}
                      />
                    </td>
                    <td>
                      <button
                        className={`toggle ${inactivo ? 'off' : 'on'}`}
                        onClick={() => {
                          actualizar(p.id, { activo: inactivo });
                          toast(inactivo ? 'success' : 'info', `${p.nombre} ${inactivo ? 'activado' : 'pausado'}`);
                        }}
                      >
                        <span className="toggle-dot" />
                        {inactivo ? 'Inactivo' : 'Activo'}
                      </button>
                    </td>
                    <td>
                      {bajo && (
                        <button
                          className="btn-restock"
                          onClick={() => {
                            reponer(p.id);
                            toast('success', `Stock de ${p.nombre} repuesto`);
                          }}
                        >
                          Reponer
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <ProductFormModal open={nuevoOpen} onClose={() => setNuevoOpen(false)} />
    </div>
  );
}

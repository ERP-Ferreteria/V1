import { NavLink, Outlet } from 'react-router-dom';
import { useStore } from '../store/useStore.js';
import BrandMark from '../components/BrandMark.jsx';
import StockAlert from '../components/StockAlert.jsx';

// Layout BACK-OFFICE (/admin) — oculto al cliente. Unifica Dashboard, Cajero,
// Órdenes y Personalización en una sola área protegida por URL.
export default function AdminLayout() {
  const pendientes = useStore((s) => s.ordenes.filter((o) => o.status === 'PENDIENTE').length);
  const conectado = useStore((s) => s.conectado);

  const link = ({ isActive }) => (isActive ? 'active' : '');

  return (
    <div className="app">
      <header className="topbar admin-topbar">
        <div className="brand">
          <BrandMark size={24} />
          <span className="admin-tag">Panel</span>
          <span className={`conn-pill ${conectado ? 'on' : 'demo'}`}>
            {conectado ? 'Conectado' : 'Demo'}
          </span>
        </div>
        <nav className="mainnav">
          <NavLink to="/admin" end className={link}>📊 Dashboard</NavLink>
          <NavLink to="/admin/pos" className={link}>🧾 Cajero</NavLink>
          <NavLink to="/admin/kanban" className={link}>
            📋 Órdenes
            {pendientes > 0 && <span className="nav-badge alert">{pendientes}</span>}
          </NavLink>
          <NavLink to="/admin/personalizar" className={link}>⚙️ Personalización</NavLink>
          <NavLink to="/catalogo" className="view-store">🛒 Ver tienda</NavLink>
        </nav>
      </header>

      <StockAlert />

      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}

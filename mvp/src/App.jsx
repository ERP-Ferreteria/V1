import { NavLink, Route, Routes, Navigate } from 'react-router-dom';
import { useStore } from './store/useStore.js';
import StockAlert from './components/StockAlert.jsx';
import Catalog from './pages/Catalog.jsx';
import Pos from './pages/Pos.jsx';
import Kanban from './pages/Kanban.jsx';

// PILAR 5 — Router + layout. Las 3 vistas comparten el mismo estado global.
export default function App() {
  const pendientes = useStore((s) => s.ordenes.filter((o) => o.status === 'PENDIENTE').length);
  const enCarrito = useStore((s) => s.carrito.reduce((n, l) => n + l.cantidad, 0));

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">🛠️ Ferremax</div>
        <nav className="mainnav">
          <NavLink to="/catalogo" className={({ isActive }) => (isActive ? 'active' : '')}>
            🛒 Cliente (Catálogo)
            {enCarrito > 0 && <span className="nav-badge">{enCarrito}</span>}
          </NavLink>
          <NavLink to="/pos" className={({ isActive }) => (isActive ? 'active' : '')}>
            🧾 Cajero (POS)
          </NavLink>
          <NavLink to="/kanban" className={({ isActive }) => (isActive ? 'active' : '')}>
            📋 Dashboard Kanban
            {pendientes > 0 && <span className="nav-badge alert">{pendientes}</span>}
          </NavLink>
        </nav>
      </header>

      <StockAlert />

      <main className="content">
        <Routes>
          <Route path="/" element={<Navigate to="/catalogo" replace />} />
          <Route path="/catalogo" element={<Catalog />} />
          <Route path="/pos" element={<Pos />} />
          <Route path="/kanban" element={<Kanban />} />
        </Routes>
      </main>
    </div>
  );
}

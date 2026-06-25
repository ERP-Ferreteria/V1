import { useEffect } from 'react';
import { NavLink, Route, Routes, Navigate } from 'react-router-dom';
import { useStore } from './store/useStore.js';
import { useSettings, applyBranding } from './store/useSettings.js';
import StockAlert from './components/StockAlert.jsx';
import Toaster from './components/Toaster.jsx';
import PromptModal from './components/PromptModal.jsx';
import BrandMark from './components/BrandMark.jsx';
import Catalog from './pages/Catalog.jsx';
import Pos from './pages/Pos.jsx';
import Kanban from './pages/Kanban.jsx';
import Admin from './pages/Admin.jsx';
import Settings from './pages/Settings.jsx';

// PILAR 5 — Router + layout. Las 3 vistas comparten el mismo estado global.
// La marca (nombre/logo/colores) viene del store White-Label persistido.
export default function App() {
  const pendientes = useStore((s) => s.ordenes.filter((o) => o.status === 'PENDIENTE').length);
  const enCarrito = useStore((s) => s.carrito.reduce((n, l) => n + l.cantidad, 0));
  const primaryColor = useSettings((s) => s.primaryColor);
  const accentColor = useSettings((s) => s.accentColor);

  // Inyectar el theme de marca al montar y ante cambios de color.
  useEffect(() => {
    applyBranding({ primaryColor, accentColor });
  }, [primaryColor, accentColor]);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand"><BrandMark size={26} /></div>
        <nav className="mainnav">
          <NavLink to="/catalogo" className={({ isActive }) => (isActive ? 'active' : '')}>
            🛒 Cliente (Catálogo)
            {enCarrito > 0 && <span className="nav-badge">{enCarrito}</span>}
          </NavLink>
          <NavLink to="/pos" className={({ isActive }) => (isActive ? 'active' : '')}>
            🧾 Cajero (POS)
          </NavLink>
          <NavLink to="/kanban" className={({ isActive }) => (isActive ? 'active' : '')}>
            📋 Kanban
            {pendientes > 0 && <span className="nav-badge alert">{pendientes}</span>}
          </NavLink>
          <NavLink to="/admin" className={({ isActive }) => (isActive ? 'active' : '')}>
            📊 Admin
          </NavLink>
          <NavLink to="/configuracion" className={({ isActive }) => (isActive ? 'active' : '')}>
            ⚙️ Personalizar
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
          <Route path="/admin" element={<Admin />} />
          <Route path="/configuracion" element={<Settings />} />
        </Routes>
      </main>

      <Toaster />
      <PromptModal />
    </div>
  );
}

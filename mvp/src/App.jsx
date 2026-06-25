import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useStore } from './store/useStore.js';
import { useSettings, applyBranding } from './store/useSettings.js';
import Toaster from './components/Toaster.jsx';
import PromptModal from './components/PromptModal.jsx';
import PublicLayout from './layouts/PublicLayout.jsx';
import AdminLayout from './layouts/AdminLayout.jsx';
import Catalog from './pages/Catalog.jsx';
import Pos from './pages/Pos.jsx';
import Kanban from './pages/Kanban.jsx';
import Admin from './pages/Admin.jsx';
import Settings from './pages/Settings.jsx';

// Dos áreas separadas:
//  · Público  → /catalogo (lo que ve el cliente)
//  · Back-office → /admin/* (oculto: Dashboard, Cajero, Órdenes, Personalización)
export default function App() {
  const primaryColor = useSettings((s) => s.primaryColor);
  const accentColor = useSettings((s) => s.accentColor);
  const cargarDesdeBackend = useStore((s) => s.cargarDesdeBackend);

  useEffect(() => {
    applyBranding({ primaryColor, accentColor });
  }, [primaryColor, accentColor]);

  useEffect(() => {
    cargarDesdeBackend();
  }, [cargarDesdeBackend]);

  return (
    <>
      <Routes>
        <Route path="/" element={<Navigate to="/catalogo" replace />} />

        {/* Público */}
        <Route element={<PublicLayout />}>
          <Route path="/catalogo" element={<Catalog />} />
        </Route>

        {/* Back-office (oculto al cliente, accesible por URL /admin) */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Admin />} />
          <Route path="pos" element={<Pos />} />
          <Route path="kanban" element={<Kanban />} />
          <Route path="personalizar" element={<Settings />} />
        </Route>

        <Route path="*" element={<Navigate to="/catalogo" replace />} />
      </Routes>

      <Toaster />
      <PromptModal />
    </>
  );
}

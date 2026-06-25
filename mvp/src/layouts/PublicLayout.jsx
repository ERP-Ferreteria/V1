import { Outlet } from 'react-router-dom';
import BrandMark from '../components/BrandMark.jsx';
import { useSettings } from '../store/useSettings.js';

// Layout PÚBLICO — lo que ve el cliente. Solo la tienda; sin herramientas internas.
export default function PublicLayout() {
  const whatsappPhone = useSettings((s) => s.whatsappPhone);

  return (
    <div className="app">
      <header className="topbar public-topbar">
        <div className="brand"><BrandMark size={30} /></div>
        {whatsappPhone && (
          <a className="store-contact" href={`https://wa.me/${whatsappPhone}`} target="_blank" rel="noreferrer">
            🟢 Escribinos por WhatsApp
          </a>
        )}
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}

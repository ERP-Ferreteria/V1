import { useState } from 'react';
import { useStore } from '../store/useStore.js';

// Alerta visual "Artículos a Comprar" (pilar 1): productos con stock_actual < stock_critico.
export default function StockAlert() {
  const faltantes = useStore((s) => s.articulosACOmprar());
  const [abierto, setAbierto] = useState(false);

  if (faltantes.length === 0) return null;

  return (
    <div className="stock-alert">
      <button className="stock-alert-bar" onClick={() => setAbierto((v) => !v)}>
        ⚠️ <strong>{faltantes.length} artículos a comprar</strong> — stock bajo el mínimo
        <span className="caret">{abierto ? '▲' : '▼'}</span>
      </button>
      {abierto && (
        <ul className="stock-alert-list">
          {faltantes.map((p) => (
            <li key={p.id}>
              <span>
                {p.emoji} {p.nombre} <small>({p.medida} · {p.material})</small>
              </span>
              <span className="stock-nums">
                <span className="now">{p.stock_actual}</span> / mín {p.stock_critico}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

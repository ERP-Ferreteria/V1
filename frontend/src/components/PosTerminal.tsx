import { useEffect, useState } from 'react';
import {
  db,
  CachedProduct,
  CartLine,
  PendingSale,
  recordLocalSale,
  newClientId,
} from '../db/localDb';

/**
 * Fase 3.2 — POS táctil offline.
 * Interfaz de mostrador: botones grandes, lectura rápida por categoría/medida.
 * Funciona sin internet: lee el catálogo de IndexedDB y guarda las ventas
 * localmente; el Service Worker las sincroniza cuando vuelve la red.
 */
export default function PosTerminal() {
  const [products, setProducts] = useState<CachedProduct[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [online, setOnline] = useState(navigator.onLine);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    db.products.toArray().then(setProducts);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const visible = products.filter(
    (p) =>
      !filter ||
      p.name.toLowerCase().includes(filter.toLowerCase()) ||
      p.sku.toLowerCase().includes(filter.toLowerCase()),
  );

  function addToCart(p: CachedProduct, unitId: string) {
    const unit = p.units.find((u) => u.id === unitId)!;
    setCart((prev) => {
      const existing = prev.find((l) => l.productUnitId === unitId);
      if (existing) {
        return prev.map((l) =>
          l.productUnitId === unitId ? { ...l, quantity: l.quantity + 1 } : l,
        );
      }
      return [
        ...prev,
        {
          productUnitId: unitId,
          productId: p.id,
          name: p.name,
          unit: unit.unit,
          quantity: 1,
          unitPrice: unit.price,
        },
      ];
    });
  }

  const total = cart.reduce((s, l) => s + l.quantity * l.unitPrice, 0);

  /** Cobra en efectivo en el mostrador: guarda la venta offline. */
  async function charge() {
    if (cart.length === 0) return;
    const sale: PendingSale = {
      clientId: newClientId(),
      code: `POS-${Date.now().toString(36).toUpperCase()}`,
      clientUpdatedAt: new Date().toISOString(),
      total,
      items: cart.map((l) => ({ productUnitId: l.productUnitId, quantity: l.quantity })),
      bankReference: 'EFECTIVO_OFFLINE',
      syncStatus: 'PENDIENTE',
    };
    await recordLocalSale(sale);

    // Pedir sincronización en background (si el navegador la soporta).
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      const reg = await navigator.serviceWorker.ready;
      await (reg as any).sync.register('sync-sales');
    }

    setCart([]);
    setProducts(await db.products.toArray()); // refrescar stock local
  }

  return (
    <div className="pos">
      <header className="pos-header">
        <h1>Mostrador</h1>
        <span className={online ? 'badge online' : 'badge offline'}>
          {online ? '● En línea' : '● Offline — ventas guardadas localmente'}
        </span>
      </header>

      <input
        className="pos-search"
        placeholder="Buscar producto o SKU…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />

      <div className="pos-grid">
        {visible.map((p) => (
          <div key={p.id} className="pos-card">
            <div className="pos-card-title">{p.name}</div>
            <div className="pos-card-meta">
              {p.categoria} · {p.medida} · {p.material}
            </div>
            <div className="pos-card-stock">Stock: {p.stockQty}</div>
            <div className="pos-card-units">
              {p.units.map((u) => (
                <button key={u.id} className="unit-btn" onClick={() => addToCart(p, u.id)}>
                  {u.unit}
                  <small>${u.price}</small>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <footer className="pos-footer">
        <div className="pos-cart-summary">
          {cart.length} líneas · <strong>${total.toFixed(2)}</strong>
        </div>
        <button className="btn-charge" disabled={cart.length === 0} onClick={charge}>
          Cobrar
        </button>
      </footer>
    </div>
  );
}

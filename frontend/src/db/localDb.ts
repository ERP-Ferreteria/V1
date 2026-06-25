import Dexie, { Table } from 'dexie';

/**
 * Fase 3.2 — Base local del POS (IndexedDB vía Dexie).
 * Edge computing: el mostrador opera 100% local. El catálogo se cachea y las
 * ventas se guardan en `pendingSales` hasta que el Service Worker las sincroniza.
 */

export interface CachedProduct {
  id: string;
  sku: string;
  name: string;
  categoria: string;
  medida: string;
  material: string;
  stockQty: number;
  units: { id: string; unit: string; factor: number; price: number; barcode?: string }[];
}

export interface CartLine {
  productUnitId: string;
  productId: string;
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
}

export interface PendingSale {
  clientId: string;        // UUID idempotente generado en el dispositivo
  code: string;            // POS-xxxx local
  clientUpdatedAt: string; // timestamp local → base del Last-Write-Wins
  total: number;
  items: { productUnitId: string; quantity: number }[];
  bankReference?: string;  // "EFECTIVO_OFFLINE" para ventas de mostrador
  syncStatus: 'PENDIENTE' | 'CONFIRMADO' | 'REQUIERE_REVISION' | 'ERROR';
  serverId?: string;
}

class FerremaxDB extends Dexie {
  products!: Table<CachedProduct, string>;
  pendingSales!: Table<PendingSale, string>;

  constructor() {
    super('ferremax-pos');
    this.version(1).stores({
      products: 'id, sku, categoria, medida',
      pendingSales: 'clientId, syncStatus, clientUpdatedAt',
    });
  }
}

export const db = new FerremaxDB();

/** Refresca el catálogo local desde el árbol del backend (cuando hay red). */
export async function cacheCatalog(products: CachedProduct[]) {
  await db.products.bulkPut(products);
}

/** Guarda una venta offline y descuenta stock localmente (optimista). */
export async function recordLocalSale(sale: PendingSale) {
  await db.transaction('rw', db.products, db.pendingSales, async () => {
    for (const item of sale.items) {
      const product = await db.products
        .filter((p) => p.units.some((u) => u.id === item.productUnitId))
        .first();
      if (product) {
        const unit = product.units.find((u) => u.id === item.productUnitId)!;
        product.stockQty -= unit.factor * item.quantity;
        await db.products.put(product);
      }
    }
    await db.pendingSales.put(sale);
  });
}

export function newClientId(): string {
  return crypto.randomUUID();
}

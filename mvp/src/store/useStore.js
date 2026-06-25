import { create } from 'zustand';
import { PRODUCTS } from '../data/products.js';
import { isConnected, isLoggedIn, inventory as apiInv, orders as apiOrders, flattenCatalog } from '../api/api.js';

// PILAR 5 — Estado global.
// Modo demo: todo en memoria. Modo cloud (VITE_API_URL + login): hidrata desde
// el backend multi-tenant y las altas/órdenes impactan la API real.

let orderSeq = 1;
const nextCode = () => `ORD-${String(orderSeq++).padStart(4, '0')}`;

// API order (en) → forma del MVP (es), para mostrar en el Kanban.
const mapApiOrder = (o) => ({
  code: o.code,
  status: o.status === 'COMPLETADA' ? 'COMPLETADA' : 'PENDIENTE',
  cliente: o.customerName ?? 'Consumidor Final',
  origen: o.source === 'POS_OFFLINE' ? 'POS' : 'WhatsApp',
  ref: o.bankReference ?? null,
  total: Number(o.total),
  items: (o.items ?? []).map((it) => ({
    cantidad: it.quantity, unit: it.productUnit?.unit, nombre: it.product?.name,
    precio: Number(it.unitPrice ?? 0), productId: it.productId, factor: 1,
  })),
});

export const useStore = create((set, get) => ({
  productos: PRODUCTS,
  carrito: [], // [{ key, productId, nombre, unit, factor, precio, cantidad }]
  ordenes: [], // [{ code, status, items, total, cliente, origen, ref, creada }]
  conectado: false, // true cuando los datos vienen del backend real

  // Hidrata catálogo + órdenes desde el backend (modo cloud). No-op en demo.
  cargarDesdeBackend: async () => {
    if (!isConnected() || !isLoggedIn()) return false;
    try {
      const [tree, ord] = await Promise.all([apiInv.tree(), apiOrders.list()]);
      set({ productos: flattenCatalog(tree), ordenes: ord.map(mapApiOrder), conectado: true });
      return true;
    } catch (e) {
      console.warn('No se pudo hidratar desde el backend:', e.message);
      return false;
    }
  },

  // ── Carrito (compartido por POS y Catálogo) ──
  agregarAlCarrito: (producto, unidad) =>
    set((state) => {
      const key = `${producto.id}__${unidad.unit}`;
      const existente = state.carrito.find((l) => l.key === key);
      if (existente) {
        return {
          carrito: state.carrito.map((l) =>
            l.key === key ? { ...l, cantidad: l.cantidad + 1 } : l,
          ),
        };
      }
      return {
        carrito: [
          ...state.carrito,
          {
            key,
            productId: producto.id,
            nombre: producto.nombre,
            unit: unidad.unit,
            factor: unidad.factor,
            precio: unidad.precio,
            cantidad: 1,
          },
        ],
      };
    }),

  cambiarCantidad: (key, delta) =>
    set((state) => ({
      carrito: state.carrito
        .map((l) => (l.key === key ? { ...l, cantidad: l.cantidad + delta } : l))
        .filter((l) => l.cantidad > 0),
    })),

  quitarDelCarrito: (key) =>
    set((state) => ({ carrito: state.carrito.filter((l) => l.key !== key) })),

  vaciarCarrito: () => set({ carrito: [] }),

  totalCarrito: () =>
    get().carrito.reduce((s, l) => s + l.precio * l.cantidad, 0),

  // ── PILAR 3: checkout cliente → crea orden PENDIENTE ──
  crearOrdenPendiente: (cliente, origen = 'WhatsApp') => {
    const { carrito } = get();
    if (carrito.length === 0) return null;
    const orden = {
      code: nextCode(),
      status: 'PENDIENTE',
      cliente: cliente || 'Consumidor Final',
      origen,
      ref: null,
      items: carrito.map((l) => ({ ...l })),
      total: carrito.reduce((s, l) => s + l.precio * l.cantidad, 0),
      creada: new Date().toISOString(),
    };
    set((state) => ({ ordenes: [orden, ...state.ordenes], carrito: [] }));
    return orden;
  },

  // ── PILAR 4: aprobar pago → mueve a COMPLETADA y descuenta stock global ──
  aprobarPago: (code, ref) =>
    set((state) => {
      const orden = state.ordenes.find((o) => o.code === code);
      if (!orden || orden.status !== 'PENDIENTE') return {};

      // Descontar definitivamente del stock (cantidad * factor de la unidad).
      const productos = state.productos.map((p) => {
        const consumido = orden.items
          .filter((it) => it.productId === p.id)
          .reduce((s, it) => s + it.cantidad * it.factor, 0);
        return consumido ? { ...p, stock_actual: p.stock_actual - consumido } : p;
      });

      const ordenes = state.ordenes.map((o) =>
        o.code === code
          ? { ...o, status: 'COMPLETADA', ref: ref || 'S/REF', aprobada: new Date().toISOString() }
          : o,
      );
      return { productos, ordenes };
    }),

  // Venta directa de mostrador (POS): cobra y completa en un paso.
  cobrarEnMostrador: () => {
    const orden = get().crearOrdenPendiente('Mostrador', 'POS');
    if (orden) get().aprobarPago(orden.code, 'EFECTIVO');
    return orden;
  },

  // Reporte "Artículos a Comprar": stock_actual < stock_critico (solo activos).
  articulosACOmprar: () =>
    get().productos.filter((p) => p.activo !== false && p.stock_actual < p.stock_critico),

  // ── ADMIN: gestión de inventario (ABM) ──
  // Edita stock, stock crítico, precio base o estado activo de un producto.
  actualizarProducto: (id, patch) =>
    set((state) => ({
      productos: state.productos.map((p) => {
        if (p.id !== id) return p;
        const next = { ...p };
        if ('stock_actual' in patch) next.stock_actual = Math.max(0, Math.round(patch.stock_actual) || 0);
        if ('stock_critico' in patch) next.stock_critico = Math.max(0, Math.round(patch.stock_critico) || 0);
        if ('activo' in patch) next.activo = patch.activo;
        if ('precioBase' in patch) {
          const precio = Math.max(0, Number(patch.precioBase) || 0);
          next.unidades = p.unidades.map((u, i) => (i === 0 ? { ...u, precio } : u));
        }
        return next;
      }),
    })),

  // Alta de producto. En cloud lo crea en la API y re-hidrata; en demo lo
  // agrega al estado local. Devuelve { ok, error? }.
  agregarProducto: async (data) => {
    const nuevo = {
      id: `local-${Date.now()}`,
      sku: data.sku, nombre: data.nombre, emoji: data.emoji || '📦',
      categoria: data.categoria, medida: data.medida, material: data.material,
      stock_actual: Math.max(0, Math.round(data.stock_actual) || 0),
      stock_critico: Math.max(0, Math.round(data.stock_critico) || 0),
      activo: true,
      unidades: data.unidades.filter((u) => u.unit && u.precio > 0),
    };
    if (nuevo.unidades.length === 0) return { ok: false, error: 'Agregá al menos una unidad con precio' };

    if (get().conectado) {
      try {
        await apiInv.createProduct(nuevo);
        await get().cargarDesdeBackend();
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    }
    set((state) => ({ productos: [nuevo, ...state.productos] }));
    return { ok: true };
  },

  // Reponer stock al nivel sugerido (lead time): deja stock = 2x crítico.
  reponerStock: (id) =>
    set((state) => ({
      productos: state.productos.map((p) =>
        p.id === id ? { ...p, stock_actual: Math.max(p.stock_actual, p.stock_critico * 2) } : p,
      ),
    })),

  // KPIs del panel de administración.
  metricas: () => {
    const { productos, ordenes } = get();
    const activos = productos.filter((p) => p.activo !== false);
    const valorInventario = activos.reduce(
      (s, p) => s + p.stock_actual * (p.unidades[0]?.precio ?? 0),
      0,
    );
    const completadas = ordenes.filter((o) => o.status === 'COMPLETADA');
    return {
      totalProductos: activos.length,
      valorInventario,
      pendientes: ordenes.filter((o) => o.status === 'PENDIENTE').length,
      completadas: completadas.length,
      ingresos: completadas.reduce((s, o) => s + o.total, 0),
      aComprar: activos.filter((p) => p.stock_actual < p.stock_critico).length,
    };
  },
}));

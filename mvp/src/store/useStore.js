import { create } from 'zustand';
import { PRODUCTS } from '../data/products.js';

// PILAR 5 — Estado global en memoria.
// Catálogo, carrito y órdenes viven aquí: un pedido hecho en la Vista Cliente
// aparece al instante en el Kanban del cajero, y aprobar el pago descuenta el
// stock global que ve el POS. Sin backend: todo es estado React.

let orderSeq = 1;
const nextCode = () => `ORD-${String(orderSeq++).padStart(4, '0')}`;

export const useStore = create((set, get) => ({
  productos: PRODUCTS,
  carrito: [], // [{ key, productId, nombre, unit, factor, precio, cantidad }]
  ordenes: [], // [{ code, status, items, total, cliente, origen, ref, creada }]

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

  // Reporte "Artículos a Comprar": stock_actual < stock_critico.
  articulosACOmprar: () =>
    get().productos.filter((p) => p.stock_actual < p.stock_critico),
}));

// PILAR 1 — Mock Data de Ferretería (estado inicial)
// Jerarquía funcional estricta de 3 niveles:
//   categoria (Funcional) → medida → material (Material/Acabado)
// Cada producto tiene varias unidades de venta y campos stock_actual / stock_critico.
// Los productos marcados con (*) tienen stock_actual < stock_critico → disparan
// la alerta visual "Artículos a Comprar".

export const PRODUCTS = [
  // ───────────── TORNILLERÍA ─────────────
  {
    id: 'p01', sku: 'TOR-14-GAL', nombre: 'Tornillo Hexagonal',
    categoria: 'Tornillería', medida: '1/4 pulgada', material: 'Galvanizado',
    emoji: '🔩', stock_actual: 480, stock_critico: 200,
    unidades: [
      { unit: 'Unidad', factor: 1, precio: 12 },
      { unit: 'Caja x100', factor: 100, precio: 1050 },
    ],
  },
  {
    id: 'p02', sku: 'TOR-38-INOX', nombre: 'Tornillo Autorroscante',
    categoria: 'Tornillería', medida: '3/8 pulgada', material: 'Acero Inoxidable',
    emoji: '🔩', stock_actual: 90, stock_critico: 150, // (*) bajo crítico
    unidades: [
      { unit: 'Unidad', factor: 1, precio: 25 },
      { unit: 'Caja x50', factor: 50, precio: 1100 },
    ],
  },
  {
    id: 'p03', sku: 'TUE-14-GAL', nombre: 'Tuerca Hexagonal',
    categoria: 'Tornillería', medida: '1/4 pulgada', material: 'Galvanizado',
    emoji: '⚙️', stock_actual: 620, stock_critico: 250,
    unidades: [
      { unit: 'Unidad', factor: 1, precio: 8 },
      { unit: 'Caja x100', factor: 100, precio: 700 },
    ],
  },
  {
    id: 'p04', sku: 'ARA-516-ZIN', nombre: 'Arandela Plana',
    categoria: 'Tornillería', medida: '5/16 pulgada', material: 'Zincado',
    emoji: '⭕', stock_actual: 340, stock_critico: 200,
    unidades: [
      { unit: 'Unidad', factor: 1, precio: 5 },
      { unit: 'Bolsa x200', factor: 200, precio: 850 },
    ],
  },

  // ───────────── PLOMERÍA ─────────────
  {
    id: 'p05', sku: 'CAN-12-PVC', nombre: 'Caño Roscado',
    categoria: 'Plomería', medida: '1/2 pulgada', material: 'PVC',
    emoji: '🚿', stock_actual: 75, stock_critico: 40,
    unidades: [
      { unit: 'Metro', factor: 1, precio: 320 },
      { unit: 'Tira x6m', factor: 6, precio: 1750 },
    ],
  },
  {
    id: 'p06', sku: 'COD-12-PVC', nombre: 'Codo 90°',
    categoria: 'Plomería', medida: '1/2 pulgada', material: 'PVC',
    emoji: '🔧', stock_actual: 18, stock_critico: 30, // (*) bajo crítico
    unidades: [
      { unit: 'Unidad', factor: 1, precio: 145 },
      { unit: 'Pack x10', factor: 10, precio: 1300 },
    ],
  },
  {
    id: 'p07', sku: 'TEF-19-BLA', nombre: 'Cinta Teflón',
    categoria: 'Plomería', medida: '19 mm', material: 'Blanca',
    emoji: '🧵', stock_actual: 210, stock_critico: 80,
    unidades: [
      { unit: 'Rollo', factor: 1, precio: 95 },
      { unit: 'Caja x12', factor: 12, precio: 1020 },
    ],
  },
  {
    id: 'p08', sku: 'LLA-34-BRO', nombre: 'Llave de Paso',
    categoria: 'Plomería', medida: '3/4 pulgada', material: 'Bronce',
    emoji: '🚰', stock_actual: 44, stock_critico: 20,
    unidades: [{ unit: 'Unidad', factor: 1, precio: 2850 }],
  },
  {
    id: 'p09', sku: 'PEG-100-PVC', nombre: 'Adhesivo para PVC',
    categoria: 'Plomería', medida: '100 ml', material: 'Solvente',
    emoji: '🧴', stock_actual: 60, stock_critico: 25,
    unidades: [
      { unit: 'Litro', factor: 1, precio: 4200 },
      { unit: 'Unidad 100ml', factor: 0.1, precio: 520 },
    ],
  },

  // ───────────── ELECTRICIDAD ─────────────
  {
    id: 'p10', sku: 'CAB-25-COB', nombre: 'Cable Unipolar',
    categoria: 'Electricidad', medida: '2.5 mm²', material: 'Cobre',
    emoji: '🔌', stock_actual: 850, stock_critico: 300,
    unidades: [
      { unit: 'Metro', factor: 1, precio: 280 },
      { unit: 'Rollo x100m', factor: 100, precio: 26500 },
    ],
  },
  {
    id: 'p11', sku: 'LLT-20-PVC', nombre: 'Llave Térmica 2P',
    categoria: 'Electricidad', medida: '20 A', material: 'PVC',
    emoji: '⚡', stock_actual: 12, stock_critico: 25, // (*) bajo crítico
    unidades: [{ unit: 'Unidad', factor: 1, precio: 5400 }],
  },
  {
    id: 'p12', sku: 'TOM-10-BLA', nombre: 'Tomacorriente Doble',
    categoria: 'Electricidad', medida: '10 A', material: 'Blanco',
    emoji: '🔲', stock_actual: 95, stock_critico: 40,
    unidades: [
      { unit: 'Unidad', factor: 1, precio: 1250 },
      { unit: 'Caja x10', factor: 10, precio: 11500 },
    ],
  },
  {
    id: 'p13', sku: 'CIN-19-NEG', nombre: 'Cinta Aisladora',
    categoria: 'Electricidad', medida: '19 mm', material: 'Negra',
    emoji: '🎞️', stock_actual: 180, stock_critico: 60,
    unidades: [
      { unit: 'Rollo', factor: 1, precio: 380 },
      { unit: 'Caja x10', factor: 10, precio: 3400 },
    ],
  },
  {
    id: 'p14', sku: 'LAM-9-LED', nombre: 'Lámpara LED',
    categoria: 'Electricidad', medida: '9 W', material: 'Luz Cálida',
    emoji: '💡', stock_actual: 130, stock_critico: 50,
    unidades: [
      { unit: 'Unidad', factor: 1, precio: 1480 },
      { unit: 'Pack x4', factor: 4, precio: 5500 },
    ],
  },

  // ───────────── PINTURERÍA ─────────────
  {
    id: 'p15', sku: 'PIN-4L-LAT', nombre: 'Látex Interior Blanco',
    categoria: 'Pinturería', medida: '4 litros', material: 'Látex',
    emoji: '🪣', stock_actual: 38, stock_critico: 15,
    unidades: [
      { unit: 'Litro', factor: 1, precio: 3100 },
      { unit: 'Balde x4L', factor: 4, precio: 11800 },
    ],
  },
  {
    id: 'p16', sku: 'ROD-22-LAN', nombre: 'Rodillo de Lana',
    categoria: 'Pinturería', medida: '22 cm', material: 'Lana Natural',
    emoji: '🖌️', stock_actual: 26, stock_critico: 12,
    unidades: [{ unit: 'Unidad', factor: 1, precio: 1650 }],
  },
  {
    id: 'p17', sku: 'PIN-1-PLA', nombre: 'Pincel Profesional',
    categoria: 'Pinturería', medida: '1 pulgada', material: 'Cerda Plana',
    emoji: '🖌️', stock_actual: 72, stock_critico: 30,
    unidades: [
      { unit: 'Unidad', factor: 1, precio: 540 },
      { unit: 'Set x3', factor: 3, precio: 1450 },
    ],
  },

  // ───────────── HERRAMIENTAS ─────────────
  {
    id: 'p18', sku: 'MAR-500-ACE', nombre: 'Martillo Carpintero',
    categoria: 'Herramientas', medida: '500 g', material: 'Acero / Madera',
    emoji: '🔨', stock_actual: 22, stock_critico: 10,
    unidades: [{ unit: 'Unidad', factor: 1, precio: 4600 }],
  },
  {
    id: 'p19', sku: 'DES-6-CRU', nombre: 'Destornillador Phillips',
    categoria: 'Herramientas', medida: '6 mm', material: 'Cromo Vanadio',
    emoji: '🪛', stock_actual: 58, stock_critico: 20,
    unidades: [
      { unit: 'Unidad', factor: 1, precio: 1280 },
      { unit: 'Set x6', factor: 6, precio: 6200 },
    ],
  },
  {
    id: 'p20', sku: 'GUA-9-NIT', nombre: 'Guantes de Trabajo',
    categoria: 'Herramientas', medida: 'Talle 9', material: 'Nitrilo',
    emoji: '🧤', stock_actual: 14, stock_critico: 35, // (*) bajo crítico
    unidades: [
      { unit: 'Par', factor: 1, precio: 720 },
      { unit: 'Pack x12', factor: 12, precio: 7600 },
    ],
  },
];

// Metadatos de categorías para los "botones grandes" del POS (pilar 2).
export const CATEGORIAS = [
  { nombre: 'Tornillería', emoji: '🔩', color: '#f59e0b' },
  { nombre: 'Plomería', emoji: '🚿', color: '#3b82f6' },
  { nombre: 'Electricidad', emoji: '⚡', color: '#eab308' },
  { nombre: 'Pinturería', emoji: '🪣', color: '#8b5cf6' },
  { nombre: 'Herramientas', emoji: '🔨', color: '#ef4444' },
];

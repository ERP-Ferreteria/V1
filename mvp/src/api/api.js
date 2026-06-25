// Cliente del backend real (apps/api).
// Modo demo:  sin VITE_API_URL → todo corre con estado local en memoria.
// Modo cloud: con VITE_API_URL → la app habla con la API multi-tenant.
// El token se guarda en localStorage y se refresca solo ante 401.

const BASE = import.meta.env.VITE_API_URL?.replace(/\/$/, '') ?? '';
const TKEY = 'ferremax-tokens';

export const isConnected = () => Boolean(BASE);

function getTokens() {
  try { return JSON.parse(localStorage.getItem(TKEY)) ?? {}; } catch { return {}; }
}
function setTokens(t) { localStorage.setItem(TKEY, JSON.stringify(t)); }
export function logout() { localStorage.removeItem(TKEY); }
export const isLoggedIn = () => Boolean(getTokens().accessToken);

// fetch con Authorization + auto-refresh.
async function authed(path, init = {}, retry = true) {
  const { accessToken, refreshToken } = getTokens();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}`, ...(init.headers ?? {}) },
  });
  if (res.status === 401 && retry && refreshToken) {
    const r = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken }),
    });
    if (r.ok) { setTokens({ ...getTokens(), ...(await r.json()) }); return authed(path, init, false); }
    logout();
  }
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`);
  return res.status === 204 ? null : res.json();
}

// ── Auth ──
export const auth = {
  async login(slug, email, password) {
    const res = await fetch(`${BASE}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug, email, password }),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Login falló');
    const data = await res.json();
    setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
    return data.user;
  },
  logout,
};

// ── Inventario ──
export const inventory = {
  tree: () => authed('/api/inventory/tree'),
  purchaseReport: () => authed('/api/inventory/purchase-report'),
  // Alta por nombres: el backend upsertea la jerarquía y crea el producto.
  createProduct: (p) =>
    authed('/api/inventory/products', { method: 'POST', body: JSON.stringify(toApiProduct(p)) }),
};

// ── Órdenes ──
export const orders = {
  list: (status) => authed(`/api/orders${status ? `?status=${status}` : ''}`),
  create: (items, extra = {}) =>
    authed('/api/orders', { method: 'POST', body: JSON.stringify({ items, ...extra }) }),
  approve: (id, bankReference) =>
    authed(`/api/orders/${id}/approve`, { method: 'POST', body: JSON.stringify({ bankReference }) }),
  reject: (id) => authed(`/api/orders/${id}/reject`, { method: 'POST' }),
};

// ── Branding (White-Label) ──
export const branding = {
  get: () => authed('/api/branding'),
  update: (data) => authed('/api/branding', { method: 'PUT', body: JSON.stringify(data) }),
  uploadLogo: (dataUrl) => authed('/api/branding/logo', { method: 'POST', body: JSON.stringify({ dataUrl }) }),
};

// ── Mapeos entre la forma del MVP (es) y la API (en) ──
const UNIT_ENUM = { unidad: 'UNIDAD', caja: 'CAJA', litro: 'LITRO', metro: 'METRO', docena: 'DOCENA', kilogramo: 'KILOGRAMO', rollo: 'ROLLO', bolsa: 'BOLSA', par: 'PAR', set: 'SET' };
const toEnumUnit = (label) => UNIT_ENUM[String(label).split(' ')[0].toLowerCase()] ?? 'UNIDAD';

function toApiProduct(p) {
  return {
    categoria: p.categoria, medida: p.medida, material: p.material,
    sku: p.sku, name: p.nombre, emoji: p.emoji,
    stockQty: p.stock_actual, criticalStock: p.stock_critico,
    units: (p.unidades ?? []).map((u) => ({ unit: toEnumUnit(u.unit), factor: u.factor, price: u.precio })),
  };
}

// Aplana el árbol de la API a la forma de producto del MVP.
export function flattenCatalog(tree) {
  const out = [];
  for (const cat of tree ?? [])
    for (const med of cat.measures ?? [])
      for (const mat of med.materialFinishes ?? [])
        for (const p of mat.products ?? [])
          out.push({
            id: p.id, sku: p.sku, nombre: p.name, emoji: p.emoji ?? '📦',
            categoria: cat.name, medida: med.value, material: mat.value,
            stock_actual: p.stockQty, stock_critico: p.criticalStock,
            activo: p.active !== false,
            unidades: (p.units ?? []).map((u) => ({ unit: u.unit, factor: Number(u.factor), precio: Number(u.price) })),
          });
  return out;
}

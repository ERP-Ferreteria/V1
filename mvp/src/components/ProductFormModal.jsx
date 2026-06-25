import { useState } from 'react';
import { useStore } from '../store/useStore.js';
import { useUI } from '../store/useUI.js';
import { CATEGORIAS } from '../data/products.js';

const UNIDADES = ['Unidad', 'Caja', 'Litro', 'Metro', 'Docena', 'Kilogramo', 'Rollo', 'Bolsa', 'Par', 'Set'];

const EMPTY = {
  nombre: '', sku: '', emoji: '📦',
  categoria: CATEGORIAS[0].nombre, medida: '', material: '',
  stock_actual: 0, stock_critico: 0,
  unidades: [{ unit: 'Unidad', factor: 1, precio: 0 }],
};

// Alta de producto (ABM). En modo cloud crea en la API; en demo, en memoria.
export default function ProductFormModal({ open, onClose }) {
  const agregar = useStore((s) => s.agregarProducto);
  const toast = useUI((s) => s.toast);
  const [f, setF] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const upd = (patch) => setF((prev) => ({ ...prev, ...patch }));
  const updUnit = (i, patch) =>
    setF((prev) => ({ ...prev, unidades: prev.unidades.map((u, j) => (j === i ? { ...u, ...patch } : u)) }));
  const addUnit = () => setF((prev) => ({ ...prev, unidades: [...prev.unidades, { unit: 'Caja', factor: 100, precio: 0 }] }));
  const removeUnit = (i) => setF((prev) => ({ ...prev, unidades: prev.unidades.filter((_, j) => j !== i) }));

  async function guardar() {
    if (!f.nombre.trim() || !f.sku.trim()) return toast('error', 'Completá nombre y SKU');
    if (!f.medida.trim() || !f.material.trim()) return toast('error', 'Completá medida y material');
    setSaving(true);
    const r = await agregar(f);
    setSaving(false);
    if (r.ok) {
      toast('success', `Producto "${f.nombre}" creado`);
      setF(EMPTY);
      onClose();
    } else {
      toast('error', r.error ?? 'No se pudo crear');
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <h3>➕ Nuevo producto</h3>

        <div className="form-grid">
          <label className="fld span2">Nombre
            <input value={f.nombre} onChange={(e) => upd({ nombre: e.target.value })} placeholder="Tornillo Hexagonal" />
          </label>
          <label className="fld">SKU
            <input value={f.sku} onChange={(e) => upd({ sku: e.target.value })} placeholder="TOR-14-GAL" />
          </label>
          <label className="fld">Emoji
            <input value={f.emoji} onChange={(e) => upd({ emoji: e.target.value })} maxLength={4} />
          </label>
          <label className="fld">Categoría
            <select value={f.categoria} onChange={(e) => upd({ categoria: e.target.value })}>
              {CATEGORIAS.map((c) => <option key={c.nombre}>{c.nombre}</option>)}
            </select>
          </label>
          <label className="fld">Medida
            <input value={f.medida} onChange={(e) => upd({ medida: e.target.value })} placeholder="1/4 pulgada" />
          </label>
          <label className="fld">Material / Acabado
            <input value={f.material} onChange={(e) => upd({ material: e.target.value })} placeholder="Galvanizado" />
          </label>
          <label className="fld">Stock actual
            <input type="number" value={f.stock_actual} onChange={(e) => upd({ stock_actual: Number(e.target.value) })} />
          </label>
          <label className="fld">Stock crítico
            <input type="number" value={f.stock_critico} onChange={(e) => upd({ stock_critico: Number(e.target.value) })} />
          </label>
        </div>

        <div className="units-editor">
          <div className="units-head"><span>Unidades de venta</span><button className="btn-mini" onClick={addUnit}>+ Unidad</button></div>
          {f.unidades.map((u, i) => (
            <div key={i} className="unit-line">
              <select value={u.unit} onChange={(e) => updUnit(i, { unit: e.target.value })}>
                {UNIDADES.map((x) => <option key={x}>{x}</option>)}
              </select>
              <input type="number" value={u.factor} onChange={(e) => updUnit(i, { factor: Number(e.target.value) })} title="Equivalencia a unidad base" placeholder="factor" />
              <input type="number" value={u.precio} onChange={(e) => updUnit(i, { precio: Number(e.target.value) })} placeholder="precio $" />
              {f.unidades.length > 1 && <button className="btn-x" onClick={() => removeUnit(i)}>✕</button>}
            </div>
          ))}
        </div>

        <div className="modal-actions">
          <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={guardar} disabled={saving}>{saving ? 'Guardando…' : 'Crear producto'}</button>
        </div>
      </div>
    </div>
  );
}

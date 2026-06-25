import { useSettings, applyBranding } from '../store/useSettings.js';

// Panel de personalización White-Label. Todo lo que se cambia acá impacta al
// instante en Catálogo, POS y Kanban (nombre, logo, colores, WhatsApp, banco).
export default function Settings() {
  const s = useSettings();

  function set(field) {
    return (e) => {
      const value = e.target.value;
      s.update({ [field]: value });
      if (field === 'primaryColor' || field === 'accentColor') {
        applyBranding({ ...s, [field]: value });
      }
    };
  }

  return (
    <div className="settings">
      <div className="settings-head">
        <h2>⚙️ Personalización de la tienda</h2>
        <p className="muted">
          Configuración White-Label. Los cambios se guardan en este navegador y se aplican
          al instante en todas las vistas.
        </p>
      </div>

      <div className="settings-grid">
        <section className="settings-card">
          <h3>Identidad</h3>
          <label>
            Nombre de la tienda
            <input value={s.storeName} onChange={set('storeName')} />
          </label>
          <label>
            Logo (emoji)
            <input value={s.logoEmoji} onChange={set('logoEmoji')} maxLength={4} />
          </label>
          <div className="color-row">
            <label>
              Color primario
              <input type="color" value={s.primaryColor} onChange={set('primaryColor')} />
            </label>
            <label>
              Color de acento
              <input type="color" value={s.accentColor} onChange={set('accentColor')} />
            </label>
          </div>
        </section>

        <section className="settings-card">
          <h3>Contacto y cobro</h3>
          <label>
            WhatsApp (formato internacional sin +)
            <input value={s.whatsappPhone} onChange={set('whatsappPhone')} placeholder="5491122334455" />
          </label>
          <label>
            Banco
            <input value={s.bankName} onChange={set('bankName')} />
          </label>
          <label>
            Cuenta / CBU / Alias
            <input value={s.bankAccount} onChange={set('bankAccount')} />
          </label>
          <label>
            Titular
            <input value={s.bankHolder} onChange={set('bankHolder')} />
          </label>
        </section>
      </div>

      <div className="settings-preview">
        <span>Vista previa:</span>
        <span className="preview-chip" style={{ background: s.primaryColor }}>{s.logoEmoji} {s.storeName}</span>
        <button className="btn-reset" onClick={() => { s.reset(); applyBranding({ primaryColor: '#2563eb', accentColor: '#22c55e' }); }}>
          Restaurar valores por defecto
        </button>
      </div>
    </div>
  );
}

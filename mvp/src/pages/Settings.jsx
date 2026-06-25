import { useSettings, applyBranding } from '../store/useSettings.js';
import { useUI } from '../store/useUI.js';

const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
const LOGO_MAX = 2 * 1024 * 1024; // 2 MB (igual que el backend)

// Panel de personalización White-Label. Todo lo que se cambia acá impacta al
// instante en Catálogo, POS y Kanban (logo, nombre, colores, WhatsApp, banco).
// El logo se sube como imagen — mismo flujo que POST /api/branding/logo del backend.
export default function Settings() {
  const s = useSettings();
  const toast = useUI((st) => st.toast);

  function set(field) {
    return (e) => {
      const value = e.target.value;
      s.update({ [field]: value });
      if (field === 'primaryColor' || field === 'accentColor') {
        applyBranding({ ...s, [field]: value });
      }
    };
  }

  function onLogo(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!LOGO_TYPES.includes(file.type)) return toast('error', 'Formato no válido (PNG, JPG, WEBP o SVG)');
    if (file.size > LOGO_MAX) return toast('error', 'La imagen supera 2 MB');
    const reader = new FileReader();
    reader.onload = () => {
      s.update({ logoUrl: String(reader.result) }); // en producción → POST /api/branding/logo
      toast('success', 'Logo actualizado');
    };
    reader.readAsDataURL(file);
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

          <div className="logo-field">
            <span className="logo-label">Logo de la ferretería</span>
            <div className="logo-uploader">
              <div className="logo-preview">
                {s.logoUrl ? <img src={s.logoUrl} alt="logo" /> : <span>{s.logoEmoji}</span>}
              </div>
              <div className="logo-actions">
                <label className="btn-upload">
                  {s.logoUrl ? 'Cambiar logo' : 'Subir logo'}
                  <input type="file" accept={LOGO_TYPES.join(',')} onChange={onLogo} hidden />
                </label>
                {s.logoUrl && (
                  <button className="btn-remove" onClick={() => s.update({ logoUrl: '' })}>Quitar</button>
                )}
                <small>PNG, JPG, WEBP o SVG · máx 2 MB</small>
              </div>
            </div>
          </div>

          <label>
            Emoji (si no subís logo)
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
        <span className="preview-chip" style={{ background: s.primaryColor }}>
          {s.logoUrl ? <img className="preview-logo" src={s.logoUrl} alt="" /> : <span>{s.logoEmoji}</span>}
          {s.storeName}
        </span>
        <button className="btn-reset" onClick={() => { s.reset(); applyBranding({ primaryColor: '#2563eb', accentColor: '#22c55e' }); }}>
          Restaurar valores por defecto
        </button>
      </div>
    </div>
  );
}

import { useUI } from '../store/useUI.js';

// Notificaciones flotantes (esquina inferior). Animadas, auto-descartables.
const ICONS = { success: '✓', error: '✕', info: 'ℹ' };

export default function Toaster() {
  const toasts = useUI((s) => s.toasts);
  const dismiss = useUI((s) => s.dismiss);

  return (
    <div className="toaster">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`} onClick={() => dismiss(t.id)}>
          <span className="toast-icon">{ICONS[t.type] ?? 'ℹ'}</span>
          <span className="toast-msg">{t.message}</span>
        </div>
      ))}
    </div>
  );
}

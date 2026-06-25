import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// White-Label: configuración de marca 100% editable y persistida en el navegador.
// Simula, sin backend, lo que en producción vendría de TenantBranding por tenant.
// Cambiar cualquier valor re-pinta toda la app (colores via CSS variables).

const DEFAULTS = {
  storeName: 'Ferretería El Tornillo',
  logoEmoji: '🛠️',
  primaryColor: '#2563eb', // botones, acentos primarios
  accentColor: '#22c55e', // confirmaciones, cobrar
  whatsappPhone: '5491122334455', // E.164 sin '+'
  bankName: 'Banco Nación',
  bankAccount: 'CBU 0110599520000012345678',
  bankHolder: 'Ferretería El Tornillo S.R.L.',
};

export const useSettings = create(
  persist(
    (set) => ({
      ...DEFAULTS,
      update: (patch) => set(patch),
      reset: () => set(DEFAULTS),
    }),
    { name: 'ferremax-branding' },
  ),
);

// Inyecta los colores de marca como CSS variables en :root.
// Se llama desde App al montar y ante cada cambio.
export function applyBranding({ primaryColor, accentColor }) {
  const root = document.documentElement;
  root.style.setProperty('--primary', primaryColor);
  root.style.setProperty('--green', accentColor);
}

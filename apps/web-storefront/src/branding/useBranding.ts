import { create } from 'zustand';

/**
 * Estado de branding White-Label (Zustand).
 * Resuelve el tenant por el host actual, trae su branding del storefront y lo
 * inyecta como CSS variables en :root. Con esto, la MISMA app React se pinta
 * con la identidad de cada comercio sin rebuild.
 */
export interface Branding {
  storeTitle: string;
  logoUrl?: string;
  faviconUrl?: string;
  primaryColor: string;
  accentColor: string;
  fontFamily: string;
  whatsappPhone?: string;
  bankName?: string;
  bankAccount?: string;
  bankHolder?: string;
}

interface BrandingState {
  branding: Branding | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  load: () => Promise<void>;
}

const API = import.meta.env.VITE_STOREFRONT_API ?? '/storefront';

export const useBranding = create<BrandingState>((set) => ({
  branding: null,
  status: 'idle',
  load: async () => {
    set({ status: 'loading' });
    try {
      // El backend resuelve el tenant por Host; el navegador ya envía el host correcto.
      const res = await fetch(`${API}/branding`);
      if (!res.ok) throw new Error('branding');
      const branding: Branding = await res.json();
      applyTheme(branding);
      set({ branding, status: 'ready' });
    } catch {
      set({ status: 'error' });
    }
  },
}));

/** Inyecta el theme en CSS variables y actualiza título/favicon. */
function applyTheme(b: Branding) {
  const root = document.documentElement;
  root.style.setProperty('--brand-primary', b.primaryColor);
  root.style.setProperty('--brand-accent', b.accentColor);
  root.style.setProperty('--brand-font', b.fontFamily);
  if (b.storeTitle) document.title = b.storeTitle;
  if (b.faviconUrl) {
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = b.faviconUrl;
  }
}

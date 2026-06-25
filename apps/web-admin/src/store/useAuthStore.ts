import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Sesión del panel admin (Zustand + persist).
 * Guarda tokens y refresca el access token de forma transparente. Los permisos
 * viajan en el access token y se exponen como `can()` para gating de UI por RBAC.
 */
interface SessionUser {
  id: string;
  name: string;
  role: string;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: SessionUser | null;
  permissions: string[];
  login: (slug: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  authFetch: (input: string, init?: RequestInit) => Promise<Response>;
  can: (permission: string) => boolean;
}

const API = import.meta.env.VITE_API_URL ?? '/auth';

function decodePerms(token: string): string[] {
  try {
    return JSON.parse(atob(token.split('.')[1])).permissions ?? [];
  } catch {
    return [];
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      permissions: [],

      login: async (slug, email, password) => {
        const res = await fetch(`${API}/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug, email, password }),
        });
        if (!res.ok) throw new Error((await res.json()).error ?? 'Login falló');
        const { accessToken, refreshToken, user } = await res.json();
        set({ accessToken, refreshToken, user, permissions: decodePerms(accessToken) });
      },

      logout: () => set({ accessToken: null, refreshToken: null, user: null, permissions: [] }),

      can: (permission) => {
        const p = get().permissions;
        return p.includes('*') || p.includes(permission);
      },

      // fetch con auto-refresh ante 401 (rotación de refresh token).
      authFetch: async (input, init = {}) => {
        const exec = (token: string | null) =>
          fetch(input, {
            ...init,
            headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` },
          });

        let res = await exec(get().accessToken);
        if (res.status !== 401) return res;

        const r = await fetch(`${API}/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: get().refreshToken }),
        });
        if (!r.ok) {
          get().logout();
          return res;
        }
        const { accessToken, refreshToken } = await r.json();
        set({ accessToken, refreshToken, permissions: decodePerms(accessToken) });
        return exec(accessToken);
      },
    }),
    { name: 'ferremax-admin-session' },
  ),
);

import { create } from 'zustand';

// Capa de UI: toasts y modal de input (reemplazan alert()/prompt() nativos
// por una experiencia pulida y consistente — base del look 2026).
export const useUI = create((set, get) => ({
  toasts: [],
  toast: (type, message) => {
    const id = Date.now() + Math.random();
    set((s) => ({ toasts: [...s.toasts, { id, type, message }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3400);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  // Modal de input promisificado: const ref = await ask({ title, label, ... })
  prompt: null,
  ask: ({ title, label, placeholder = '', confirmText = 'Confirmar' }) =>
    new Promise((resolve) =>
      set({ prompt: { title, label, placeholder, confirmText, resolve } }),
    ),
  closePrompt: (value) => {
    get().prompt?.resolve(value);
    set({ prompt: null });
  },
}));

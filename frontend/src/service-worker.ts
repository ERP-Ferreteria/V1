/// <reference lib="webworker" />
import { db } from './db/localDb';
import { syncPendingSales } from './sync/syncEngine';

/**
 * Fase 3.3 — Service Worker.
 * 1. Cachea el shell de la app para que el POS cargue sin internet.
 * 2. Escucha el Background Sync ('sync-sales'): cuando vuelve la conexión,
 *    sincroniza las ventas offline aplicando la reconciliación por timestamp.
 * 3. Reintenta periódicamente si el SyncManager no está disponible.
 */

declare const self: ServiceWorkerGlobalScope;

const CACHE = 'ferremax-shell-v1';
const SHELL = ['/', '/index.html', '/assets/index.js', '/assets/index.css'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

// Cache-first para el shell; network-first para las APIs.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.url.includes('/api/')) return; // las APIs no se cachean
  event.respondWith(caches.match(req).then((hit) => hit ?? fetch(req)));
});

// Background Sync: se dispara cuando el navegador recupera conectividad.
self.addEventListener('sync', (event: any) => {
  if (event.tag === 'sync-sales') {
    event.waitUntil(runSync());
  }
});

// Mensaje manual desde la app (fallback para navegadores sin SyncManager).
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SYNC_NOW') {
    event.waitUntil(runSync());
  }
});

async function runSync() {
  const token = await readToken();
  if (!token) return;
  try {
    const summary = await syncPendingSales(token);
    // Avisar a las pestañas abiertas para que refresquen el Kanban / stock.
    const clients = await self.clients.matchAll();
    clients.forEach((c) =>
      c.postMessage({ type: 'SYNC_DONE', summary }),
    );
  } catch (err) {
    // El Background Sync reintentará automáticamente al fallar.
    console.error('[SW] sync error', err);
    throw err;
  }
}

/** El token JWT se guarda en IndexedDB para que el SW lo lea sin la UI. */
async function readToken(): Promise<string | null> {
  try {
    const row = await (db as any).table('auth')?.get('jwt');
    return row?.value ?? null;
  } catch {
    return null;
  }
}

export {};

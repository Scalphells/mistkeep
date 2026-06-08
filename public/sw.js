/* Service worker — Mistkeep (PWA hors-ligne, sans dépendance).
 *
 * Stratégie :
 *   - navigation (HTML)  : network-first → fallback cache (app shell) ;
 *   - assets same-origin : stale-while-revalidate ;
 *   - tout le cross-origin (Supabase API / Storage / Realtime) : BYPASS total
 *     (jamais mis en cache — auth, RLS et temps réel doivent rester live).
 */

const CACHE = 'vaultmj-v2';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Laisser passer tout ce qui n'est pas notre origine (Supabase, CDN…).
  if (url.origin !== self.location.origin) return;

  // Navigation : réseau d'abord (sans cache HTTP, pour toujours obtenir le shell
  // à jour qui référence les assets hashés courants), repli sur le cache.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req.url, { cache: 'no-store' })
        .then((res) => {
          caches.open(CACHE).then((c) => c.put('/index.html', res.clone()));
          return res;
        })
        .catch(() => caches.match('/index.html').then((r) => r || caches.match('/')))
    );
    return;
  }

  // Assets statiques : stale-while-revalidate.
  e.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

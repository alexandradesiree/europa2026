/* EUROPA 2026 — service worker: la app funciona sin señal */
const CACHE = 'europa2026-v1';
const FILES = [
  './', './index.html', './styles.css', './data.js', './app.js',
  './manifest.json', './icon-192.png', './icon-512.png', './icon-180.png'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(r => {
      const copy = r.clone();
      caches.open(CACHE).then(c => { try { c.put(e.request, copy); } catch (_) {} });
      return r;
    }).catch(() => caches.match('./index.html')))
  );
});

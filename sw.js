/* EUROPA 2026 — service worker
   ESTRATEGIA: red primero, caché como respaldo.
   - Con señal: descarga siempre la última versión de GitHub y la guarda.
   - Sin señal: sirve al instante lo último que guardó.
   Así, editar data.js en GitHub sí llega al teléfono. */
const CACHE = 'europa2026';
const FILES = [
  './', './index.html', './styles.css', './data.js', './app.js',
  './manifest.json', './icon-192.png', './icon-512.png', './icon-180.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x))))
      .then(() => self.clients.claim())
  );
});

/* Descarga con límite de tiempo: si la red tarda más de 4 segundos
   (wifi de hotel, metro con una barra), no esperamos y servimos la caché. */
function fetchConLimite(req, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    fetch(req).then(r => { clearTimeout(t); resolve(r); },
                    e => { clearTimeout(t); reject(e); });
  });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;

  e.respondWith(
    fetchConLimite(req, 4000)
      .then(res => {
        if (res && res.ok) {
          const copia = res.clone();
          caches.open(CACHE).then(c => { try { c.put(req, copia); } catch (_) {} });
        }
        return res;
      })
      .catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
  );
});

/* Permite que el botón "Buscar versión nueva" vacíe la caché */
self.addEventListener('message', e => {
  if (e.data === 'limpiar') {
    caches.keys().then(k => Promise.all(k.map(x => caches.delete(x))))
      .then(() => e.source && e.source.postMessage('limpio'));
  }
});

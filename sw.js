/* ════════════════════════════════════════════════════════════
   MIRROR «El Origen» — Service Worker · NETWORK-FIRST
   Regla de Darío: los DEPLOYS NUEVOS SIEMPRE GANAN.
   - Online: siempre baja la versión fresca de la red y la guarda como respaldo.
   - Offline: recién ahí usa lo cacheado (para que la app abra sin internet).
   - skipWaiting + clients.claim: si quedó un SW viejo, este lo reemplaza YA,
     en la próxima carga (mata cualquier caché vieja que tape una versión nueva).
   - Solo cachea MISMO ORIGEN y solo GET. Nunca toca el proxy ni las APIs (POST).
   Subí este archivo como sw.js junto al index.html en cada deploy.
   ════════════════════════════════════════════════════════════ */
const CACHE = 'mirror-el-origen-v16';

self.addEventListener('install', (e) => {
  // El SW nuevo no espera a que se cierren las pestañas viejas.
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    // Borra TODAS las cachés que no sean la actual (purga versiones viejas).
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return; // POST (proxy/APIs) van directo a la red, sin tocar.

  let url;
  try { url = new URL(req.url); } catch (_) { return; }
  // Cross-origin (CDNs de librerías, fuentes, etc.): siempre a la red, no se cachea acá.
  if (url.origin !== self.location.origin) return;

  e.respondWith((async () => {
    try {
      // NETWORK-FIRST: primero la red (deploy nuevo gana), y de paso refresca el respaldo.
      const fresh = await fetch(req);
      try { const cache = await caches.open(CACHE); cache.put(req, fresh.clone()); } catch (_) {}
      return fresh;
    } catch (err) {
      // Sin internet: caemos al respaldo cacheado.
      const cached = await caches.match(req);
      if (cached) return cached;
      // Navegación offline sin caché del recurso exacto: servimos el index.
      if (req.mode === 'navigation') {
        const idx = await caches.match('./') || await caches.match('./index.html');
        if (idx) return idx;
      }
      throw err;
    }
  })());
});

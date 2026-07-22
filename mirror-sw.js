/* ══════════════════════════════════════════════════════════════════════════
   mirror-sw.js — Service Worker de MIRROR / plataforma "El Origen"  (Etapa 7, Ciclo 2)
   VA JUNTO AL index.html EN LA RAÍZ DEL DEPLOY, con este nombre exacto.
   Sirve tanto para el MIRROR personal (v4.1) como para la plataforma (v36):
   es idéntico para ambos, no lleva nada específico de una app.

   FILOSOFÍA (honestidad y soberanía por diseño):
   • RED-PRIMERO para la navegación: con conexión, SIEMPRE se baja la última
     versión publicada en la URL. El deploy nuevo gana solo al recargar; el cache
     es únicamente respaldo para abrir offline. JAMÁS se sirve una app vieja
     habiendo red.
   • El SW NO TOCA NADA que no sea el documento de navegación de MISMO ORIGEN.
     El proxy (piloto-mirror-api), Firebase y las CDNs viajan SIEMPRE por red
     viva, sin pasar por el cache: cero riesgo de respuestas viejas o de que la
     memoria/el motor queden servidos de una copia.
   • Sin este archivo al lado del index, la app funciona igual (instalable, solo
     sin respaldo offline): el registro está envuelto en catch en el index.
   ══════════════════════════════════════════════════════════════════════════ */

'use strict';

var CACHE = 'mirror-shell-v1';

/* Al instalar: tomamos el control cuanto antes. No precacheamos una lista fija
   (el shell es un único index que cambia entre versiones): se guarda al vuelo la
   primera navegación exitosa. Así el respaldo offline es SIEMPRE el último index
   que el usuario abrió con red, nunca uno congelado en el deploy. */
self.addEventListener('install', function (e) {
  self.skipWaiting();
});

/* Al activar: limpiamos caches viejos de versiones anteriores del SW y tomamos
   control de las pestañas abiertas. */
self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (claves) {
      return Promise.all(
        claves.map(function (k) { return k === CACHE ? null : caches.delete(k); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

/* fetch:
   - SOLO interceptamos navegaciones (mode 'navigate') de MISMO ORIGEN → el
     documento HTML (el shell). Todo lo demás (proxy, Firebase, CDNs, imágenes,
     otros orígenes) NO se toca: no llamamos respondWith y el navegador lo
     resuelve por red normal.
   - Para el documento: RED-PRIMERO. Si la red responde, se sirve eso y se
     actualiza el respaldo en cache. Si la red falla (offline), recién ahí se
     sirve la última copia cacheada. Si tampoco hay copia, error honesto. */
self.addEventListener('fetch', function (e) {
  var req = e.request;

  // Solo GET; nunca tocamos POST/PUT/PATCH (memoria, encuestas, motor).
  if (req.method !== 'GET') return;

  var esNavegacion =
    req.mode === 'navigate' ||
    (req.headers.get('accept') || '').indexOf('text/html') !== -1;

  if (!esNavegacion) return; // proxy/Firebase/CDN/estáticos: de largo, red viva.

  // Mismo origen únicamente: una navegación a otro dominio no es asunto nuestro.
  var mismoOrigen;
  try { mismoOrigen = new URL(req.url).origin === self.location.origin; }
  catch (_) { mismoOrigen = false; }
  if (!mismoOrigen) return;

  e.respondWith(
    fetch(req).then(function (res) {
      // Guardamos una copia como respaldo offline (solo si la respuesta es válida).
      if (res && res.ok) {
        var copia = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copia); }).catch(function () {});
      }
      return res;
    }).catch(function () {
      // Sin red: servimos el último shell cacheado, si existe.
      return caches.match(req).then(function (hit) {
        if (hit) return hit;
        return caches.match('index.html').then(function (idx) {
          if (idx) return idx;
          // Ni red ni cache: error honesto, sin pantalla rota.
          return new Response(
            '<!doctype html><meta charset="utf-8"><title>Sin conexión</title>' +
            '<body style="background:#050508;color:#e8e2d6;font:14px monospace;' +
            'display:flex;align-items:center;justify-content:center;height:100vh;' +
            'margin:0;text-align:center;padding:2rem;">' +
            '<div>◈ Sin conexión y sin copia guardada todavía.<br><br>' +
            'Ahora mismo no puedo pensar, pero lo tuyo está a salvo.<br>' +
            'Volvé a abrirme con red y quedo listo también para offline.</div></body>',
            { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 503 }
          );
        });
      });
    })
  );
});

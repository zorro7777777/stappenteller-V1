/* ═══════════════════════════════════════════════════════════════
   SERVICE WORKER  —  Cockpit Framework  v5.0
   Cache-First + stale-while-revalidate + GPS state relay

   NIEUW in v5.0:
     closedAt timestamp  — SW noteert wanneer de tab verborgen
                           wordt; stuurt dit mee bij LAST_FIX
                           zodat logic.js de slaapperiode kan
                           berekenen voor crow-flies re-sync.
   ═══════════════════════════════════════════════════════════════ */

const CACHE_NAME   = 'cockpit-v5';
const CACHE_ASSETS = [
  './', './index.html',
  './cockpit-master.css', './app.js', './logic.js',
  './manifest.json', './sw.js', './icon-192.png', './icon-512.png'
];

let _cachedGpsFix = null;   /* laatste bekende GPS-positie */
let _closedAt     = null;   /* tijdstip waarop tab verborgen werd */
const NOTIF_TAG   = 'cockpit-gps-active';

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(c=>c.addAll(CACHE_ASSETS)).then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  if (new URL(event.request.url).hostname.includes('nominatim.openstreetmap.org')) return;
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        fetch(event.request).then(nr=>{if(nr&&nr.status===200&&nr.type!=='opaque')caches.open(CACHE_NAME).then(c=>c.put(event.request,nr.clone()));}).catch(()=>{});
        return cached;
      }
      return fetch(event.request)
        .then(nr=>{if(!nr||nr.status!==200||nr.type==='opaque')return nr;caches.open(CACHE_NAME).then(c=>c.put(event.request,nr.clone()));return nr;})
        .catch(()=>caches.match('./index.html'));
    })
  );
});

self.addEventListener('message', async event => {
  const msg = event.data; if (!msg) return;

  switch (msg.type) {

    case 'GPS_FIX':
      /* Sla de fix op; reset closedAt want tab is actief */
      _cachedGpsFix = { lat:msg.lat, lng:msg.lng, accuracy:msg.accuracy, timestamp:msg.timestamp };
      _closedAt = null;
      break;

    case 'TAB_HIDDEN':
      /* app.js stuurt dit wanneer visibilityState 'hidden' wordt.
         We noteren het tijdstip zodat we bij LAST_FIX de slaap-
         duur kunnen meesturen.                                    */
      _closedAt = msg.timestamp || Date.now();
      console.log('[SW] Tab verborgen om', new Date(_closedAt).toLocaleTimeString('nl-BE'));
      break;

    case 'GET_LAST_FIX':
      if (_cachedGpsFix) {
        const client = await self.clients.get(event.source.id);
        if (client) {
          client.postMessage({
            type:     'LAST_FIX',
            ..._cachedGpsFix,
            closedAt: _closedAt  /* null als tab nooit verborgen was */
          });
          console.log('[SW] LAST_FIX gestuurd. ClosedAt:', _closedAt ? new Date(_closedAt).toLocaleTimeString('nl-BE') : 'n/a');
        }
      }
      break;

    case 'SHOW_SILENT_NOTIFICATION':
      try {
        await self.registration.showNotification('GPS Tracking actief', {
          body:              'Stappenteller loopt op de achtergrond.',
          icon:              './icon-192.png',
          badge:             './icon-192.png',
          tag:               NOTIF_TAG,
          silent:            true,
          renotify:          false,
          requireInteraction:true,
          actions:           [{ action:'open', title:'Open app' }]
        });
      } catch (e) { console.warn('[SW] Notificatie mislukt:', e.message); }
      break;

    case 'CLOSE_SILENT_NOTIFICATION':
      const notifs = await self.registration.getNotifications({ tag: NOTIF_TAG });
      notifs.forEach(n => n.close());
      break;
  }
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type:'window', includeUncontrolled:true }).then(clients => {
      const c = clients.find(x => x.url.includes(self.registration.scope));
      return c ? c.focus() : self.clients.openWindow('./index.html');
    })
  );
});

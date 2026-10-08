const CACHE = 'pikol-v74-system-audit';
const SHELL = [
  './venue-booking.css?v=72-hero-restore','./venue-ui.js?v=71','./venue-matrix.js?v=72-hero-restore','./venue-admin.js?v=71',
  './assets/promo-qr/official-website-master.png','./assets/promo-qr/official-website-qr-logo.png',
  './assets/promo-qr/booking-site-master.png','./assets/promo-qr/booking-site-qr-logo.png','./assets/promo-qr/tournament-registration-master.png','./assets/promo-qr/tournament-registration-qr-logo.png','./assets/promo-qr/open-play-registration-master.png','./assets/promo-qr/open-play-registration-qr-logo.png',
  './tournament-premium.js?v=74-system-audit','./tournament-command.js?v=67','./tournament-premium.css?v=67','./scoring-premium.css?v=67','./scoring-premium.js?v=74-system-audit',
  './range-availability.js?v=56-android-native-scroll','./client-upgrades.css?v=56-android-native-scroll',
  './index.html','./admin.html','./scoring.html','./styles.css','./cards.js','./tournament-view.js','./config.js','./qr-lite.js?v=67','./qr-decoder.js?v=67','./promo-qr.js?v=68-official-website','./promo-qr.css?v=67',
  './admin-premium.css?v=73-venue-admin','./admin-premium.css','./admin-charts.js','./admin-charts.js?v=28-admin-reference','./booking-premium.css?v=72-hero-restore','./booking-premium.css','./assets/booking/maps-pin.svg','./assets/booking/hero-court.jpg','./assets/booking/court-01.jpg','./assets/booking/court-02.jpg','./assets/booking/court-03.jpg',
  './assets/booking/community.jpg','./assets/booking/membership.jpg','./assets/defaults/venue-default.webp','./assets/defaults/court-default.webp',
  './manifest.json?v=73','./admin-manifest.json?v=73','./scoring-manifest.json?v=73','./icons/wenjelly-v73-192.png','./icons/wenjelly-v73-512.png','./icons/wenjelly-v73-maskable-192.png','./icons/wenjelly-v73-maskable-512.png','./icons/wenjelly-v73-apple.png'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(async cache => {
    await Promise.all(SHELL.map(async url => { try { await cache.add(url); } catch (_) {} }));
  }));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE && (k.startsWith('pikol-') || k.startsWith('pikol-admin-shell-'))).map(k => caches.delete(k)));
    // Take control silently. Do NOT navigate or reload open pages here.
    // The previous implementation navigated every client during activation while
    // index/admin also reloaded on controllerchange, creating a refresh loop on
    // some browsers/PWA sessions (especially the Admin site).
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  // API/private/realtime data must never be served from a PWA cache.
  if (event.request.headers.has('Authorization') || /\/(?:api|branding|socket\.io)(?:\/|$)/.test(url.pathname)) return;

  const scopePath = new URL(self.registration.scope).pathname;
  const page = ['index.html','admin.html','scoring.html'].find(name => url.pathname === scopePath + name) || (url.pathname === scopePath ? 'index.html' : null);
  const isHtml = !!page;
  if (isHtml) {
    // Network-first prevents an old admin/booking interface from appearing first.
    event.respondWith((async () => {
      try {
        const fresh = await fetch(event.request, { cache: 'no-store' });
        if (fresh && fresh.ok) {
          const cache = await caches.open(CACHE);
          // Cache the public HTML shell, without session/query parameters.
          await cache.put(new URL(page,self.registration.scope).href, fresh.clone()).catch(()=>{});
        }
        return fresh;
      } catch (_) {
        const hit = await caches.match(new URL(page,self.registration.scope).href);
        if (hit) return hit;
        if (/\/admin\.html$/i.test(url.pathname)) return (await caches.match('./admin.html')) || Response.error();
        if (/\/scoring\.html$/i.test(url.pathname)) return (await caches.match('./scoring.html')) || Response.error();
        return (await caches.match('./index.html')) || Response.error();
      }
    })());
    return;
  }

  // Cache only known public shell assets; never arbitrary authenticated resources.
  const allowed = new Set(SHELL.map(p=>new URL(p,self.registration.scope).href));
  if (!allowed.has(url.href)) return;
  // Static assets can paint quickly, then refresh in the background.
  event.respondWith((async () => {
    const hit = await caches.match(event.request);
    const network = fetch(event.request).then(async res => {
      if (res && res.ok) {
        const cache = await caches.open(CACHE);
        await cache.put(event.request, res.clone()).catch(()=>{});
      }
      return res;
    }).catch(() => null);
    if (hit) { event.waitUntil(network); return hit; }
    return (await network) || Response.error();
  })());
});
self.addEventListener('message', event => {
  if (!event.data) return;
  if (event.data.type === 'SKIP_WAITING') return self.skipWaiting();
  if (event.data.type === 'PIKOL_BADGE_SYNC') {
    const count = event.data.count;
    if (event.waitUntil) event.waitUntil(applyAppBadge(count));
    else applyAppBadge(count);
  }
});
async function applyAppBadge(count) {
  const n = Math.max(0, Number(count) || 0);
  try {
    /* WorkerNavigator is the standards path in service-worker context. Keep the
       registration fallback for older engines that exposed the early API there. */
    if (n > 0) {
      if (self.navigator && 'setAppBadge' in self.navigator) await self.navigator.setAppBadge(n);
      else if ('setAppBadge' in self.registration) await self.registration.setAppBadge(n);
    } else {
      if (self.navigator && 'clearAppBadge' in self.navigator) await self.navigator.clearAppBadge();
      else if ('clearAppBadge' in self.registration) await self.registration.clearAppBadge();
    }
  } catch (_) {}
}
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; }
  catch (_) { data = { body: event.data ? event.data.text() : 'New PIKOL alert' }; }
  event.waitUntil((async () => {
    if (Object.prototype.hasOwnProperty.call(data, 'badgeCount')) {
      await applyAppBadge(data.badgeCount);
      try {
        const openClients = await self.clients.matchAll({ type:'window', includeUncontrolled:true });
        openClients.forEach(client => { try { client.postMessage({type:'PIKOL_BADGE_SYNC',count:Math.max(0,Number(data.badgeCount)||0)}); } catch (_) {} });
      } catch (_) {}
    }
    /* Badge-only sync is used after an alert is reviewed on another device.
       It intentionally does not create a second visible notification.
       On Android/Chromium, clearing visible PIKOL notifications when the
       unread count reaches zero also lets the launcher clear its native dot. */
    if (data.badgeOnly) {
      if (Math.max(0, Number(data.badgeCount) || 0) === 0 && self.registration.getNotifications) {
        try {
          const notes = await self.registration.getNotifications();
          notes.forEach(note => {
            const tag = String(note && note.tag || '');
            if (!tag || tag.startsWith('pikol-')) note.close();
          });
        } catch (_) {}
      }
      return;
    }
    const options = {
      body: data.body || 'A new item needs your attention.',
      icon: './icons/wenjelly-v73-192.png', badge: './icons/wenjelly-v73-192.png',
      tag: data.tag || 'pikol-alert', renotify: true,
      data: { url: data.url || './admin.html', type: data.type || 'alert', alertId: data.alertId || null }
    };
    await self.registration.showNotification(data.title || 'PIKOL Alert', options);
  })());
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || './admin.html', self.registration.scope).href;
  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type:'window', includeUncontrolled:true });
    for (const client of windows) {
      try { if (new URL(client.url).origin === new URL(target).origin) { if ('navigate' in client) await client.navigate(target); return client.focus(); } } catch (_) {}
    }
    return clients.openWindow ? clients.openWindow(target) : null;
  })());
});


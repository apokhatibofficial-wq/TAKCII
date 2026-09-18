/* TAK-C.TAXI service worker — cache-first shell, network-first data, instant silent updates */
const VERSION = 'takc-v2';
const SHELL = ['./', './manifest.webmanifest'];

self.addEventListener('install', (e) => {
  self.skipWaiting(); // new code takes over without the user reinstalling
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL).catch(() => {})));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)));
    await self.clients.claim();
    const cs = await self.clients.matchAll({ type: 'window' });
    cs.forEach((c) => c.postMessage({ type: 'SW_UPDATED', version: VERSION }));
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const isTile = /tile\.openstreetmap|basemaps|tiles?\./.test(url.host);
  if (isTile) {
    // stale-while-revalidate: map keeps working on a weak network
    e.respondWith(caches.open(VERSION + '-tiles').then(async (c) => {
      const hit = await c.match(req);
      const net = fetch(req)
        .then(async (r) => {
          // cache.put() rejects for a handful of real response shapes (206
          // Partial Content is the common one) — that rejection was never
          // awaited or caught here, so it surfaced as an unhandled promise
          // rejection inside the service worker on any such request. Awaiting
          // it behind its own .catch() means a failed cache write can never
          // do anything but fail to cache; it can't take the response down.
          await c.put(req, r.clone()).catch(() => {});
          return r;
        })
        .catch(() => hit);
      return hit || net;
    }));
    return;
  }
  e.respondWith((async () => {
    try {
      const net = await fetch(req);
      const c = await caches.open(VERSION);
      await c.put(req, net.clone()).catch(() => {});
      return net;
    } catch (err) {
      const hit = await caches.match(req);
      return hit || new Response('offline', { status: 503 });
    }
  })());
});

self.addEventListener('push', (e) => {
  let data = {};
  try {
    data = e.data ? e.data.json() : {};
  } catch {
    data = {};
  }
  e.waitUntil(
    self.registration.showNotification(data.title || 'TAK-C.TAXI', {
      body: data.body || '',
      icon: './icon-192.png',
      badge: './icon-192.png',
      dir: 'rtl',
      data: { rideId: data.rideId }
    })
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((cs) => {
      const existing = cs[0];
      if (existing) return existing.focus();
      return self.clients.openWindow('./');
    })
  );
});

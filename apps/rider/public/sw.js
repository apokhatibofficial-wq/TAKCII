/* TAK-C.TAXI service worker — cache-first shell, network-first data, instant silent updates */
const VERSION = 'takc-v1';
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
      const net = fetch(req).then((r) => { c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  e.respondWith((async () => {
    try {
      const net = await fetch(req);
      const c = await caches.open(VERSION);
      c.put(req, net.clone());
      return net;
    } catch (err) {
      const hit = await caches.match(req);
      return hit || new Response('offline', { status: 503 });
    }
  })());
});

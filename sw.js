const CACHE_NAME = 'flashcard-pwa-v2';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-512-maskable.png',
  '/icons/apple-touch-icon.png'
];

// Install - cache core assets
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

// Activate - clean old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

// Fetch strategy:
// - For CDN (xlsx, unsplash): stale-while-revalidate
// - For own assets: cache-first, fallback to network
// - For navigation: network-first, fallback to cache
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);

  // Only handle GET
  if (req.method !== 'GET') return;

  // Navigation requests (SPA)
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(req, copy));
        return res;
      }).catch(() => caches.match('/index.html').then(r => r || caches.match('/')))
    );
    return;
  }

  // CDN / cross-origin -> stale-while-revalidate
  if (url.origin !== location.origin) {
    e.respondWith(
      caches.match(req).then(cached => {
        const fetchPromise = fetch(req).then(netRes => {
          if (netRes.ok) {
            const clone = netRes.clone();
            caches.open(CACHE_NAME).then(c => c.put(req, clone));
          }
          return netRes;
        }).catch(()=> cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Same-origin assets
  e.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(netRes => {
        if (netRes.ok && netRes.type === 'basic') {
          const clone = netRes.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, clone));
        }
        return netRes;
      });
    })
  );
});

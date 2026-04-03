const CACHE = 'space-rpg-v1';

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then(cache =>
      cache.addAll(['/', '/game', '/manifest.json'])
        .catch(() => {}) // non-fatal if some assets fail
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then(cached => {
      // Network first for navigation, cache fallback for assets
      if (e.request.mode === 'navigate') {
        return fetch(e.request)
          .then(res => {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
            return res;
          })
          .catch(() => cached || caches.match('/'));
      }
      return cached || fetch(e.request).then(res => {
        if (res.ok && e.request.url.includes('/assets/')) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      });
    })
  );
});

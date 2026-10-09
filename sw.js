const CACHE_NAME = 'athletics-intel-v5.2-20261009';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './js/app.js',
  './js/rankings.js',
  './js/analytics.js',
  './js/qualification.js',
  './js/venues.js',
  './js/training_plan.js',
  './data/ranking_latest.json',
  './data/rankings_archive.json',
  './data/athletes_database.json',
  './data/competitions_database.json',
  './data/calendar_2027.json',
  './data/luka_history.json',
  './data/venues_database.json',
  './data/training_logs_full.json'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker v5.2] Pre-caching static assets');
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('[ServiceWorker] Cache addAll warning:', err);
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[ServiceWorker] Purging legacy cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING' || (event.data && event.data.action === 'SKIP_WAITING')) {
    self.skipWaiting();
  }
  if (event.data === 'CLEAR_ALL_CACHES' || (event.data && event.data.action === 'CLEAR_ALL_CACHES')) {
    caches.keys().then((keys) => {
      return Promise.all(keys.map(k => caches.delete(k)));
    }).then(() => {
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ success: true });
      }
    });
  }
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // If request contains cache-busting params, bypass service worker cache
  if (url.searchParams.has('nocache') || url.searchParams.has('_t') || url.searchParams.has('t') || url.searchParams.has('v')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // 1. Navigation requests (HTML pages): NETWORK FIRST
  // Always fetch fresh HTML from the server to guarantee instant app updates on Mac/iOS
  if (event.request.mode === 'navigate' || url.pathname.endsWith('index.html') || url.pathname.endsWith('/')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then(cached => cached || caches.match('./index.html')))
    );
    return;
  }

  // 2. Dynamic JSON data (/data/): NETWORK FIRST with Cache Fallback
  if (url.pathname.includes('/data/')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // 3. Static scripts & assets (/js/, /icons/, etc.): NETWORK FIRST with Cache Fallback
  // Ensures that code updates are immediately delivered on launch
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});

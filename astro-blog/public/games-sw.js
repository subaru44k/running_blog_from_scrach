const CACHE_VERSION = 'games-offline-v3';
const OFFLINE_ROUTES = [
  '/games/',
  '/games/janken/',
  '/games/clock/',
  '/games/reversi/',
  '/games/snake/',
  '/games/maze/',
  '/games/tic-tac-toe/',
  '/favicon.svg',
  '/logo-mark.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(OFFLINE_ROUTES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

function isGameNavigation(request, requestUrl) {
  return request.mode === 'navigate' && requestUrl.origin === self.location.origin && requestUrl.pathname.startsWith('/games/');
}

function isGameAsset(request, requestUrl) {
  if (request.method !== 'GET' || requestUrl.origin !== self.location.origin) return false;
  return (
    requestUrl.pathname.startsWith('/_astro/') ||
    requestUrl.pathname.startsWith('/images/') ||
    requestUrl.pathname === '/favicon.svg' ||
    requestUrl.pathname === '/logo-mark.svg' ||
    requestUrl.pathname.endsWith('.css') ||
    requestUrl.pathname.endsWith('.js') ||
    requestUrl.pathname.endsWith('.woff2')
  );
}

self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  if (isGameNavigation(event.request, requestUrl)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request)
          .then((response) => {
            if (response.ok) {
              const responseClone = response.clone();
              caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, responseClone));
            }
            return response;
          })
          .catch(() => caches.match('/games/'));
      })
    );
    return;
  }

  if (isGameAsset(event.request, requestUrl)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, responseClone));
          }
          return response;
        });
      })
    );
  }
});

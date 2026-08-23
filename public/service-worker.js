// Версию поднимаем при изменениях воркера: на activate все остальные кеши
// удаляются, что вычищает у пользователей устаревший index.html.
const CACHE_NAME = 'autopro-v3';
const APP_SHELL = [
  '/',
  '/index.html',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // allSettled so one failed CDN fetch doesn't abort install of the rest
      Promise.allSettled(APP_SHELL.map((url) => cache.add(url)))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') {
    // Mutations always go straight to the network — offline write handling
    // lives in the app's IndexedDB mutation queue, not the service worker.
    return;
  }

  const url = new URL(request.url);
  const isApi = url.pathname.startsWith('/api/');

  if (request.mode === 'navigate') {
    // SPA navigation: network-first, fall back to the cached shell offline.
    // Успешный ответ обязательно кладём в кеш: иначе офлайн-фолбэк навсегда
    // остаётся тем index.html, что был закеширован при установке, и после
    // деплоя начинает ссылаться на уже удалённый бандл -> белый экран.
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy));
          }
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  if (isApi) {
    // API GET: network-first, cache the response, fall back to last-known-good on failure.
    // (Primary offline data path is the app's IndexedDB cache; this is defense in depth.)
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Same-origin static assets (including Vite's hashed JS/CSS bundle) and CDN assets:
  // cache-first, then network + runtime cache.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});

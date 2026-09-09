const CACHE_NAME = 'o-vuoro-runtime-v2';
const scope = self.registration.scope;
const APP_SHELL = [scope, new URL('index.html', scope).href, new URL('manifest.webmanifest', scope).href, new URL('icon.svg', scope).href];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.match(event.request).then(async (cached) => {
      if (cached) return cached;
      try {
        const response = await fetch(event.request);
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(event.request, response.clone());
        }
        return response;
      } catch {
        if (event.request.mode === 'navigate') return caches.match(new URL('index.html', scope).href);
        throw new Error('Offline resource unavailable.');
      }
    }),
  );
});
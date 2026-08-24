/* INTAKE service worker — app shell offline, network-first for APIs */
const CACHE = 'intake-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;

  // Never cache nutrition API traffic — stale macros are worse than no macros.
  if (url.hostname.includes('openfoodfacts.org') || url.hostname.includes('nal.usda.gov')) return;

  // Fonts + CDN: cache-first, they never change.
  if (url.hostname.includes('fonts.') || url.hostname.includes('cdnjs.')) {
    e.respondWith(
      caches.match(e.request).then(hit => hit || fetch(e.request).then(r => {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return r;
      }).catch(() => hit))
    );
    return;
  }

  // App shell: network-first so deploys land, cache as offline fallback.
  if (url.origin === location.origin) {
    e.respondWith(
      fetch(e.request).then(r => {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return r;
      }).catch(() => caches.match(e.request).then(hit => hit || caches.match('./index.html')))
    );
  }
});

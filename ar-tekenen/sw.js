// Offline support: serve the app from the cache, refresh it in the background.
const CACHE = 'ar-tekenen-v1';
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/catalog.js', 'js/render.js', 'js/svg.js', 'js/sketches.js',
  'js/draw-animals.js', 'js/draw-people.js', 'js/draw-things.js', 'js/draw-world.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
  'icons/camera.svg', 'icons/gallery.svg', 'icons/flower.svg', 'icons/learn.svg', 'icons/sketch.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => {
      const net = fetch(e.request).then((res) => {
        if (res.ok) caches.open(CACHE).then((c) => c.put(e.request, res.clone()));
        return res;
      }).catch(() => hit);
      return hit || net;
    }),
  );
});

// Service worker: app werkt offline en het AI-model hoeft maar één keer gedownload te worden.
const CACHE = 'gezichtwissel-v2';
const SHELL = [
  './', 'index.html', 'style.css', 'icon.svg', 'manifest.webmanifest',
  'js/app.js', 'js/engine.js', 'js/mesh.js', 'js/detector.js', 'js/store.js',
];
const CDN_HOSTS = ['cdn.jsdelivr.net', 'storage.googleapis.com'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Bibliotheek en model: versie staat vast in de URL, dus eerst uit de cache.
  if (CDN_HOSTS.includes(url.hostname)) {
    e.respondWith(caches.open(CACHE).then(async (c) => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) c.put(req, res.clone());
      return res;
    }));
    return;
  }

  // Eigen bestanden: eerst het netwerk (altijd de nieuwste versie), anders de cache.
  if (url.origin === self.location.origin) {
    e.respondWith(fetch(req).then((res) => {
      if (res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone()));
      return res;
    }).catch(() => caches.match(req).then((r) => r || caches.match('index.html'))));
  }
});

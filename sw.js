// EduNest web apps: offline support. Change VERSION on every release so phones pick up the new files.
const VERSION = 'edunest-web-1.7.1-p2';
const SHELL = [
  './', 'index.html', 'config.js',
  'assets/app.css', 'assets/core.js', 'assets/lib.js', 'assets/icons.js', 'assets/demo.js', 'assets/fonts/gsf.woff2',
  'parent/', 'parent/index.html', 'parent/app.js', 'parent/manifest.webmanifest',
  'teacher/', 'teacher/index.html', 'teacher/app.js', 'teacher/manifest.webmanifest',
  'icons/parent-192.png', 'icons/teacher-192.png', 'icons/parent-favicon-32.png', 'icons/teacher-favicon-32.png', 'icons/parent-favicon-96.png', 'icons/teacher-favicon-96.png', 'icons/parent-96.png', 'icons/teacher-96.png', 'icons/edunest.svg',
  'school/logo.webp', 'school/logo-name.webp', 'school/logo-name-dark.webp', 'school/logo-192.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL.map((p) => new Request(p, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// Pages and config.js: network first (new version / settings arrive at once), phone copy when offline.
// Everything else of this site: phone copy first, refreshed in the background.
// Firebase / Google traffic is never touched (Firestore keeps its own offline copy).
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  const fresh = req.mode === 'navigate' || url.pathname.endsWith('/config.js');
  if (fresh) {
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res.ok) (await caches.open(VERSION)).put(req, res.clone());
        return res;
      } catch {
        return (await caches.match(req, { ignoreSearch: true })) || (await caches.match(new URL('index.html', url).href)) || Response.error();
      }
    })());
    return;
  }
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const hit = await cache.match(req, { ignoreSearch: true });
    const net = fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    return (await net) || Response.error();
  })());
});

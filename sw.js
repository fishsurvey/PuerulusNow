// Puerulus collectors – offline service worker
const VERSION = '20261117-1651';
const SHELL = 'shell-' + VERSION;
const TILES = 'tiles-v1';
const SHELL_FILES = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(k => k.startsWith('shell-') && k !== SHELL).map(k => caches.delete(k))
  )).then(() => self.clients.claim()));
});

function timeout(ms){ return new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)); }

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Satellite tiles: cache first, save anything new we see
  if (url.hostname.endsWith('arcgisonline.com')){
    e.respondWith((async () => {
      const cache = await caches.open(TILES);
      const hit = await cache.match(req.url);
      if (hit) return hit;
      try{
        const res = await fetch(req);
        if (res.ok) cache.put(req.url, res.clone());
        return res;
      }catch(err){
        return new Response('', { status: 504 });
      }
    })());
    return;
  }

  // App files: try network briefly (to pick up updates), fall back to cache
  if (url.origin === self.location.origin){
    e.respondWith((async () => {
      const cache = await caches.open(SHELL);
      try{
        const res = await Promise.race([fetch(req), timeout(3000)]);
        if (res.ok) cache.put(req, res.clone());
        return res;
      }catch(err){
        return (await cache.match(req, { ignoreSearch: true })) ||
               (req.mode === 'navigate' ? await cache.match('./index.html') : new Response('', { status: 504 }));
      }
    })());
  }
});

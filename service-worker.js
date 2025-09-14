const CACHE_NAME = "flashcards-pwa-v1";
const toCache = [
  "./","./index.html","./settings.html","./styles.css","./app.js","./manifest.json","./assets/icons/icon-192.png","./assets/icons/icon-512.png"
];
self.addEventListener('install', e=>{ e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(toCache))); self.skipWaiting(); });
self.addEventListener('activate', e=>{ e.waitUntil(clients.claim()); });
self.addEventListener('fetch', e=>{ e.respondWith(caches.match(e.request).then(r=> r || fetch(e.request))); });

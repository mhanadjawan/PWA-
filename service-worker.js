const CACHE_NAME = 'flashcards-cache-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/settings.html',
 '/styles.css',
 '/app.js',
  '/manifest.json',
  '/icons/android-launchericon-48-48.png',
  '/icons/android-launchericon-72-72.png',
  '/icons/android-launchericon-96-96.png',
  '/icons/android-launchericon-144-144.png',
  '/icons/android-launchericon-192-192.png',
  '/icons/android-launchericon-512-512.png',
  '/icons/100.png',
  '/icons/128.png',
  '/icons/256.png',
  '/icons/512.png',
  '/icons/192.png',
  '/icons/1024.png'
 

];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache);
    })
  );
});


self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );
    })
  );
});


self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});


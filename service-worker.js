const CACHE_NAME = "recon-separate-tables-v14-20260630";

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll([
      "./",
      "./index.html",
      "./style.css",
      "./app.js",
      "./manifest.json",
      "./assets/fonts/AlibabaPuHuiTi-3-55-Regular.ttf",
      "./assets/fonts/AlibabaPuHuiTi-3-75-SemiBold.ttf",
      "./assets/icons/broom.svg",
      "./assets/icons/check.svg",
      "./assets/icons/copy.svg",
      "./assets/icons/download.svg",
      "./assets/icons/fire.svg",
      "./assets/icons/mobile.svg",
      "./assets/icons/plus.svg",
      "./assets/icons/send.svg",
      "./assets/icons/settings.svg",
      "./assets/icons/snowflake.svg",
      "./assets/icons/telegram.svg",
      "./assets/icons/trash.svg",
      "./assets/icons/x.svg"
    ]))
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});

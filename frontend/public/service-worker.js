const CACHE_NAME = "resumeai-v2";
// Strict static assets dependencies ko hata kar generic path layout mapping
const urlsToCache = [
  "/",
  "/index.html",
  "/favicon.ico"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // url chunks filter matching handle rules
      return cache.addAll(urlsToCache);
    })
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request).catch(() => {
        return caches.match("/");
      });
    })
  );
});
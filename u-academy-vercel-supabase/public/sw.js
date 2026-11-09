// U++ Academy service worker — minimal offline-capable worker.
// Cache-first for same-origin static assets, network-first for pages/API.
const CACHE = "u-academy-v1";
const STATIC_PATTERNS = ["/_next/static/", "/icon-", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Only handle same-origin requests; let cross-origin (fonts, YouTube) pass through.
  if (url.origin !== self.location.origin) return;

  const isStatic =
    STATIC_PATTERNS.some((p) => url.pathname.includes(p)) ||
    /\.(png|svg|ico|css|js|woff2?)$/.test(url.pathname);

  if (isStatic) {
    // Cache-first for static assets.
    event.respondWith(
      caches.open(CACHE).then((cache) =>
        cache.match(req).then(
          (hit) =>
            hit ||
            fetch(req).then((res) => {
              if (res.ok) cache.put(req, res.clone());
              return res;
            })
        )
      )
    );
  } else {
    // Network-first for pages and API, falling back to cache when offline.
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req))
    );
  }
});

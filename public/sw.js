// U++ Academy service worker — minimal offline-capable worker.
// Cache-first for same-origin static assets, network-first for pages.
// API responses are NEVER cached (they are per-user and must not be
// served stale — or to another session — from the cache).
const CACHE = "u-academy-v2";
const STATIC_PATTERNS = ["/_next/static/", "/icon-", "/logo", "/manifest.webmanifest"];

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
  // Never cache or serve API calls from the cache.
  if (url.pathname.startsWith("/api/")) return;

  const isStatic =
    STATIC_PATTERNS.some((p) => url.pathname.includes(p)) ||
    /\.(png|jpe?g|svg|ico|css|js|woff2?)$/.test(url.pathname);

  if (isStatic) {
    // Cache-first for static assets (logo, icons, manifest, JS/CSS).
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
    // Network-first for pages, falling back to the cached shell when offline.
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

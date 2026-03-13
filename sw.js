// CACHE_VERSION is automatically updated on each push to main.
// Do not edit manually — it will be overwritten by CI.
const CACHE_VERSION = "ae31550d";
const CACHE_NAME = `planar-atlas-${CACHE_VERSION}`;

const PRECACHE_ASSETS = [
  "/",
  "/index.html",
  "/styles/themes.css",
  "/styles/gallery.css",
  "/styles/game.css",
  "/src/gallery/index.js",
  "/src/gallery/ui.js",
  "/src/gallery/utils.js",
  "/src/gallery/render.js",
  "/src/gallery/search.js",
  "/src/gallery/modal.js",
  "/src/gallery/state.js",
  "/src/deck/index.js",
  "/src/deck/codec.js",
  "/src/deck/panel.js",
  "/src/game/state.js",
  "/src/game/ui.js",
  "/src/changelog.js",
  "/src/game/classic.js",
  "/src/game/bem.js",
  "/cards.json",
  "/version.json",
  "/manifest.json",
  "/assets/favicon.svg",
  "/assets/favicon-192.png",
  "/assets/favicon-512.png",
  "/assets/card-preview.jpg",
  "https://cdn.jsdelivr.net/npm/marked/marked.min.js",
  "https://cdn.jsdelivr.net/npm/dompurify@3.1.6/dist/purify.min.js",
  "https://cdn.jsdelivr.net/npm/mana-font@latest/css/mana.min.css"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and chrome-extension URLs
  if (request.method !== "GET" || url.protocol === "chrome-extension:") return;

  // For card images and thumbnails: cache-first with network fallback
  if (url.pathname.startsWith("/cards/images/") || url.pathname.startsWith("/cards/thumbs/")) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        }).catch(() => caches.match("/assets/card-preview.jpg").then(r => r || Response.error()));
      })
    );
    return;
  }

  // For transcripts: cache-first with network fallback
  if (url.pathname.startsWith("/transcripts/")) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        }).catch(() => new Response("", { status: 503 }));
      })
    );
    return;
  }

  // For per-card JSON: cache-first with network fallback
  if (url.pathname.startsWith("/cards/") && url.pathname.endsWith(".json")) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        }).catch(() => new Response("{}", { status: 503, headers: { "Content-Type": "application/json" } }));
      })
    );
    return;
  }

  // For everything else: network-first with cache fallback (keeps app shell fresh)
  event.respondWith(
    fetch(request).then((response) => {
      if (response.ok) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
      }
      return response;
    }).catch(() => caches.match(request))
  );
});

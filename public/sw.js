/*
 * Service worker SalesAcademy (PWA). Консервативный: НИКОГДА не кеширует видео,
 * медиа, ключи и ответы API (CLAUDE.md, правило 2 — защищённая раздача только сервером).
 * Кеширует только публичную статику (_next/static, иконки) и отдаёт offline-страницу,
 * когда сеть недоступна при навигации.
 */
const CACHE = "salesacademy-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.add(OFFLINE_URL)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

// Пути, которые нельзя кешировать ни при каких условиях.
function isProtected(url) {
  return (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/protected-media") ||
    url.pathname.includes("/video/") ||
    url.pathname.startsWith("/admin")
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (isProtected(url)) return; // пусть идёт в сеть напрямую, без участия SW

  // Навигация: network-first, offline-страница как запасной вариант.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.match(OFFLINE_URL).then((r) => r || Response.error())),
    );
    return;
  }

  // Публичная статика: stale-while-revalidate.
  if (url.pathname.startsWith("/_next/static") || url.pathname.startsWith("/images")) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        const network = fetch(req)
          .then((res) => {
            if (res.ok) cache.put(req, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || network;
      }),
    );
  }
});

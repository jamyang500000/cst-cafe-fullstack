// CST Cafe service worker.
// Its only job: if the internet is down when you open a page, show a
// friendly offline page instead of the browser's error. Everything else
// (menu, orders, logins) always goes straight to the network, so nothing
// out of date is ever shown and nothing private is stored.

const CACHE = "cst-cafe-offline-v2"; // change the number when offline.html changes
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL]))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  // Remove caches from older versions of this file.
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  // Only page loads; API calls, images and scripts are left alone.
  if (event.request.mode !== "navigate") return;
  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE_URL)));
});

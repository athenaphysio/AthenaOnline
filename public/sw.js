// A deliberately minimal service worker. It caches nothing and changes
// nothing about how pages load; its only job is that some Android browsers
// (Samsung Internet in particular) will only offer "install this app" to a
// site that has one, and it passes every request straight to the network.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});

// Roam Messenger's service worker. It caches nothing. Its jobs are to show
// phone notifications, which never contain any message content, and to
// open the right conversation when one is tapped.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = {};
  }
  const title = data.title || "Roam Messenger";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "You have a new message.",
      icon: "/roam-messenger/icon-192.png",
      badge: "/roam-messenger/icon-192.png",
      tag: data.tag || "roam-messenger",
      renotify: true,
      data: { url: data.url || "/roam-messenger" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/roam-messenger";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes("/roam-messenger") && "focus" in client) {
          client.postMessage({ type: "open", url });
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});

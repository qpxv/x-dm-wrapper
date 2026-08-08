self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let url = "/";
  let tag;
  if (event.data) {
    try {
      const payload = event.data.json();
      if (typeof payload.url === "string") {
        url = payload.url;
      }
      if (typeof payload.tag === "string") {
        tag = payload.tag;
      }
    } catch {
      // Ignore malformed payloads — still show the generic notification.
    }
  }

  const notificationOptions = {
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url },
    tag,
    renotify: true,
  };

  event.waitUntil(
    (async () => {
      await self.registration.showNotification("New message", notificationOptions);

      if (tag) {
        // Closing an existing same-tag notification isn't instant on every
        // platform, so two pushes arriving close together can both leave a
        // banner visible. Self-heal: if more than one is left standing after
        // a beat, collapse down to a single fresh one for this chat.
        await new Promise((resolve) => setTimeout(resolve, 500));
        const matches = await self.registration.getNotifications({ tag });
        if (matches.length > 1) {
          matches.forEach((notification) => notification.close());
          await new Promise((resolve) => setTimeout(resolve, 300));
          await self.registration.showNotification("New message", notificationOptions);
        }
      }
    })()
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clients) => {
      const client = clients[0];
      if (client) {
        if ("navigate" in client) {
          try {
            const navigated = await client.navigate(url);
            return navigated.focus();
          } catch {
            // Navigation unsupported/blocked — at least bring the window forward.
          }
        }
        return client.focus();
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});

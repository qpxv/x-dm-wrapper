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

  async function showCollapsed() {
    if (tag) {
      const existing = await self.registration.getNotifications({ tag });
      if (existing.length > 0) {
        existing.forEach((notification) => notification.close());
        // Closing isn't instant on every platform — give the OS a moment to
        // actually remove it before showing the replacement, otherwise two
        // pushes arriving close together can both leave a banner visible.
        await new Promise((resolve) => setTimeout(resolve, 400));
      }
    }
    await self.registration.showNotification("New message", notificationOptions);
  }

  // Two pushes for the same chat can be handled concurrently by the browser.
  // Without serializing on the tag, both handlers can see "nothing to close
  // yet" at the same time and each show their own banner. navigator.locks
  // ensures only one push at a time runs the close-then-show sequence.
  event.waitUntil(
    tag && "locks" in navigator ? navigator.locks.request(tag, showCollapsed) : showCollapsed()
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

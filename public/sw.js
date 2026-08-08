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
      existing.forEach((notification) => notification.close());
    }
    await self.registration.showNotification("New message", notificationOptions);

    if (tag) {
      // close() isn't reliably reflected on every platform, even after a
      // wait (confirmed WebKit bug: bugs.webkit.org/show_bug.cgi?id=258922).
      // Retry-and-self-heal a few times as best-effort defense-in-depth —
      // real notification volume is now debounced server-side (see
      // extendNotifyDebounce/flushDebouncedNotify in lib/push/send.ts), so
      // this only matters for the rare case of two messages within seconds.
      for (let attempt = 0; attempt < 6; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 400));
        const matches = await self.registration.getNotifications({ tag });
        if (matches.length <= 1) {
          break;
        }
        matches.slice(1).forEach((notification) => notification.close());
      }
    }
  }

  // Two pushes for the same chat can be handled concurrently by the browser.
  // navigator.locks serializes handling per tag so the second push always
  // sees (and closes) the first's notification before showing its own.
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

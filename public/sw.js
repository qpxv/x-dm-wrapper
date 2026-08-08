self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

function debugLog(payload) {
  return fetch("/api/debug/sw-log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => {});
}

self.addEventListener("push", (event) => {
  let url = "/";
  let tag;
  let rawText = null;
  if (event.data) {
    rawText = event.data.text();
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

  event.waitUntil(
    (async () => {
      await debugLog({ stage: "push-received", rawText, url, tag, time: Date.now() });

      await self.registration.showNotification("New message", {
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        data: { url },
        tag,
        renotify: true,
      });

      if (tag) {
        // Closing an existing same-tag notification isn't instant on every
        // platform, so a rapid pair of pushes can both leave a banner
        // visible. Wait a beat, then self-heal: keep only the newest one.
        await new Promise((resolve) => setTimeout(resolve, 500));
        const matches = await self.registration.getNotifications({ tag });
        await debugLog({
          stage: "reconcile",
          tag,
          matchCount: matches.length,
          timestamps: matches.map((n) => n.timestamp),
        });
        if (matches.length > 1) {
          const sorted = [...matches].sort((a, b) => b.timestamp - a.timestamp);
          sorted.slice(1).forEach((notification) => notification.close());
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

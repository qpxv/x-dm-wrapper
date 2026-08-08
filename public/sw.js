const SW_VERSION = "debug-3";

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
    body: JSON.stringify({ swVersion: SW_VERSION, ...payload }),
  }).catch(() => {});
}

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

  const receivedAt = Date.now();

  async function showCollapsed() {
    await debugLog({ stage: "lock-acquired", tag, receivedAt, elapsedMs: Date.now() - receivedAt });

    if (tag) {
      const existing = await self.registration.getNotifications({ tag });
      await debugLog({ stage: "existing-before-close", tag, existingCount: existing.length });
      existing.forEach((notification) => notification.close());
    }
    await self.registration.showNotification("New message", notificationOptions);

    if (tag) {
      // close() isn't reliably reflected within any single fixed wait on
      // this platform (confirmed via logging: even after a 400ms wait,
      // getNotifications() sometimes still showed 2). Retry-and-self-heal
      // instead of trusting one wait to be long enough.
      for (let attempt = 0; attempt < 6; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 400));
        const matches = await self.registration.getNotifications({ tag });
        await debugLog({ stage: "reconcile-attempt", tag, attempt, matchCount: matches.length });
        if (matches.length <= 1) {
          break;
        }
        matches.slice(1).forEach((notification) => notification.close());
      }
    }

    const after = await self.registration.getNotifications({ tag });
    await debugLog({ stage: "lock-released", tag, finalCount: after.length });
  }

  event.waitUntil(
    (async () => {
      await debugLog({ stage: "push-received", tag, receivedAt });
      if (tag && "locks" in navigator) {
        await debugLog({ stage: "requesting-lock", tag });
        await navigator.locks.request(tag, showCollapsed);
      } else {
        await debugLog({ stage: "no-lock-support", tag, hasLocks: "locks" in navigator });
        await showCollapsed();
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

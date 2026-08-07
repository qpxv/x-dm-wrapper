self.addEventListener("push", (event) => {
  let url = "/";
  if (event.data) {
    try {
      const payload = event.data.json();
      if (typeof payload.url === "string") {
        url = payload.url;
      }
    } catch {
      // Ignore malformed payloads — still show the generic notification.
    }
  }

  event.waitUntil(
    self.registration.showNotification("X DM Wrapper", {
      body: "New message",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(url) && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});

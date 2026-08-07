"use client";

import { useEffect, useState, type JSX } from "react";
import { Bell } from "lucide-react";
import { subscribeToPush } from "@/app/actions/push";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

type Status = "checking" | "ios-needs-install" | "unsupported" | "can-enable" | "enabled";

function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0))).buffer;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function EnableNotifications(): JSX.Element | null {
  const [status, setStatus] = useState<Status>("checking");
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function detect(): Promise<void> {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        if (!cancelled) {
          setStatus(isIos() && !isStandalone() ? "ios-needs-install" : "unsupported");
        }
        return;
      }

      if (isIos() && !isStandalone()) {
        if (!cancelled) {
          setStatus("ios-needs-install");
        }
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      const existing = await registration.pushManager.getSubscription();
      if (!cancelled) {
        setStatus(existing ? "enabled" : "can-enable");
      }
    }

    void detect();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleEnable(): Promise<void> {
    setIsPending(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setIsPending(false);
        return;
      }

      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) {
        throw new Error("NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set");
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      await subscribeToPush(subscription.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } });
      setStatus("enabled");
    } finally {
      setIsPending(false);
    }
  }

  if (status === "checking" || status === "enabled" || status === "unsupported") {
    return null;
  }

  if (status === "ios-needs-install") {
    return (
      <p className="text-xs text-muted-foreground">
        Add to Home Screen to enable notifications.
      </p>
    );
  }

  return (
    <Button variant="outline" size="icon" aria-label="Enable notifications" onClick={handleEnable} disabled={isPending}>
      {isPending ? <Spinner /> : <Bell className="size-4" />}
    </Button>
  );
}

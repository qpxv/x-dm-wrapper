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

function toSubscriptionPayload(
  subscription: PushSubscription
): { endpoint: string; keys: { p256dh: string; auth: string } } {
  const json = subscription.toJSON();
  if (!json.keys?.p256dh || !json.keys?.auth) {
    throw new Error("Push subscription is missing encryption keys");
  }
  return {
    endpoint: subscription.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
  };
}

export function EnableNotifications(): JSX.Element | null {
  const [status, setStatus] = useState<Status>("checking");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

      if (!existing) {
        if (!cancelled) {
          setStatus("can-enable");
        }
        return;
      }

      // A subscription can exist at the browser level without ever having
      // been persisted server-side (e.g. a past subscribeToPush call that
      // silently failed) — re-sync on every mount so that case self-heals.
      try {
        await subscribeToPush(toSubscriptionPayload(existing));
        if (!cancelled) {
          setStatus("enabled");
        }
      } catch {
        await existing.unsubscribe();
        if (!cancelled) {
          setError("Couldn't enable notifications — try again.");
          setStatus("can-enable");
        }
      }
    }

    void detect();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleEnable(): Promise<void> {
    setIsPending(true);
    setError(null);
    let subscription: PushSubscription | null = null;
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        return;
      }

      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) {
        throw new Error("NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set");
      }

      const registration = await navigator.serviceWorker.ready;
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      await subscribeToPush(toSubscriptionPayload(subscription));
      setStatus("enabled");
    } catch {
      // Don't leave a browser-level subscription dangling if the server
      // never got it — otherwise the next mount would wrongly report "enabled".
      await subscription?.unsubscribe();
      setError("Couldn't enable notifications — try again.");
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
    <div className="flex items-center gap-2">
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <Button variant="outline" size="icon" aria-label="Enable notifications" onClick={handleEnable} disabled={isPending}>
        {isPending ? <Spinner /> : <Bell className="size-4" />}
      </Button>
    </div>
  );
}

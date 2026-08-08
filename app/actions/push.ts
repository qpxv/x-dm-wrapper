"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface PushSubscriptionInput {
  deviceId: string;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export async function subscribeToPush(subscription: PushSubscriptionInput): Promise<void> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    throw new Error("Not authenticated");
  }

  // Safari/WebKit can mint a brand-new push endpoint for the same device
  // (e.g. after reinstalling the PWA), which would otherwise leave the old
  // endpoint as a permanent orphan receiving duplicate pushes forever. Keying
  // on a stable per-device id instead means a device always maps to one row.
  await prisma.pushSubscription.deleteMany({
    where: { endpoint: subscription.endpoint, deviceId: { not: subscription.deviceId } },
  });

  await prisma.pushSubscription.upsert({
    where: { deviceId: subscription.deviceId },
    create: {
      deviceId: subscription.deviceId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
    update: {
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
  });
}

import webpush from "web-push";
import { prisma } from "@/lib/prisma";

function getWebPushClient(): typeof webpush {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    throw new Error("VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT must be set");
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  return webpush;
}

export async function notifyNewMessage(conversationId: string): Promise<void> {
  const subscriptions = await prisma.pushSubscription.findMany();
  if (subscriptions.length === 0) {
    return;
  }

  const client = getWebPushClient();
  const payload = JSON.stringify({
    url: `/conversations/${conversationId}`,
    tag: conversationId,
  });

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await client.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          payload
        );
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: subscription.id } });
        } else {
          throw error;
        }
      }
    })
  );
}

const DEBOUNCE_MS = 2 * 60 * 1000;

// Extends (or starts) this conversation's debounce window. Returns true only
// when no chain is already scheduled to check it — i.e. the caller should
// kick off flushDebouncedNotify. If one's already running, extending the
// timestamp is enough; that chain picks up the new deadline on its own.
export async function extendNotifyDebounce(conversationId: string): Promise<boolean> {
  const now = new Date();
  const before = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { pendingNotifyAt: true },
  });
  const alreadyScheduled = !!before?.pendingNotifyAt && before.pendingNotifyAt > now;

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { pendingNotifyAt: new Date(now.getTime() + DEBOUNCE_MS) },
  });

  return !alreadyScheduled;
}

// Self-rescheduling: sleeps until pendingNotifyAt, then re-checks (a newer
// message may have pushed it further out while sleeping) and loops. Only the
// invocation that finds it due AND wins the atomic claim actually sends, so
// if two chains ever exist concurrently the extra one is a harmless no-op.
//
// If a chain dies mid-sleep (e.g. a deploy restarts the function),
// pendingNotifyAt is left stale in the past with nothing to claim it — the
// next inbound message for this conversation will see it's in the past,
// treat it as unscheduled, and kick off a fresh chain, so a lost chain only
// delays that notification rather than losing it outright.
export async function flushDebouncedNotify(conversationId: string): Promise<void> {
  for (;;) {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { pendingNotifyAt: true },
    });
    if (!conversation?.pendingNotifyAt) {
      return;
    }

    const waitMs = conversation.pendingNotifyAt.getTime() - Date.now();
    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      continue;
    }

    const claimed = await prisma.conversation.updateMany({
      where: { id: conversationId, pendingNotifyAt: { lte: new Date() } },
      data: { pendingNotifyAt: null },
    });
    if (claimed.count > 0) {
      await notifyNewMessage(conversationId);
    }
    return;
  }
}

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

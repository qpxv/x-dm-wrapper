import { Direction } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildConversationId, fetchConversationEvents } from "@/lib/x/dm";

interface EmbeddedUser {
  id: string;
  username: string;
  name: string;
  profile_image_url?: string;
}

export interface ParsedWebhookEvent {
  eventId: string;
  senderId: string;
  recipientId: string;
  text: string;
  mediaUrl: string | null;
  sentAt: Date;
  embeddedUsers: Map<string, EmbeddedUser>;
}

// Legacy/v1.1-shaped payload, confirmed against real captured events in Phase 2.
export function parseWebhookPayload(rawBody: string): ParsedWebhookEvent | null {
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return null;
  }

  const event = (body as Record<string, unknown>)?.data as Record<string, unknown> | undefined;
  const payload = event?.payload as Record<string, unknown> | undefined;
  const events = payload?.direct_message_events as Array<Record<string, unknown>> | undefined;
  const dmEvent = events?.[0];
  const messageCreate = dmEvent?.message_create as Record<string, unknown> | undefined;
  const target = messageCreate?.target as Record<string, unknown> | undefined;
  const messageData = messageCreate?.message_data as Record<string, unknown> | undefined;

  const eventId = dmEvent?.id;
  const senderId = messageCreate?.sender_id;
  const recipientId = target?.recipient_id;
  const createdTimestamp = dmEvent?.created_timestamp;

  if (
    typeof eventId !== "string" ||
    typeof senderId !== "string" ||
    typeof recipientId !== "string" ||
    typeof createdTimestamp !== "string"
  ) {
    return null;
  }

  const usersRaw = (payload?.users ?? {}) as Record<string, { data?: EmbeddedUser }>;
  const embeddedUsers = new Map<string, EmbeddedUser>();
  for (const entry of Object.values(usersRaw)) {
    if (entry.data) {
      embeddedUsers.set(entry.data.id, entry.data);
    }
  }

  // Best-effort: the legacy attachment shape hasn't been observed in real
  // traffic yet (only text messages so far), so this is unverified.
  const attachment = messageData?.attachment as Record<string, unknown> | undefined;
  const media = attachment?.media as Record<string, unknown> | undefined;
  const mediaUrl = typeof media?.media_url_https === "string" ? media.media_url_https : null;

  return {
    eventId,
    senderId,
    recipientId,
    text: typeof messageData?.text === "string" ? messageData.text : "",
    mediaUrl,
    sentAt: new Date(Number(createdTimestamp)),
    embeddedUsers,
  };
}

async function upsertContact(userId: string, embeddedUsers: Map<string, EmbeddedUser>) {
  const embedded = embeddedUsers.get(userId);

  return prisma.contact.upsert({
    where: { xUserId: userId },
    create: {
      xUserId: userId,
      username: embedded?.username ?? userId,
      name: embedded?.name ?? userId,
      profileImageUrl: embedded?.profile_image_url,
    },
    update: {},
  });
}

export async function ingestWebhookEvent(parsed: ParsedWebhookEvent): Promise<void> {
  const myUserId = process.env.X_MY_USER_ID;
  if (!myUserId) {
    throw new Error("X_MY_USER_ID is not set");
  }

  const direction = parsed.senderId === myUserId ? Direction.OUTBOUND : Direction.INBOUND;
  const otherUserId = direction === Direction.OUTBOUND ? parsed.recipientId : parsed.senderId;

  const contact = await upsertContact(otherUserId, parsed.embeddedUsers);

  let conversation = await prisma.conversation.findUnique({ where: { contactId: contact.id } });
  const isNewConversation = !conversation;

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        xConversationId: buildConversationId(myUserId, otherUserId),
        contactId: contact.id,
        lastMessageAt: parsed.sentAt,
        isUnread: direction === Direction.INBOUND,
        backfilledAt: null,
      },
    });
  }

  await prisma.message.upsert({
    where: { xEventId: parsed.eventId },
    create: {
      xEventId: parsed.eventId,
      conversationId: conversation.id,
      senderId: parsed.senderId,
      direction,
      text: parsed.text,
      mediaUrls: parsed.mediaUrl ? [parsed.mediaUrl] : [],
      sentAt: parsed.sentAt,
    },
    update: {},
  });

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      lastMessageAt: parsed.sentAt,
      ...(direction === Direction.INBOUND ? { isUnread: true } : {}),
    },
  });

  if (isNewConversation) {
    await backfillConversation(conversation.id, otherUserId);
  }
}

export async function backfillConversation(conversationId: string, otherUserId: string): Promise<void> {
  let paginationToken: string | undefined;
  let reachedCap = false;

  do {
    const page = await fetchConversationEvents(otherUserId, paginationToken);
    if (!page) {
      reachedCap = true;
      break;
    }

    for (const event of page.events) {
      if (event.event_type !== "MessageCreate") {
        continue;
      }

      const mediaUrls = (event.attachments?.media_keys ?? [])
        .map((key) => page.mediaByKey.get(key))
        .filter((url): url is string => Boolean(url));

      await prisma.message.upsert({
        where: { xEventId: event.id },
        create: {
          xEventId: event.id,
          conversationId,
          senderId: event.sender_id,
          direction: event.sender_id === process.env.X_MY_USER_ID ? Direction.OUTBOUND : Direction.INBOUND,
          text: event.text ?? "",
          mediaUrls,
          sentAt: new Date(event.created_at),
        },
        update: {},
      });
    }

    paginationToken = page.nextToken ?? undefined;
  } while (paginationToken);

  if (!reachedCap) {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { backfilledAt: new Date() },
    });
  }
}

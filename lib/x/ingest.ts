import { Direction } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildConversationId, fetchConversationEvents, type EmbeddedUser } from "@/lib/x/dm";
import { notifyNewMessage } from "@/lib/push/send";

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

// Only advances lastMessageAt (and flips isUnread) when sentAt is actually
// newer than what's stored — a duplicate/replayed/optimistic write must not
// be able to move the conversation's sort position or unread state backward.
export async function advanceLastMessageAt(
  conversationId: string,
  sentAt: Date,
  direction: Direction
): Promise<boolean> {
  const result = await prisma.conversation.updateMany({
    where: {
      id: conversationId,
      OR: [{ lastMessageAt: null }, { lastMessageAt: { lt: sentAt } }],
    },
    data: {
      lastMessageAt: sentAt,
      ...(direction === Direction.INBOUND ? { isUnread: true } : {}),
    },
  });

  return result.count > 0;
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

export interface ResolvedMessage {
  eventId: string;
  otherUserId: string;
  direction: Direction;
  senderId: string;
  text: string;
  mediaUrl: string | null;
  sentAt: Date;
  embeddedUsers: Map<string, EmbeddedUser>;
}

// Shared core used by both the webhook path (ingestWebhookEvent) and the
// poll safety net (lib/x/poll.ts) — everything after direction/otherUserId
// have already been resolved from whichever source shape they came from.
export async function ingestResolvedMessage(msg: ResolvedMessage): Promise<void> {
  const myUserId = process.env.X_MY_USER_ID;
  if (!myUserId) {
    throw new Error("X_MY_USER_ID is not set");
  }

  const contact = await upsertContact(msg.otherUserId, msg.embeddedUsers);

  let conversation = await prisma.conversation.findUnique({ where: { contactId: contact.id } });
  const isNewConversation = !conversation;

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        xConversationId: buildConversationId(myUserId, msg.otherUserId),
        contactId: contact.id,
        lastMessageAt: msg.sentAt,
        isUnread: msg.direction === Direction.INBOUND,
        backfilledAt: null,
      },
    });
  }

  await prisma.message.upsert({
    where: { xEventId: msg.eventId },
    create: {
      xEventId: msg.eventId,
      conversationId: conversation.id,
      senderId: msg.senderId,
      direction: msg.direction,
      text: msg.text,
      mediaUrls: msg.mediaUrl ? [msg.mediaUrl] : [],
      sentAt: msg.sentAt,
    },
    update: {},
  });

  const advanced = await advanceLastMessageAt(conversation.id, msg.sentAt, msg.direction);

  if (advanced && msg.direction === Direction.INBOUND) {
    try {
      await notifyNewMessage(conversation.id);
    } catch (error) {
      console.error("Failed to send push notification", error);
    }
  }

  if (isNewConversation) {
    // The core message is already safely persisted above — a backfill
    // failure (e.g. X rate-limiting a burst of new-conversation lookups)
    // must not be treated as fatal to this event's ingestion. Conversation
    // stays backfilledAt: null, which surfaces the existing RateLimitBanner
    // "continue anyway" retry flow (app/api/x/rate-limit/bump/route.ts).
    try {
      await backfillConversation(conversation.id, msg.otherUserId);
    } catch (error) {
      console.error("Failed to backfill new conversation", conversation.id, error);
    }
  }
}

export async function ingestWebhookEvent(parsed: ParsedWebhookEvent): Promise<void> {
  const myUserId = process.env.X_MY_USER_ID;
  if (!myUserId) {
    throw new Error("X_MY_USER_ID is not set");
  }

  const direction = parsed.senderId === myUserId ? Direction.OUTBOUND : Direction.INBOUND;
  const otherUserId = direction === Direction.OUTBOUND ? parsed.recipientId : parsed.senderId;

  await ingestResolvedMessage({
    eventId: parsed.eventId,
    otherUserId,
    direction,
    senderId: parsed.senderId,
    text: parsed.text,
    mediaUrl: parsed.mediaUrl,
    sentAt: parsed.sentAt,
    embeddedUsers: parsed.embeddedUsers,
  });
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

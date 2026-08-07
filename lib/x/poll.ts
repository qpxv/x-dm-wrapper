import { Direction } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fetchLatestDmEventId, fetchRecentDmEvents, type DmEvent, type EmbeddedUser } from "@/lib/x/dm";
import { ingestResolvedMessage } from "@/lib/x/ingest";

const CATCH_UP_MAX_RESULTS = 100;

function otherUserIdFromConversationId(dmConversationId: string, myUserId: string): string | null {
  const [a, b] = dmConversationId.split("-");
  if (!a || !b) {
    return null;
  }
  if (a === myUserId) {
    return b;
  }
  if (b === myUserId) {
    return a;
  }
  return null;
}

async function ingestDmEvent(event: DmEvent, myUserId: string, users: Map<string, EmbeddedUser>): Promise<void> {
  if (event.event_type !== "MessageCreate") {
    return;
  }

  const otherUserId = otherUserIdFromConversationId(event.dm_conversation_id, myUserId);
  if (!otherUserId) {
    return;
  }

  const direction = event.sender_id === myUserId ? Direction.OUTBOUND : Direction.INBOUND;

  await ingestResolvedMessage({
    eventId: event.id,
    otherUserId,
    direction,
    senderId: event.sender_id,
    text: event.text ?? "",
    mediaUrl: null,
    sentAt: new Date(event.created_at),
    embeddedUsers: users,
  });
}

export interface PollResult {
  checked: boolean;
  caughtUp: boolean;
  ingestedCount: number;
  error?: string;
}

// Safety net for missed webhook deliveries. Cheapest possible check first
// (max_results=1, $0.01) — only pays for the bigger catch-up fetch when the
// newest event id has actually changed since the last poll. See
// prisma DmSyncCursor and the Phase 9 plan for the cost reasoning.
export async function pollMissedDmEvents(): Promise<PollResult> {
  const myUserId = process.env.X_MY_USER_ID;
  if (!myUserId) {
    throw new Error("X_MY_USER_ID is not set");
  }

  const latestId = await fetchLatestDmEventId();
  if (latestId === null) {
    return { checked: false, caughtUp: false, ingestedCount: 0 };
  }

  const cursor = await prisma.dmSyncCursor.findFirst();

  if (cursor?.lastEventId === latestId) {
    return { checked: true, caughtUp: true, ingestedCount: 0 };
  }

  const page = await fetchRecentDmEvents(CATCH_UP_MAX_RESULTS);
  if (!page) {
    return { checked: true, caughtUp: false, ingestedCount: 0 };
  }

  const knownEventId = cursor?.lastEventId ?? null;
  const newEvents: DmEvent[] = [];
  for (const event of page.events) {
    if (event.id === knownEventId) {
      break;
    }
    newEvents.push(event);
  }

  // page.events is newest-first; ingest oldest-first so conversations and
  // push notifications reflect real chronological order.
  newEvents.reverse();

  // A single event's ingestion (e.g. a brand-new conversation's backfill
  // hitting X's rate limit) must not crash the whole batch and block the
  // cursor from advancing past events that already succeeded — stop at the
  // first failure and only advance the cursor to the last success, so the
  // next poll retries from exactly where it left off instead of either
  // re-processing everything or silently skipping the failed event.
  let processedCount = 0;
  let lastSuccessId: string | null = knownEventId;
  let ingestError: string | undefined;

  for (const event of newEvents) {
    try {
      await ingestDmEvent(event, myUserId, page.users);
      lastSuccessId = event.id;
      processedCount += 1;
    } catch (error) {
      console.error("Failed to ingest polled dm event", event.id, error);
      ingestError = error instanceof Error ? error.message : String(error);
      break;
    }
  }

  if (lastSuccessId !== knownEventId) {
    if (cursor) {
      await prisma.dmSyncCursor.update({ where: { id: cursor.id }, data: { lastEventId: lastSuccessId } });
    } else {
      await prisma.dmSyncCursor.create({ data: { lastEventId: lastSuccessId } });
    }
  }

  return {
    checked: true,
    caughtUp: knownEventId !== null && !ingestError,
    ingestedCount: processedCount,
    ...(ingestError ? { error: ingestError } : {}),
  };
}

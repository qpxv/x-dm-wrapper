"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { Direction } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendDirectMessage } from "@/lib/x/dm";
import { advanceLastMessageAt } from "@/lib/x/ingest";

async function requireSession(): Promise<void> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    throw new Error("Not authenticated");
  }
}

export async function markConversationRead(conversationId: string): Promise<void> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return;
  }

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { isUnread: false },
  });
}

export async function sendReply(conversationId: string, text: string): Promise<void> {
  await requireSession();

  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("Message cannot be empty");
  }

  const myUserId = process.env.X_MY_USER_ID;
  if (!myUserId) {
    throw new Error("X_MY_USER_ID is not set");
  }

  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation) {
    throw new Error("Conversation not found");
  }

  const { dmEventId } = await sendDirectMessage(conversation.xConversationId, trimmed);
  const sentAt = new Date();

  await prisma.message.upsert({
    where: { xEventId: dmEventId },
    create: {
      xEventId: dmEventId,
      conversationId: conversation.id,
      senderId: myUserId,
      direction: Direction.OUTBOUND,
      text: trimmed,
      mediaUrls: [],
      sentAt,
    },
    update: {},
  });

  await advanceLastMessageAt(conversation.id, sentAt, Direction.OUTBOUND);

  revalidatePath(`/conversations/${conversationId}`);
}

export async function addNote(conversationId: string, content: string): Promise<void> {
  await requireSession();

  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error("Note cannot be empty");
  }

  await prisma.note.create({
    data: { conversationId, content: trimmed },
  });

  revalidatePath(`/conversations/${conversationId}`);
}

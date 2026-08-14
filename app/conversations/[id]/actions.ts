"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { Direction } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fetchUserProfile, sendDirectMessage } from "@/lib/x/dm";
import { advanceLastMessageAt } from "@/lib/x/ingest";
import { generateSuggestions } from "@/lib/ai/suggest";

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

export async function getContactProfile(contactId: string): Promise<{
  name: string;
  username: string;
  profileImageUrl: string | null;
  description: string | null;
}> {
  await requireSession();

  const contact = await prisma.contact.findUniqueOrThrow({ where: { id: contactId } });

  if (contact.description !== null) {
    return contact;
  }

  const profile = await fetchUserProfile(contact.xUserId);
  if (!profile) {
    return contact;
  }

  const updated = await prisma.contact.update({
    where: { id: contactId },
    data: { description: profile.description ?? "" },
  });

  return updated;
}

export async function getAiSuggestions(conversationId: string, hint?: string): Promise<string[]> {
  await requireSession();

  const [messages, notes] = await Promise.all([
    prisma.message.findMany({
      where: { conversationId },
      orderBy: { sentAt: "asc" },
      select: { direction: true, text: true },
    }),
    prisma.note.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
      select: { content: true, createdAt: true },
    }),
  ]);

  return generateSuggestions(messages, notes, hint);
}

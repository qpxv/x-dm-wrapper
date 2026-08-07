"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

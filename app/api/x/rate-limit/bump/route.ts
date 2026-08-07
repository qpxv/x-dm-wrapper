import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bumpDailyCap } from "@/lib/x/rate-limit";
import { backfillConversation } from "@/lib/x/ingest";

export async function POST(): Promise<NextResponse> {
  await bumpDailyCap();

  const pending = await prisma.conversation.findMany({
    where: { backfilledAt: null },
    include: { contact: true },
  });

  for (const conversation of pending) {
    await backfillConversation(conversation.id, conversation.contact.xUserId);
  }

  return NextResponse.json({ ok: true, retried: pending.length });
}

import type { JSX } from "react";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ContactProfileDialog } from "@/components/contact-profile-dialog";
import { MarkConversationRead } from "@/components/mark-conversation-read";
import { MessageThread } from "@/components/message-thread";
import { NotesSection } from "@/components/notes-section";
import { ReplyBox } from "@/components/reply-box";
import { ReplyProvider } from "@/components/reply-context";
import { AiSuggestButton } from "@/components/ai-suggest-button";
import { CopyConversationButton } from "@/components/copy-conversation-button";
import { SuggestionsPanel } from "@/components/suggestions-panel";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<JSX.Element> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/login");
  }

  const { id } = await params;

  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: {
      contact: true,
      messages: { orderBy: { sentAt: "asc" } },
      notes: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!conversation) {
    notFound();
  }

  return (
    <ReplyProvider
      conversationId={conversation.id}
      initialMessages={conversation.messages}
      notes={conversation.notes}
      contact={{ name: conversation.contact.name, username: conversation.contact.username }}
    >
      <div className="mx-auto flex h-dvh w-full max-w-2xl flex-col overflow-hidden">
        <MarkConversationRead conversationId={conversation.id} />

        <div className="shrink-0">
          <header className="flex items-center gap-3 border-b px-4 py-3">
            <Link href="/" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="size-5" />
            </Link>
            <ContactProfileDialog
              contactId={conversation.contact.id}
              name={conversation.contact.name}
              username={conversation.contact.username}
              profileImageUrl={conversation.contact.profileImageUrl}
              description={conversation.contact.description}
            />
            <CopyConversationButton />
            <AiSuggestButton />
          </header>

          <NotesSection conversationId={conversation.id} notes={conversation.notes} />
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          <MessageThread />
        </div>

        <SuggestionsPanel />
        <ReplyBox />
      </div>
    </ReplyProvider>
  );
}

import type { JSX } from "react";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MarkConversationRead } from "@/components/mark-conversation-read";
import { ScrollToBottom } from "@/components/scroll-to-bottom";
import { cn } from "@/lib/utils";

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
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col">
      <MarkConversationRead conversationId={conversation.id} />

      <header className="flex items-center gap-3 border-b px-4 py-3">
        <Link href="/" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-5" />
        </Link>
        <Avatar>
          <AvatarImage src={conversation.contact.profileImageUrl ?? undefined} />
          <AvatarFallback>{conversation.contact.name.charAt(0)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate font-medium">{conversation.contact.name}</p>
          <p className="truncate text-sm text-muted-foreground">
            @{conversation.contact.username}
          </p>
        </div>
      </header>

      <section className="border-b px-4 py-3">
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">Notes</h2>
        {conversation.notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No notes yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {conversation.notes.map((note) => (
              <li key={note.id} className="rounded-md bg-muted p-2 text-sm">
                <p className="whitespace-pre-wrap">{note.content}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {note.createdAt.toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-4 py-4">
        {conversation.messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "max-w-[75%] rounded-2xl px-3 py-2 text-sm break-words",
              message.direction === "OUTBOUND"
                ? "self-end bg-primary text-primary-foreground"
                : "self-start bg-muted text-foreground"
            )}
          >
            <p className="whitespace-pre-wrap">{message.text}</p>
            {message.mediaUrls.map((url) => (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 block underline"
              >
                Attachment
              </a>
            ))}
          </div>
        ))}
        <ScrollToBottom />
      </div>
    </div>
  );
}

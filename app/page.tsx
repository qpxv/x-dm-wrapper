import type { JSX } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SignOutButton } from "@/components/sign-out-button";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarBadge, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { RateLimitBanner } from "@/components/rate-limit-banner";
import { formatRelativeTime } from "@/lib/format";

export default async function Home(): Promise<JSX.Element> {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/login");
  }

  const xToken = await prisma.xOAuthToken.findFirst();

  if (!xToken) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4">
        <p className="text-muted-foreground">Inbox coming soon.</p>
        <Button render={<a href="/api/x/authorize" />}>Connect X account</Button>
        <SignOutButton />
      </div>
    );
  }

  const conversations = await prisma.conversation.findMany({
    orderBy: { lastMessageAt: "desc" },
    include: { contact: true },
  });

  const hasPendingBackfill = conversations.some((c) => c.backfilledAt === null);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <h1 className="text-lg font-semibold">Inbox</h1>
        <SignOutButton />
      </header>

      {hasPendingBackfill ? (
        <div className="px-4 pt-3">
          <RateLimitBanner />
        </div>
      ) : null}

      {conversations.length === 0 ? (
        <p className="flex flex-1 items-center justify-center text-muted-foreground">
          No conversations yet.
        </p>
      ) : (
        <ul>
          {conversations.map((conversation) => (
            <li key={conversation.id} className="border-b last:border-b-0">
              <Link
                href={`/conversations/${conversation.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted"
              >
                <Avatar size="lg">
                  <AvatarImage src={conversation.contact.profileImageUrl ?? undefined} />
                  <AvatarFallback>{conversation.contact.name.charAt(0)}</AvatarFallback>
                  {conversation.isUnread ? <AvatarBadge /> : null}
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{conversation.contact.name}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    @{conversation.contact.username}
                  </p>
                </div>
                {conversation.lastMessageAt ? (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatRelativeTime(conversation.lastMessageAt)}
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

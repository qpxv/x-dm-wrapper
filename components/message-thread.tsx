"use client";

import { useEffect, useRef, type JSX } from "react";
import type { Message } from "@prisma/client";
import { formatDayLabel, formatMessageTime } from "@/lib/format";
import { cn } from "@/lib/utils";

function groupByLocalDay(messages: Message[]): { label: string; messages: Message[] }[] {
  const groups: { label: string; messages: Message[] }[] = [];

  for (const message of messages) {
    const label = formatDayLabel(message.sentAt);
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.label === label) {
      lastGroup.messages.push(message);
    } else {
      groups.push({ label, messages: [message] });
    }
  }

  return groups;
}

export function MessageThread({ messages }: { messages: Message[] }): JSX.Element {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView();
  }, []);

  const groups = groupByLocalDay(messages);

  return (
    <div className="flex flex-col gap-2">
      {groups.map((group) => (
        <div key={group.label} className="flex flex-col gap-2">
          <div className="my-2 text-center text-xs text-muted-foreground">{group.label}</div>
          {group.messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex flex-col gap-0.5",
                message.direction === "OUTBOUND" ? "items-end" : "items-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[75%] rounded-2xl px-3 py-2 text-sm break-words",
                  message.direction === "OUTBOUND"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
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
              <span className="px-1 text-xs text-muted-foreground">
                {formatMessageTime(message.sentAt)}
              </span>
            </div>
          ))}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

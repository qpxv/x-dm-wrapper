"use client";

import { useState, useTransition, type JSX, type KeyboardEvent } from "react";
import { sendReply } from "@/app/conversations/[id]/actions";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export function ReplyBox({ conversationId }: { conversationId: string }): JSX.Element {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSend(): void {
    setError(null);
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }

    startTransition(async () => {
      try {
        await sendReply(conversationId, trimmed);
        setText("");
      } catch {
        setError("Couldn't send — try again.");
      }
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="border-t px-4 py-3">
      <div className="flex items-end gap-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a reply..."
          rows={2}
          className="text-sm"
        />
        <Button onClick={handleSend} disabled={isPending || !text.trim()}>
          Send
        </Button>
      </div>
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

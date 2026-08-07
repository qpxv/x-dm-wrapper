"use client";

import { useState, useTransition, type JSX, type KeyboardEvent } from "react";
import { Send } from "lucide-react";
import { sendReply } from "@/app/conversations/[id]/actions";
import { useReply } from "@/components/reply-context";
import { AutoResizeTextarea } from "@/components/auto-resize-textarea";
import { Button } from "@/components/ui/button";

const REPLY_MAX_HEIGHT = 160;

export function ReplyBox({ conversationId }: { conversationId: string }): JSX.Element {
  const { replyText, setReplyText } = useReply();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSend(): void {
    setError(null);
    const trimmed = replyText.trim();
    if (!trimmed) {
      return;
    }

    startTransition(async () => {
      try {
        await sendReply(conversationId, trimmed);
        setReplyText("");
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
        <AutoResizeTextarea
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a reply..."
          maxHeight={REPLY_MAX_HEIGHT}
          className="text-sm"
        />
        <Button
          size="icon"
          className="size-9"
          aria-label="Send"
          onClick={handleSend}
          disabled={isPending || !replyText.trim()}
        >
          <Send className="size-4" />
        </Button>
      </div>
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

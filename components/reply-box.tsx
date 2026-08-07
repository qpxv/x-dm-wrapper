"use client";

import { useState, useTransition, type JSX, type KeyboardEvent } from "react";
import { Send } from "lucide-react";
import { sendReply } from "@/app/conversations/[id]/actions";
import { AutoResizeTextarea } from "@/components/auto-resize-textarea";
import { Button } from "@/components/ui/button";

const REPLY_MAX_HEIGHT = 160;

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
        <AutoResizeTextarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a reply..."
          maxHeight={REPLY_MAX_HEIGHT}
          className="text-sm"
        />
        <Button
          size="icon"
          aria-label="Send"
          onClick={handleSend}
          disabled={isPending || !text.trim()}
        >
          <Send className="size-4" />
        </Button>
      </div>
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

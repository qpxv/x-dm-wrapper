"use client";

import { type JSX, type KeyboardEvent } from "react";
import { Send } from "lucide-react";
import { useReply } from "@/components/reply-context";
import { AutoResizeTextarea } from "@/components/auto-resize-textarea";
import { Button } from "@/components/ui/button";

const REPLY_MAX_HEIGHT = 160;

export function ReplyBox(): JSX.Element {
  const { replyText, setReplyText, sendMessage, isSending, sendError } = useReply();

  function handleSend(): void {
    sendMessage(replyText);
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
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleSend}
          disabled={isSending || !replyText.trim()}
        >
          <Send className="size-4" />
        </Button>
      </div>
      {sendError ? <p className="mt-1 text-xs text-destructive">{sendError}</p> : null}
    </div>
  );
}

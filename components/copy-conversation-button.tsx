"use client";

import { useState, type JSX } from "react";
import { Check, Copy } from "lucide-react";
import { useReply } from "@/components/reply-context";
import { Button } from "@/components/ui/button";
import { formatConversationForCopy } from "@/lib/conversation-export";

export function CopyConversationButton(): JSX.Element {
  const { messages, notes, contact } = useReply();
  const [copied, setCopied] = useState(false);

  async function handleCopy(): Promise<void> {
    const text = formatConversationForCopy(contact, messages, notes);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Button
      variant="outline"
      size="icon"
      aria-label="Copy conversation"
      onClick={handleCopy}
    >
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
    </Button>
  );
}

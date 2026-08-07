"use client";

import { useEffect } from "react";
import { markConversationRead } from "@/app/conversations/[id]/actions";

export function MarkConversationRead({ conversationId }: { conversationId: string }): null {
  useEffect(() => {
    markConversationRead(conversationId);
  }, [conversationId]);

  return null;
}

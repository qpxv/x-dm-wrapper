"use client";

import {
  createContext,
  useCallback,
  useContext,
  useOptimistic,
  useState,
  useTransition,
  type JSX,
  type ReactNode,
} from "react";
import type { Message, Note } from "@prisma/client";
import { getAiSuggestions, sendReply } from "@/app/conversations/[id]/actions";

interface ReplyContextValue {
  replyText: string;
  setReplyText: (text: string) => void;
  messages: Message[];
  notes: Note[];
  contact: { name: string; username: string };
  sendMessage: (text: string) => void;
  isSending: boolean;
  sendError: string | null;
  suggestions: string[] | null;
  isLoadingSuggestions: boolean;
  suggestionsError: string | null;
  fetchSuggestions: () => void;
  applySuggestion: (text: string) => void;
  dismissSuggestions: () => void;
}

const ReplyContext = createContext<ReplyContextValue | null>(null);

export function ReplyProvider({
  conversationId,
  initialMessages,
  notes,
  contact,
  children,
}: {
  conversationId: string;
  initialMessages: Message[];
  notes: Note[];
  contact: { name: string; username: string };
  children: ReactNode;
}): JSX.Element {
  const [replyText, setReplyText] = useState("");
  const [suggestions, setSuggestions] = useState<string[] | null>(null);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [isSending, startTransition] = useTransition();
  const [messages, addOptimisticMessage] = useOptimistic(
    initialMessages,
    (state, newMessage: Message) => [...state, newMessage]
  );

  const fetchSuggestions = useCallback(() => {
    setSuggestionsError(null);
    setIsLoadingSuggestions(true);
    getAiSuggestions(conversationId, replyText.trim() || undefined)
      .then((result) => setSuggestions(result))
      .catch(() => setSuggestionsError("Couldn't get suggestions — try again."))
      .finally(() => setIsLoadingSuggestions(false));
  }, [conversationId, replyText]);

  const applySuggestion = useCallback((text: string) => {
    setReplyText(text);
    setSuggestions(null);
  }, []);

  const dismissSuggestions = useCallback(() => setSuggestions(null), []);

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) {
        return;
      }

      setSendError(null);
      setReplyText("");

      const optimisticMessage: Message = {
        id: `optimistic-${crypto.randomUUID()}`,
        xEventId: `optimistic-${crypto.randomUUID()}`,
        conversationId,
        senderId: "",
        direction: "OUTBOUND",
        text: trimmed,
        mediaUrls: [],
        sentAt: new Date(),
        createdAt: new Date(),
      };

      startTransition(async () => {
        addOptimisticMessage(optimisticMessage);
        try {
          await sendReply(conversationId, trimmed);
        } catch {
          setSendError("Couldn't send — try again.");
        }
      });
    },
    [conversationId, addOptimisticMessage]
  );

  return (
    <ReplyContext.Provider
      value={{
        replyText,
        setReplyText,
        messages,
        notes,
        contact,
        sendMessage,
        isSending,
        sendError,
        suggestions,
        isLoadingSuggestions,
        suggestionsError,
        fetchSuggestions,
        applySuggestion,
        dismissSuggestions,
      }}
    >
      {children}
    </ReplyContext.Provider>
  );
}

export function useReply(): ReplyContextValue {
  const ctx = useContext(ReplyContext);
  if (!ctx) {
    throw new Error("useReply must be used within a ReplyProvider");
  }
  return ctx;
}

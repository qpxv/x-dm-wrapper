"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type JSX,
  type ReactNode,
} from "react";
import { getAiSuggestions } from "@/app/conversations/[id]/actions";

interface ReplyContextValue {
  replyText: string;
  setReplyText: (text: string) => void;
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
  children,
}: {
  conversationId: string;
  children: ReactNode;
}): JSX.Element {
  const [replyText, setReplyText] = useState("");
  const [suggestions, setSuggestions] = useState<string[] | null>(null);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);

  const fetchSuggestions = useCallback(() => {
    setSuggestionsError(null);
    setIsLoadingSuggestions(true);
    getAiSuggestions(conversationId)
      .then((result) => setSuggestions(result))
      .catch(() => setSuggestionsError("Couldn't get suggestions — try again."))
      .finally(() => setIsLoadingSuggestions(false));
  }, [conversationId]);

  const applySuggestion = useCallback((text: string) => {
    setReplyText(text);
    setSuggestions(null);
  }, []);

  const dismissSuggestions = useCallback(() => setSuggestions(null), []);

  return (
    <ReplyContext.Provider
      value={{
        replyText,
        setReplyText,
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

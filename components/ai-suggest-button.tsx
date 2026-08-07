"use client";

import type { JSX } from "react";
import { Sparkles, LoaderCircle } from "lucide-react";
import { useReply } from "@/components/reply-context";
import { Button } from "@/components/ui/button";

export function AiSuggestButton(): JSX.Element {
  const { fetchSuggestions, isLoadingSuggestions } = useReply();

  return (
    <Button
      variant="outline"
      size="icon"
      aria-label="Suggest replies"
      onClick={fetchSuggestions}
      disabled={isLoadingSuggestions}
    >
      {isLoadingSuggestions ? (
        <LoaderCircle className="size-4 animate-spin" />
      ) : (
        <Sparkles className="size-4" />
      )}
    </Button>
  );
}

"use client";

import type { JSX } from "react";
import { X } from "lucide-react";
import { useReply } from "@/components/reply-context";
import { Button } from "@/components/ui/button";

export function SuggestionsPanel(): JSX.Element | null {
  const { suggestions, suggestionsError, applySuggestion, dismissSuggestions } = useReply();

  if (!suggestions && !suggestionsError) {
    return null;
  }

  return (
    <div className="border-t bg-muted/50 px-4 py-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">Suggestions</h2>
        <Button variant="ghost" size="icon-sm" aria-label="Dismiss" onClick={dismissSuggestions}>
          <X className="size-4" />
        </Button>
      </div>

      {suggestionsError ? (
        <p className="text-sm text-destructive">{suggestionsError}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {suggestions?.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => applySuggestion(suggestion)}
              className="rounded-md border bg-background p-2 text-left text-sm hover:bg-muted"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

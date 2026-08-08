"use client";

import { useState, useTransition, type JSX, type KeyboardEvent } from "react";
import { Save } from "lucide-react";
import type { Note } from "@prisma/client";
import { addNote } from "@/app/conversations/[id]/actions";
import { AutoResizeTextarea } from "@/components/auto-resize-textarea";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

const NOTES_MAX_HEIGHT = 160;

export function NotesSection({
  conversationId,
  notes,
}: {
  conversationId: string;
  notes: Note[];
}): JSX.Element {
  const [showHistory, setShowHistory] = useState(false);
  const [content, setContent] = useState(notes[0]?.content ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const earlier = notes.slice(1);
  const trimmed = content.trim();
  const hasChanged = trimmed !== (notes[0]?.content ?? "");

  function handleSave(): void {
    setError(null);
    if (!trimmed || !hasChanged) {
      return;
    }

    startTransition(async () => {
      try {
        await addNote(conversationId, trimmed);
      } catch {
        setError("Couldn't save note — try again.");
      }
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSave();
    }
  }

  return (
    <section className="border-b px-4 py-3">
      {earlier.length > 0 ? (
        <div className="mb-2 flex justify-end">
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            {showHistory ? "Hide history" : `Show history (${earlier.length})`}
          </button>
        </div>
      ) : null}

      {showHistory ? (
        <ul className="mb-2 flex flex-col gap-2">
          {earlier.map((note) => (
            <li key={note.id} className="rounded-md bg-muted p-2 text-sm">
              <p className="whitespace-pre-wrap">{note.content}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {note.createdAt.toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex items-end gap-2">
        <AutoResizeTextarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a note..."
          maxHeight={NOTES_MAX_HEIGHT}
          className="text-sm"
        />
        <Button
          size="icon"
          className="size-9"
          aria-label="Save note"
          onClick={handleSave}
          disabled={isPending || !trimmed || !hasChanged}
        >
          {isPending ? <Spinner /> : <Save className="size-4" />}
        </Button>
      </div>
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
    </section>
  );
}

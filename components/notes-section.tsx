"use client";

import { useState, useTransition, type JSX } from "react";
import type { Note } from "@prisma/client";
import { addNote } from "@/app/conversations/[id]/actions";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export function NotesSection({
  conversationId,
  notes,
}: {
  conversationId: string;
  notes: Note[];
}): JSX.Element {
  const [showHistory, setShowHistory] = useState(false);
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [latest, ...earlier] = notes;

  function handleSubmit(): void {
    setError(null);
    const trimmed = content.trim();
    if (!trimmed) {
      return;
    }

    startTransition(async () => {
      try {
        await addNote(conversationId, trimmed);
        setContent("");
      } catch {
        setError("Couldn't save note — try again.");
      }
    });
  }

  return (
    <section className="border-b px-4 py-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">Notes</h2>
        {earlier.length > 0 ? (
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            {showHistory ? "Hide history" : `Show history (${earlier.length})`}
          </button>
        ) : null}
      </div>

      {latest ? (
        <div className="rounded-md bg-muted p-2 text-sm">
          <p className="whitespace-pre-wrap">{latest.content}</p>
          <p className="mt-1 text-xs text-muted-foreground">{latest.createdAt.toLocaleString()}</p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No notes yet.</p>
      )}

      {showHistory ? (
        <ul className="mt-2 flex flex-col gap-2">
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

      <div className="mt-2 flex gap-2">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Add a note..."
          rows={2}
          className="text-sm"
        />
        <Button size="sm" onClick={handleSubmit} disabled={isPending || !content.trim()}>
          Save
        </Button>
      </div>
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
    </section>
  );
}

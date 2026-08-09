import Anthropic from "@anthropic-ai/sdk";
import type { Message, Note } from "@prisma/client";
import { VOICE_SAMPLES } from "@/lib/constants/voice-samples";

const client = new Anthropic();

function formatMessages(messages: Pick<Message, "direction" | "text">[]): string {
  return messages
    .map((m) => `${m.direction === "OUTBOUND" ? "Me" : "Them"}: ${m.text}`)
    .join("\n");
}

function formatNotes(notes: Pick<Note, "content" | "createdAt">[]): string {
  if (notes.length === 0) {
    return "(no notes)";
  }
  return notes.map((n) => `[${n.createdAt.toISOString()}] ${n.content}`).join("\n");
}

interface SuggestionsResponse {
  suggestions: string[];
}

export async function generateSuggestions(
  messages: Pick<Message, "direction" | "text">[],
  notes: Pick<Note, "content" | "createdAt">[],
  hint?: string
): Promise<string[]> {
  const prompt = `Here is how I write — match this tone and style closely:
<voice_samples>
${VOICE_SAMPLES}
</voice_samples>

My private strategy notes for this specific lead, oldest first:
<notes>
${formatNotes(notes)}
</notes>

The conversation so far, oldest first:
<conversation>
${formatMessages(messages)}
</conversation>
${hint ? `\nI've started typing this in the reply box (not yet sent):\n<draft>\n${hint}\n</draft>\n` : ""}
Suggest exactly 3 distinct next messages I could send to continue this sales conversation, written in my voice. Keep them short, natural, and appropriate for a DM.${hint ? " If my draft above reads like a direction or instruction (e.g. what topic to steer toward), use it as guidance rather than repeating it verbatim. If it reads like the start or fragment of an actual message, continue/complete it naturally instead." : ""}`;

  const response = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 1024,
    thinking: { type: "disabled" },
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            suggestions: {
              type: "array",
              items: { type: "string" },
            },
          },
          required: ["suggestions"],
          additionalProperties: false,
        },
      },
    },
    messages: [{ role: "user", content: prompt }],
  });

  const block = response.content[0];
  if (block.type !== "text") {
    throw new Error("Unexpected response content type from suggestion generation");
  }

  const parsed: SuggestionsResponse = JSON.parse(block.text);
  if (parsed.suggestions.length !== 3) {
    throw new Error(`Expected 3 suggestions, got ${parsed.suggestions.length}`);
  }
  return parsed.suggestions;
}

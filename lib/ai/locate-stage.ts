import Anthropic from "@anthropic-ai/sdk";
import type { Message, Note } from "@prisma/client";
import { SALES_SOP } from "@/lib/constants/sales-sop";
import { formatMessages, formatNotes } from "@/lib/ai/suggest";

const client = new Anthropic();

interface LocateStageResponse {
  stage: string;
  summary: string;
}

export async function locateStage(
  messages: Pick<Message, "direction" | "text">[],
  notes: Pick<Note, "content" | "createdAt">[],
  profileDescription?: string | null
): Promise<LocateStageResponse> {
  const prompt = `Here is my SOP for how I want sales conversations to typically go:
<sales_sop>
${SALES_SOP}
</sales_sop>
${profileDescription ? `\nThe prospect's X bio, for extra context on who they are:\n<prospect_profile>\n${profileDescription}\n</prospect_profile>\n` : ""}
My private strategy notes for this specific lead, oldest first:
<notes>
${formatNotes(notes)}
</notes>

The conversation so far, oldest first:
<conversation>
${formatMessages(messages)}
</conversation>

Based on the SOP above, tell me where this conversation currently stands. Identify which
numbered step of the SOP we're effectively at right now (use "Before step 1" if rapport
hasn't started, or "Past step 10" if the pitch has already been made). Then give one
sentence grounded in what's actually been said, summarizing the status and what's still
missing before moving forward.`;

  const response = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 512,
    thinking: { type: "disabled" },
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            stage: { type: "string" },
            summary: { type: "string" },
          },
          required: ["stage", "summary"],
          additionalProperties: false,
        },
      },
    },
    messages: [{ role: "user", content: prompt }],
  });

  const block = response.content[0];
  if (block.type !== "text") {
    throw new Error("Unexpected response content type from stage location");
  }

  return JSON.parse(block.text) as LocateStageResponse;
}

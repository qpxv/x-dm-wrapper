import type { Message, Note } from "@prisma/client";

export function formatConversationForCopy(
  contact: { name: string; username: string },
  messages: Message[],
  notes: Note[]
): string {
  type Entry = { at: Date; line: string };

  const messageEntries: Entry[] = messages.map((m) => ({
    at: m.sentAt,
    line: `[${m.sentAt.toLocaleString()}] ${m.direction === "OUTBOUND" ? "Me" : contact.name}: ${m.text}`,
  }));

  const noteEntries: Entry[] = notes.map((n) => ({
    at: n.createdAt,
    line: `[${n.createdAt.toLocaleString()}] (My note) ${n.content}`,
  }));

  const timeline = [...messageEntries, ...noteEntries].sort(
    (a, b) => a.at.getTime() - b.at.getTime()
  );

  const header = `Conversation with ${contact.name} (@${contact.username})`;
  return [header, "", ...timeline.map((e) => e.line)].join("\n");
}

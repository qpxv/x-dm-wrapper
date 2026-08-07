import { getValidAccessToken } from "@/lib/x/oauth";
import { tryConsumeApiCall } from "@/lib/x/rate-limit";

export function buildConversationId(userIdA: string, userIdB: string): string {
  return BigInt(userIdA) < BigInt(userIdB) ? `${userIdA}-${userIdB}` : `${userIdB}-${userIdA}`;
}

export interface DmEvent {
  id: string;
  event_type: string;
  sender_id: string;
  text?: string;
  created_at: string;
  dm_conversation_id: string;
  attachments?: { media_keys?: string[] };
}

interface DmEventsResponse {
  data?: DmEvent[];
  meta?: { next_token?: string };
  includes?: { media?: Array<{ media_key: string; url?: string; preview_image_url?: string }> };
}

export interface DmEventsPage {
  events: DmEvent[];
  mediaByKey: Map<string, string>;
  nextToken: string | null;
}

const DM_EVENT_FIELDS = "id,event_type,sender_id,text,created_at,dm_conversation_id,attachments";
const EXPANSIONS = "attachments.media_keys";
const MEDIA_FIELDS = "media_key,url,preview_image_url";

// Rate-cap gated: returns null if the daily API call cap has been reached.
export async function fetchConversationEvents(
  participantId: string,
  paginationToken?: string
): Promise<DmEventsPage | null> {
  const allowed = await tryConsumeApiCall();
  if (!allowed) {
    return null;
  }

  const accessToken = await getValidAccessToken();
  const params = new URLSearchParams({
    max_results: "100",
    "dm_event.fields": DM_EVENT_FIELDS,
    expansions: EXPANSIONS,
    "media.fields": MEDIA_FIELDS,
  });
  if (paginationToken) {
    params.set("pagination_token", paginationToken);
  }

  const response = await fetch(
    `https://api.x.com/2/dm_conversations/with/${participantId}/dm_events?${params.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch dm_events: ${response.status} ${await response.text()}`);
  }

  const body: DmEventsResponse = await response.json();
  const mediaByKey = new Map<string, string>();
  for (const media of body.includes?.media ?? []) {
    const url = media.url ?? media.preview_image_url;
    if (url) {
      mediaByKey.set(media.media_key, url);
    }
  }

  return {
    events: body.data ?? [],
    mediaByKey,
    nextToken: body.meta?.next_token ?? null,
  };
}

import { getValidAccessToken } from "@/lib/x/oauth";
import { tryConsumeApiCall } from "@/lib/x/rate-limit";

export function buildConversationId(userIdA: string, userIdB: string): string {
  return BigInt(userIdA) < BigInt(userIdB) ? `${userIdA}-${userIdB}` : `${userIdB}-${userIdA}`;
}

export interface EmbeddedUser {
  id: string;
  username: string;
  name: string;
  profile_image_url?: string;
  description?: string;
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

// Cheapest possible check against the account-wide dm_events feed — X bills
// $0.01 per event object returned, so this always passes max_results=1
// explicitly (the API defaults to 100 if omitted). Used by the poll safety
// net (lib/x/poll.ts) to detect whether anything's new before paying for a
// full catch-up fetch.
export async function fetchLatestDmEventId(): Promise<string | null> {
  const allowed = await tryConsumeApiCall();
  if (!allowed) {
    return null;
  }

  const accessToken = await getValidAccessToken();
  const params = new URLSearchParams({ max_results: "1", "dm_event.fields": DM_EVENT_FIELDS });
  const response = await fetch(`https://api.x.com/2/dm_events?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch dm_events: ${response.status} ${await response.text()}`);
  }

  const body: DmEventsResponse = await response.json();
  return body.data?.[0]?.id ?? null;
}

interface DmEventsWithUsersResponse {
  data?: DmEvent[];
  meta?: { next_token?: string };
  includes?: { users?: EmbeddedUser[] };
}

export interface DmEventsWithUsersPage {
  events: DmEvent[];
  users: Map<string, EmbeddedUser>;
  nextToken: string | null;
}

// Account-wide dm_events feed (not scoped to one conversation), newest-first
// — used by the poll safety net's catch-up fetch. Rate-cap gated like every
// other billable X call; unlike fetchConversationEvents this one also pulls
// embedded sender profile data via expansions, needed to create brand-new
// Contacts the same way the webhook path does from its embedded users.
export async function fetchRecentDmEvents(maxResults: number): Promise<DmEventsWithUsersPage | null> {
  const allowed = await tryConsumeApiCall();
  if (!allowed) {
    return null;
  }

  const accessToken = await getValidAccessToken();
  const params = new URLSearchParams({
    max_results: String(maxResults),
    "dm_event.fields": DM_EVENT_FIELDS,
    expansions: "sender_id,participant_ids",
    "user.fields": "username,name,profile_image_url,description",
  });

  const response = await fetch(`https://api.x.com/2/dm_events?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch dm_events: ${response.status} ${await response.text()}`);
  }

  const body: DmEventsWithUsersResponse = await response.json();
  const users = new Map<string, EmbeddedUser>();
  for (const user of body.includes?.users ?? []) {
    users.set(user.id, user);
  }

  return {
    events: body.data ?? [],
    users,
    nextToken: body.meta?.next_token ?? null,
  };
}

interface UserResponse {
  data?: {
    username: string;
    name: string;
    profile_image_url?: string;
    description?: string;
  };
}

export interface UserProfile {
  username: string;
  name: string;
  profileImageUrl?: string;
  description?: string;
}

// Rate-cap gated: returns null if the daily API call cap has been reached.
export async function fetchUserProfile(userId: string): Promise<UserProfile | null> {
  const allowed = await tryConsumeApiCall();
  if (!allowed) {
    return null;
  }

  const accessToken = await getValidAccessToken();
  const params = new URLSearchParams({ "user.fields": "username,name,profile_image_url,description" });
  const response = await fetch(`https://api.x.com/2/users/${userId}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch user: ${response.status} ${await response.text()}`);
  }

  const body: UserResponse = await response.json();
  if (!body.data) {
    return null;
  }

  return {
    username: body.data.username,
    name: body.data.name,
    profileImageUrl: body.data.profile_image_url,
    description: body.data.description,
  };
}

interface SendMessageResponse {
  data?: { dm_conversation_id: string; dm_event_id: string };
}

// Rate-cap gated: throws if the daily API call cap has been reached, since a
// user-initiated send must surface an error rather than fail silently.
export async function sendDirectMessage(
  xConversationId: string,
  text: string
): Promise<{ dmEventId: string }> {
  const allowed = await tryConsumeApiCall();
  if (!allowed) {
    throw new Error("Daily X API call cap reached — cannot send right now.");
  }

  const accessToken = await getValidAccessToken();
  const response = await fetch(
    `https://api.x.com/2/dm_conversations/${xConversationId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to send message: ${response.status} ${await response.text()}`);
  }

  const body: SendMessageResponse = await response.json();
  if (!body.data?.dm_event_id) {
    throw new Error("Send message response missing dm_event_id");
  }

  return { dmEventId: body.data.dm_event_id };
}

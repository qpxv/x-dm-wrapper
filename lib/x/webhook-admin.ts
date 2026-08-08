interface WebhooksListResponse {
  data?: Array<{ id: string; url: string }>;
}

export interface CrcRevalidationResult {
  ok: boolean;
  detail?: string;
}

// Manually triggers X's CRC re-validation for our registered DM webhook
// (PUT /2/webhooks/:id). X automatically stops delivering webhook events
// entirely if a periodic CRC check ever fails, so calling this regularly
// keeps the subscription alive rather than waiting to notice it's dead.
// Webhook management endpoints use app-only bearer auth and aren't billed
// per-resource like the DM event reads, so this is free to run often.
export async function triggerWebhookCrcRevalidation(): Promise<CrcRevalidationResult> {
  const bearerToken = process.env.X_BEARER_TOKEN;
  const webhookUrl = process.env.X_WEBHOOK_URL;
  if (!bearerToken || !webhookUrl) {
    throw new Error("X_BEARER_TOKEN and X_WEBHOOK_URL must be set");
  }

  const listResponse = await fetch("https://api.x.com/2/webhooks", {
    headers: { Authorization: `Bearer ${bearerToken}` },
  });
  if (!listResponse.ok) {
    return { ok: false, detail: `List failed: ${listResponse.status}` };
  }
  const listBody = (await listResponse.json()) as WebhooksListResponse;

  const webhook = listBody.data?.find((entry) => entry.url === webhookUrl);
  if (!webhook) {
    return { ok: false, detail: "No matching webhook registered" };
  }

  const crcResponse = await fetch(`https://api.x.com/2/webhooks/${webhook.id}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${bearerToken}` },
  });
  if (!crcResponse.ok) {
    return { ok: false, detail: `CRC trigger failed: ${crcResponse.status} ${await crcResponse.text()}` };
  }

  return { ok: true };
}

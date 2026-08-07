import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { computeCrcResponseToken, verifyWebhookSignature } from "@/lib/x/webhook-auth";
import { ingestWebhookEvent, parseWebhookPayload } from "@/lib/x/ingest";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const crcToken = request.nextUrl.searchParams.get("crc_token");

  if (!crcToken) {
    return NextResponse.json({ error: "Missing crc_token" }, { status: 400 });
  }

  return NextResponse.json({ response_token: computeCrcResponseToken(crcToken) });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const rawBody = await request.text();
  const signature = request.headers.get("x-twitter-webhooks-signature");

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  const parsed = parseWebhookPayload(rawBody);
  if (!parsed) {
    console.warn("x webhook event: unrecognized payload shape", rawBody);
    return NextResponse.json({ ok: true });
  }

  // X invalidates a webhook after repeated failures, so a bug in ingestion
  // shouldn't turn into a failed delivery — log and still 200.
  try {
    await ingestWebhookEvent(parsed);
  } catch (error) {
    console.error("x webhook event: ingestion failed", error);
  }

  return NextResponse.json({ ok: true });
}

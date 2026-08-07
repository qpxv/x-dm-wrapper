import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { computeCrcResponseToken, verifyWebhookSignature } from "@/lib/x/webhook-auth";

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

  // Phase 2 scope: log identifying info only. Real ingestion (Contact/
  // Conversation/Message writes, backfill, dedupe) lands in Phase 3 and
  // will resolve the actual event data via the clean v2 dm_events read
  // endpoint rather than parsing this payload directly.
  console.log("x webhook event:", rawBody);

  return NextResponse.json({ ok: true });
}

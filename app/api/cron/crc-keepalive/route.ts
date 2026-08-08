import { NextRequest, NextResponse } from "next/server";
import { triggerWebhookCrcRevalidation } from "@/lib/x/webhook-admin";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await triggerWebhookCrcRevalidation();
  return NextResponse.json(result);
}

import { NextRequest, NextResponse } from "next/server";
import { pollMissedDmEvents } from "@/lib/x/poll";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await pollMissedDmEvents();
  return NextResponse.json(result);
}

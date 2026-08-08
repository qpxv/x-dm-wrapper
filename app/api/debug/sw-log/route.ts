import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  console.log("[sw-debug]", JSON.stringify(body));
  return NextResponse.json({ ok: true });
}

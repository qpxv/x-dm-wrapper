import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { completeAuthorization } from "@/lib/x/oauth";

const OAUTH_COOKIE = "x_oauth_pending";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const code = request.nextUrl.searchParams.get("code");
  const returnedState = request.nextUrl.searchParams.get("state");
  const pendingCookie = request.cookies.get(OAUTH_COOKIE)?.value;

  if (!code || !returnedState || !pendingCookie) {
    return NextResponse.json({ error: "Missing code, state, or pending session" }, { status: 400 });
  }

  const { state, codeVerifier } = JSON.parse(pendingCookie) as {
    state: string;
    codeVerifier: string;
  };

  if (returnedState !== state) {
    return NextResponse.json({ error: "State mismatch" }, { status: 400 });
  }

  await completeAuthorization(code, codeVerifier);

  const response = NextResponse.redirect(new URL("/?x_connected=1", request.url));
  response.cookies.delete(OAUTH_COOKIE);
  return response;
}

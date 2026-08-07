import { NextResponse } from "next/server";
import {
  buildAuthorizeUrl,
  generateCodeChallenge,
  generateCodeVerifier,
  generateState,
} from "@/lib/x/oauth";

const OAUTH_COOKIE = "x_oauth_pending";

export async function GET(): Promise<NextResponse> {
  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  const response = NextResponse.redirect(buildAuthorizeUrl(state, codeChallenge));

  response.cookies.set(OAUTH_COOKIE, JSON.stringify({ state, codeVerifier }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  return response;
}

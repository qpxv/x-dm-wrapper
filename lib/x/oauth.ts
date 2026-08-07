import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

const AUTHORIZE_URL = "https://x.com/i/oauth2/authorize";
const TOKEN_URL = "https://api.x.com/2/oauth2/token";
const SCOPES = "dm.read dm.write tweet.read users.read offline.access";

function base64UrlEncode(input: Buffer): string {
  return input.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function generateCodeVerifier(): string {
  return base64UrlEncode(randomBytes(32));
}

export function generateCodeChallenge(verifier: string): string {
  return base64UrlEncode(createHash("sha256").update(verifier).digest());
}

export function generateState(): string {
  return base64UrlEncode(randomBytes(16));
}

function getRedirectUri(): string {
  const baseUrl = process.env.BETTER_AUTH_URL;
  if (!baseUrl) {
    throw new Error("BETTER_AUTH_URL is not set");
  }
  return `${baseUrl}/api/x/callback`;
}

export function buildAuthorizeUrl(state: string, codeChallenge: string): string {
  const clientId = process.env.X_CLIENT_ID;
  if (!clientId) {
    throw new Error("X_CLIENT_ID is not set");
  }

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: getRedirectUri(),
    scope: SCOPES,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  return `${AUTHORIZE_URL}?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

function basicAuthHeader(): string {
  const clientId = process.env.X_CLIENT_ID;
  const clientSecret = process.env.X_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("X_CLIENT_ID / X_CLIENT_SECRET is not set");
  }
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
}

async function requestToken(body: URLSearchParams): Promise<TokenResponse> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: basicAuthHeader(),
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`X token request failed: ${response.status} ${await response.text()}`);
  }

  return response.json() as Promise<TokenResponse>;
}

async function exchangeCodeForTokens(code: string, codeVerifier: string): Promise<TokenResponse> {
  const clientId = process.env.X_CLIENT_ID;
  if (!clientId) {
    throw new Error("X_CLIENT_ID is not set");
  }

  return requestToken(
    new URLSearchParams({
      code,
      grant_type: "authorization_code",
      client_id: clientId,
      redirect_uri: getRedirectUri(),
      code_verifier: codeVerifier,
    })
  );
}

async function refreshTokens(refreshToken: string): Promise<TokenResponse> {
  const clientId = process.env.X_CLIENT_ID;
  if (!clientId) {
    throw new Error("X_CLIENT_ID is not set");
  }

  return requestToken(
    new URLSearchParams({
      refresh_token: refreshToken,
      grant_type: "refresh_token",
      client_id: clientId,
    })
  );
}

async function saveTokens(tokens: TokenResponse): Promise<void> {
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

  await prisma.$transaction([
    prisma.xOAuthToken.deleteMany(),
    prisma.xOAuthToken.create({
      data: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt,
      },
    }),
  ]);
}

export async function completeAuthorization(code: string, codeVerifier: string): Promise<void> {
  const tokens = await exchangeCodeForTokens(code, codeVerifier);
  await saveTokens(tokens);
}

const EXPIRY_BUFFER_MS = 60_000;

export async function getValidAccessToken(): Promise<string> {
  const record = await prisma.xOAuthToken.findFirst();
  if (!record) {
    throw new Error("X account is not connected yet — visit /api/x/authorize first");
  }

  if (record.expiresAt.getTime() - EXPIRY_BUFFER_MS > Date.now()) {
    return record.accessToken;
  }

  const tokens = await refreshTokens(record.refreshToken);
  await saveTokens(tokens);
  return tokens.access_token;
}

import { createHmac, timingSafeEqual } from "node:crypto";

function requireConsumerSecret(): string {
  const secret = process.env.X_CONSUMER_SECRET;
  if (!secret) {
    throw new Error("X_CONSUMER_SECRET is not set");
  }
  return secret;
}

function hmacSha256Base64(message: string): string {
  return createHmac("sha256", requireConsumerSecret()).update(message).digest("base64");
}

export function computeCrcResponseToken(crcToken: string): string {
  return `sha256=${hmacSha256Base64(crcToken)}`;
}

export function verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!signatureHeader) {
    return false;
  }

  const expected = computeCrcResponseToken(rawBody);
  const expectedBytes = Buffer.from(expected);
  const actualBytes = Buffer.from(signatureHeader);

  if (expectedBytes.length !== actualBytes.length) {
    return false;
  }

  return timingSafeEqual(expectedBytes, actualBytes);
}

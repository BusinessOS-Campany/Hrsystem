import { createHmac, randomBytes, timingSafeEqual } from "crypto";

export const SESSION_COOKIE = "hrsys_session";
export const SESSION_TTL_DAYS = 7;

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value) {
    throw new Error("AUTH_SECRET is not configured");
  }
  return value;
}

/** Random, URL-safe session token. Only its HMAC is persisted. */
export function generateToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function hashToken(token: string) {
  return createHmac("sha256", secret()).update(token).digest("hex");
}

export function safeEqual(a: string, b: string) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

export function sessionExpiry(days = SESSION_TTL_DAYS) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

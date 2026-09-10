/**
 * stripe-signature.ts — Verifies Stripe webhook signatures over exact raw bytes.
 *
 * Part of: Gull Drop
 * Created: 2026-09-10
 * Last modified: 2026-09-10 by Replit Agent
 *
 * Dependencies: Node crypto for HMAC-SHA256 and constant-time comparison.
 *
 * HUMAN REVIEW NOTES:
 * Never pass parsed or re-serialized JSON here; Stripe signs the original bytes.
 */
import crypto from "node:crypto";

export const STRIPE_SIGNATURE_MAX_AGE_SECONDS = 300;

/**
 * verifyStripeSignature — Authenticates a Stripe-Signature header.
 *
 * @param rawBody - Exact request bytes received from Stripe.
 * @param header - Full Stripe-Signature request header.
 * @param secret - Endpoint-specific signing secret.
 * @param now - Current Unix timestamp, injectable for deterministic tests.
 * @returns True only for a valid v1 HMAC inside the replay window.
 */
export function verifyStripeSignature(
  rawBody: Buffer,
  header: string,
  secret: string,
  now = Math.floor(Date.now() / 1000),
): boolean {
  const parts = new Map<string, string[]>();
  for (const part of header.split(",")) {
    const [key, value] = part.trim().split("=", 2);
    if (key && value) parts.set(key, [...(parts.get(key) ?? []), value]);
  }
  const timestamp = Number(parts.get("t")?.[0]);
  if (!Number.isInteger(timestamp) || Math.abs(now - timestamp) > STRIPE_SIGNATURE_MAX_AGE_SECONDS) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody.toString("utf8")}`)
    .digest("hex");
  return (parts.get("v1") ?? []).some((candidate) => {
    if (!/^[a-f0-9]{64}$/i.test(candidate)) return false;
    return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(candidate, "hex"));
  });
}
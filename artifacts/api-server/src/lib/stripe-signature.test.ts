/**
 * stripe-signature.test.ts — Deterministic Stripe signature security checks.
 *
 * Part of: Gull Drop
 * Created: 2026-09-10
 * Last modified: 2026-09-10 by Replit Agent
 *
 * Dependencies: Node test/assert/crypto and the pure signature verifier.
 */
import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { verifyStripeSignature } from "./stripe-signature.ts";

const body = Buffer.from('{"id":"evt_test","type":"checkout.session.completed"}');
const secret = "whsec_unit_test_only";
const now = 1_800_000_000;

/**
 * signedHeader — Produces a deterministic Stripe-compatible test header.
 *
 * @param timestamp - Unix timestamp included in the signed payload.
 * @returns A valid Stripe-Signature header for the fixture body.
 */
function signedHeader(timestamp: number): string {
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${body.toString("utf8")}`)
    .digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

test("accepts a valid signature over the exact raw body", () => {
  assert.equal(verifyStripeSignature(body, signedHeader(now), secret, now), true);
});

test("rejects a signature after the five-minute replay window", () => {
  assert.equal(verifyStripeSignature(body, signedHeader(now - 301), secret, now), false);
});

test("rejects tampered payloads and malformed signatures", () => {
  assert.equal(verifyStripeSignature(Buffer.from("{}"), signedHeader(now), secret, now), false);
  assert.equal(verifyStripeSignature(body, `t=${now},v1=not-hex`, secret, now), false);
});

test("accepts any valid v1 signature during Stripe secret rotation", () => {
  assert.equal(verifyStripeSignature(body, `t=${now},v1=${"0".repeat(64)},${signedHeader(now).split(",")[1]}`, secret, now), true);
});
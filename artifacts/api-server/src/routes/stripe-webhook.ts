/**
 * stripe-webhook.ts — Raw-body Stripe signature verification and fulfillment.
 * This route must be mounted before any JSON body parser.
 */
import express, { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db, pool } from "@workspace/db";
import { processStripeEvent } from "../lib/gull-drop";
import { verifyStripeSignature } from "../lib/stripe-signature";

const router: IRouter = Router();
/**
 * POST /api/stripe/webhook
 * Authentication: Stripe-Signature HMAC using STRIPE_WEBHOOK_SECRET.
 * Body: Raw Stripe Event JSON, limited to 1 MB.
 * Responses: 200 processed/duplicate, 400 invalid, 500 retryable failure, 503 unconfigured.
 */
router.post("/stripe/webhook", express.raw({ type: "application/json", limit: "1mb" }), async (req, res): Promise<void> => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    res.status(503).json({ error: "Webhook is not configured." });
    return;
  }
  const signature = req.get("stripe-signature");
  if (!signature || !Buffer.isBuffer(req.body) || !verifyStripeSignature(req.body, signature, secret)) {
    res.status(400).json({ error: "Invalid webhook signature." });
    return;
  }
  let event: { id?: string; type?: string; data?: { object?: Record<string, any> } };
  try {
    event = JSON.parse(req.body.toString("utf8"));
  } catch {
    res.status(400).json({ error: "Malformed webhook payload." });
    return;
  }
  if (!event.id || !event.type || !event.data?.object) {
    res.status(400).json({ error: "Malformed webhook event." });
    return;
  }
  try {
    await processStripeEvent(event.id, event.type, event.data.object);
    res.sendStatus(200);
  } catch {
    res.status(500).json({ error: "Webhook processing failed." });
  }
});

/**
 * GET /api/stripe/webhook/status
 * Authentication: None; returns booleans only and never exposes secret material.
 * Responses: 200 ready, 503 missing signing secret or unavailable database.
 */
router.get("/stripe/webhook/status", async (_req, res): Promise<void> => {
  const configured = Boolean(process.env.STRIPE_WEBHOOK_SECRET);
  let database = false;
  try {
    const readiness = await pool.query<{
      events: string | null;
      purchases: string | null;
      entitlements: string | null;
    }>(`select
      to_regclass('public.gull_drop_stripe_events')::text as events,
      to_regclass('public.gull_drop_purchases')::text as purchases,
      to_regclass('public.gull_drop_entitlements')::text as entitlements`);
    database = Boolean(
      readiness.rows[0]?.events
      && readiness.rows[0]?.purchases
      && readiness.rows[0]?.entitlements,
    );
  } catch {
    database = false;
  }
  res.status(configured && database ? 200 : 503).json({ configured, database });
});

export default router;
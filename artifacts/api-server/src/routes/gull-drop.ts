/**
 * gull-drop.ts — Secure one-time Stripe checkout and fulfillment verification.
 *
 * Part of: Gull Drop
 * Created: 2026-09-08
 * Last modified: 2026-09-08 by Replit Agent
 *
 * Dependencies: Stripe's HTTPS API and generated OpenAPI validators.
 *
 * HUMAN REVIEW NOTES:
 * The browser never receives Stripe credentials and cannot choose prices. Product
 * names and amounts are controlled here, while fulfillment requires Stripe's
 * payment_status to be "paid".
 */

import {
  CreateGullDropCheckoutBody,
  CreateGullDropCheckoutResponse,
  GetGullDropFulfillmentQueryParams,
  GetGullDropFulfillmentResponse,
} from "@workspace/api-zod";
import { Router, type IRouter } from "express";
import { activeEntitlements, GULL_DROP_OFFERS, isOffer, processStripeEvent, type GullDropOffer } from "../lib/gull-drop";
import { getAuth } from "@clerk/express";
import { db, gullDropProfiles, gullDropPurchases } from "@workspace/db";
import { and, eq, isNull, sql } from "drizzle-orm";

const router: IRouter = Router();
const STRIPE_API_BASE = "https://api.stripe.com";

const offers = GULL_DROP_OFFERS;

/**
 * Calls Stripe with an environment-specific server secret.
 *
 * Production exclusively uses STRIPE_SECRET_KEY, while local development uses
 * STRIPE_SANDBOX_SECRET_KEY so a preview can never create an accidental live charge.
 *
 * @param path - Stripe API path beginning with /v1.
 * @param init - Optional request method, headers, and body.
 * @returns The unmodified Stripe HTTP response for route-specific validation.
 * @throws When the required environment key has not been configured.
 */
async function stripeRequest(path: string, init: RequestInit = {}): Promise<Response> {
  const isProduction = process.env.NODE_ENV === "production";
  const secretKey = isProduction
    ? process.env.STRIPE_SECRET_KEY
    : process.env.STRIPE_SANDBOX_SECRET_KEY;

  if (!secretKey) {
    throw new Error(
      isProduction
        ? "STRIPE_SECRET_KEY is required in production."
        : "STRIPE_SANDBOX_SECRET_KEY is required in development.",
    );
  }

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${secretKey}`);
  return fetch(`${STRIPE_API_BASE}${path}`, { ...init, headers });
}

/** Creates Stripe Checkout with a server-controlled one-time price. */
router.post("/gull-drop/checkout", async (req, res): Promise<void> => {
  const parsed = CreateGullDropCheckoutBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { offer, origin, deviceId, source = "", creator = "" } = parsed.data;
  const product = offers[offer];
  const returnUrl = new URL(origin);
  if (returnUrl.host !== req.get("host")) {
    res.status(400).json({ error: "Checkout return URL must use the current game host." });
    return;
  }
  returnUrl.search = "";
  returnUrl.hash = "";
  const successUrl = new URL(returnUrl);
  successUrl.searchParams.set("checkout", "success");
  successUrl.searchParams.set("session_id", "{CHECKOUT_SESSION_ID}");
  const cancelUrl = new URL(returnUrl);
  cancelUrl.searchParams.set("checkout", "cancelled");

  const body = new URLSearchParams();
  body.set("mode", "payment");
  body.set("managed_payments[enabled]", "false");
  body.set("success_url", successUrl.toString());
  body.set("cancel_url", cancelUrl.toString());
  body.set("client_reference_id", deviceId);
  body.set("metadata[offer]", offer);
  body.set("metadata[source]", source);
  body.set("metadata[creator]", creator);
  const { userId } = getAuth(req);
  if (userId) body.set("metadata[userId]", userId);
  body.set("line_items[0][quantity]", "1");
  body.set("line_items[0][price_data][currency]", "usd");
  body.set("line_items[0][price_data][unit_amount]", String(product.amount));
  body.set("line_items[0][price_data][product_data][name]", product.name);
  body.set("line_items[0][price_data][product_data][metadata][gull_drop_offer]", offer);

  let stripeResponse: Response;
  try {
    stripeResponse = await stripeRequest("/v1/checkout/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
  } catch (error) {
    req.log.error({ error }, "Stripe credentials unavailable");
    res.status(503).json({ error: "Checkout is not configured for this environment." });
    return;
  }
  const session = (await stripeResponse.json()) as { url?: string; error?: { message?: string } };
  if (!stripeResponse.ok || !session.url) {
    req.log.error({ status: stripeResponse.status, error: session.error?.message }, "Stripe checkout creation failed");
    res.status(502).json({ error: "Checkout is temporarily unavailable." });
    return;
  }

  res.json(CreateGullDropCheckoutResponse.parse({ url: session.url }));
});

/** Verifies payment directly with Stripe before returning a cosmetic entitlement. */
router.get("/gull-drop/fulfillment", async (req, res): Promise<void> => {
  const parsed = GetGullDropFulfillmentQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  let stripeResponse: Response;
  try {
    stripeResponse = await stripeRequest(
      `/v1/checkout/sessions/${encodeURIComponent(parsed.data.sessionId)}`,
    );
  } catch (error) {
    req.log.error({ error }, "Stripe credentials unavailable");
    res.status(503).json({ error: "Purchase verification is not configured for this environment." });
    return;
  }
  const session = (await stripeResponse.json()) as {
    payment_status?: string;
    metadata?: { offer?: string; source?: string; creator?: string; userId?: string };
    amount_total?: number;
    currency?: string;
    mode?: string;
    client_reference_id?: string;
    payment_intent?: string | { id?: string; latest_charge?: string };
    error?: { message?: string };
  };
  if (!stripeResponse.ok) {
    req.log.warn({ status: stripeResponse.status }, "Stripe fulfillment lookup failed");
    res.status(400).json({ error: "Purchase could not be verified." });
    return;
  }

  const offer = session.metadata?.offer;
  if (!(offer && isOffer(offer))) {
    res.status(400).json({ error: "Purchase did not contain a valid Gull Drop offer." });
    return;
  }
  const verifiedOffer = offer as GullDropOffer;
  const validPurchase =
    session.payment_status === "paid"
    && session.client_reference_id === parsed.data.deviceId
    && session.amount_total === offers[verifiedOffer].amount
    && session.currency === "usd"
    && session.mode === "payment";
  if (validPurchase) {
    try {
      await processStripeEvent(`return:${parsed.data.sessionId}`, "checkout.session.completed", {
        id: parsed.data.sessionId,
        mode: session.mode,
        payment_status: session.payment_status,
        metadata: session.metadata,
        amount_total: session.amount_total,
        currency: session.currency,
        client_reference_id: session.client_reference_id,
        payment_intent: session.payment_intent,
      });
    } catch (error) {
      req.log.error({ error }, "Durable fulfillment failed");
      res.status(503).json({ error: "Purchase could not be durably recorded." });
      return;
    }
  }
  const entitlementIsActive = validPurchase
    ? (await activeEntitlements(parsed.data.deviceId)).includes(verifiedOffer)
    : false;
  const { userId } = getAuth(req);
  if (entitlementIsActive && userId) {
    await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"gull-drop-account:" + userId}))`);
      await tx.update(gullDropPurchases)
        .set({ userId, updatedAt: new Date() })
        .where(and(
          eq(gullDropPurchases.checkoutSessionId, parsed.data.sessionId),
          isNull(gullDropPurchases.userId),
        ));
      const paidOffers = await tx.selectDistinct({ offer: gullDropPurchases.offer })
        .from(gullDropPurchases)
        .where(and(eq(gullDropPurchases.userId, userId), eq(gullDropPurchases.status, "paid")));
      const entitlements = paidOffers.map(({ offer: paidOffer }) => paidOffer);
      await tx.insert(gullDropProfiles)
        .values({ userId, entitlements })
        .onConflictDoUpdate({ target: gullDropProfiles.userId, set: { entitlements, updatedAt: new Date() } });
    });
  }
  res.json(GetGullDropFulfillmentResponse.parse({
    // Stripe's payment_status remains "paid" after a refund. The durable
    // entitlement is authoritative so return navigation cannot restore access.
    paid: entitlementIsActive,
    offer: verifiedOffer,
    amount: session.amount_total ?? offers[verifiedOffer].amount,
    source: session.metadata?.source ?? "",
    creator: session.metadata?.creator ?? "",
  }));
});

/** Returns server-backed, active cosmetic entitlements for a device. */
router.get("/gull-drop/entitlements", async (req, res): Promise<void> => {
  const deviceId = typeof req.query.deviceId === "string" ? req.query.deviceId : "";
  const parsed = GetGullDropFulfillmentQueryParams.shape.deviceId.safeParse(deviceId);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid deviceId." });
    return;
  }
  try {
    res.json({ offers: await activeEntitlements(parsed.data) });
  } catch (error) {
    req.log.error({ error }, "Entitlement lookup failed");
    res.status(503).json({ error: "Entitlements are temporarily unavailable." });
  }
});

export default router;
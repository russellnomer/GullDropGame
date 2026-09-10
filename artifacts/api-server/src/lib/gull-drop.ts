/**
 * gull-drop.ts — Authoritative offers and durable Stripe fulfillment.
 * Payment state is never granted from browser input or an in-memory store.
 */
import { db, gullDropEntitlements, gullDropPurchases, gullDropStripeEvents } from "@workspace/db";
import { and, eq, inArray, ne, or, sql } from "drizzle-orm";

export const GULL_DROP_OFFERS = {
  messy: { amount: 299, name: "Gull Drop — Messy Pack" },
  patron: { amount: 699, name: "Gull Drop — Boardwalk Patron" },
  founder: { amount: 1499, name: "Gull Drop — Founder's Contraband" },
} as const;
export type GullDropOffer = keyof typeof GULL_DROP_OFFERS;
export const isOffer = (value: unknown): value is GullDropOffer =>
  typeof value === "string" && value in GULL_DROP_OFFERS;

type StripeObject = Record<string, unknown>;

/**
 * classifyStripeEvent — Maps subscribed Stripe event names to internal actions.
 *
 * @param type - Stripe event type.
 * @returns The ledger action to execute.
 */
export function classifyStripeEvent(type: string): "checkout" | "failure" | "refund" | "dispute" | "unknown" {
  if (type === "checkout.session.completed" || type === "checkout.session.async_payment_succeeded") return "checkout";
  if (type === "checkout.session.async_payment_failed") return "failure";
  if (type === "charge.refunded") return "refund";
  if (type === "charge.dispute.created") return "dispute";
  return "unknown";
}

/**
 * validatePaidCheckout — Validates all server-controlled fulfillment fields.
 *
 * @param object - Checkout Session delivered by Stripe.
 * @returns Validated purchase fields, or null when payment cannot be fulfilled.
 */
export function validatePaidCheckout(object: StripeObject): {
  checkoutSessionId: string;
  deviceId: string;
  offer: GullDropOffer;
  amount: number;
  currency: string;
  paymentIntentId: string | null;
  chargeId: string | null;
  source: string;
  creator: string;
} | null {
  const metadata = object.metadata && typeof object.metadata === "object"
    ? object.metadata as Record<string, unknown>
    : {};
  const offer = metadata.offer;
  const deviceId = object.client_reference_id;
  if (
    object.mode !== "payment"
    || object.payment_status !== "paid"
    || !isOffer(offer)
    || typeof object.id !== "string"
    || typeof deviceId !== "string"
    || !/^[A-Za-z0-9_-]{4,48}$/.test(deviceId)
    || object.amount_total !== GULL_DROP_OFFERS[offer].amount
    || object.currency !== "usd"
  ) {
    return null;
  }
  const paymentIntent = object.payment_intent;
  const paymentIntentId = typeof paymentIntent === "string"
    ? paymentIntent
    : paymentIntent && typeof paymentIntent === "object" && typeof (paymentIntent as Record<string, unknown>).id === "string"
      ? (paymentIntent as Record<string, string>).id
      : null;
  const chargeId = paymentIntent && typeof paymentIntent === "object"
    && typeof (paymentIntent as Record<string, unknown>).latest_charge === "string"
    ? (paymentIntent as Record<string, string>).latest_charge
    : null;
  return {
    checkoutSessionId: object.id,
    deviceId,
    offer,
    amount: object.amount_total as number,
    currency: object.currency,
    paymentIntentId,
    chargeId,
    source: typeof metadata.source === "string" ? metadata.source : "",
    creator: typeof metadata.creator === "string" ? metadata.creator : "",
  };
}

/**
 * stripeReferences — Extracts stable payment identifiers from a Stripe object.
 *
 * @param type - Stripe event type.
 * @param object - Event data object.
 * @returns IDs used to serialize and correlate out-of-order events.
 */
function stripeReferences(type: string, object: StripeObject): {
  objectId: string | null;
  paymentIntentId: string | null;
  chargeId: string | null;
} {
  const objectId = typeof object.id === "string" ? object.id : null;
  const paymentIntent = object.payment_intent;
  const paymentIntentId = typeof paymentIntent === "string"
    ? paymentIntent
    : paymentIntent && typeof paymentIntent === "object"
      && typeof (paymentIntent as Record<string, unknown>).id === "string"
      ? (paymentIntent as Record<string, string>).id
      : null;
  const checkoutChargeId = paymentIntent && typeof paymentIntent === "object"
    && typeof (paymentIntent as Record<string, unknown>).latest_charge === "string"
    ? (paymentIntent as Record<string, string>).latest_charge
    : null;
  const chargeId = type === "charge.dispute.created"
    ? typeof object.charge === "string" ? object.charge : null
    : type === "charge.refunded" ? objectId : checkoutChargeId;
  return { objectId, paymentIntentId, chargeId };
}

/** Applies one signed Stripe event atomically; duplicate event ids are no-ops. */
export async function processStripeEvent(id: string, type: string, object: StripeObject): Promise<boolean> {
  return db.transaction(async (tx) => {
    const references = stripeReferences(type, object);
    const terminal = type === "charge.dispute.created"
      || (type === "charge.refunded" && object.refunded === true);
    const inserted = await tx.insert(gullDropStripeEvents)
      .values({ id, type, ...references, terminal, status: "received" })
      .onConflictDoNothing()
      .returning({ id: gullDropStripeEvents.id });
    if (inserted.length === 0) return false;
    try {
      const kind = classifyStripeEvent(type);
      const lockReference = references.paymentIntentId ?? references.chargeId;
      if (lockReference) {
        // One payment's events must serialize so a refund racing Checkout can
        // never commit before the purchase exists and then be overwritten.
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${lockReference}))`);
      }
      if (kind === "checkout") {
        const purchase = validatePaidCheckout(object);
        if (!purchase) throw new Error("invalid checkout payment");
        const terminalEvents = await tx.select({ type: gullDropStripeEvents.type })
          .from(gullDropStripeEvents)
          .where(and(
            inArray(gullDropStripeEvents.type, ["charge.refunded", "charge.dispute.created"]),
            eq(gullDropStripeEvents.status, "processed"),
            eq(gullDropStripeEvents.terminal, true),
            or(
              purchase.paymentIntentId
                ? eq(gullDropStripeEvents.paymentIntentId, purchase.paymentIntentId)
                : sql`false`,
              purchase.chargeId
                ? eq(gullDropStripeEvents.chargeId, purchase.chargeId)
                : sql`false`,
            ),
          ));
        const terminalStatus = terminalEvents.some((event) => event.type === "charge.dispute.created")
          ? "disputed"
          : terminalEvents.length > 0 ? "refunded" : "paid";
        await tx.insert(gullDropPurchases).values({
          checkoutSessionId: purchase.checkoutSessionId,
          deviceId: purchase.deviceId,
          offer: purchase.offer,
          amount: purchase.amount,
          currency: purchase.currency,
          status: terminalStatus,
          paymentIntentId: purchase.paymentIntentId,
          chargeId: purchase.chargeId,
          source: purchase.source,
          creator: purchase.creator,
        }).onConflictDoUpdate({
          target: gullDropPurchases.checkoutSessionId,
          set: {
            // Terminal states are monotonic; a later Checkout event or browser
            // return cannot resurrect a refunded or disputed purchase.
            status: sql`case
              when ${gullDropPurchases.status} in ('refunded', 'disputed')
                then ${gullDropPurchases.status}
              else ${terminalStatus}
            end`,
            paymentIntentId: purchase.paymentIntentId,
            chargeId: purchase.chargeId,
            updatedAt: new Date(),
          },
        });
        const [storedPurchase] = await tx.select({ status: gullDropPurchases.status })
          .from(gullDropPurchases)
          .where(eq(gullDropPurchases.checkoutSessionId, purchase.checkoutSessionId))
          .limit(1);
        if (storedPurchase?.status === "paid") {
          await tx.insert(gullDropEntitlements).values({
            deviceId: purchase.deviceId,
            offer: purchase.offer,
            purchaseSessionId: purchase.checkoutSessionId,
            active: true,
          }).onConflictDoUpdate({
            target: [gullDropEntitlements.deviceId, gullDropEntitlements.offer],
            set: {
              active: true,
              purchaseSessionId: purchase.checkoutSessionId,
              revokedReason: null,
              revokedAt: null,
              updatedAt: new Date(),
            },
          });
        }
      } else if (kind === "failure") {
        if (typeof object.id === "string") {
          await tx.update(gullDropPurchases)
            .set({ status: "failed", updatedAt: new Date() })
            .where(eq(gullDropPurchases.checkoutSessionId, object.id));
        }
      } else if (kind === "refund" || kind === "dispute") {
        // Partial refunds retain cosmetic access; only a fully refunded charge revokes it.
        if (kind === "refund" && object.refunded !== true) {
          await tx.update(gullDropStripeEvents).set({ status: "processed", processedAt: new Date() }).where(eq(gullDropStripeEvents.id, id));
          return true;
        }
        const chargeId = kind === "dispute" && typeof object.charge === "string"
          ? object.charge
          : typeof object.id === "string" ? object.id : "";
        const paymentIntentId = typeof object.payment_intent === "string" ? object.payment_intent : undefined;
        const purchases = await tx.select({
          checkoutSessionId: gullDropPurchases.checkoutSessionId,
          deviceId: gullDropPurchases.deviceId,
          offer: gullDropPurchases.offer,
        })
          .from(gullDropPurchases).where(paymentIntentId
            ? inArray(gullDropPurchases.paymentIntentId, [paymentIntentId])
            : eq(gullDropPurchases.chargeId, chargeId));
        for (const purchase of purchases) {
          // Lock shared entitlement state before changing any of its purchases;
          // this makes simultaneous refunds deterministic.
          await tx.select({ deviceId: gullDropEntitlements.deviceId })
            .from(gullDropEntitlements)
            .where(and(
              eq(gullDropEntitlements.deviceId, purchase.deviceId),
              eq(gullDropEntitlements.offer, purchase.offer),
            ))
            .for("update");
          await tx.update(gullDropPurchases).set({
            status: kind === "refund" ? "refunded" : "disputed",
            refunded: kind === "refund",
            disputed: kind === "dispute",
            updatedAt: new Date(),
          }).where(eq(gullDropPurchases.checkoutSessionId, purchase.checkoutSessionId));
          const otherPaidPurchases = await tx.select({ id: gullDropPurchases.checkoutSessionId })
            .from(gullDropPurchases)
            .where(and(
              eq(gullDropPurchases.deviceId, purchase.deviceId),
              eq(gullDropPurchases.offer, purchase.offer),
              eq(gullDropPurchases.status, "paid"),
              ne(gullDropPurchases.checkoutSessionId, purchase.checkoutSessionId),
            ))
            .limit(1);
          if (otherPaidPurchases.length === 0) {
            await tx.update(gullDropEntitlements).set({
              active: false,
              revokedReason: kind,
              revokedAt: new Date(),
              updatedAt: new Date(),
            }).where(and(
              eq(gullDropEntitlements.deviceId, purchase.deviceId),
              eq(gullDropEntitlements.offer, purchase.offer),
            ));
          }
        }
      }
      await tx.update(gullDropStripeEvents).set({ status: "processed", processedAt: new Date() }).where(eq(gullDropStripeEvents.id, id));
      return true;
    } catch (error) {
      // Invalid signed business data is recorded for audit; database failures
      // abort the transaction and escape so Stripe retries delivery.
      await tx.update(gullDropStripeEvents)
        .set({ status: "failed", error: error instanceof Error ? error.message : "processing failed" })
        .where(eq(gullDropStripeEvents.id, id));
      return true;
    }
  });
}

export async function activeEntitlements(deviceId: string): Promise<GullDropOffer[]> {
  const rows = await db.select({ offer: gullDropEntitlements.offer }).from(gullDropEntitlements)
    .where(and(eq(gullDropEntitlements.deviceId, deviceId), eq(gullDropEntitlements.active, true)));
  return rows.map((row) => row.offer).filter(isOffer);
}

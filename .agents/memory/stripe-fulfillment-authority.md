---
name: Stripe fulfillment authority
description: Durable rules for Gull Drop payment fulfillment, event ordering, and revocation.
---

Stripe Checkout's `payment_status` confirms that money was collected, but it remains paid after later refunds or disputes. Never use that historical flag by itself to restore cosmetics.

**Why:** Stripe events can be duplicated, delayed, or delivered out of order. Browser return reconciliation can also happen after a terminal payment event. Access must not be restored after a refund or dispute.

**How to apply:** Treat full refunds and disputes as monotonic terminal events, serialize processing by payment reference, and return the current server-backed entitlement state to clients. Partial refunds are non-terminal.

Production payment schema changes use Replit's supported Publish schema-diff flow rather than startup DDL or custom production migration scripts.

**Why:** Replit binds and migrates the production database during Publish; application-managed production DDL is unsafe and unsupported.

**How to apply:** Update and validate the development schema first, then republish and confirm the schema step before enabling the production webhook.
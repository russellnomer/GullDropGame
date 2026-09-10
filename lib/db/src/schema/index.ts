// Export your models here. Add one export per file
// export * from "./posts";
//
// Each model/table should ideally be split into different files.
// Each model/table should define a Drizzle table, insert schema, and types:
//
//   import { pgTable, text, serial } from "drizzle-orm/pg-core";
//   import { createInsertSchema } from "drizzle-zod";
//   import { z } from "zod/v4";
//
//   export const postsTable = pgTable("posts", {
//     id: serial("id").primaryKey(),
//     title: text("title").notNull(),
//   });
//
//   export const insertPostSchema = createInsertSchema(postsTable).omit({ id: true });
//   export type InsertPost = z.infer<typeof insertPostSchema>;
//   export type Post = typeof postsTable.$inferSelect;

import { pgTable, text, integer, boolean, timestamp, index, primaryKey } from "drizzle-orm/pg-core";

/** Durable Stripe idempotency ledger. */
export const gullDropStripeEvents = pgTable("gull_drop_stripe_events", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  objectId: text("object_id"),
  paymentIntentId: text("payment_intent_id"),
  chargeId: text("charge_id"),
  terminal: boolean("terminal").notNull().default(false),
  status: text("status").notNull().default("received"),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
}, (table) => [
  index("gull_drop_events_payment_intent_idx").on(table.paymentIntentId),
  index("gull_drop_events_charge_idx").on(table.chargeId),
]);

/** One row per Checkout session, including failed/revoked payment state. */
export const gullDropPurchases = pgTable("gull_drop_purchases", {
  checkoutSessionId: text("checkout_session_id").primaryKey(),
  deviceId: text("device_id").notNull(),
  offer: text("offer").notNull(),
  amount: integer("amount").notNull(),
  currency: text("currency").notNull(),
  status: text("status").notNull().default("pending"),
  paymentIntentId: text("payment_intent_id"),
  chargeId: text("charge_id"),
  source: text("source").notNull().default(""),
  creator: text("creator").notNull().default(""),
  refunded: boolean("refunded").notNull().default(false),
  disputed: boolean("disputed").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("gull_drop_purchases_payment_intent_idx").on(table.paymentIntentId),
  index("gull_drop_purchases_charge_idx").on(table.chargeId),
]);

/** Active access is represented separately so revocation is durable and queryable. */
export const gullDropEntitlements = pgTable("gull_drop_entitlements", {
  deviceId: text("device_id").notNull(),
  offer: text("offer").notNull(),
  active: boolean("active").notNull().default(true),
  purchaseSessionId: text("purchase_session_id").notNull(),
  revokedReason: text("revoked_reason"),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  primaryKey({ columns: [table.deviceId, table.offer] }),
  index("gull_drop_entitlements_active_idx").on(table.deviceId, table.active),
]);

export * from "./gull-drop-profile.ts";
export * from "./gull-drop-leaderboard.ts";
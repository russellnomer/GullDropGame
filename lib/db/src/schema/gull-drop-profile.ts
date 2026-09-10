import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/** Persistent Gull Drop progression keyed by the authenticated Clerk user. */
export const gullDropProfiles = pgTable("gull_drop_profiles", {
  userId: text("user_id").primaryKey(),
  lifetime: integer("lifetime").notNull().default(0),
  highScore: integer("high_score").notNull().default(0),
  mafiaHighScore: integer("mafia_high_score").notNull().default(0),
  skin: text("skin").notNull().default("cream"),
  weapon: text("weapon").notNull().default("street"),
  entitlements: text("entitlements").array().notNull().default([]),
  loot: jsonb("loot").$type<Record<string, unknown>>().notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
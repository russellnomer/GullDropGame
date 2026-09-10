import { index, integer, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/** Accepted Gull Drop rounds used by the public Classic and Armed rankings. */
export const gullDropLeaderboard = pgTable("gull_drop_leaderboard", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  handle: text("handle").notNull(),
  mode: text("mode").notNull(),
  score: integer("score").notNull(),
  combo: integer("combo").notNull(),
  weapon: text("weapon"),
  durationMs: integer("duration_ms").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastSubmittedAt: timestamp("last_submitted_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("gull_drop_leaderboard_mode_score_idx").on(table.mode, table.score),
  uniqueIndex("gull_drop_leaderboard_user_mode_idx").on(table.userId, table.mode),
]);

export const insertGullDropLeaderboardSchema = createInsertSchema(gullDropLeaderboard).omit({
  id: true,
  createdAt: true,
  lastSubmittedAt: true,
});
export type InsertGullDropLeaderboard = z.infer<typeof insertGullDropLeaderboardSchema>;
export type GullDropLeaderboardRow = typeof gullDropLeaderboard.$inferSelect;
import { db, gullDropLeaderboard, pool } from "@workspace/db";
import { desc, eq } from "drizzle-orm";

/** Returns the globally ranked best row for each player in one channel. */
export async function listLeaderboardRows(mode: string) {
  return db
    .select({
      id: gullDropLeaderboard.id,
      handle: gullDropLeaderboard.handle,
      score: gullDropLeaderboard.score,
      combo: gullDropLeaderboard.combo,
      mode: gullDropLeaderboard.mode,
      weapon: gullDropLeaderboard.weapon,
      createdAt: gullDropLeaderboard.createdAt,
    })
    .from(gullDropLeaderboard)
    .where(eq(gullDropLeaderboard.mode, mode))
    .orderBy(desc(gullDropLeaderboard.score), gullDropLeaderboard.createdAt)
    .limit(25);
}

export type LeaderboardSubmission = {
  userId: string;
  handle: string;
  mode: string;
  score: number;
  combo: number;
  weapon: string | null;
  durationMs: number;
  submittedAt: Date;
};

/**
 * Atomically records a submission when the cooldown has elapsed while keeping
 * the greater of the stored and incoming scores. A null result is rate-limited.
 */
export async function submitLeaderboardBest(input: LeaderboardSubmission) {
  const result = await pool.query<{
    id: number;
    handle: string;
    mode: string;
    score: number;
    combo: number;
    weapon: string | null;
    created_at: Date;
  }>(`
    INSERT INTO gull_drop_leaderboard
      (user_id, handle, mode, score, combo, weapon, duration_ms, created_at, last_submitted_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
    ON CONFLICT (user_id, mode) DO UPDATE SET
      handle = CASE WHEN EXCLUDED.score > gull_drop_leaderboard.score THEN EXCLUDED.handle ELSE gull_drop_leaderboard.handle END,
      score = GREATEST(gull_drop_leaderboard.score, EXCLUDED.score),
      combo = CASE WHEN EXCLUDED.score > gull_drop_leaderboard.score THEN EXCLUDED.combo ELSE gull_drop_leaderboard.combo END,
      weapon = CASE WHEN EXCLUDED.score > gull_drop_leaderboard.score THEN EXCLUDED.weapon ELSE gull_drop_leaderboard.weapon END,
      duration_ms = CASE WHEN EXCLUDED.score > gull_drop_leaderboard.score THEN EXCLUDED.duration_ms ELSE gull_drop_leaderboard.duration_ms END,
      created_at = CASE WHEN EXCLUDED.score > gull_drop_leaderboard.score THEN EXCLUDED.created_at ELSE gull_drop_leaderboard.created_at END,
      last_submitted_at = EXCLUDED.last_submitted_at
    WHERE gull_drop_leaderboard.last_submitted_at <= EXCLUDED.last_submitted_at - INTERVAL '20 seconds'
    RETURNING id, handle, mode, score, combo, weapon, created_at
  `, [
    input.userId,
    input.handle,
    input.mode,
    input.score,
    input.combo,
    input.weapon,
    input.durationMs,
    input.submittedAt,
  ]);
  const row = result.rows[0];
  return row ? {
    id: row.id,
    handle: row.handle,
    mode: row.mode,
    score: row.score,
    combo: row.combo,
    weapon: row.weapon,
    createdAt: row.created_at,
  } : null;
}
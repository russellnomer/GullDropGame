import assert from "node:assert/strict";
import crypto from "node:crypto";
import test, { after } from "node:test";
import { db, gullDropLeaderboard, pool } from "@workspace/db";
import { eq } from "drizzle-orm";
import { listLeaderboardRows, submitLeaderboardBest } from "../lib/gull-drop-leaderboard.ts";

after(async () => {
  await pool.end();
});

test("keeps one best row per player before selecting the top 25", async (t) => {
  const mode = `ranking-test-${crypto.randomUUID()}`;
  t.after(async () => {
    await db.delete(gullDropLeaderboard).where(eq(gullDropLeaderboard.mode, mode));
  });

  const now = new Date();
  await db.insert(gullDropLeaderboard).values(
    Array.from({ length: 25 }, (_, index) => ({
      userId: `other-${index}-${mode}`,
      handle: `GULL-${String(index).padStart(4, "0")}`,
      mode,
      score: 1_000 - index,
      combo: 1,
      weapon: null,
      durationMs: 90_000,
      createdAt: now,
      lastSubmittedAt: now,
    })),
  );

  for (let index = 0; index < 300; index += 1) {
    await db.insert(gullDropLeaderboard).values({
      userId: `repeat-${mode}`,
      handle: "GULL-SPAM",
      mode,
      score: 2_000 + index,
      combo: 1,
      weapon: null,
      durationMs: 90_000,
      createdAt: now,
      lastSubmittedAt: now,
    }).onConflictDoUpdate({
      target: [gullDropLeaderboard.userId, gullDropLeaderboard.mode],
      set: { score: 2_000 + index, createdAt: now, lastSubmittedAt: now },
    });
  }

  const rows = await listLeaderboardRows(mode);
  assert.equal(rows.length, 25);
  assert.equal(new Set(rows.map((row) => row.handle)).size, 25);
  assert.equal(rows[0]?.handle, "GULL-SPAM");
  assert.equal(rows[0]?.score, 2_299);
  assert.ok(rows.every((row, index) => index === 0 || row.score <= rows[index - 1]!.score));
});

test("concurrent submissions cannot lower a best score or bypass cooldown", async (t) => {
  const mode = `concurrency-test-${crypto.randomUUID()}`;
  const userId = `player-${mode}`;
  t.after(async () => {
    await db.delete(gullDropLeaderboard).where(eq(gullDropLeaderboard.mode, mode));
  });

  const initialTime = new Date("2026-09-10T00:00:00.000Z");
  const initial = await submitLeaderboardBest({
    userId, handle: "GULL-BASE", mode, score: 1_000, combo: 1,
    weapon: null, durationMs: 90_000, submittedAt: initialTime,
  });
  assert.equal(initial?.score, 1_000);

  const concurrentTime = new Date(initialTime.getTime() + 21_000);
  const results = await Promise.all([
    submitLeaderboardBest({
      userId, handle: "GULL-HIGH", mode, score: 5_000, combo: 5,
      weapon: null, durationMs: 90_000, submittedAt: concurrentTime,
    }),
    submitLeaderboardBest({
      userId, handle: "GULL-LOW", mode, score: 500, combo: 1,
      weapon: null, durationMs: 90_000, submittedAt: concurrentTime,
    }),
  ]);

  const accepted = results.filter((result) => result !== null);
  assert.equal(accepted.length, 1);
  const [stored] = await db.select().from(gullDropLeaderboard)
    .where(eq(gullDropLeaderboard.userId, userId)).limit(1);
  assert.equal(stored?.score, Math.max(1_000, accepted[0]!.score));

  const blocked = await submitLeaderboardBest({
    userId, handle: "GULL-LATE", mode, score: 9_000, combo: 9,
    weapon: null, durationMs: 90_000, submittedAt: concurrentTime,
  });
  assert.equal(blocked, null);
});
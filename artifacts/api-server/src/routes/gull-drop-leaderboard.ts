import { getAuth } from "@clerk/express";
import {
  ListGullDropLeaderboardQueryParams,
  ListGullDropLeaderboardResponse,
  SubmitGullDropScoreBody,
  SubmitGullDropScoreResponse,
} from "@workspace/api-zod";
import { db, gullDropProfiles } from "@workspace/db";
import { eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { listLeaderboardRows, submitLeaderboardBest } from "../lib/gull-drop-leaderboard";

const router: IRouter = Router();
const ROUND_LIMIT_MS = 90_000;

const WEAPONS = {
  street: { need: 0 },
  messy: { need: 4_000, offer: "messy" },
  patron: { need: 12_000, offer: "patron" },
  fizz: { need: 20_000, offer: "founder" },
  founder: { need: 30_000, offer: "founder" },
} as const;

router.get("/gull-drop/leaderboard", async (req, res): Promise<void> => {
  const parsed = ListGullDropLeaderboardQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid leaderboard mode." });
    return;
  }

  const rows = await listLeaderboardRows(parsed.data.mode);

  res.json(ListGullDropLeaderboardResponse.parse(rows));
});

router.post("/gull-drop/leaderboard", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Sign in required to post a score." });
    return;
  }

  const parsed = SubmitGullDropScoreBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid round result." });
    return;
  }

  const round = parsed.data;
  if (round.durationMs > ROUND_LIMIT_MS + 5_000) {
    res.status(400).json({ error: "Round exceeded the time limit." });
    return;
  }

  const seconds = round.durationMs / 1_000;
  const maximumPlausibleScore = Math.floor(seconds * (round.mode === "classic" ? 35_000 : 12_000) + 5_000);
  const maximumPlausibleCombo = Math.floor(seconds * 7 + 5);
  if (round.score > maximumPlausibleScore || round.combo > maximumPlausibleCombo) {
    req.log.warn({ userId, mode: round.mode, score: round.score, combo: round.combo, durationMs: round.durationMs }, "Rejected implausible Gull Drop score");
    res.status(400).json({ error: "Round result was not plausible." });
    return;
  }

  if (round.mode === "classic" && round.weapon && round.weapon !== "street") {
    res.status(400).json({ error: "Classic scores cannot include upgraded weapon effects." });
    return;
  }

  const [profile] = await db
    .select({
      lifetime: gullDropProfiles.lifetime,
      entitlements: gullDropProfiles.entitlements,
    })
    .from(gullDropProfiles)
    .where(eq(gullDropProfiles.userId, userId))
    .limit(1);

  const weaponId = round.mode === "armed" ? (round.weapon ?? "street") : null;
  if (weaponId) {
    const weapon = WEAPONS[weaponId];
    const owned = (profile?.lifetime ?? 0) >= weapon.need
      || ("offer" in weapon && profile?.entitlements.includes(weapon.offer));
    if (!owned) {
      res.status(403).json({ error: "That weapon is not owned by this player." });
      return;
    }
  }

  const now = new Date();
  const entry = await submitLeaderboardBest({
    userId,
    handle: round.handle,
    score: round.score,
    combo: round.combo,
    mode: round.mode,
    weapon: weaponId,
    durationMs: round.durationMs,
    submittedAt: now,
  });
  if (!entry) {
    res.setHeader("Retry-After", "20");
    res.status(429).json({ error: "Too many scores submitted. Try again shortly." });
    return;
  }

  res.status(201).json(SubmitGullDropScoreResponse.parse(entry));
});

export default router;
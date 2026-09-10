import { getAuth } from "@clerk/express";
import { db, gullDropProfiles } from "@workspace/db";
import { eq } from "drizzle-orm";
import { Router, type IRouter } from "express";

const router: IRouter = Router();

/** Returns the signed-in player's server-owned progression and entitlements. */
router.get("/gull-drop/profile", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Sign in required." });
    return;
  }
  const [profile] = await db.select().from(gullDropProfiles).where(eq(gullDropProfiles.userId, userId)).limit(1);
  res.json(profile ?? null);
});

/** Saves non-purchase progression; paid entitlements are never accepted from the client. */
router.put("/gull-drop/profile", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Sign in required." });
    return;
  }
  const body = req.body as Record<string, unknown>;
  const safeInt = (value: unknown) => Math.max(0, Math.min(1_000_000_000, Math.floor(Number(value) || 0)));
  const safeId = (value: unknown, fallback: string) => typeof value === "string" && /^[a-z0-9-]{1,32}$/.test(value) ? value : fallback;
  const values = {
    lifetime: safeInt(body.lifetime),
    highScore: safeInt(body.highScore),
    mafiaHighScore: safeInt(body.mafiaHighScore),
    skin: safeId(body.skin, "cream"),
    weapon: safeId(body.weapon, "street"),
    loot: (typeof body.loot === "object" && body.loot !== null ? body.loot : {}) as Record<string, unknown>,
    updatedAt: new Date(),
  };
  const [profile] = await db.insert(gullDropProfiles)
    .values({ userId, ...values })
    .onConflictDoUpdate({ target: gullDropProfiles.userId, set: values })
    .returning();
  res.json(profile);
});

export default router;
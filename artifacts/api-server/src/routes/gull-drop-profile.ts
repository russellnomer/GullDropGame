import { getAuth } from "@clerk/express";
import { db, gullDropProfiles, gullDropPurchases } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";

const router: IRouter = Router();

/** Persists progression and derives paid ownership exclusively from account-linked purchases. */
export async function saveGullDropProfile(userId: string, body: Record<string, unknown>) {
  const safeInt = (value: unknown) => Math.max(0, Math.min(1_000_000_000, Math.floor(Number(value) || 0)));
  const safeId = (value: unknown, fallback: string) => typeof value === "string" && /^[a-z0-9-]{1,32}$/.test(value) ? value : fallback;
  const incomingLoot = (typeof body.loot === "object" && body.loot !== null ? body.loot : {}) as Record<string, unknown>;
  const modifiedAt = Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(Number(incomingLoot.modifiedAt) || 0)));
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"gull-drop-account:" + userId}))`);
    const activeAccountOffers = await tx.selectDistinct({ offer: gullDropPurchases.offer })
      .from(gullDropPurchases)
      .where(and(eq(gullDropPurchases.userId, userId), eq(gullDropPurchases.status, "paid")));
    const entitlements = Array.from(new Set(activeAccountOffers.map(({ offer }) => offer)));
    const values = {
      lifetime: safeInt(body.lifetime),
      highScore: safeInt(body.highScore),
      mafiaHighScore: safeInt(body.mafiaHighScore),
      skin: safeId(body.skin, "cream"),
      weapon: safeId(body.weapon, "street"),
      loot: { ...incomingLoot, modifiedAt },
      entitlements,
      updatedAt: new Date(),
    };
    const [profile] = await tx.insert(gullDropProfiles)
      .values({ userId, ...values })
      .onConflictDoUpdate({
        target: gullDropProfiles.userId,
        set: {
          lifetime: sql`greatest(${gullDropProfiles.lifetime}, excluded.lifetime)`,
          highScore: sql`greatest(${gullDropProfiles.highScore}, excluded.high_score)`,
          mafiaHighScore: sql`greatest(${gullDropProfiles.mafiaHighScore}, excluded.mafia_high_score)`,
          skin: sql`case when coalesce((excluded.loot ->> 'modifiedAt')::bigint, 0) >= coalesce((${gullDropProfiles.loot} ->> 'modifiedAt')::bigint, 0) then excluded.skin else ${gullDropProfiles.skin} end`,
          weapon: sql`case when coalesce((excluded.loot ->> 'modifiedAt')::bigint, 0) >= coalesce((${gullDropProfiles.loot} ->> 'modifiedAt')::bigint, 0) then excluded.weapon else ${gullDropProfiles.weapon} end`,
          loot: sql`case when coalesce((excluded.loot ->> 'modifiedAt')::bigint, 0) >= coalesce((${gullDropProfiles.loot} ->> 'modifiedAt')::bigint, 0) then ${gullDropProfiles.loot} || excluded.loot else ${gullDropProfiles.loot} end`,
          entitlements,
          updatedAt: values.updatedAt,
        },
      })
      .returning();
    return profile;
  });
}

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
  const profile = await saveGullDropProfile(userId, req.body as Record<string, unknown>);
  res.json(profile);
});

export default router;
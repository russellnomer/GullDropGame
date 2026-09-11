import { Show, SignInButton, SignUpButton, UserButton, useAuth } from "@clerk/react";
import { useEffect } from "react";
import { equippedSkin, equippedWeapon, loadSave, writeSave } from "@/game/progress";
import { useGame } from "@/game/store";

type CloudProfile = {
  lifetime: number;
  highScore: number;
  mafiaHighScore: number;
  skin: string;
  weapon: string;
  entitlements: Array<"messy" | "patron" | "founder">;
  loot: Record<string, unknown>;
};

function finiteRevision(value: unknown): number {
  const revision = Number(value);
  return Number.isFinite(revision) && revision >= 0 ? revision : 0;
}

/** Merges monotonic progress while resolving the whole local save by its latest revision. */
export function mergeCloudProfile(local: ReturnType<typeof loadSave>, state: ReturnType<typeof useGame.getState>, cloud: CloudProfile | null) {
  const cloudRevision = finiteRevision(cloud?.loot?.modifiedAt);
  // On equal revisions, keep the local copy. This covers a prior interrupted
  // upload where the revision reached the server but its matching loadout did not.
  const pristineLocal = local.modifiedAt === 0
    && local.lifetime === 0
    && local.skin === "cream"
    && local.weapon === "street"
    && !local.dailyDone;
  const localIsNewer = !pristineLocal && local.modifiedAt >= cloudRevision;
  return {
    lifetime: Math.max(local.lifetime, cloud?.lifetime ?? 0),
    highScore: Math.max(state.highScore, cloud?.highScore ?? 0),
    mafiaHighScore: Math.max(state.mafiaHighScore, cloud?.mafiaHighScore ?? 0),
    skin: localIsNewer ? local.skin : (cloud?.skin ?? local.skin),
    weapon: localIsNewer ? local.weapon : (cloud?.weapon ?? local.weapon),
    loot: localIsNewer
      ? { ...(cloud?.loot ?? {}), dailyDate: local.dailyDate, dailyDone: local.dailyDone, deviceId: local.deviceId, modifiedAt: local.modifiedAt }
      : { dailyDate: local.dailyDate, dailyDone: local.dailyDone, ...(cloud?.loot ?? {}), modifiedAt: cloudRevision },
    modifiedAt: Math.max(local.modifiedAt, cloudRevision),
  };
}

/** Synchronizes guest progression into the authenticated player's cloud profile. */
export function AccountSync() {
  const { isSignedIn } = useAuth();
  useEffect(() => {
    if (!isSignedIn) return;
    let active = true;
    let syncing = false;
    const sync = async () => {
      if (syncing) return;
      syncing = true;
      try {
        const response = await fetch("/api/gull-drop/profile", { credentials: "include" });
        if (!response.ok || !active) return;
        const cloud = await response.json() as CloudProfile | null;
        const local = loadSave();
        const state = useGame.getState();
        const merged = mergeCloudProfile(local, state, cloud);
        const saved = writeSave({
          lifetime: merged.lifetime,
          skin: merged.skin,
          weapon: merged.weapon,
          modifiedAt: merged.modifiedAt,
          entitlements: cloud?.entitlements ?? [],
          dailyDate: String(merged.loot.dailyDate ?? local.dailyDate),
          dailyDone: Boolean(merged.loot.dailyDone),
          patron: (cloud?.entitlements ?? []).includes("patron"),
        });
        try {
          localStorage.setItem("gull-drop-high-score", String(merged.highScore));
          localStorage.setItem("gull-drop-mafia-high-score", String(merged.mafiaHighScore));
        } catch {
          // In-memory recovery still works when private browsing denies storage.
        }
        state.patch({
          lifetime: saved.lifetime,
          highScore: merged.highScore,
          mafiaHighScore: merged.mafiaHighScore,
          entitlements: saved.entitlements,
          patron: saved.patron,
        });
        useGame.setState({
          skinId: equippedSkin(saved).id,
          weaponId: equippedWeapon(saved).id,
        });
        await fetch("/api/gull-drop/profile", {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(merged),
        });
      } catch {
        // A failed synchronization must leave the current local save untouched.
      } finally {
        syncing = false;
      }
    };
    void sync();
    const timer = window.setInterval(() => void sync(), 3000);
    return () => { active = false; window.clearInterval(timer); };
  }, [isSignedIn]);
  return null;
}

/** Compact account controls leave the game playable without requiring sign-in. */
export function AccountControls() {
  return (
    <div className="pointer-events-auto absolute top-[calc(0.75rem+env(safe-area-inset-top))] left-[calc(0.75rem+env(safe-area-inset-left))] z-40 flex items-center gap-2">
      <Show when="signed-out">
        <SignInButton mode="modal"><button type="button" className="h-10 rounded-md border border-border bg-surface/90 px-3 text-xs font-bold text-fg">Sign in</button></SignInButton>
        <SignUpButton mode="modal"><button type="button" className="h-10 rounded-md bg-accent px-3 text-xs font-bold text-accent-fg">Save progress</button></SignUpButton>
      </Show>
      <Show when="signed-in"><UserButton /></Show>
    </div>
  );
}
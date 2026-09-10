import { Show, SignInButton, SignUpButton, UserButton, useAuth } from "@clerk/react";
import { useEffect } from "react";
import { loadSave, writeSave } from "@/game/progress";
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

/** Synchronizes guest progression into the authenticated player's cloud profile. */
export function AccountSync() {
  const { isSignedIn } = useAuth();
  useEffect(() => {
    if (!isSignedIn) return;
    let active = true;
    const sync = async () => {
      const response = await fetch("/api/gull-drop/profile", { credentials: "include" });
      if (!response.ok || !active) return;
      const cloud = await response.json() as CloudProfile | null;
      const local = loadSave();
      const state = useGame.getState();
      const merged = {
        lifetime: Math.max(local.lifetime, cloud?.lifetime ?? 0),
        highScore: Math.max(state.highScore, cloud?.highScore ?? 0),
        mafiaHighScore: Math.max(state.mafiaHighScore, cloud?.mafiaHighScore ?? 0),
        skin: cloud?.skin ?? local.skin,
        weapon: cloud?.weapon ?? local.weapon,
        loot: { dailyDate: local.dailyDate, dailyDone: local.dailyDone, ...(cloud?.loot ?? {}) },
      };
      const saved = writeSave({ ...local, lifetime: merged.lifetime, skin: merged.skin, weapon: merged.weapon, entitlements: cloud?.entitlements ?? [] });
      state.patch({ lifetime: saved.lifetime, highScore: merged.highScore, mafiaHighScore: merged.mafiaHighScore, entitlements: saved.entitlements });
      state.setSkin(saved.skin);
      state.setWeapon(saved.weapon);
      await fetch("/api/gull-drop/profile", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(merged),
      });
    };
    void sync();
    const timer = window.setInterval(() => void sync(), 15000);
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
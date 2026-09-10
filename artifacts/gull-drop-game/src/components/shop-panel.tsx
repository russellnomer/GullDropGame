import { useEffect, useState } from "react";
import { ShoppingBag, Trophy, X } from "lucide-react";
import { currentGame } from "@/game/runtime";
import { listBlotter, postBlotter, startPatronCheckout, syncEntitlements, verifyPatronCheckout } from "@/game/server";
import { equippedWeapon, loadSave, nextRank, SKINS, skinUnlocked, WEAPONS, weaponUnlocked, writeSave } from "@/game/progress";
import { useGame } from "@/game/store";
import { track } from "@/game/analytics";
import type { OfferId } from "@/game/progress";

export function ShopAndBlotter() {
  const shop = useGame((s) => s.shopOpen);
  const blotter = useGame((s) => s.blotterOpen);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const q = new URLSearchParams(window.location.search);
    const sessionId = q.get("session_id");
    if (q.get("checkout") !== "success" || !sessionId) return;
    void verifyPatronCheckout(sessionId, loadSave().deviceId)
      .then((purchase) => {
        if (!purchase.paid) throw new Error("Payment has not completed.");
        writeSave({ entitlements: Array.from(new Set([...loadSave().entitlements, purchase.offer])) });
        useGame.getState().grantOffer(purchase.offer);
        currentGame()?.applyLook();
        useGame.getState().setShop(true);
        track("payment", {
          offer: purchase.offer,
          revenueCents: purchase.amount,
          source: purchase.source ?? "",
          creator: purchase.creator ?? "",
        });
      })
      .catch(() => track("payment_failed", { stage: "fulfillment" }))
      .finally(() => {
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete("checkout");
        cleanUrl.searchParams.delete("session_id");
        window.history.replaceState({}, "", cleanUrl);
      });
  }, []);
  useEffect(() => {
    void syncEntitlements(loadSave().deviceId).then((offers) => {
      useGame.getState().replaceEntitlements(offers);
      currentGame()?.applyLook();
    }).catch(() => undefined);
  }, []);
  if (shop) return <Shop />;
  if (blotter) return <Blotter />;
  return null;
}

function Shop() {
  const lifetime = useGame((s) => s.lifetime);
  const patron = useGame((s) => s.patron);
  const skinId = useGame((s) => s.skinId);
  const weaponId = useGame((s) => s.weaponId);
  const rank = useGame((s) => s.rankName);
  const save = loadSave();
  const nxt = nextRank(lifetime);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const entitlements = useGame((s) => s.entitlements);

  const handleCheckout = async (tierId: OfferId) => {
    setBusy(tierId);
    setNote(null);
    try {
      track("checkout_start", { offer: tierId });
      const deviceId = loadSave().deviceId;
      const challenge = useGame.getState().challenge;
      const r = await startPatronCheckout({
        data: {
          origin: `${window.location.origin}${window.location.pathname}`,
          offer: tierId,
          deviceId,
          source: challenge?.source ?? "shop",
          creator: challenge?.creator ?? "",
        },
      });
      if (r.url) {
        window.location.href = r.url;
      } else {
        setNote(r.error ?? "Checkout isn't connected yet.");
      }
    } catch (error) {
      track("payment_failed", { offer: tierId });
      setNote(error instanceof Error ? error.message : "Checkout failed.");
    } finally {
      setBusy(null);
    }
  };

  const tiers: Array<{ id: OfferId; name: string; price: string; desc: string }> = [
    { id: "messy", name: "Messy Pack", price: "$2.99", desc: "Cosmetics plus immediate Messy Repeater access. Otherwise earn it at 4,000 respect." },
    { id: "patron", name: "Boardwalk Patron", price: "$6.99", desc: "Gold cosmetics plus immediate Patron Enforcer access. Otherwise earn it at 12,000 respect." },
    { id: "founder", name: "Founder's Contraband", price: "$14.99", desc: "Founder cosmetics plus immediate Contraband Cannon access. Otherwise earn it at 30,000 respect." }
  ];

  return (
    <div className="pointer-events-auto absolute inset-0 z-30 flex items-end justify-center bg-bg/80 p-4 sm:items-center">
      <div className="max-h-[90dvh] w-full max-w-3xl overflow-y-auto rounded-xl border border-border bg-surface p-5 sm:p-8 shadow-2xl">
        <div className="flex items-start justify-between gap-3 mb-6">
          <div>
            <p className="text-xs tracking-[0.2em] text-accent uppercase font-bold">Gull Shop</p>
            <h2 className="font-display text-4xl text-fg mt-1">Boardwalk Merch</h2>
            <p className="mt-2 text-sm text-muted">
              {rank} · {lifetime.toLocaleString()} lifetime respect
            </p>
          </div>
          <button type="button" className="flex size-10 items-center justify-center rounded-md border border-border text-fg hover:bg-surface-2 transition-colors" onClick={() => useGame.getState().setShop(false)} aria-label="Close shop">
            <X className="size-4" />
          </button>
        </div>

        <div className="mb-8 rounded-lg border-2 border-accent/40 bg-accent/5 p-4 sm:p-5 flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
          <div className="flex-1">
            <h3 className="font-display text-xl text-fg uppercase tracking-wide">Earn It or Get It Early</h3>
            <p className="mt-2 text-sm text-fg/80 leading-relaxed">
              Every weapon can be earned through lifetime respect. One-time packs unlock matching gear immediately and include cosmetics. Upgraded gear competes only on the separate Armed blotter; Classic Gull rankings stay power-neutral. No subscriptions. Stripe confirms access after payment.
            </p>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-4 mb-6">
          {tiers.map(t => (
            <div key={t.id} className={`rounded-xl border ${t.id === 'patron' ? 'border-accent bg-surface-2' : 'border-border bg-surface-2'} p-5 flex flex-col relative overflow-hidden`}>
              {t.id === 'founder' && (
                <div className="absolute -right-8 top-4 bg-[#c45c4a] text-white text-[10px] font-bold uppercase tracking-wider py-1 px-8 rotate-45">
                  Launch edition
                </div>
              )}
              <h4 className="font-display text-2xl text-fg">{t.name}</h4>
              <p className="font-display text-xl text-accent mt-1">{t.price}</p>
              <p className="mt-3 text-sm text-muted flex-1">{t.desc}</p>
              
              <button 
                type="button" 
                disabled={!!busy || entitlements.includes(t.id)}
                className={`mt-5 flex h-12 w-full items-center justify-center rounded-md font-bold uppercase tracking-wider text-sm transition-transform active:scale-[0.98] disabled:opacity-50 ${t.id === 'patron' ? 'bg-accent text-accent-fg hover:bg-accent/90' : 'bg-fg text-bg hover:bg-fg/90'}`}
                onClick={() => handleCheckout(t.id)}
              >
                {busy === t.id ? "Loading..." : entitlements.includes(t.id) ? "Owned" : "Purchase"}
              </button>
            </div>
          ))}
        </div>

        {note && <p className="mb-6 text-center text-sm text-accent font-medium">{note}</p>}

        <div className="mb-8 border-t border-border pt-6">
          <h3 className="font-display text-xl text-fg uppercase tracking-wide">Your Arsenal</h3>
          <p className="mb-4 mt-1 text-sm text-muted">Earn weapons with respect, or unlock them sooner through the matching pack.</p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {WEAPONS.map((weapon) => {
              const currentSave = { ...save, lifetime, entitlements, weapon: weaponId };
              const open = weaponUnlocked(weapon, currentSave);
              const equipped = weaponId === weapon.id;
              const remaining = Math.max(0, weapon.need - lifetime);
              return (
                <li key={weapon.id} className={`rounded-md border p-4 ${equipped ? "border-accent bg-accent/5" : "border-border bg-surface-2"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-fg">{weapon.name}</p>
                      <p className="mt-1 text-xs text-muted">{weapon.blurb}</p>
                      <p className="mt-2 text-xs text-accent">Power {weapon.damage} · {Math.round(1 / weapon.fireDelay * 10) / 10} shots/sec</p>
                    </div>
                    <button
                      type="button"
                      disabled={!open || equipped}
                      className="h-10 rounded-md border border-border px-3 text-xs font-bold uppercase text-fg disabled:opacity-40"
                      onClick={() => {
                        useGame.getState().setWeapon(weapon.id);
                        currentGame()?.applyLook();
                      }}
                    >
                      {equipped ? "Equipped" : open ? "Equip" : "Locked"}
                    </button>
                  </div>
                  {!open && (
                    <p className="mt-3 border-t border-border pt-2 text-xs text-muted">
                      Earn {remaining.toLocaleString()} more respect{weapon.offer ? ` or buy the ${weapon.offer} pack now` : ""}.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        <div className="border-t border-border pt-6">
          <h3 className="font-display text-xl text-fg mb-4 uppercase tracking-wide">Your Wardrobe</h3>
          <ul className="grid sm:grid-cols-2 gap-3">
            {SKINS.map((s) => {
              const open = skinUnlocked(s, { ...save, lifetime, patron, skin: skinId });
              const on = skinId === s.id;
              return (
                <li key={s.id} className={`flex items-center justify-between gap-3 rounded-md border px-4 py-3 ${on ? 'border-accent bg-accent/5' : 'border-border bg-surface-2'}`}>
                  <div>
                    <p className="text-sm font-bold text-fg">{s.name}</p>
                    <p className="text-xs text-muted mt-0.5">{s.patron ? "Patron only" : s.need === 0 ? "Starter" : `Unlock at ${s.need.toLocaleString()} respect`}</p>
                  </div>
                  <button
                    type="button"
                    disabled={!open || on}
                    className={`h-10 rounded-md border px-4 text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-40 disabled:hover:bg-transparent ${on ? 'border-accent text-accent bg-accent/10' : 'border-border text-fg hover:bg-surface'}`}
                    onClick={() => {
                      useGame.getState().setSkin(s.id);
                      currentGame()?.applyLook();
                    }}
                  >
                    {on ? "Equipped" : open ? "Wear" : "Locked"}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Blotter() {
  const currentMode = useGame((s) => s.mode);
  const [channel, setChannel] = useState<"classic" | "armed">(currentMode === "mafia" ? "armed" : "classic");
  const [rows, setRows] = useState<Array<{ handle: string; score: number; combo: number; weapon?: string | null }>>([]);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    const refresh = () => {
      setErr(null);
      void listBlotter(channel)
        .then((next) => { if (active) setRows(next); })
        .catch(() => { if (active) setErr("Blotter is warming up."); });
    };
    refresh();
    const timer = window.setInterval(refresh, 30_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [channel]);
  return (
    <div className="pointer-events-auto absolute inset-0 z-30 flex items-end justify-center bg-bg/70 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs tracking-[0.2em] text-accent uppercase">World blotter</p>
            <h2 className="font-display text-3xl text-fg">Most wanted</h2>
          </div>
          <button type="button" className="flex size-10 items-center justify-center rounded-md border border-border text-fg" onClick={() => useGame.getState().setBlotter(false)} aria-label="Close blotter">
            <X className="size-4" />
          </button>
        </div>
        {err && <p className="mt-3 text-sm text-muted">{err}</p>}
        <div className="mt-4 grid grid-cols-2 rounded-md border border-border p-1">
          {(["classic", "armed"] as const).map((item) => (
            <button key={item} type="button" className={`h-10 rounded text-xs font-bold uppercase ${channel === item ? "bg-accent text-accent-fg" : "text-muted"}`} onClick={() => setChannel(item)}>
              {item}
            </button>
          ))}
        </div>
        <ol className="mt-4 space-y-2">
          {rows.map((r, i) => (
            <li key={`${r.handle}-${i}`} className="flex items-baseline justify-between rounded-md border border-border bg-surface-2 px-3 py-2">
              <span className="text-sm text-muted">
                {i + 1}. {r.handle}
              </span>
              <span className="text-right">
                <span className="block font-display tabular-nums text-fg">{r.score.toLocaleString()}</span>
                {channel === "armed" && r.weapon && <span className="block text-[10px] uppercase text-muted">{r.weapon}</span>}
              </span>
            </li>
          ))}
          {rows.length === 0 && !err && <p className="text-sm text-muted">Nobody's confessed yet. Clock out and post yours.</p>}
        </ol>
      </div>
    </div>
  );
}

export function MenuExtras() {
  return (
    <div className="mt-3 flex gap-3">
      <button type="button" className="flex h-11 flex-1 items-center justify-center gap-2 rounded-md border border-border bg-surface-2 text-sm text-fg" onClick={() => useGame.getState().setShop(true)}>
        <ShoppingBag className="size-4" />
        Shop
      </button>
      <button type="button" className="flex h-11 flex-1 items-center justify-center gap-2 rounded-md border border-border bg-surface-2 text-sm text-fg" onClick={() => useGame.getState().setBlotter(true)}>
        <Trophy className="size-4" />
        Blotter
      </button>
    </div>
  );
}

export function postScoreToBlotter() {
  const g = useGame.getState();
  const score = g.mode === "mafia" ? g.mafiaStats.banked : g.score;
  if (score < 1) return;
  void postBlotter({
    data: {
      handle: loadSave().handle,
      score,
      combo: g.mode === "mafia" ? g.mafiaStats.maxChain : g.stats.comboMax,
      mode: g.mode === "mafia" ? "armed" : "classic",
      weapon: g.mode === "mafia" ? equippedWeapon(loadSave()).id : undefined,
      durationMs: Math.max(5_000, Math.min(95_000, Math.round(g.elapsed * 1_000))),
    },
  }).catch(() => undefined);
}

export function shareScore() {
  const g = useGame.getState();
  const text = `I scored ${g.score.toLocaleString()} respect in GULL DROP as ${g.rankName}. The squirrels started it.`;
  const url = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

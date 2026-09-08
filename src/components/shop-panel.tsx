import { useEffect, useState } from "react";
import { ShoppingBag, Trophy, X } from "lucide-react";
import { currentGame } from "@/game/runtime";
import { listBlotter, postBlotter, startPatronCheckout } from "@/game/server";
import { loadSave, nextRank, SKINS, skinUnlocked } from "@/game/progress";
import { useGame } from "@/game/store";

export function ShopAndBlotter() {
  const shop = useGame((s) => s.shopOpen);
  const blotter = useGame((s) => s.blotterOpen);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const q = new URLSearchParams(window.location.search);
    if (q.get("patron") === "1") {
      useGame.getState().grantPatron();
      currentGame()?.applyLook();
      useGame.getState().setShop(true);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);
  if (shop) return <Shop />;
  if (blotter) return <Blotter />;
  return null;
}

function Shop() {
  const lifetime = useGame((s) => s.lifetime);
  const patron = useGame((s) => s.patron);
  const skinId = useGame((s) => s.skinId);
  const rank = useGame((s) => s.rankName);
  const save = loadSave();
  const nxt = nextRank(lifetime);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function buy() {
    setBusy(true);
    setNote(null);
    try {
      const r = await startPatronCheckout({ data: { origin: window.location.origin } });
      if (r.url) {
        window.location.href = r.url;
        return;
      }
      if (r.preview) {
        useGame.getState().grantPatron();
        currentGame()?.applyLook();
        setNote("Preview unlock. On the published game this charges $4.99 via Stripe.");
      } else {
        setNote(r.error ?? "Checkout isn't connected yet.");
      }
    } catch {
      setNote("Checkout failed. Try again after publish with Stripe keys.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pointer-events-auto absolute inset-0 z-30 flex items-end justify-center bg-bg/70 p-4 sm:items-center">
      <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-surface p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs tracking-[0.2em] text-accent uppercase">Gull shop</p>
            <h2 className="font-display text-3xl text-fg">Boardwalk merch</h2>
            <p className="mt-1 text-sm text-muted">
              {rank} · {lifetime.toLocaleString()} lifetime respect
              {nxt ? ` · next ${nxt.name} at ${nxt.need.toLocaleString()}` : ""}
            </p>
          </div>
          <button type="button" className="flex size-10 items-center justify-center rounded-md border border-border text-fg" onClick={() => useGame.getState().setShop(false)} aria-label="Close shop">
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-4 rounded-lg border border-accent/40 bg-surface-2 p-4">
          <p className="font-display text-xl text-fg">Boardwalk Patron · $4.99</p>
          <p className="mt-1 text-sm text-muted">Gold plumage, 12-gull flock, faster swarm, 1.5× respect. Pays for the fry tax.</p>
          {patron ? (
            <p className="mt-3 text-sm text-accent">You're in the family.</p>
          ) : (
            <button type="button" disabled={busy} className="mt-3 flex h-11 w-full items-center justify-center rounded-md bg-fg text-bg disabled:opacity-60" onClick={() => void buy()}>
              {busy ? "Opening checkout…" : "Become Patron"}
            </button>
          )}
          {note && <p className="mt-2 text-xs text-muted">{note}</p>}
        </div>

        <ul className="mt-4 space-y-2">
          {SKINS.map((s) => {
            const open = skinUnlocked(s, { ...save, lifetime, patron, skin: skinId });
            const on = skinId === s.id;
            return (
              <li key={s.id} className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface-2 px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-fg">{s.name}</p>
                  <p className="text-xs text-muted">{s.patron ? "Patron only" : s.need === 0 ? "Starter" : `Unlock at ${s.need.toLocaleString()} respect`}</p>
                </div>
                <button
                  type="button"
                  disabled={!open || on}
                  className="h-9 rounded-md border border-border px-3 text-xs text-fg disabled:opacity-40"
                  onClick={() => {
                    useGame.getState().setSkin(s.id);
                    currentGame()?.applyLook();
                  }}
                >
                  {on ? "On" : open ? "Wear" : "Locked"}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function Blotter() {
  const [rows, setRows] = useState<Array<{ handle: string; score: number; combo: number }>>([]);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    void listBlotter()
      .then(setRows)
      .catch(() => setErr("Blotter is warming up."));
  }, []);
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
        <ol className="mt-4 space-y-2">
          {rows.map((r, i) => (
            <li key={`${r.handle}-${i}`} className="flex items-baseline justify-between rounded-md border border-border bg-surface-2 px-3 py-2">
              <span className="text-sm text-muted">
                {i + 1}. {r.handle}
              </span>
              <span className="font-display tabular-nums text-fg">{r.score.toLocaleString()}</span>
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
  if (g.score < 1) return;
  void postBlotter({ data: { handle: loadSave().handle, score: g.score, combo: g.stats.comboMax } }).catch(() => undefined);
}

export function shareScore() {
  const g = useGame.getState();
  const text = `I scored ${g.score.toLocaleString()} respect in GULL DROP as ${g.rankName}. The squirrels started it.`;
  const url = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}


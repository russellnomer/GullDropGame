import { useRef, useEffect, useMemo, useState, type PointerEvent as PE, type ReactNode } from "react";
import { Bird, ChevronDown, ChevronUp, Music, Pause, Play, RotateCcw, Share2, ShoppingBag, Squirrel, Star, Volume1, Volume2, VolumeX, Copy, Download } from "lucide-react";
import { currentGame } from "@/game/runtime";
import { playSoundCheck, unlockAudio, type SoundCheckResult } from "@/game/audio";
import { mountRadio, skipRadio, prevRadio, TRACKS, RELEASES_URL, onNowPlaying, type Track } from "@/game/radio";
import { recentFaults, onFaults, installFaults, type Fault } from "@/game/log";
import { useGame } from "@/game/store";
import { challengeDare, challengeUrl, createChallenge } from "@/game/challenge";
import { track } from "@/game/analytics";
import { MenuExtras, ShopAndBlotter, postScoreToBlotter, shareScore } from "@/components/shop-panel";
import { AccountControls, AccountSync } from "@/components/account-sync";

function fmt(t: number) {
  const s = Math.max(0, Math.ceil(t));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

export function GameOverlay() {
  const phase = useGame((s) => s.phase);
  const howTo = useGame((s) => s.howTo);
  const locked = useGame((s) => s.locked);
  const muted = useGame((s) => s.muted);
  const radioOff = useGame((s) => s.radioOff);

  return (
    <div className="pointer-events-none absolute inset-0 font-sans">
      <AccountSync />
      <AccountControls />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse at center, transparent 48%, rgba(11,20,24,0.42) 100%)" }}
        aria-hidden
      />
      {phase === "menu" && <Menu />}
      {phase === "playing" && <Hud />}
      {phase === "playing" && !locked && <ClickCatch />}
      {phase === "paused" && <PauseMenu />}
      {phase === "gameover" && <GameOver />}
      {howTo && phase === "menu" && <HowTo />}
      <ShopAndBlotter />
      {phase === "playing" && <TouchLayer />}
      <RadioDock />
      <FaultTape />
      <button
        type="button"
        className="pointer-events-auto absolute top-3 right-16 z-20 flex size-11 items-center justify-center rounded-md border border-border bg-surface/80 text-fg"
        onClick={() => useGame.getState().toggleRadio()}
        aria-label={radioOff ? "Turn music on" : "Turn music off"}
        title={radioOff ? "Music off" : "Music on"}
      >
        <Music className={`size-5 ${radioOff ? "opacity-35" : ""}`} />
      </button>
      <button
        type="button"
        className="pointer-events-auto absolute top-3 right-3 z-20 flex size-11 items-center justify-center rounded-md border border-border bg-surface/80 text-fg"
        onClick={() => {
          unlockAudio();
          useGame.getState().toggleMute();
        }}
        aria-label={muted ? "Unmute effects" : "Mute effects"}
        title={muted ? "SFX off" : "SFX on"}
      >
        {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
      </button>
    </div>
  );
}

/** Tracks primary touch input so wide phones and tablets receive mobile controls. */
function useTouchControls(): boolean {
  const query = "(hover: none), (pointer: coarse)";
  const [touch, setTouch] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const sync = () => setTouch(media.matches);
    media.addEventListener("change", sync);
    sync();
    return () => media.removeEventListener("change", sync);
  }, []);
  return touch;
}

function FaultTape() {
  const [rows, setRows] = useState<Fault[]>([]);
  useEffect(() => {
    installFaults();
    const sync = () => setRows(recentFaults());
    sync();
    return onFaults(sync);
  }, []);
  if (rows.length === 0) return null;
  const last = rows[rows.length - 1];
  return (
    <div className="pointer-events-none absolute inset-x-0 top-14 z-30 flex justify-center px-3">
      <p className={`max-w-xl rounded-md border px-3 py-1.5 text-xs ${last.level === "error" ? "border-danger bg-danger/20 text-fg" : "border-border bg-surface/90 text-muted"}`}>
        {last.msg}
      </p>
    </div>
  );
}

function RadioDock() {
  const phase = useGame((s) => s.phase);
  const host = useRef<HTMLDivElement>(null);
  const restartTimer = useRef<number | null>(null);
  const dismissTimer = useRef<number | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [nowTrack, setNowTrack] = useState<Track>(TRACKS[0]);
  const lastTrackId = useRef(TRACKS[0].id);

  useEffect(() => {
    if (host.current) mountRadio(host.current);
  }, []);

  useEffect(() => {
    const unsubscribe = onNowPlaying((track) => {
      setNowTrack(track);
      if (track.id !== lastTrackId.current) {
        lastTrackId.current = track.id;
        setShowToast(false);
        if (restartTimer.current !== null) window.clearTimeout(restartTimer.current);
        if (dismissTimer.current !== null) window.clearTimeout(dismissTimer.current);
        restartTimer.current = window.setTimeout(() => {
          setShowToast(true);
          dismissTimer.current = window.setTimeout(() => setShowToast(false), 4_500);
        }, 50);
      }
    });
    return () => {
      unsubscribe();
      if (restartTimer.current !== null) window.clearTimeout(restartTimer.current);
      if (dismissTimer.current !== null) window.clearTimeout(dismissTimer.current);
    };
  }, []);

  const live = phase === "playing" || phase === "paused";
  return (
    <>
      <div
        className="pointer-events-none fixed top-0 left-0 z-0 h-px w-px overflow-hidden opacity-0"
        aria-hidden={!live}
      >
        <div ref={host} className="h-full w-full" />
      </div>

      {live && showToast && !useGame.getState().radioOff && (
        <div role="status" aria-live="polite" className="pointer-events-none absolute top-4 right-1/2 translate-x-[40%] z-40 motion-safe:animate-toast">
          <div className="flex items-center gap-3 rounded-md bg-wood border-neon px-4 py-2 shadow-xl">
            <Music className="size-4 text-accent motion-safe:animate-pulse" />
            <div className="flex flex-col">
              <span className="text-[10px] font-bold tracking-widest text-[#38bdf8] uppercase drop-shadow-md">Boardwalk Radio</span>
              <span className="font-display text-sm text-white text-stroke drop-shadow-md">{nowTrack.title}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function RadioCard() {
  const [now, setNow] = useState<Track>(TRACKS[0]);
  const radioOff = useGame((s) => s.radioOff);
  useEffect(() => onNowPlaying(setNow), []);
  return (
    <div className="mt-4 rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-fg">
      <span className="text-[10px] tracking-[0.18em] text-accent uppercase">Boardwalk radio</span>
      <p className="mt-0.5 font-medium">{now.title}</p>
      <p className="text-xs text-muted">{now.artist}{radioOff ? " · music off" : ""}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" className="rounded-md border border-border px-2 py-1 text-xs" onClick={() => useGame.getState().toggleRadio()}>
          {radioOff ? "Music on" : "Music off"}
        </button>
        <button type="button" className="rounded-md border border-border px-2 py-1 text-xs" onClick={() => skipRadio()}>
          Next
        </button>
        <a href={now.url} target="_blank" rel="noreferrer" className="rounded-md border border-border px-2 py-1 text-xs">
          This track
        </a>
        <a href={RELEASES_URL} target="_blank" rel="noreferrer" className="rounded-md border border-border px-2 py-1 text-xs">
          All releases
        </a>
      </div>
    </div>
  );
}

let flyAt = 0;
function fly() {
  const now = Date.now();
  if (now - flyAt < 400) return;
  flyAt = now;
  track("activation", { mode: useGame.getState().mode, challenged: Boolean(useGame.getState().challenge) });
  const readyGame = currentGame();
  readyGame?.tryLock();
  useGame.getState().start();
  try {
    unlockAudio();
  } catch (err) {
    console.warn("[Gull Drop] fly audio", err);
  }
  const boot = () => {
    const g = currentGame();
    if (!g) return false;
    try {
      g.begin();
    } catch (err) {
      console.error("[Gull Drop] begin", err);
    }
    return true;
  };
  if (readyGame) {
    readyGame.begin();
    return;
  }
  if (boot()) return;
  let n = 0;
  const id = window.setInterval(() => {
    n += 1;
    if (boot() || n > 120) window.clearInterval(id);
  }, 40);
}

function Menu() {
  const hs = useGame((s) => s.highScore);
  const challenge = useGame((s) => s.challenge);
  const mode = useGame((s) => s.mode);
  const setMode = useGame((s) => s.setMode);
  const mhs = useGame((s) => s.mafiaHighScore);
  const muted = useGame((s) => s.muted);
  const [soundCheck, setSoundCheck] = useState<SoundCheckResult | "checking" | null>(null);

  const checkSound = async () => {
    setSoundCheck("checking");
    setSoundCheck(await playSoundCheck());
  };

  return (
    <div className="pointer-events-auto absolute inset-0 flex items-end justify-center bg-bg/20 p-4 pb-8 sm:items-center">
      <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/50 to-transparent" aria-hidden />
      <div className="relative z-20 w-full max-w-lg rounded-xl border border-border bg-surface/90 p-6 shadow-lg sm:p-8">
        <p className="text-xs font-medium tracking-[0.22em] text-accent uppercase">Atlantic City Boardwalk</p>
        <h1 className="font-display mt-2 text-5xl leading-none tracking-tight text-fg sm:text-6xl">GULL DROP</h1>

        {challenge ? (
          <div className="mt-6 rounded-md border border-accent/40 bg-accent/10 p-4">
            <p className="font-display text-lg text-accent uppercase tracking-wider">Turf War</p>
            <p className="mt-1 text-sm text-fg">
              A rival gull says they run this boardwalk with <strong className="text-accent">{challenge.target.toLocaleString()} respect</strong>. {challengeDare(challenge)}
            </p>
          </div>
        ) : (
          <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">
            You run the gull family. Gray squirrels on the rails. The Don wears the hat. Taffy shop is a crime scene.
          </p>
        )}

                {!challenge && (
          <div className="mt-5 grid grid-cols-2 rounded-lg bg-surface-2 p-1 border border-border">
            <button type="button" onClick={() => { track("mode_select", { mode: "gull" }); setMode("gull"); }} className={`flex h-10 items-center justify-center rounded-md text-sm font-bold uppercase tracking-wider transition-colors ${mode === "gull" ? "bg-accent text-bg" : "text-muted hover:bg-surface"}`}>Gull</button>
            <button type="button" onClick={() => { track("mode_select", { mode: "mafia" }); setMode("mafia"); }} className={`flex h-10 items-center justify-center rounded-md text-sm font-bold uppercase tracking-wider transition-colors ${mode === "mafia" ? "bg-[#c45c4a] text-white" : "text-muted hover:bg-surface"}`}>Squirrel</button>
          </div>
        )}

        {!challenge && mode === "gull" && (
          <ul className="mt-4 space-y-1 text-sm text-fg">
            <li>Poop on tourists, politicians, and the Don.</li>
            <li>Lock a mark and press F to send the flock.</li>
            <li>North Inlet to Chelsea. Marina is inland.</li>
          </ul>
        )}
        {!challenge && mode === "mafia" && (
          <ul className="mt-4 space-y-1 text-sm text-fg">
            <li>Enter the Taffy Shop and demand peanuts for protection.</li>
            <li>Shoot acorns. Evade stray cats. Bank respect.</li>
            <li>90 seconds. Don't run out of health.</li>
          </ul>
        )}

        {hs > 0 && mode === "gull" && <p className="mt-4 font-display text-lg tabular-nums text-accent">Boardwalk record {hs.toLocaleString()}</p>}
        {mhs > 0 && mode === "mafia" && <p className="mt-4 font-display text-lg tabular-nums text-[#c45c4a]">Squirrel record {mhs.toLocaleString()}</p>}
        <RadioCard />
        <div className="mt-3">
          <button
            type="button"
            className="flex h-10 w-full items-center justify-center gap-2 rounded-md border border-border bg-surface-2 px-4 text-sm font-medium text-fg disabled:opacity-60"
            onClick={() => void checkSound()}
            disabled={soundCheck === "checking"}
          >
            <Volume1 className="size-4" />
            {soundCheck === "checking" ? "Checking sound…" : "Test sound"}
          </button>
          <div className="mt-1.5 min-h-5 text-xs" role="status" aria-live="polite">
            {soundCheck === "played" && <p className="text-accent">Sound is ready. You should have heard a boardwalk hit.</p>}
            {soundCheck === "muted" && <p className="text-muted">Effects are muted. Turn on SFX with the speaker button, then test again.</p>}
            {soundCheck === "blocked" && <p className="text-danger">Sound is blocked. Allow sound for this site or unmute the browser tab, then test again.</p>}
            {!soundCheck && muted && <p className="text-muted">Effects are muted. The sound check will stay silent.</p>}
          </div>
        </div>
        <MenuExtras />
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            className="relative z-30 flex h-12 flex-1 items-center justify-center gap-2 rounded-md bg-fg px-5 text-base font-medium text-bg transition-transform duration-150 active:scale-[0.98]"
            onPointerDown={(e) => {
              e.stopPropagation();
              fly();
            }}
            onClick={(e) => {
              e.stopPropagation();
              fly();
            }}
          >
            {mode === "mafia" ? <Squirrel className="size-5" /> : <Bird className="size-5" />}
            {challenge ? "Accept Challenge" : mode === "mafia" ? "Scamper" : "Fly"}
          </button>
          <button
            type="button"
            className="flex h-12 flex-1 items-center justify-center rounded-md border border-border bg-surface-2 px-5 text-base font-medium text-fg"
            onClick={() => useGame.getState().setHowTo(true)}
          >
            How to play
          </button>
        </div>
      </div>
    </div>
  );
}

function HowTo() {
  return (
    <div className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-bg/70 p-4">
      <div className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-surface p-5 touch-pan-y sm:p-6">
        <h2 className="font-display text-3xl text-fg">How to Play</h2>
        <p className="mt-1 text-sm text-muted">Choose Gull or Squirrel on the main menu. Phones and tablets show touch controls automatically.</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <section className="rounded-lg border border-accent/40 bg-accent/5 p-4">
            <h3 className="flex items-center gap-2 font-display text-xl text-fg"><Bird className="size-5 text-accent" /> Seagull Controls</h3>
            <dl className="mt-3 space-y-3 text-sm leading-relaxed">
              <div><dt className="font-medium text-fg">Desktop flight</dt><dd className="text-muted">Mouse looks. WASD flies. Space climbs, Shift dives, Q/E rolls, and R levels out.</dd></div>
              <div><dt className="font-medium text-fg">Desktop attacks</dt><dd className="text-muted">Click drops. F or right-click calls the flock swarm.</dd></div>
              <div><dt className="font-medium text-fg">Phone or tablet</dt><dd className="text-muted">Left stick flies. Drag the right side to look. Use Climb, Dive, Level, Drop, and Swarm buttons.</dd></div>
              <div><dt className="font-medium text-fg">Objective</dt><dd className="text-muted">Complete contracts, steal glowing fry boxes, and survive wanted heat. Three acorn hits grounds the gull.</dd></div>
            </dl>
          </section>
          <section className="rounded-lg border border-[#c45c4a]/50 bg-[#c45c4a]/5 p-4">
            <h3 className="flex items-center gap-2 font-display text-xl text-fg"><Squirrel className="size-5 text-[#c45c4a]" /> Squirrel Controls</h3>
            <dl className="mt-3 space-y-3 text-sm leading-relaxed">
              <div><dt className="font-medium text-fg">Desktop movement</dt><dd className="text-muted">WASD moves. Mouse aims. Space jumps, Shift pounces, and C climbs near structures.</dd></div>
              <div><dt className="font-medium text-fg">Desktop actions</dt><dd className="text-muted">Click shoots equipped gear, including the fictional gull-grounding Fizz Bomb. Q scratches, R bites, N builds nests, and E handles tribute or banking.</dd></div>
              <div><dt className="font-medium text-fg">Phone or tablet</dt><dd className="text-muted">Left stick moves. Drag the right side to aim. Use Shoot, Tribute, Jump, Pounce, Scratch, Bite, Climb, and Nest.</dd></div>
              <div><dt className="font-medium text-fg">Objective</dt><dd className="text-muted">Enter the Taffy Shop and demand peanuts for protection. Chain tribute, then bank it at the glowing Den before cats steal it.</dd></div>
            </dl>
          </section>
        </div>
        <button type="button" className="mt-6 flex h-11 w-full items-center justify-center rounded-md bg-fg text-bg" onClick={() => useGame.getState().setHowTo(false)}>
          Got it
        </button>
      </div>
    </div>
  );
}

function Hud() {
  const score = useGame((s) => s.score);
  const combo = useGame((s) => s.combo);
  const elapsed = useGame((s) => s.elapsed);
  const cd = useGame((s) => s.cooldown);
  const swarmCd = useGame((s) => s.swarmCd);
  const lockHint = useGame((s) => s.lockHint);
  const alert = useGame((s) => s.alert);
  const frenzy = useGame((s) => s.frenzy);
  const callouts = useGame((s) => s.callouts);
  const wanted = useGame((s) => s.wanted);
  const district = useGame((s) => s.district);
  const jobTitle = useGame((s) => s.jobTitle);
  const jobBlurb = useGame((s) => s.jobBlurb);
  const jobProg = useGame((s) => s.jobProg);
  const jobGoal = useGame((s) => s.jobGoal);
  const nextTitle = useGame((s) => s.nextTitle);
  const jobArrow = useGame((s) => s.jobArrow);
  const health = useGame((s) => s.health);
  const grounded = useGame((s) => s.grounded);
  const rankName = useGame((s) => s.rankName);
  const patron = useGame((s) => s.patron);
  const flash = useGame((s) => s.flash);
    const inverted = useGame((s) => s.inverted);
  const swarmReady = swarmCd >= 0.99;
  const mode = useGame((s) => s.mode);
  const mStats = useGame((s) => s.mafiaStats);
  const bombAimX = useGame((s) => s.bombAimX);
  const bombAimY = useGame((s) => s.bombAimY);
  const bombAimVisible = useGame((s) => s.bombAimVisible);

  return (
    <>
      <div className={`absolute inset-0 z-50 pointer-events-none transition-opacity duration-75 ${flash > 0.04 || mStats.catWarning ? "opacity-100" : "opacity-0"}`} style={{ background: "radial-gradient(ellipse at center, transparent 48%, rgba(220,38,38,0.2) 100%)" }} aria-hidden />

      {mode === "gull" && (
        <div className="absolute top-16 right-16 flex gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Star key={i} className={`size-6 ${i < wanted ? "fill-danger text-danger drop-shadow-[0_0_8px_rgba(220,38,38,0.8)]" : "text-white/20"}`} />
          ))}
        </div>
      )}
        {mode === "gull" && (
      <div className="absolute top-28 right-16 flex gap-1.5 bg-black/40 px-3 py-2 rounded-full border border-white/10 backdrop-blur-sm">
          {[0, 1, 2].map((i) => (
            <span key={i} className={`block size-3 rounded-full ${i < health ? "bg-[#22c55e] shadow-[0_0_8px_rgba(34,197,94,0.8)]" : "bg-white/10"}`} />
          ))}
        </div>
      )}
      {frenzy && mode === "gull" && (
        <p className="absolute top-28 left-1/2 -translate-x-1/2 font-display text-2xl tracking-[0.2em] text-danger uppercase text-stroke-heavy animate-pulse">Five-star dump</p>
      )}
      {mStats.prompt && mode === "mafia" && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 mt-16 rounded-md bg-fg px-4 py-2 text-sm font-bold tracking-wider text-bg">
          {mStats.prompt}
        </div>
      )}
      {alert && (
        <p className="absolute top-36 left-1/2 w-[min(96%,40rem)] -translate-x-1/2 text-center font-display text-3xl tracking-wide text-white text-stroke-heavy drop-shadow-2xl">{alert}</p>
      )}
      {inverted && !alert && (
        <p className="absolute top-36 left-1/2 -translate-x-1/2 font-display text-xl tracking-[0.18em] text-danger uppercase text-stroke">Inverted — hold R to level</p>
      )}

      {/* Top Left: Score & Timer */}
      <div className="absolute top-14 left-16 flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="flex h-[38px] w-20 items-center justify-center rounded-lg border border-border bg-surface-2 pb-0.5 text-xl leading-none font-bold tracking-wider text-fg sm:h-[46px] sm:w-24 sm:text-2xl">
            {fmt(mode === "mafia" ? Math.max(0, 90 - elapsed) : elapsed)}
          </div>
          <div className="flex h-16 min-w-32 items-center justify-center rounded-xl border border-border bg-surface-2 px-5 pb-1 text-4xl leading-none font-bold text-fg sm:h-20 sm:min-w-40 sm:text-5xl">
            {mode === "mafia" ? mStats.banked : score}
          </div>
        </div>

        {mode === "mafia" && (
          <div className="flex flex-col gap-2">
             <div className="flex h-6 items-center gap-1 rounded bg-bg px-2 font-mono text-xs font-bold text-[#c45c4a] w-fit">
               HP: {[0, 1, 2].map((i) => <span key={i} className={`block size-3 rounded-full mx-1 ${i < health ? "bg-[#22c55e]" : "bg-white/20"}`} />)}
               &nbsp; HEAT: {[0, 1, 2, 3, 4].map((i) => <Star key={i} className={`size-3 ${i < wanted ? "fill-current" : "opacity-30"}`} />)}
             </div>
             {mStats.unbanked > 0 && <div className="flex h-6 items-center rounded bg-bg px-2 font-mono text-xs font-bold text-[#eab308] w-fit">
               UNBANKED: {mStats.unbanked} (CHAIN: {mStats.chain}x {mStats.chainTimer > 0 ? `${Math.ceil(mStats.chainTimer)}s` : ''})
             </div>}
          </div>
        )}

        <div className="pl-1">
          <p className="mt-1 text-xs font-bold tracking-[0.16em] text-[#38bdf8] uppercase drop-shadow-md">{district}</p>
          <p className="mt-1 text-[11px] font-bold text-[#cbd5e1] uppercase drop-shadow-md">
            {mode === "mafia" ? "THE DON" : rankName}
            {patron ? " · PATRON" : ""}
          </p>
        </div>
        {combo > 1 && mode === "gull" && (
          <div className="rounded-md bg-rust px-3 py-1.5 shadow-lg transform -rotate-2 origin-left">
            <p className="font-display text-2xl text-[#facc15] tabular-nums text-stroke drop-shadow-md">x{combo} MULTI</p>
          </div>
        )}
        {mode === "gull" && (
        <div className="rounded-md bg-wood px-4 py-3 shadow-xl">
          <p className="text-[11px] font-bold tracking-widest text-[#94a3b8] uppercase drop-shadow-md">{jobTitle}</p>
          <p className="mt-1 text-sm font-medium text-white drop-shadow-md">{jobBlurb}</p>
          {jobGoal > 0 && (
            <p className="mt-1 font-display text-lg tabular-nums text-[#38bdf8] text-stroke drop-shadow-md">
              {jobProg}/{jobGoal}
            </p>
          )}
          {nextTitle && <p className="mt-2 text-[10px] tracking-wider text-[#64748b] uppercase drop-shadow-md">Next · {nextTitle}</p>}
        </div>
        )}
      </div>
      {mode === "gull" && (
      <div className="absolute top-4 left-1/2 -translate-x-1/2 rounded-md bg-wood border-neon px-5 py-1.5 shadow-xl">
        <p className="font-display text-3xl tabular-nums text-white text-stroke">{fmt(elapsed)}</p>
      </div>
      )}
      {mode === "gull" && (
        <p className="absolute top-28 left-1/2 -translate-x-1/2 font-display text-2xl tracking-[0.2em] text-danger uppercase text-stroke-heavy animate-pulse">Five-star dump</p>
      )}
            {mStats.prompt && mode === "mafia" && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 mt-16 rounded-md bg-fg px-4 py-2 text-sm font-bold tracking-wider text-bg">
          {mStats.prompt}
        </div>
      )}
      {alert && (
        <p className="absolute top-36 left-1/2 w-[min(96%,40rem)] -translate-x-1/2 text-center font-display text-3xl tracking-wide text-white text-stroke-heavy drop-shadow-2xl">{alert}</p>
      )}
      {inverted && !alert && (
        <p className="absolute top-36 left-1/2 -translate-x-1/2 font-display text-xl tracking-[0.18em] text-danger uppercase text-stroke">Inverted — hold R to level</p>
      )}
      <div className="absolute top-1/2 left-1/2 size-8 -translate-x-1/2 -translate-y-1/2 opacity-55" aria-label="Look and flock targeting sight">
        <span className={`absolute top-1/2 left-0 h-[2px] w-full ${lockHint ? "bg-[#eab308] shadow-[0_0_6px_#eab308]" : "bg-white"}`} />
        <span className={`absolute top-0 left-1/2 h-full w-[2px] ${lockHint ? "bg-[#eab308] shadow-[0_0_6px_#eab308]" : "bg-white"}`} />
      </div>
      {mode === "gull" && (
        <div
          className={`absolute size-12 -translate-x-1/2 -translate-y-1/2 transition-opacity duration-100 ${bombAimVisible ? "opacity-100" : "opacity-30"}`}
          style={{ left: `${bombAimX}%`, top: `${bombAimY}%` }}
          aria-label="Predicted poop impact point"
        >
          <span className="absolute inset-1 rounded-full border-2 border-dashed border-[#f3e5ab] shadow-[0_0_8px_rgba(243,229,171,0.8)]" />
          <span className="absolute top-1/2 left-0 h-px w-full bg-[#f3e5ab]/80" />
          <span className="absolute top-0 left-1/2 h-full w-px bg-[#f3e5ab]/80" />
          <span className="absolute top-full left-1/2 mt-1 -translate-x-1/2 whitespace-nowrap font-mono text-[9px] font-bold tracking-[0.18em] text-[#f3e5ab]">
            DROP ZONE
          </span>
        </div>
      )}
      {lockHint && (
        <p className="absolute top-[55%] left-1/2 -translate-x-1/2 font-display text-xl tracking-[0.16em] text-[#eab308] text-stroke uppercase whitespace-nowrap">
          {swarmReady ? `F — swarm ${lockHint}` : lockHint}
        </p>
      )}
      <div className="absolute top-[44%] left-1/2 -translate-x-1/2" aria-hidden>
        <span
          className="block h-0 w-0 border-x-[10px] border-b-[18px] border-x-transparent border-b-[#38bdf8] drop-shadow-[0_0_4px_#38bdf8]"
          style={{ transform: `rotate(${(jobArrow * 180) / Math.PI}deg)` }}
        />
      </div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full pointer-events-none" aria-live="polite" aria-atomic="false">
        {callouts.map((c, i) => (
          <div
            key={c.id}
            className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 motion-safe:animate-float whitespace-nowrap"
            style={{
              marginTop: `${i * 3}rem`,
              zIndex: 100 - i
            }}
          >
            <p className="font-display text-3xl md:text-5xl leading-none text-white text-stroke-heavy text-center origin-bottom rotate-[-3deg] uppercase">
              <span className="text-[#38bdf8]">+{c.pts}</span> {c.title}
            </p>
          </div>
        ))}
      </div>
      <div className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 sm:flex items-center gap-6 rounded-md bg-wood border-neon-toxic px-6 py-3 shadow-2xl">
        <div className="flex flex-col gap-1 items-center">
          <span id="drop-label" className="text-[10px] font-bold tracking-widest text-[#94a3b8] uppercase drop-shadow-md">Drop</span>
          <span
            role="progressbar"
            aria-labelledby="drop-label"
            aria-valuenow={Math.round((1 - cd) * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            className="relative block h-4 w-32 overflow-hidden rounded-[2px] bg-black/60 border border-white/10 shadow-inner"
          >
            <span className="absolute inset-y-0 left-0 bg-[#22c55e] shadow-[0_0_10px_#22c55e] transition-all duration-100 ease-linear" style={{ width: `${Math.round((1 - cd) * 100)}%` }} />
          </span>
        </div>
        <div className="flex flex-col gap-1 items-center">
          <span id="flock-label" className="text-[10px] font-bold tracking-widest text-[#94a3b8] uppercase drop-shadow-md">Flock (F)</span>
          <span
            role="progressbar"
            aria-labelledby="flock-label"
            aria-valuenow={Math.round(swarmCd * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            className="relative block h-4 w-32 overflow-hidden rounded-[2px] bg-black/60 border border-white/10 shadow-inner"
          >
            <span className="absolute inset-y-0 left-0 bg-[#eab308] shadow-[0_0_10px_#eab308] transition-all duration-100 ease-linear" style={{ width: `${Math.round(swarmCd * 100)}%` }} />
          </span>
        </div>
      </div>
      <MiniMap />
      <button
        type="button"
        className="pointer-events-auto absolute top-4 right-32 flex size-12 items-center justify-center rounded-md bg-rust text-white shadow-lg hover:scale-105 active:scale-95 transition-transform"
        onClick={() => {
          document.exitPointerLock();
          useGame.getState().pause();
        }}
        aria-label="Pause"
      >
        <Pause className="size-6" />
      </button>
    </>
  );
}

function ClickCatch() {
  const coarse = typeof window !== "undefined" && window.matchMedia("(hover: none), (pointer: coarse)").matches;
  if (coarse) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-20 z-10 flex justify-center">
      <button type="button" className="pointer-events-auto rounded-md border border-border bg-surface/90 px-4 py-2 text-sm text-fg" onClick={() => currentGame()?.tryLock()}>
        Click the boardwalk to look around
      </button>
    </div>
  );
}

function PauseMenu() {
  return (
    <div className="pointer-events-auto absolute inset-0 z-20 flex items-center justify-center bg-bg/70 p-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-6">
        <h2 className="font-display text-3xl text-fg">Paused</h2>
        <p className="mt-2 text-sm text-muted">The mafia is still throwing.</p>
        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            className="flex h-12 items-center justify-center gap-2 rounded-md bg-fg text-bg"
            onClick={() => {
              useGame.getState().resume();
              currentGame()?.tryLock();
            }}
          >
            <Play className="size-5" />
            Resume
          </button>
          <button
            type="button"
            className="flex h-12 items-center justify-center rounded-md border border-border text-fg"
            onClick={() => {
              useGame.getState().end();
              document.exitPointerLock();
            }}
          >
            Clock out
          </button>
          <button type="button" className="flex h-12 items-center justify-center gap-2 rounded-md border border-border text-fg" onClick={() => useGame.getState().setShop(true)}>
            <ShoppingBag className="size-4" />
            Shop
          </button>
          <button type="button" className="flex h-12 items-center justify-center rounded-md border border-border text-fg" onClick={() => useGame.getState().toMenu()}>
            Leave the boards
          </button>
        </div>
      </div>
    </div>
  );
}

function GameOver() {
  const score = useGame((s) => s.score);
  const mode = useGame((s) => s.mode);
  const mStats = useGame((s) => s.mafiaStats);
  const hs = useGame((s) => s.highScore);
  const mhs = useGame((s) => s.mafiaHighScore);
  const stats = useGame((s) => s.stats);
  const challenge = useGame((s) => s.challenge);
  const handle = useGame((s) => s.handle);
  const rankName = useGame((s) => s.rankName);
  const entitlements = useGame((s) => s.entitlements);
  const record = mode === "mafia" ? mStats.banked >= mhs && mStats.banked > 0 : score >= hs && score > 0;
  const premiumMark = entitlements.includes("founder")
    ? "FOUNDER'S CONTRABAND"
    : entitlements.includes("patron")
      ? "BOARDWALK PATRON"
      : entitlements.includes("messy")
        ? "MESSY PACK"
        : null;

  useEffect(() => {
    postScoreToBlotter();
    track("run_complete", { mode, score: mode === "mafia" ? mStats.banked : score, challenged: Boolean(challenge), won: challenge ? score > challenge.target : false });
  }, [score]);

  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

    const shareText = mode === "mafia"
    ? `I made off with ${mStats.banked.toLocaleString()} respect in GULL DROP SQUIRREL.`
    : challenge && score > challenge.target
      ? `I beat a boardwalk challenge with ${score.toLocaleString()} respect in GULL DROP.`
      : `I scored ${score.toLocaleString()} respect in GULL DROP. The squirrels started it.`;

  const outgoingChallenge = useMemo(() => mode === "gull" ? createChallenge(score, challenge ? "rematch" : "result", handle) : null, [challenge, handle, score, mode]);
  const challengeLink = outgoingChallenge ? challengeUrl(outgoingChallenge) : "";
  const finalScore = mode === "mafia" ? mStats.banked : score;

  const handleCopy = () => {
    navigator.clipboard.writeText(`${shareText} ${challengeLink}`.trim()).catch(() => {});
    if (mode === "gull") track("challenge_create", { method: "copy", score });
    track("share", { method: "copy", mode });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    setDownloading(true);
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 1200;
    const context = canvas.getContext("2d");
    if (!context) return setDownloading(false);
    context.fillStyle = "#ece8e1";
    context.fillRect(0, 0, 1200, 1200);
    context.strokeStyle = "#1a1f24";
    context.lineWidth = 8;
    context.strokeRect(38, 38, 1124, 1124);
    context.fillStyle = "#1a1f24";
    context.font = "700 62px sans-serif";
    context.fillText("GULL DROP", 90, 145);
    context.font = "26px monospace";
    context.fillText("OFFICIAL ATLANTIC CITY WRAP SHEET", 90, 205);
    context.fillStyle = "#c45c4a";
    context.font = "700 170px sans-serif";
    context.fillText(finalScore.toLocaleString(), 90, 440);
    context.fillStyle = "#1a1f24";
    context.font = "30px monospace";
    context.fillText(`${rankName} · RESPECT DEMANDED`, 96, 495);
    if (mode === "mafia") {
      context.fillText(`BANKED ${mStats.banked}  ·  UNBANKED ${mStats.unbanked}  ·  MAX CHAIN ${mStats.maxChain}x`, 90, 620);
      context.fillText(`MAX HEAT ${stats.wantedMax}  ·  SQUIRREL RECORD ${mhs}`, 90, 680);
      context.fillText("THE BOARDWALK PAYS ON TIME.", 90, 1080);
    } else {
      context.fillText(`HITS ${stats.hits}  ·  WALKERS ${stats.dogWalkers}  ·  DOGS ${stats.dogs}`, 90, 620);
      context.fillText(`SQUIRRELS ${stats.squirrels}  ·  POLITICIANS ${stats.pols}  ·  SWARMS ${stats.swarms}`, 90, 680);
      context.fillText(`MAX HEAT ${stats.wantedMax}  ·  MAX COMBO ${stats.comboMax}x`, 90, 740);
      context.fillText("THE SQUIRRELS STARTED IT.", 90, 1080);
    }
    const link = document.createElement("a");
    link.download = `gull-drop-${mode}-${finalScore}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    track("download_card", { score: finalScore, mode });
    setDownloading(false);
  };

  const handleShare = async () => {
    const hasNativeShare = "share" in navigator;
    if (mode === "gull") { track("challenge_create", { method: hasNativeShare ? "native" : "x", score }); }
    else { track("share", { method: hasNativeShare ? "native" : "x", mode }); }
    if (hasNativeShare) {
      await navigator.share({ title: "Gull Drop Challenge", text: shareText, url: challengeLink || undefined }).catch(() => undefined);
      return;
    }
    window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}${challengeLink ? `&url=${encodeURIComponent(challengeLink)}` : ""}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="pointer-events-auto absolute inset-0 z-20 flex items-center justify-center bg-bg/80 p-4 sm:p-6 overflow-y-auto">
      <div className="w-full max-w-lg mt-auto mb-auto">
        <div id="wrap-sheet" className={`relative rounded-xl border-2 ${premiumMark ? "border-accent" : "border-border"} bg-[#ece8e1] text-[#1a1f24] p-1 shadow-2xl overflow-hidden`}>
          <div className="border border-[#1a1f24]/20 p-5 sm:p-6 rounded-lg relative">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.03] pointer-events-none select-none flex flex-col items-center">
              <Bird className="size-48" />
              <div className="font-display text-3xl mt-2 tracking-widest">A.C.P.D.</div>
            </div>

            <div className="flex justify-between items-start border-b-2 border-[#1a1f24] pb-4 mb-4">
              <div>
                <p className="font-display text-2xl uppercase tracking-wider leading-none">Official Wrap Sheet</p>
                <p className="text-xs uppercase tracking-widest text-[#1a1f24]/60 mt-1 font-mono">Atlantic City Boardwalk Div.</p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-widest text-[#1a1f24]/60 font-mono">Subject ID</p>
                <p className="font-mono text-sm font-bold">{handle}</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-6 mb-6">
              <div className="flex-1">
                <p className="text-xs uppercase tracking-widest text-[#1a1f24]/60 font-mono mb-1">Total Respect Demanded</p>
                <p className="font-display text-6xl leading-none tabular-nums text-[#c45c4a]">{finalScore.toLocaleString()}</p>
                {record && <p className="mt-1 text-sm font-bold text-[#c45c4a] uppercase tracking-wide">New Boardwalk Record</p>}
              </div>

              {mode === "gull" && challenge && (
                <div className="flex-1 border-l-2 border-[#1a1f24]/20 pl-4 sm:pl-6 flex flex-col justify-center">
                  <p className="text-xs uppercase tracking-widest text-[#1a1f24]/60 font-mono mb-1">Challenge Target</p>
                  <p className={`font-display text-3xl tabular-nums ${score > challenge.target ? 'text-[#5eb7ae]' : 'text-[#1a1f24]'}`}>
                    {challenge.target.toLocaleString()}
                  </p>
                  {score > challenge.target ? (
                    <div className="mt-1 inline-block bg-[#1a1f24] text-[#ece8e1] px-2 py-0.5 text-xs uppercase tracking-widest font-bold">Target Humiliated</div>
                  ) : (
                    <div className="mt-1 inline-block bg-[#c45c4a] text-[#ece8e1] px-2 py-0.5 text-xs uppercase tracking-widest font-bold">Failed to Beat</div>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-2 border-y border-[#1a1f24]/20 py-4 mb-4 text-sm font-mono">
              <div className="col-span-2 flex justify-between border-b border-[#1a1f24]/10 pb-1">
                <span className="text-[#1a1f24]/60">Rank</span>
                <span className="font-bold">{rankName}</span>
              </div>
              {mode === "mafia" ? (
                <>
                  <div className="flex justify-between border-b border-[#1a1f24]/10 pb-1">
                    <span className="text-[#1a1f24]/60">Banked</span>
                    <span className="font-bold">{mStats.banked}</span>
                  </div>
                  <div className="flex justify-between border-b border-[#1a1f24]/10 pb-1">
                    <span className="text-[#1a1f24]/60">Unbanked</span>
                    <span className="font-bold">{mStats.unbanked}</span>
                  </div>
                  <div className="flex justify-between border-b border-[#1a1f24]/10 pb-1">
                    <span className="text-[#1a1f24]/60">Max Chain</span>
                    <span className="font-bold">{mStats.maxChain}x</span>
                  </div>
                  <div className="flex justify-between border-b border-[#1a1f24]/10 pb-1">
                    <span className="text-[#1a1f24]/60">Heat</span>
                    <span className="font-bold">{stats.wantedMax}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between border-b border-[#1a1f24]/10 pb-1">
                    <span className="text-[#1a1f24]/60">Hits</span>
                    <span className="font-bold">{stats.hits}</span>
                  </div>
                  <div className="flex justify-between border-b border-[#1a1f24]/10 pb-1">
                    <span className="text-[#1a1f24]/60">Walkers</span>
                    <span className="font-bold">{stats.dogWalkers}</span>
                  </div>
                  <div className="flex justify-between border-b border-[#1a1f24]/10 pb-1">
                    <span className="text-[#1a1f24]/60">Dogs</span>
                    <span className="font-bold">{stats.dogs}</span>
                  </div>
                  <div className="flex justify-between border-b border-[#1a1f24]/10 pb-1">
                    <span className="text-[#1a1f24]/60">Squirrels</span>
                    <span className="font-bold">{stats.squirrels}</span>
                  </div>
                  <div className="flex justify-between border-b border-[#1a1f24]/10 pb-1">
                    <span className="text-[#1a1f24]/60">Politicians</span>
                    <span className="font-bold">{stats.pols}</span>
                  </div>
                  <div className="flex justify-between border-b border-[#1a1f24]/10 pb-1">
                    <span className="text-[#1a1f24]/60">Swarms</span>
                    <span className="font-bold">{stats.swarms}</span>
                  </div>
                  <div className="flex justify-between border-b border-[#1a1f24]/10 pb-1">
                    <span className="text-[#1a1f24]/60">Suits Soiled</span>
                    <span className="font-bold">{stats.suits}</span>
                  </div>
                  <div className="flex justify-between border-b border-[#1a1f24]/10 pb-1">
                    <span className="text-[#1a1f24]/60">Custards</span>
                    <span className="font-bold">{stats.custards}</span>
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-between items-end">
              <p className="text-xs uppercase tracking-widest text-[#1a1f24]/50 font-mono">End of Report</p>
              <div className="text-right">
                <p className="text-xs uppercase tracking-widest text-[#1a1f24]/60 font-mono">
                  {mode === "mafia" ? "Max Heat / Chain" : "Max Heat / Combo"}
                </p>
                <p className="font-mono text-sm font-bold">
                  {stats.wantedMax} Stars / {mode === "mafia" ? mStats.maxChain : stats.comboMax}x
                </p>
              </div>
            </div>
            {premiumMark && (
              <div className="mt-4 border-2 border-[#c45c4a] px-3 py-2 text-center font-mono text-xs font-bold tracking-[0.2em] text-[#c45c4a]">
                {premiumMark} · COSMETIC ISSUE
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              className="flex h-12 flex-col items-center justify-center gap-1 rounded-md bg-fg text-bg hover:bg-fg/90 transition-colors"
              onClick={handleShare}
            >
              <Share2 className="size-4" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Post</span>
            </button>
            <button
              type="button"
              className="flex h-12 flex-col items-center justify-center gap-1 rounded-md bg-surface-2 border border-border text-fg hover:bg-surface transition-colors"
              onClick={handleCopy}
            >
              <Copy className="size-4" />
              <span className="text-[10px] font-bold uppercase tracking-wider">{copied ? "Copied" : "Link"}</span>
            </button>
            <button
              type="button"
              className="flex h-12 flex-col items-center justify-center gap-1 rounded-md bg-surface-2 border border-border text-fg hover:bg-surface transition-colors disabled:opacity-50"
              onClick={handleDownload}
              disabled={downloading}
            >
              <Download className="size-4" />
              <span className="text-[10px] font-bold uppercase tracking-wider">{downloading ? "Saving" : "Save"}</span>
            </button>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              className="flex h-14 flex-1 items-center justify-center gap-2 rounded-md bg-fg text-bg font-bold uppercase tracking-wider text-sm transition-transform active:scale-[0.98]"
              onClick={() => {
                unlockAudio();
                track("rematch", { challenged: Boolean(challenge) });
                useGame.getState().setChallenge(outgoingChallenge); fly();
              }}
            >
              <RotateCcw className="size-4" />
              {mode === "mafia" ? "Scamper Again" : "Fly Again"}
            </button>
            <button
              type="button"
              className="flex h-14 flex-1 items-center justify-center gap-2 rounded-md border border-border bg-surface-2 text-fg font-bold uppercase tracking-wider text-sm hover:bg-surface transition-colors"
              onClick={() => useGame.getState().toMenu()}
            >
              Clock Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniMap() {
  const x = useGame((s) => s.playerX);
  const z = useGame((s) => s.playerZ);
  const yaw = useGame((s) => s.yaw);
  const blips = useGame((s) => s.blips);
  const scale = 0.55;
  return (
    <div className="absolute bottom-4 left-4 hidden size-28 overflow-hidden rounded-md border border-border bg-surface/85 sm:block">
      <div className="absolute inset-0 bg-[linear-gradient(#1b2c33_1px,transparent_1px),linear-gradient(90deg,#1b2c33_1px,transparent_1px)] bg-[size:14px_14px]" />
      <div className="absolute top-1/2 left-3 right-3 h-2 -translate-y-1/2 rounded-sm bg-accent/25" />
      {blips.map((b, i) => (
        <span
          key={i}
          className={`absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full ${b.k === "don" ? "bg-danger" : "bg-[#c49a6a]"}`}
          style={{ left: `${50 + (b.x - x) * scale}%`, top: `${50 + (b.z - z) * scale}%` }}
        />
      ))}
      <span
        className="absolute left-1/2 top-1/2 block h-0 w-0 -translate-x-1/2 -translate-y-1/2 border-x-4 border-b-8 border-x-transparent border-b-accent"
        style={{ transform: `translate(-50%, -50%) rotate(${(-yaw * 180) / Math.PI}deg)` }}
      />
    </div>
  );
}

function Stat({ k, v }: { k: string; v: number }) {
  return (
    <div className="rounded-md border border-border bg-surface-2 px-3 py-2">
      <dt className="text-xs text-muted">{k}</dt>
      <dd className="font-display text-lg tabular-nums text-fg">{v}</dd>
    </div>
  );
}

function TouchLayer() {
  const mode = useGame(s => s.mode);
  const touchDevice = useTouchControls();
  useEffect(() => {
    const clear = () => useGame.getState().setTouch({ moveX: 0, moveY: 0, lookX: 0, lookY: 0, climb: 0, fire: false, level: false, interact: false, swarm: false, mafiaAction: null });
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", clear);
    return () => {
      window.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", clear);
    };
  }, []);
  if (!touchDevice) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-10 touch-none select-none">
      <LookPad />
      <Stick />

      {mode === "gull" && (
        <>
          <div className="pointer-events-auto absolute right-[calc(1rem+env(safe-area-inset-right))] bottom-[calc(7rem+env(safe-area-inset-bottom))] z-20 flex touch-none flex-col gap-2">
            <ClimbBtn dir={1} label="Climb"><ChevronUp className="size-6" /></ClimbBtn>
            <ClimbBtn dir={-1} label="Dive"><ChevronDown className="size-6" /></ClimbBtn>
            <button type="button" className="flex h-11 items-center justify-center rounded-md border border-border bg-surface/85 px-3 text-xs font-medium text-fg" onPointerDown={() => useGame.getState().setTouch({ level: true })} onPointerUp={() => useGame.getState().setTouch({ level: false })} onPointerCancel={() => useGame.getState().setTouch({ level: false })}>Level</button>
          </div>
          <button type="button" className="pointer-events-auto absolute right-[calc(7rem+env(safe-area-inset-right))] bottom-[calc(1.5rem+env(safe-area-inset-bottom))] z-20 flex size-16 touch-none items-center justify-center rounded-full border border-accent bg-surface/90 text-xs font-medium text-fg" onPointerDown={() => useGame.getState().setTouch({ swarm: true })} onPointerUp={() => useGame.getState().setTouch({ swarm: false })} onPointerCancel={() => useGame.getState().setTouch({ swarm: false })}>Swarm</button>
          <button type="button" className="pointer-events-auto absolute right-[calc(1rem+env(safe-area-inset-right))] bottom-[calc(1.5rem+env(safe-area-inset-bottom))] z-20 flex size-20 touch-none items-center justify-center rounded-full border border-border bg-fg text-sm font-medium text-bg" onPointerDown={() => useGame.getState().setTouch({ fire: true })} onPointerUp={() => useGame.getState().setTouch({ fire: false })} onPointerCancel={() => useGame.getState().setTouch({ fire: false })}>Drop</button>
        </>
      )}

      {mode === "mafia" && (
        <>
          <button type="button" className="pointer-events-auto absolute right-[calc(1rem+env(safe-area-inset-right))] bottom-[calc(1.5rem+env(safe-area-inset-bottom))] z-20 flex size-[88px] min-h-[44px] min-w-[44px] touch-none items-center justify-center rounded-full border border-border bg-[#c45c4a] text-sm font-bold text-white shadow-lg active:scale-95" onPointerDown={() => useGame.getState().setTouch({ fire: true })} onPointerUp={() => useGame.getState().setTouch({ fire: false })} onPointerCancel={() => useGame.getState().setTouch({ fire: false })}>Shoot</button>
          <button type="button" className="pointer-events-auto absolute right-[calc(112px+env(safe-area-inset-right))] bottom-[calc(1.5rem+env(safe-area-inset-bottom))] z-20 flex size-[64px] min-h-[44px] min-w-[44px] touch-none items-center justify-center rounded-full border border-border bg-surface-2 text-xs font-bold text-[#eab308] shadow-lg active:scale-95" onPointerDown={() => useGame.getState().setTouch({ interact: true })} onPointerUp={() => useGame.getState().setTouch({ interact: false })} onPointerCancel={() => useGame.getState().setTouch({ interact: false })}>Tribute</button>
          <div className="pointer-events-auto absolute right-[calc(1rem+env(safe-area-inset-right))] bottom-[calc(112px+env(safe-area-inset-bottom))] z-20 grid touch-none grid-cols-3 gap-1">
            {(["jump", "pounce", "scratch", "bite", "climb", "nest"] as const).map((action) => (
              <button key={action} type="button" className="h-10 min-w-14 rounded-md border border-border bg-surface/90 px-2 text-[10px] font-bold uppercase text-fg active:scale-95" onPointerDown={() => useGame.getState().setTouch({ mafiaAction: action })}>
                {action}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ClimbBtn({ dir, label, children }: { dir: number; label: string; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      className="flex size-12 items-center justify-center rounded-md border border-border bg-surface/85 text-fg"
      onPointerDown={() => useGame.getState().setTouch({ climb: dir })}
      onPointerUp={() => useGame.getState().setTouch({ climb: 0 })}
      onPointerCancel={() => useGame.getState().setTouch({ climb: 0 })}
    >
      {children}
    </button>
  );
}

function Stick() {
  const origin = useRef({ x: 0, y: 0, id: -1 });
  const onDown = (e: PE<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    origin.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
  };
  const onMove = (e: PE<HTMLDivElement>) => {
    if (origin.current.id !== e.pointerId) return;
    const dx = e.clientX - origin.current.x;
    const dy = e.clientY - origin.current.y;
    const m = Math.hypot(dx, dy) || 1;
    const s = Math.min(1, m / 46);
    useGame.getState().setTouch({ moveX: (dx / m) * s, moveY: (-dy / m) * s });
  };
  const onUp = () => {
    origin.current.id = -1;
    useGame.getState().setTouch({ moveX: 0, moveY: 0 });
  };
  return (
    <div
      className="pointer-events-auto absolute bottom-[calc(1.5rem+env(safe-area-inset-bottom))] left-[calc(1rem+env(safe-area-inset-left))] z-20 size-28 touch-none rounded-full border border-border bg-surface/50"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    />
  );
}

function LookPad() {
  const last = useRef({ x: 0, y: 0, id: -1 });
  const onDown = (e: PE<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    last.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
  };
  const onMove = (e: PE<HTMLDivElement>) => {
    if (last.current.id !== e.pointerId) return;
    const dx = e.clientX - last.current.x;
    const dy = e.clientY - last.current.y;
    last.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    const t = useGame.getState().touch;
    useGame.getState().setTouch({ lookX: t.lookX + dx, lookY: t.lookY + dy });
  };
  const onUp = () => {
    last.current.id = -1;
  };
  return (
    <div className="pointer-events-auto absolute right-0 top-[calc(4rem+env(safe-area-inset-top))] bottom-[calc(4rem+env(safe-area-inset-bottom))] z-0 w-[55%] touch-none" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />
  );
}

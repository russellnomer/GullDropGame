import { useRef, useEffect, useState, type PointerEvent as PE, type ReactNode } from "react";
import { Bird, ChevronDown, ChevronUp, Music, Pause, Play, RotateCcw, Share2, ShoppingBag, Star, Volume2, VolumeX } from "lucide-react";
import { currentGame } from "@/game/runtime";
import { unlockAudio } from "@/game/audio";
import { mountRadio, skipRadio, prevRadio, TRACKS, RELEASES_URL, onNowPlaying, type Track } from "@/game/radio";
import { recentFaults, onFaults, installFaults, type Fault } from "@/game/log";
import { useGame } from "@/game/store";
import { MenuExtras, ShopAndBlotter, postScoreToBlotter, shareScore } from "@/components/shop-panel";

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
  useEffect(() => {
    if (host.current) mountRadio(host.current);
  }, []);
  const live = phase === "playing" || phase === "paused";
  return (
    <div
      className={
        live
          ? "pointer-events-none absolute right-3 bottom-36 z-10 h-[78px] w-[140px] overflow-hidden rounded-md border border-border bg-surface/90"
          : "pointer-events-none fixed top-0 left-0 z-0 h-px w-px overflow-hidden opacity-0"
      }
      aria-hidden={!live}
    >
      <div ref={host} className="h-full w-full" />
      {live && (
        <div className="absolute right-1 bottom-1 flex gap-1">
          <button type="button" className="pointer-events-auto rounded bg-bg/80 px-1.5 py-0.5 text-[10px] text-fg" onClick={() => prevRadio()}>
            Prev
          </button>
          <button type="button" className="pointer-events-auto rounded bg-bg/80 px-1.5 py-0.5 text-[10px] text-fg" onClick={() => skipRadio()}>
            Next
          </button>
        </div>
      )}
    </div>
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
  if (boot()) return;
  let n = 0;
  const id = window.setInterval(() => {
    n += 1;
    if (boot() || n > 120) window.clearInterval(id);
  }, 40);
}

function Menu() {
  const hs = useGame((s) => s.highScore);
  return (
    <div className="pointer-events-auto absolute inset-0 flex items-end justify-center bg-bg/20 p-4 pb-8 sm:items-center">
      <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/50 to-transparent" aria-hidden />
      <div className="relative z-20 w-full max-w-lg rounded-xl border border-border bg-surface/90 p-6 shadow-lg sm:p-8">
        <p className="text-xs font-medium tracking-[0.22em] text-accent uppercase">Atlantic City Boardwalk</p>
        <h1 className="font-display mt-2 text-5xl leading-none tracking-tight text-fg sm:text-6xl">GULL DROP</h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">
          You run the gull family. Gray squirrels on the rails. The Don wears the hat. Taffy shop is a crime scene.
        </p>
        <ul className="mt-4 space-y-1 text-sm text-fg">
          <li>Poop on tourists, politicians, and the Don.</li>
          <li>Lock a mark and press F to send the flock.</li>
          <li>North Inlet to Chelsea. Marina is inland.</li>
        </ul>
        {hs > 0 && <p className="mt-4 font-display text-lg tabular-nums text-accent">Boardwalk record {hs.toLocaleString()}</p>}
        <RadioCard />
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
            <Bird className="size-5" />
            Fly
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
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6">
        <h2 className="font-display text-2xl text-fg">How to soil a city</h2>
        <dl className="mt-4 space-y-3 text-sm leading-relaxed">
          <div>
            <dt className="font-medium text-fg">Look / Fly / Drop</dt>
            <dd className="text-muted">Mouse look. WASD. Space climb, Shift dive. Click to drop. F or right-click to swarm. Loop freely — Q/E roll, hold R to level out.</dd>
          </div>
          <div>
            <dt className="font-medium text-fg">The city</dt>
            <dd className="text-muted">Free roam. Daily contract on the HUD. Steal glowing fry boxes for bonus respect. Pause to clock out.</dd>
          </div>
          <div>
            <dt className="font-medium text-fg">Heat</dt>
            <dd className="text-muted">Cops, politicians, squirrels raise stars. Fat squirrels with sparks roam the whole boards; the Don is in Nut Quarter. At two stars, acorns fly. Three hits = GROUNDED.</dd>
          </div>
        </dl>
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

  return (
    <>
      {flash > 0.04 && (
        <div className="pointer-events-none absolute inset-0 z-10 bg-fg" style={{ opacity: Math.min(0.28, flash * 0.28) }} />
      )}
      {grounded && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-bg/55">
          <p className="font-display text-6xl tracking-tight text-danger sm:text-8xl">GROUNDED</p>
        </div>
      )}
      <div className="absolute top-3 left-3 flex flex-col gap-2">
        <div className="rounded-md border border-border bg-surface/80 px-3 py-2">
          <p className="text-xs tracking-wider text-muted uppercase">Respect</p>
          <p className="font-display text-3xl leading-none tabular-nums text-fg">{score.toLocaleString()}</p>
          <p className="mt-1 text-xs tracking-[0.16em] text-accent uppercase">{district}</p>
          <p className="mt-1 text-xs text-muted">
            {rankName}
            {patron ? " · PATRON" : ""}
          </p>
        </div>
        {combo > 1 && (
          <div className="rounded-md border border-accent/40 bg-surface/80 px-3 py-1.5">
            <p className="font-display text-lg text-accent tabular-nums">x{combo} airmail</p>
          </div>
        )}
        <div className="rounded-md border border-border bg-surface/80 px-3 py-2">
          <p className="text-xs tracking-wider text-muted uppercase">{jobTitle}</p>
          <p className="mt-1 text-xs text-fg">{jobBlurb}</p>
          {jobGoal > 0 && (
            <p className="mt-1 font-display text-sm tabular-nums text-accent">
              {jobProg}/{jobGoal}
            </p>
          )}
          {nextTitle && <p className="mt-1 text-[11px] tracking-wider text-muted uppercase">Next · {nextTitle}</p>}
        </div>
      </div>
      <div className="absolute top-3 left-1/2 -translate-x-1/2 rounded-md border border-border bg-surface/80 px-4 py-1.5">
        <p className="font-display text-2xl tabular-nums text-fg">{fmt(elapsed)}</p>
      </div>
      <div className="absolute top-14 right-16 flex gap-0.5">
        {[0, 1, 2, 3, 4].map((i) => (
          <Star key={i} className={`size-5 ${i < wanted ? "fill-danger text-danger" : "text-subtle"}`} />
        ))}
      </div>
      <div className="absolute top-24 right-16 flex gap-1">
        {[0, 1, 2].map((i) => (
          <span key={i} className={`block size-2 rounded-full ${i < health ? "bg-accent" : "bg-surface-2"}`} />
        ))}
      </div>
      {frenzy && (
        <p className="absolute top-16 left-1/2 -translate-x-1/2 font-display text-sm tracking-[0.2em] text-danger uppercase">Five-star dump</p>
      )}
      {alert && (
        <p className="absolute top-24 left-1/2 w-[min(92%,28rem)] -translate-x-1/2 text-center font-display text-lg tracking-wide text-fg">{alert}</p>
      )}
      {inverted && !alert && (
        <p className="absolute top-24 left-1/2 -translate-x-1/2 font-display text-sm tracking-[0.18em] text-danger uppercase">Inverted — hold R to level</p>
      )}
      <div className="absolute top-1/2 left-1/2 size-5 -translate-x-1/2 -translate-y-1/2">
        <span className={`absolute top-1/2 left-0 h-px w-full ${lockHint ? "bg-accent" : "bg-fg/80"}`} />
        <span className={`absolute top-0 left-1/2 h-full w-px ${lockHint ? "bg-accent" : "bg-fg/80"}`} />
      </div>
      {lockHint && (
        <p className="absolute top-[54%] left-1/2 -translate-x-1/2 font-display text-sm tracking-[0.16em] text-accent uppercase">
          {swarmReady ? `F — swarm ${lockHint}` : lockHint}
        </p>
      )}
      <div className="absolute top-[46%] left-1/2 -translate-x-1/2" aria-hidden>
        <span
          className="block h-0 w-0 border-x-[7px] border-b-[12px] border-x-transparent border-b-accent/90"
          style={{ transform: `rotate(${(jobArrow * 180) / Math.PI}deg)` }}
        />
      </div>
      <div className="absolute right-3 bottom-24 hidden max-w-xs flex-col items-end gap-2 sm:flex">
        {callouts.map((c) => (
          <div key={c.id} className="rounded-md border border-accent/30 bg-surface/90 px-3 py-2 text-right shadow-lg">
            <p className="font-display text-base leading-tight text-fg">“{c.title}”</p>
            <p className="mt-0.5 text-xs tabular-nums text-accent">+{c.pts}</p>
          </div>
        ))}
      </div>
      <div className="absolute bottom-4 left-1/2 hidden -translate-x-1/2 sm:block">
        <div className="flex items-center gap-4 rounded-lg border border-border bg-surface/80 px-4 py-2">
          <span className="text-xs tracking-wider text-muted uppercase">Drop</span>
          <span className="relative block h-2 w-20 overflow-hidden rounded-sm bg-surface-2">
            <span className="absolute inset-y-0 left-0 bg-accent" style={{ width: `${Math.round((1 - cd) * 100)}%` }} />
          </span>
          <span className="text-xs tracking-wider text-muted uppercase">Flock</span>
          <span className="relative block h-2 w-20 overflow-hidden rounded-sm bg-surface-2">
            <span className="absolute inset-y-0 left-0 bg-accent" style={{ width: `${Math.round(swarmCd * 100)}%` }} />
          </span>
        </div>
      </div>
      <MiniMap />
      <button
        type="button"
        className="pointer-events-auto absolute top-3 right-28 flex size-11 items-center justify-center rounded-md border border-border bg-surface/80 text-fg"
        onClick={() => {
          document.exitPointerLock();
          useGame.getState().pause();
        }}
        aria-label="Pause"
      >
        <Pause className="size-5" />
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
  const hs = useGame((s) => s.highScore);
  const stats = useGame((s) => s.stats);
  const record = score >= hs && score > 0;
  useEffect(() => {
    postScoreToBlotter();
  }, [score]);
  return (
    <div className="pointer-events-auto absolute inset-0 z-20 flex items-end justify-center bg-bg/60 p-4 pb-8 sm:items-center">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6">
        <p className="text-xs tracking-[0.2em] text-accent uppercase">Police blotter</p>
        <h2 className="font-display mt-1 text-3xl text-fg">Clocked out</h2>
        <p className="font-display mt-3 text-5xl tabular-nums text-fg">{score.toLocaleString()}</p>
        {record && <p className="mt-1 text-sm text-accent">New boardwalk record</p>}
        <dl className="mt-5 grid grid-cols-2 gap-2 text-sm">
          <Stat k="Hits" v={stats.hits} />
          <Stat k="Jobs done" v={stats.jobs} />
          <Stat k="Squirrels" v={stats.squirrels} />
          <Stat k="Heat peak" v={stats.wantedMax} />
          <Stat k="Politicians glazed" v={stats.pols} />
          <Stat k="Flock strikes" v={stats.swarms} />
          <Stat k="Suits soiled" v={stats.suits} />
          <Stat k="Custards ruined" v={stats.custards} />
        </dl>
        <p className="mt-4 text-xs text-muted">Best combo x{stats.comboMax}</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-md bg-fg text-bg"
            onClick={() => {
              unlockAudio();
              currentGame()?.begin();
            }}
          >
            <RotateCcw className="size-4" />
            Again
          </button>
          <button type="button" className="flex h-12 flex-1 items-center justify-center rounded-md border border-border text-fg" onClick={() => useGame.getState().toMenu()}>
            Menu
          </button>
        </div>
        <button type="button" className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-md border border-border text-sm text-fg" onClick={() => shareScore()}>
          <Share2 className="size-4" />
          Brag on X
        </button>
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
  return (
    <div className="pointer-events-none absolute inset-0">
      <LookPad />
      <Stick />
      <div className="pointer-events-auto absolute right-4 bottom-28 flex flex-col gap-2 sm:hidden">
        <ClimbBtn dir={1} label="Climb">
          <ChevronUp className="size-6" />
        </ClimbBtn>
        <ClimbBtn dir={-1} label="Dive">
          <ChevronDown className="size-6" />
        </ClimbBtn>
        <button
          type="button"
          className="flex h-11 items-center justify-center rounded-md border border-border bg-surface/85 px-3 text-xs font-medium text-fg"
          onPointerDown={() => useGame.getState().setTouch({ level: true })}
          onPointerUp={() => useGame.getState().setTouch({ level: false })}
          onPointerCancel={() => useGame.getState().setTouch({ level: false })}
        >
          Level
        </button>
      </div>
      <button
        type="button"
        className="pointer-events-auto absolute right-28 bottom-6 flex size-16 items-center justify-center rounded-full border border-accent bg-surface/90 text-xs font-medium text-fg sm:hidden"
        onPointerDown={() => useGame.getState().setTouch({ swarm: true })}
        onPointerUp={() => useGame.getState().setTouch({ swarm: false })}
        onPointerCancel={() => useGame.getState().setTouch({ swarm: false })}
      >
        Swarm
      </button>
      <button
        type="button"
        className="pointer-events-auto absolute right-4 bottom-6 flex size-20 items-center justify-center rounded-full border border-border bg-fg text-sm font-medium text-bg sm:hidden"
        onPointerDown={() => useGame.getState().setTouch({ fire: true })}
        onPointerUp={() => useGame.getState().setTouch({ fire: false })}
        onPointerCancel={() => useGame.getState().setTouch({ fire: false })}
      >
        Drop
      </button>
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
      className="pointer-events-auto absolute bottom-6 left-4 size-28 rounded-full border border-border bg-surface/50 sm:hidden"
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
    <div className="pointer-events-auto absolute inset-y-16 right-0 w-[55%] sm:hidden" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />
  );
}

import { useGame } from "./store";
import { startRadio } from "./radio";
import { fault } from "./log";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let sfx: GainNode | null = null;
let sfxMeter: AnalyserNode | null = null;
let amb: GainNode | null = null;
let ocean: AudioBufferSourceNode | null = null;
let noise: AudioBuffer | null = null;
let unlockPromise: Promise<boolean> | null = null;
let warnedUnavailable = false;

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new C({ latencyHint: "interactive" });
    master = ctx.createGain();
    sfx = ctx.createGain();
    sfxMeter = ctx.createAnalyser();
    amb = ctx.createGain();
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -8;
    limiter.knee.value = 8;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.18;
    master.gain.value = 0.82;
    sfx.gain.value = 0.95;
    amb.gain.value = 0.22;
    sfxMeter.fftSize = 2048;
    sfx.connect(sfxMeter);
    sfxMeter.connect(master);
    amb.connect(master);
    master.connect(limiter);
    limiter.connect(ctx.destination);
  }
  return ctx;
}

function reportAudioFailure(message: string, err?: unknown) {
  fault("warn", `Audio: ${message}`, err);
}

function prime(c: AudioContext) {
  const source = c.createBufferSource();
  source.buffer = c.createBuffer(1, 1, c.sampleRate);
  source.connect(c.destination);
  source.start();
}

export function unlockAudio(): Promise<boolean> {
  if (unlockPromise) return unlockPromise;
  try {
    const c = ac();
    if (!c) {
      if (!warnedUnavailable) {
        warnedUnavailable = true;
        reportAudioFailure("Web Audio is unavailable");
      }
      return Promise.resolve(false);
    }
    unlockPromise = (async () => {
      if (c.state !== "running") await c.resume();
      if (c.state !== "running") throw new Error(`context remained ${c.state}`);
      prime(c);
      startOcean();
      startRadio();
      return true;
    })().catch((err) => {
      reportAudioFailure("could not be unlocked", err);
      return false;
    }).finally(() => {
      unlockPromise = null;
    });
    return unlockPromise;
  } catch (err) {
    reportAudioFailure("could not be initialized", err);
    return Promise.resolve(false);
  }
}

export function resumeAudio() {
  void unlockAudio();
}

export type SoundCheckResult = "played" | "muted" | "blocked";

export async function playSoundCheck(): Promise<SoundCheckResult> {
  const ready = await unlockAudio();
  if (!ready) return "blocked";
  if (silent()) return "muted";
  playReadyVictimReaction("ordinary");
  return "played";
}

function silent(): boolean {
  return useGame.getState().muted;
}

function envGain(t: number, a: number, d: number, vol: number): GainNode | null {
  const c = ac();
  if (!c || !sfx) return null;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  g.connect(sfx);
  return g;
}

function noiseBuffer(c: AudioContext): AudioBuffer {
  if (noise) return noise;
  noise = c.createBuffer(1, Math.ceil(c.sampleRate * 0.42), c.sampleRate);
  const data = noise.getChannelData(0);
  let previous = 0;
  for (let i = 0; i < data.length; i++) {
    previous = previous * 0.72 + (Math.random() * 2 - 1) * 0.28;
    data[i] = previous;
  }
  return noise;
}

function tone(
  c: AudioContext,
  t: number,
  from: number,
  to: number,
  duration: number,
  volume: number,
  type: OscillatorType = "triangle",
) {
  const oscillator = c.createOscillator();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(from, t);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + duration);
  const gain = envGain(t, 0.006, duration, volume);
  if (!gain) return;
  oscillator.connect(gain);
  oscillator.start(t);
  oscillator.stop(t + duration + 0.02);
}

function texture(c: AudioContext, t: number, duration: number, volume: number, cutoff: number) {
  const source = c.createBufferSource();
  source.buffer = noiseBuffer(c);
  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(cutoff, t);
  filter.Q.value = 0.7;
  const gain = envGain(t, 0.003, duration, volume);
  if (!gain) return;
  source.connect(filter);
  filter.connect(gain);
  source.start(t);
  source.stop(t + duration + 0.02);
}

/** A small pair of filtered tones suggests a vowel without using recorded or spoken audio. */
function vocal(c: AudioContext, t: number, pitch: number, volume: number, length = 0.16, rise = false) {
  const end = rise ? pitch * 1.22 : pitch * 0.72;
  tone(c, t, pitch, end, length, volume, "triangle");
  tone(c, t + 0.012, pitch * 1.95, end * 1.65, length * 0.82, volume * 0.34, "sine");
}

function impact(c: AudioContext, t: number, big = false) {
  tone(c, t, big ? 145 : 210, 48, big ? 0.2 : 0.14, big ? 0.115 : 0.075, "sine");
  texture(c, t, big ? 0.075 : 0.045, big ? 0.042 : 0.028, big ? 980 : 1250);
}

export type VictimReaction = "ordinary" | "gag" | "surprised" | "authority" | "showstopper" | "vip" | "pitboss" | "swarm" | "squirrel" | "car" | "bus";

/**
 * Plays one curated, short reaction per victim category.  Keeping the selection here
 * avoids stacking every possible reaction on a single hit.
 */
function playReadyVictimReaction(reaction: VictimReaction) {
  if (silent()) return;
  const c = ac();
  if (!c) return;
  const t = c.currentTime;
  const variant = (Math.random() * 3) | 0;

  if (reaction === "pitboss") {
    impact(c, t, true);
    vocal(c, t + 0.025, 245, 0.065, 0.2, true);
    // A deliberately oversized, but still soft, casino jackpot flourish.
    [392, 523, 659, 784, 1047].forEach((frequency, index) => {
      tone(c, t + 0.07 + index * 0.055, frequency, frequency * 1.04, 0.17, 0.048, "square");
    });
    texture(c, t + 0.1, 0.14, 0.022, 2200);
    return;
  }

  if (reaction === "vip") {
    impact(c, t, true);
    vocal(c, t + 0.015, variant === 0 ? 420 : 350, 0.06, 0.18, variant === 0);
    [659, 784, 988].forEach((frequency, index) => tone(c, t + 0.07 + index * 0.055, frequency, frequency, 0.12, 0.034, "triangle"));
    return;
  }

  if (reaction === "swarm") {
    impact(c, t, true);
    texture(c, t + 0.035, 0.12, 0.035, 1500);
    vocal(c, t + 0.02, 300 + variant * 65, 0.055, 0.2, false);
    return;
  }

  if (reaction === "squirrel") {
    impact(c, t, false);
    [980, 1320, 760].forEach((frequency, index) => {
      tone(c, t + index * 0.055, frequency, frequency * 1.18, 0.09, 0.052, "square");
    });
    texture(c, t + 0.08, 0.08, 0.02, 2400);
    return;
  }

  if (reaction === "car") {
    impact(c, t, true);
    tone(c, t + 0.035, 310, 250, 0.24, 0.065, "square");
    tone(c, t + 0.055, 415, 340, 0.24, 0.052, "square");
    return;
  }

  if (reaction === "bus") {
    impact(c, t, true);
    tone(c, t + 0.03, 125, 72, 0.3, 0.095, "sawtooth");
    [330, 392, 494].forEach((frequency, index) => {
      tone(c, t + 0.12 + index * 0.07, frequency, frequency * 0.92, 0.16, 0.045, "square");
    });
    return;
  }

  impact(c, t, false);
  if (reaction === "gag") {
    tone(c, t + 0.025, 150 + variant * 18, 68, 0.15, 0.07, "triangle");
    texture(c, t + 0.075, 0.09, 0.027, 740);
    vocal(c, t + 0.1, 260 + variant * 30, 0.035, 0.11, false);
    return;
  }

  if (reaction === "authority") {
    vocal(c, t + 0.018, 370 + variant * 42, 0.065, 0.2, true);
    tone(c, t + 0.055, 720, 480, 0.11, 0.027, "square");
    return;
  }

  if (reaction === "showstopper") {
    vocal(c, t + 0.012, 480 + variant * 50, 0.065, 0.23, variant !== 1);
    tone(c, t + 0.13, 740, 430, 0.13, 0.03, "triangle");
    return;
  }

  if (reaction === "surprised") {
    vocal(c, t + 0.012, 390 + variant * 55, 0.06, 0.18, true);
    texture(c, t + 0.07, 0.055, 0.018, 1800);
    return;
  }

  if (variant === 0) vocal(c, t + 0.015, 310, 0.058, 0.15, true);
  else if (variant === 1) {
    vocal(c, t + 0.012, 405, 0.05, 0.12, false);
    texture(c, t + 0.075, 0.07, 0.018, 1050);
  } else {
    tone(c, t + 0.02, 185, 90, 0.14, 0.055, "triangle");
    vocal(c, t + 0.08, 285, 0.035, 0.1, false);
  }
}

export function playVictimReaction(reaction: VictimReaction) {
  if (silent()) return;
  const c = ac();
  if (!c) return;
  if (c.state === "running") {
    playReadyVictimReaction(reaction);
    return;
  }
  void unlockAudio().then((ready) => {
    if (ready) playReadyVictimReaction(reaction);
    else reportAudioFailure(`${reaction} reaction could not play`);
  });
}

export function audioContextState(): AudioContextState | "unavailable" {
  return ctx?.state ?? "unavailable";
}

/**
 * Browser-regression diagnostic: trigger a real reaction graph and sample the
 * SFX bus. Ambient ocean/radio audio cannot create a false positive here.
 */
export async function measureVictimReaction(reaction: VictimReaction): Promise<number> {
  const c = ac();
  if (!c || !sfxMeter || c.state !== "running" || silent()) return 0;
  const samples = new Float32Array(sfxMeter.fftSize);
  let peak = 0;
  playVictimReaction(reaction);
  const deadline = performance.now() + 650;
  while (performance.now() < deadline) {
    sfxMeter.getFloatTimeDomainData(samples);
    for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
  return peak;
}

if (typeof window !== "undefined") {
  window.__gullAudioTest = {
    getState: audioContextState,
    measureReaction: measureVictimReaction,
  };
}

export function playSquawk() {
  if (silent()) return;
  const c = ac();
  if (!c) return;
  const t = c.currentTime;
  const o = c.createOscillator();
  o.type = "sawtooth";
  o.frequency.setValueAtTime(620, t);
  o.frequency.exponentialRampToValueAtTime(280, t + 0.16);
  const g = envGain(t, 0.01, 0.16, 0.09);
  if (!g) return;
  o.connect(g);
  o.start(t);
  o.stop(t + 0.18);
}

export function playPlop() {
  if (silent()) return;
  const c = ac();
  if (!c) return;
  const t = c.currentTime;
  const o = c.createOscillator();
  o.type = "sine";
  o.frequency.setValueAtTime(180, t);
  o.frequency.exponentialRampToValueAtTime(70, t + 0.12);
  const g = envGain(t, 0.005, 0.12, 0.1);
  if (!g) return;
  o.connect(g);
  o.start(t);
  o.stop(t + 0.14);
}

export function playHit(big = false) {
  if (silent()) return;
  const c = ac();
  if (!c) return;
  const t = c.currentTime;
  const o = c.createOscillator();
  o.type = "triangle";
  o.frequency.setValueAtTime(big ? 160 : 220, t);
  o.frequency.exponentialRampToValueAtTime(50, t + 0.2);
  const g = envGain(t, 0.005, 0.22, big ? 0.14 : 0.09);
  if (!g) return;
  o.connect(g);
  o.start(t);
  o.stop(t + 0.24);
}

export function playBonus() {
  if (silent()) return;
  const c = ac();
  if (!c) return;
  const t = c.currentTime;
  [523, 659, 784].forEach((f, i) => {
    const o = c.createOscillator();
    o.type = "square";
    o.frequency.value = f;
    const g = envGain(t + i * 0.05, 0.01, 0.12, 0.05);
    if (!g) return;
    o.connect(g);
    o.start(t + i * 0.05);
    o.stop(t + i * 0.05 + 0.14);
  });
}

export function playScream() {
  if (silent()) return;
  const c = ac();
  if (!c) return;
  const t = c.currentTime;
  const o = c.createOscillator();
  o.type = "sawtooth";
  o.frequency.setValueAtTime(520 + Math.random() * 180, t);
  o.frequency.exponentialRampToValueAtTime(220, t + 0.32);
  const g = envGain(t, 0.01, 0.32, 0.08);
  if (!g) return;
  o.connect(g);
  o.start(t);
  o.stop(t + 0.36);
}

export function playGag() {
  if (silent()) return;
  const c = ac();
  if (!c) return;
  const t = c.currentTime;
  const o = c.createOscillator();
  o.type = "triangle";
  o.frequency.setValueAtTime(140, t);
  o.frequency.exponentialRampToValueAtTime(70, t + 0.18);
  const g = envGain(t, 0.005, 0.2, 0.11);
  if (!g) return;
  o.connect(g);
  o.start(t);
  o.stop(t + 0.22);
  const o2 = c.createOscillator();
  o2.type = "square";
  o2.frequency.setValueAtTime(380, t + 0.08);
  o2.frequency.exponentialRampToValueAtTime(160, t + 0.28);
  const g2 = envGain(t + 0.08, 0.01, 0.2, 0.05);
  if (g2) {
    o2.connect(g2);
    o2.start(t + 0.08);
    o2.stop(t + 0.3);
  }
}

export function playYell() {
  if (silent()) return;
  const c = ac();
  if (!c) return;
  const t = c.currentTime;
  const o = c.createOscillator();
  o.type = "square";
  o.frequency.setValueAtTime(640, t);
  o.frequency.linearRampToValueAtTime(880, t + 0.08);
  o.frequency.exponentialRampToValueAtTime(300, t + 0.28);
  const g = envGain(t, 0.008, 0.26, 0.07);
  if (!g) return;
  o.connect(g);
  o.start(t);
  o.stop(t + 0.3);
}

export function playChirp() {
  if (silent()) return;
  const c = ac();
  if (!c) return;
  const t = c.currentTime;
  const o = c.createOscillator();
  o.type = "square";
  o.frequency.setValueAtTime(920, t);
  o.frequency.exponentialRampToValueAtTime(1400, t + 0.06);
  const g = envGain(t, 0.005, 0.16, 0.08);
  if (!g) return;
  o.connect(g);
  o.start(t);
  o.stop(t + 0.18);
}

export function playThump() {
  if (silent()) return;
  const c = ac();
  if (!c) return;
  const t = c.currentTime;
  const o = c.createOscillator();
  o.type = "sine";
  o.frequency.setValueAtTime(140, t);
  o.frequency.exponentialRampToValueAtTime(50, t + 0.18);
  const g = envGain(t, 0.005, 0.18, 0.12);
  if (!g) return;
  o.connect(g);
  o.start(t);
  o.stop(t + 0.2);
}

function startOcean() {
  const c = ac();
  if (!c || !amb || ocean) return;
  const len = c.sampleRate * 3;
  const b = c.createBuffer(1, len, c.sampleRate);
  const d = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    d[i] = last * 3.5;
  }
  const src = c.createBufferSource();
  src.buffer = b;
  src.loop = true;
  const f = c.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = 400;
  src.connect(f);
  f.connect(amb);
  src.start();
  ocean = src;
}

declare global {
  interface Window {
    __gullAudioTest?: {
      getState: () => AudioContextState | "unavailable";
      measureReaction: (reaction: VictimReaction) => Promise<number>;
    };
  }
}

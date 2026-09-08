import { useGame } from "./store";
import { startRadio } from "./radio";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let sfx: GainNode | null = null;
let amb: GainNode | null = null;
let ocean: AudioBufferSourceNode | null = null;

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new C({ latencyHint: "interactive" });
    master = ctx.createGain();
    sfx = ctx.createGain();
    amb = ctx.createGain();
    sfx.gain.value = 0.9;
    amb.gain.value = 0.22;
    sfx.connect(master);
    amb.connect(master);
    master.connect(ctx.destination);
  }
  return ctx;
}

export function unlockAudio() {
  try {
    const c = ac();
    if (!c) return;
    if (c.state === "suspended") void c.resume();
    startOcean();
    startRadio();
  } catch (err) {
    console.warn("[Gull Drop] audio", err);
  }
}

export function resumeAudio() {
  const c = ac();
  if (c && c.state === "suspended") void c.resume();
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

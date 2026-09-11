import { create } from "zustand";
import { equippedSkin, equippedWeapon, loadSave, rankFor, writeSave, type OfferId } from "./progress";
import { jobList } from "./jobs";
import { readChallenge, type Challenge } from "./challenge";
import type { MafiaAction } from "./input";

export type Phase = "menu" | "playing" | "paused" | "gameover";

export type GameMode = "gull" | "mafia";

export type MafiaStats = {
  banked: number;
  unbanked: number;
  chain: number;
  maxChain: number;
  chainTimer: number;
  acornCd: number;
  prompt: string | null;
  catWarning: boolean;
};

export type Callout = { id: number; title: string; pts: number };

export type RoundStats = {
  hits: number;
  custards: number;
  selfies: number;
  proposals: number;
  naps: number;
  balloons: number;
  feeders: number;
  hotdogs: number;
  dogWalkers: number;
  dogs: number;
  suits: number;
  pols: number;
  swarms: number;
  squirrels: number;
  jobs: number;
  wantedMax: number;
  comboMax: number;
};

const HS_KEY = "gull-drop-hs-v1";
const MAFIA_HS_KEY = "gull-drop-mafia-hs-v1";

function readMafiaHigh(): number {
  try {
    const n = Number(localStorage.getItem(MAFIA_HS_KEY) ?? "0");
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function readHigh(): number {
  try {
    const n = Number(localStorage.getItem(HS_KEY) ?? "0");
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

const emptyMafiaStats = (): MafiaStats => ({
  banked: 0,
  unbanked: 0,
  chain: 0,
  maxChain: 0,
  chainTimer: 0,
  acornCd: 0,
  prompt: null,
  catWarning: false,
});

const emptyStats = (): RoundStats => ({
  hits: 0,
  custards: 0,
  selfies: 0,
  proposals: 0,
  naps: 0,
  balloons: 0,
  feeders: 0,
  hotdogs: 0,
  dogWalkers: 0,
  dogs: 0,
  suits: 0,
  pols: 0,
  swarms: 0,
  squirrels: 0,
  jobs: 0,
  wantedMax: 0,
  comboMax: 0,
});

export type TouchState = {
  interact: boolean;
  joyX: number;
  joyY: number;
  moveX: number;
  moveY: number;
  climb: number;
  lookX: number;
  lookY: number;
  fire: boolean;
  swarm: boolean;
  level: boolean;
  mafiaAction: MafiaAction | null;
};

type Patch = Partial<
  Pick<
    GameState,
    | "mode"
    | "mafiaStats"
    | "mafiaHighScore"
    | "highScore"
    | "entitlements"
    | "weaponId"
    | "score"
    | "combo"
    | "timeLeft"
    | "cooldown"
    | "alert"
    | "frenzy"
    | "callouts"
    | "stats"
    | "lockHint"
    | "swarmCd"
    | "wanted"
    | "district"
    | "jobTitle"
    | "jobBlurb"
    | "jobProg"
    | "jobGoal"
    | "nextTitle"
    | "jobArrow"
    | "health"
    | "grounded"
    | "elapsed"
    | "yaw"
    | "playerX"
    | "playerZ"
    | "bombAimX"
    | "bombAimY"
    | "bombAimVisible"
    | "bombAimLocked"
    | "blips"
    | "flash"
    | "lifetime"
    | "rankName"
    | "patron"
    | "inverted"
  >
>;

type GameState = {
  mode: GameMode;
  mafiaHighScore: number;
  mafiaStats: MafiaStats;
  setMode: (m: GameMode) => void;
  phase: Phase;
  score: number;
  combo: number;
  timeLeft: number;
  cooldown: number;
  highScore: number;
  alert: string | null;
  callouts: Callout[];
  stats: RoundStats;
  frenzy: boolean;
  lockHint: string | null;
  swarmCd: number;
  wanted: number;
  district: string;
  jobTitle: string;
  jobBlurb: string;
  jobProg: number;
  jobGoal: number;
  nextTitle: string;
  jobArrow: number;
  health: number;
  grounded: boolean;
  elapsed: number;
  yaw: number;
  playerX: number;
  playerZ: number;
  bombAimX: number;
  bombAimY: number;
  bombAimVisible: boolean;
  bombAimLocked: boolean;
  blips: Array<{ x: number; z: number; k: "player" | "sq" | "don" | "job" }>;
  flash: number;
  lifetime: number;
  rankName: string;
  patron: boolean;
  inverted: boolean;
  skinId: string;
  weaponId: string;
  handle: string;
  shopOpen: boolean;
  blotterOpen: boolean;
  locked: boolean;
  howTo: boolean;
  muted: boolean;
  radioOff: boolean;
  touch: TouchState;
  challenge: Challenge | null;
  entitlements: OfferId[];
  setChallenge: (c: Challenge | null) => void;
  grantOffer: (offer: OfferId) => void;
  replaceEntitlements: (offers: OfferId[]) => void;
  start: () => void;
  pause: () => void;
  resume: () => void;
  end: () => void;
  toMenu: () => void;
  setHowTo: (v: boolean) => void;
  setShop: (v: boolean) => void;
  setBlotter: (v: boolean) => void;
  grantPatron: () => void;
  setSkin: (id: string) => void;
  setWeapon: (id: string) => void;
  toggleMute: () => void;
  toggleRadio: () => void;
  setLocked: (v: boolean) => void;
  patch: (p: Patch) => void;
  setTouch: (p: Partial<TouchState>) => void;
  resetInput: () => void;
  consumeLook: () => { x: number; y: number };
};

export const useGame = create<GameState>((set, get) => {
  const save = typeof window !== "undefined" ? loadSave() : loadSave();
  const opener = jobList()[0];
  return {
  mode: "gull",
  setMode: (m) => set({ mode: m }),
  mafiaHighScore: typeof window !== "undefined" ? readMafiaHigh() : 0,
  mafiaStats: emptyMafiaStats(),
  phase: "menu",
  score: 0,
  combo: 0,
  timeLeft: 90,
  cooldown: 0,
  highScore: typeof window !== "undefined" ? readHigh() : 0,
  alert: null,
  callouts: [],
  stats: emptyStats(),
  frenzy: false,
  lockHint: null,
  swarmCd: 1,
  wanted: 0,
  district: "CUSTARD STRETCH",
  jobTitle: "",
  jobBlurb: "",
  jobProg: 0,
  jobGoal: 1,
  nextTitle: "",
  jobArrow: 0,
  health: 3,
  grounded: false,
  elapsed: 0,
  yaw: 0,
  playerX: 0,
  playerZ: 0,
  bombAimX: 50,
  bombAimY: 78,
  bombAimVisible: true,
  bombAimLocked: false,
  blips: [],
  flash: 0,
  lifetime: save.lifetime,
  rankName: rankFor(save.lifetime).name,
  patron: save.patron,
  inverted: false,
  skinId: equippedSkin(save).id,
  weaponId: equippedWeapon(save).id,
  handle: save.handle,
  shopOpen: false,
  blotterOpen: false,
  locked: false,
  howTo: false,
  muted: false,
  radioOff: typeof window !== "undefined" && localStorage.getItem("gull-drop-radio-off") === "1",
  touch: { moveX: 0, moveY: 0, climb: 0, lookX: 0, lookY: 0, fire: false, swarm: false, level: false, interact: false, joyX: 0, joyY: 0, mafiaAction: null },
  challenge: typeof window !== "undefined" ? readChallenge() : null,
  entitlements: save.entitlements,
  setChallenge: (c) => set({ challenge: c }),
  grantOffer: (offer) => {
    const current = loadSave();
    const entitlements = Array.from(new Set([...current.entitlements, offer]));
    const next = writeSave({
      entitlements,
      patron: current.patron || offer === "patron",
      skin: offer === "founder" ? "contraband" : offer === "patron" ? "gold" : offer === "messy" ? "messy" : current.skin,
    });
    set({ entitlements: next.entitlements, patron: next.patron, skinId: equippedSkin(next).id, weaponId: equippedWeapon(next).id });
  },
  replaceEntitlements: (offers) => {
    const current = loadSave();
    const entitlements = Array.from(new Set(offers));
    const next = writeSave({
      entitlements,
      patron: entitlements.includes("patron"),
    });
    const skinId = equippedSkin(next).id;
    writeSave({ skin: skinId });
    set({ entitlements, patron: next.patron, skinId });
  },
  start: () => {
    const opener = jobList()[0];
    const mode = get().mode;
    set({
      mafiaStats: emptyMafiaStats(),
      phase: "playing",
      score: 0,
      combo: 0,
      timeLeft: 90,
      cooldown: 0,
      alert: mode === "mafia" ? "THE DON SENDS HIS REGARDS" : "THEY NEVER LOOK UP",
      callouts: [],
      stats: emptyStats(),
      frenzy: false,
      lockHint: null,
      swarmCd: 1,
      wanted: 0,
      district: "CUSTARD STRETCH",
      jobTitle: opener.title,
      jobBlurb: opener.blurb,
      jobProg: 0,
      jobGoal: opener.goal,
      nextTitle: "",
      jobArrow: 0,
      health: 3,
      grounded: false,
      elapsed: 0,
      bombAimX: 50,
      bombAimY: 78,
      bombAimVisible: true,
      bombAimLocked: false,
      howTo: false,
      shopOpen: false,
      blotterOpen: false,
      inverted: false,
    });
  },
  pause: () => {
    if (get().phase === "playing") set({ phase: "paused" });
  },
  resume: () => {
    if (get().phase === "paused") set({ phase: "playing" });
  },
    end: () => {
    const { score, highScore, mode, mafiaStats, mafiaHighScore } = get();
    const mhs = Math.max(mafiaStats.banked, mafiaHighScore);
    const hs = Math.max(score, highScore);

    if (mode === "mafia") {
      try { localStorage.setItem(MAFIA_HS_KEY, String(mhs)); } catch {
        // Private browsing can deny storage; the completed round must still render.
      }
      const next = writeSave({ lifetime: loadSave().lifetime + mafiaStats.banked });
      set({
        phase: "gameover",
        mafiaHighScore: mhs,
        locked: false,
        lifetime: next.lifetime,
        rankName: rankFor(next.lifetime).name,
      });
    } else {
      try { localStorage.setItem(HS_KEY, String(hs)); } catch {
        // Private browsing can deny storage; the completed round must still render.
      }
      const next = writeSave({ lifetime: loadSave().lifetime + score });
      set({
        phase: "gameover",
        highScore: hs,
        locked: false,
        lifetime: next.lifetime,
        rankName: rankFor(next.lifetime).name,
      });
    }
  },
  toMenu: () =>
    set({
      phase: "menu",
      howTo: false,
      locked: false,
      alert: null,
      callouts: [],
      frenzy: false,
      grounded: false,
    }),
  setHowTo: (v) => set({ howTo: v }),
  setShop: (v) => set({ shopOpen: v, blotterOpen: v ? false : get().blotterOpen }),
  setBlotter: (v) => set({ blotterOpen: v, shopOpen: v ? false : get().shopOpen }),
  grantPatron: () => {
    get().grantOffer("patron");
  },
  setSkin: (id) => {
    const next = writeSave({ skin: id });
    set({ skinId: next.skin });
  },
  setWeapon: (id) => {
    const next = writeSave({ weapon: id });
    set({ weaponId: equippedWeapon(next).id });
  },
  toggleMute: () => set({ muted: !get().muted }),
  toggleRadio: () => {
    const radioOff = !get().radioOff;
    try {
      localStorage.setItem("gull-drop-radio-off", radioOff ? "1" : "0");
    } catch {
      /* ignore */
    }
    set({ radioOff });
  },
  setLocked: (v) => set({ locked: v }),
  patch: (p) => set(p),
  setTouch: (p) => set({ touch: { ...get().touch, ...p } }),
  resetInput: () => set({ touch: { lookX: 0, lookY: 0, moveX: 0, moveY: 0, level: false, fire: false, interact: false, swarm: false, climb: 0, joyX: 0, joyY: 0, mafiaAction: null } }),
  consumeLook: () => {
    const { lookX, lookY } = get().touch;
    if (lookX === 0 && lookY === 0) return { x: 0, y: 0 };
    set({ touch: { ...get().touch, lookX: 0, lookY: 0 } });
    return { x: lookX, y: lookY };
  },
};
});

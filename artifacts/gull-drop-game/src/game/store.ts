import { create } from "zustand";
import { equippedSkin, loadSave, rankFor, writeSave } from "./progress";
import { jobList } from "./jobs";

export type Phase = "menu" | "playing" | "paused" | "gameover";

export type Callout = { id: number; title: string; pts: number };

export type RoundStats = {
  hits: number;
  custards: number;
  selfies: number;
  proposals: number;
  naps: number;
  balloons: number;
  feeders: number;
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

function readHigh(): number {
  try {
    const n = Number(localStorage.getItem(HS_KEY) ?? "0");
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

const emptyStats = (): RoundStats => ({
  hits: 0,
  custards: 0,
  selfies: 0,
  proposals: 0,
  naps: 0,
  balloons: 0,
  feeders: 0,
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
  moveX: number;
  moveY: number;
  climb: number;
  lookX: number;
  lookY: number;
  fire: boolean;
  swarm: boolean;
  level: boolean;
};

type Patch = Partial<
  Pick<
    GameState,
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
    | "blips"
    | "flash"
    | "lifetime"
    | "rankName"
    | "patron"
    | "inverted"
  >
>;

type GameState = {
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
  blips: Array<{ x: number; z: number; k: "player" | "sq" | "don" | "job" }>;
  flash: number;
  lifetime: number;
  rankName: string;
  patron: boolean;
  inverted: boolean;
  skinId: string;
  handle: string;
  shopOpen: boolean;
  blotterOpen: boolean;
  locked: boolean;
  howTo: boolean;
  muted: boolean;
  radioOff: boolean;
  touch: TouchState;
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
  toggleMute: () => void;
  toggleRadio: () => void;
  setLocked: (v: boolean) => void;
  patch: (p: Patch) => void;
  setTouch: (p: Partial<TouchState>) => void;
  consumeLook: () => { x: number; y: number };
};

export const useGame = create<GameState>((set, get) => {
  const save = typeof window !== "undefined" ? loadSave() : loadSave();
  const opener = jobList()[0];
  return {
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
  blips: [],
  flash: 0,
  lifetime: save.lifetime,
  rankName: rankFor(save.lifetime).name,
  patron: save.patron,
  inverted: false,
  skinId: equippedSkin(save).id,
  handle: save.handle,
  shopOpen: false,
  blotterOpen: false,
  locked: false,
  howTo: false,
  muted: false,
  radioOff: typeof window !== "undefined" && localStorage.getItem("gull-drop-radio-off") === "1",
  touch: { moveX: 0, moveY: 0, climb: 0, lookX: 0, lookY: 0, fire: false, swarm: false, level: false },
  start: () =>
    set({
      phase: "playing",
      score: 0,
      combo: 0,
      timeLeft: 90,
      cooldown: 0,
      alert: "THEY NEVER LOOK UP",
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
      howTo: false,
      shopOpen: false,
      blotterOpen: false,
      inverted: false,
    }),
  pause: () => {
    if (get().phase === "playing") set({ phase: "paused" });
  },
  resume: () => {
    if (get().phase === "paused") set({ phase: "playing" });
  },
  end: () => {
    const { score, highScore } = get();
    const hs = Math.max(score, highScore);
    try {
      localStorage.setItem(HS_KEY, String(hs));
    } catch {
      /* ignore */
    }
    const next = writeSave({ lifetime: loadSave().lifetime + score });
    set({
      phase: "gameover",
      highScore: hs,
      locked: false,
      lifetime: next.lifetime,
      rankName: rankFor(next.lifetime).name,
    });
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
    const next = writeSave({ patron: true, skin: "gold" });
    set({ patron: true, skinId: "gold" });
    void next;
  },
  setSkin: (id) => {
    const next = writeSave({ skin: id });
    set({ skinId: next.skin });
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
  consumeLook: () => {
    const { lookX, lookY } = get().touch;
    if (lookX === 0 && lookY === 0) return { x: 0, y: 0 };
    set({ touch: { ...get().touch, lookX: 0, lookY: 0 } });
    return { x: lookX, y: lookY };
  },
};
});

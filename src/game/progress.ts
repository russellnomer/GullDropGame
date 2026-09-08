export type Skin = {
  id: string;
  name: string;
  blurb: string;
  need: number;
  patron?: boolean;
  bird: number;
  drop: number;
};

export const SKINS: Skin[] = [
  { id: "cream", name: "Boardwalk Cream", blurb: "The working bird.", need: 0, bird: 0xf4f1ea, drop: 0xf4f1ea },
  { id: "teal", name: "Airmail Teal", blurb: "Matches the spark.", need: 4000, bird: 0x5eb7ae, drop: 0x5eb7ae },
  { id: "sauce", name: "Hot Sauce", blurb: "Looks like a health violation.", need: 12000, bird: 0xc45c4a, drop: 0xc45c4a },
  { id: "midnight", name: "Midnight Dump", blurb: "Night shift, worse morals.", need: 30000, bird: 0x1c2430, drop: 0xb8c4c8 },
  { id: "gold", name: "Patron Gold", blurb: "Uncle Beaky's favorite color.", need: 0, patron: true, bird: 0xf3e5ab, drop: 0xf3e5ab },
];

export type Rank = { name: string; need: number };

export const RANKS: Rank[] = [
  { name: "PIGEON", need: 0 },
  { name: "HERRING GULL", need: 2500 },
  { name: "AIRMAIL CAPO", need: 10000 },
  { name: "BOARDWALK DON", need: 40000 },
  { name: "CIVIC NIGHTMARE", need: 100000 },
];

export type Save = {
  lifetime: number;
  patron: boolean;
  skin: string;
  handle: string;
  dailyDate: string;
  dailyDone: boolean;
};

const KEY = "gull-drop-save-v2";

function newHandle(): string {
  const n = Math.floor(Math.random() * 36 ** 4)
    .toString(36)
    .toUpperCase()
    .padStart(4, "0");
  return `GULL-${n}`;
}

export function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function loadSave(): Save {
  const fallback: Save = {
    lifetime: 0,
    patron: false,
    skin: "cream",
    handle: newHandle(),
    dailyDate: "",
    dailyDone: false,
  };
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      localStorage.setItem(KEY, JSON.stringify(fallback));
      return fallback;
    }
    const s = { ...fallback, ...(JSON.parse(raw) as Partial<Save>) };
    if (s.dailyDate !== todayKey()) {
      s.dailyDate = todayKey();
      s.dailyDone = false;
    }
    return s;
  } catch {
    return fallback;
  }
}

export function writeSave(p: Partial<Save>): Save {
  const s = { ...loadSave(), ...p };
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
  return s;
}

export function rankFor(lifetime: number): Rank {
  let r = RANKS[0];
  for (const x of RANKS) if (lifetime >= x.need) r = x;
  return r;
}

export function nextRank(lifetime: number): Rank | null {
  return RANKS.find((r) => r.need > lifetime) ?? null;
}

export function skinUnlocked(skin: Skin, save: Save): boolean {
  if (skin.patron) return save.patron;
  return save.lifetime >= skin.need || save.patron;
}

export function equippedSkin(save: Save): Skin {
  const s = SKINS.find((x) => x.id === save.skin);
  if (s && skinUnlocked(s, save)) return s;
  return SKINS[0];
}

export function dailyContract() {
  const day = todayKey();
  let h = 0;
  for (let i = 0; i < day.length; i++) h = (h * 33 + day.charCodeAt(i)) >>> 0;
  const kinds = [
    { kind: "hits" as const, goal: 8, title: "DAILY: CROWD CONTROL", blurb: "Eight walkers before sunset. Extra 2,000 respect." },
    { kind: "custard" as const, goal: 3, title: "DAILY: DAIRY RAID", blurb: "Three cones. The kiosk has it coming." },
    { kind: "squirrel" as const, goal: 5, title: "DAILY: NUT TAX", blurb: "Five tail-rats. The Don will hear about it." },
  ];
  return kinds[h % kinds.length];
}

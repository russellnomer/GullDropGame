export type Skin = {
  id: string;
  name: string;
  blurb: string;
  need: number;
  patron?: boolean;
  offer?: OfferId;
  bird: number;
  drop: number;
};

export const SKINS: Skin[] = [
  { id: "cream", name: "Boardwalk Cream", blurb: "The working bird.", need: 0, bird: 0xf4f1ea, drop: 0xf4f1ea },
  { id: "messy", name: "Messy Business", blurb: "A loud splat treatment for committed troublemakers.", need: 0, offer: "messy", bird: 0xf4f1ea, drop: 0xb95575 },
  { id: "teal", name: "Airmail Teal", blurb: "Matches the spark.", need: 4000, bird: 0x5eb7ae, drop: 0x5eb7ae },
  { id: "sauce", name: "Hot Sauce", blurb: "Looks like a health violation.", need: 12000, bird: 0xc45c4a, drop: 0xc45c4a },
  { id: "midnight", name: "Midnight Dump", blurb: "Night shift, worse morals.", need: 30000, bird: 0x1c2430, drop: 0xb8c4c8 },
  { id: "gold", name: "Patron Gold", blurb: "Uncle Beaky's favorite color.", need: 0, patron: true, offer: "patron", bird: 0xf3e5ab, drop: 0xf3e5ab },
  { id: "contraband", name: "Founder's Contraband", blurb: "Launch-run plumage for birds with paperwork.", need: 0, offer: "founder", bird: 0x26252a, drop: 0xc45c4a },
];

export type OfferId = "messy" | "patron" | "founder";

export type WeaponId = "street" | "messy" | "patron" | "fizz" | "founder";

export type Weapon = {
  id: WeaponId;
  name: string;
  blurb: string;
  need: number;
  offer?: OfferId;
  damage: number;
  fireDelay: number;
  velocity: number;
  color: number;
  effect?: "fizz";
};

export const WEAPONS: Weapon[] = [
  { id: "street", name: "Street Acorn Gun", blurb: "Reliable single-shot starter.", need: 0, damage: 1, fireDelay: 0.4, velocity: 32, color: 0x5b4029 },
  { id: "messy", name: "Messy Repeater", blurb: "Faster action and heavier impacts.", need: 4000, offer: "messy", damage: 2, fireDelay: 0.32, velocity: 36, color: 0xb95575 },
  { id: "patron", name: "Patron Enforcer", blurb: "A high-velocity boardwalk status piece.", need: 12000, offer: "patron", damage: 3, fireDelay: 0.24, velocity: 41, color: 0xc9a227 },
  { id: "fizz", name: "Fizz Bomb", blurb: "Fictional foaming blast that grounds gulls in a wide area.", need: 20000, offer: "founder", damage: 2, fireDelay: 1.1, velocity: 28, color: 0x64d6c8, effect: "fizz" },
  { id: "founder", name: "Founder's Contraband Cannon", blurb: "Top-tier launch hardware.", need: 30000, offer: "founder", damage: 4, fireDelay: 0.18, velocity: 47, color: 0xc45c4a },
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
  entitlements: OfferId[];
  /** Opaque stable device identifier; distinct from the public blotter handle. */
  deviceId: string;
  weapon: string;
};

const KEY = "gull-drop-save-v2";

function newHandle(): string {
  const n = Math.floor(Math.random() * 36 ** 4)
    .toString(36)
    .toUpperCase()
    .padStart(4, "0");
  return `GULL-${n}`;
}

function newDeviceId(): string {
  try {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID().replace(/-/g, "");
    if (globalThis.crypto?.getRandomValues) {
      const bytes = new Uint8Array(16);
      globalThis.crypto.getRandomValues(bytes);
      return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    }
  } catch { /* use no predictable identifier */ }
  throw new Error("Secure device identity is unavailable.");
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
    entitlements: [],
    deviceId: newDeviceId(),
    weapon: "street",
  };
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      localStorage.setItem(KEY, JSON.stringify(fallback));
      return fallback;
    }
    const s = { ...fallback, ...(JSON.parse(raw) as Partial<Save>) };
    if (!s.deviceId || !/^[A-Za-z0-9_-]{4,48}$/.test(s.deviceId)) s.deviceId = newDeviceId();
    if (s.dailyDate !== todayKey()) {
      s.dailyDate = todayKey();
      s.dailyDone = false;
    }
    // Persist migrations and daily rollover immediately so every caller uses
    // the same opaque checkout identity.
    localStorage.setItem(KEY, JSON.stringify(s));
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
  if (skin.offer) return save.entitlements.includes(skin.offer) || (skin.offer === "patron" && save.patron);
  if (skin.patron) return save.patron;
  return save.lifetime >= skin.need || save.patron;
}

export function equippedSkin(save: Save): Skin {
  const s = SKINS.find((x) => x.id === save.skin);
  if (s && skinUnlocked(s, save)) return s;
  return SKINS[0];
}

/** Returns whether rank progression or a verified purchase unlocks a weapon. */
export function weaponUnlocked(weapon: Weapon, save: Save): boolean {
  return save.lifetime >= weapon.need || Boolean(weapon.offer && save.entitlements.includes(weapon.offer));
}

/** Resolves an equipped weapon safely when loading an old or changed save. */
export function equippedWeapon(save: Save): Weapon {
  const weapon = WEAPONS.find((candidate) => candidate.id === save.weapon);
  return weapon && weaponUnlocked(weapon, save) ? weapon : WEAPONS[0];
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

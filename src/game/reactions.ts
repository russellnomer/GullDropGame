import * as THREE from "three";

const QUOTES: Record<string, string[]> = {
  tourist: [
    "IT'S IN MY HAIR",
    "I JUST SHOWERED",
    "NOT THE GOOD SHIRT",
    "BRO. LOOK UP.",
    "THIS IS A NEW HAT",
    "I HAVE A MEETING",
    "WHY IS IT WARM",
  ],
  custardCone: [
    "THAT WAS EIGHT DOLLARS",
    "I WAS ABOUT TO BITE",
    "IT TASTES WRONG NOW",
    "THE CONE DIDN'T DESERVE THAT",
  ],
  custardBody: ["SUNDAE ON A SHIRT", "I CAN TASTE IT", "NAPKIN. ANYONE."],
  selfie: ["DELETE THAT", "IT'S ON THE RING LIGHT", "DO NOT POST THAT", "MY ANGLES"],
  proposal: ["BABE NOT NOW", "THE RING IS WHITE", "I HAD A SPEECH", "GET UP GET UP GET UP"],
  nap: ["I WAS AT PEACE", "WHO", "FIVE MORE MINUTES"],
  balloon: ["THE KIDS SAW THAT", "HELIUM AND REGRET"],
  feeder: ["I FED YOU", "WE HAD A DEAL", "UNGRATEFUL"],
  hotdog: ["I WAS EATING", "BOARDWALK RULES"],
  lawyer: ["I'LL SUE THE BIRD", "THIS IS ASSAULT", "I WANT A SUPERVISOR", "BILLABLE HOUR RUINED"],
  politician: ["THE CAMERA'S ROLLING", "THIS DOESN'T REPRESENT ME", "THOUGHTS AND PRAYERS", "NO COMMENT"],
  realtor: ["AS-IS. NO CREDITS.", "IT LOWERS THE VALUE"],
  hoa: ["THAT'S A FINE", "VIOLATION. SECTION 12.", "WE HAVE RULES"],
  parking: ["METER'S STILL RUNNING", "I JUST GOT HERE"],
  influencer: ["MY ENGAGEMENT", "IT'S NOT A BIT", "UNFOLLOWING ATLANTIC CITY"],
  crypto: ["EVEN THE BIRD DUMPED", "WENT TO ZERO"],
  insurance: ["PRE-EXISTING CONDITION", "CLAIM DENIED"],
  cop: ["THAT'S A FELONY", "DISPATCH… NEVER MIND", "I SAW NOTHING"],
  swarm: ["THEY BROUGHT FRIENDS", "IT'S RAINING"],
  swarmPol: ["TOWN HALL'S PACKED", "CONSTITUENT SERVICES"],
  squirrel: ["THAT'S MY NUT", "FAMILY DON'T FORGET", "YOU'RE DEAD, BIRD"],
  don: ["DISRESPECT", "THE FAMILY SAW THAT", "WE SETTLE THIS"],
  vendor: ["WHY ALLAH, WHY?", "WHY ALLAH, WHY?", "WHY ALLAH, WHY?"],
  rider: ["I PAID FOR THIS SEAT", "WE'RE STUCK UP HERE", "DON'T LOOK DOWN", "LET ME OFF"],
  tanner: ["MY TAN", "IT'S IN THE OIL", "I WAS RELAXING"],
  swimmer: ["SALT AND THIS", "I'M IN THE WATER", "NOT THE TUBE"],
  lifeguard: ["I'M ON DUTY", "WHISTLE'S WET", "OUT OF MY CHAIR"],
  volleyball: ["NOT THE BALL", "GAME POINT", "SAND IN MY TEETH"],
};

const BYSTANDER = [
  "GROSS",
  "NOT IT",
  "I'M OUT",
  "LOOK UP LOOK UP",
  "POOR GUY",
  "NEVER THE FACE",
  "I'M WALKING",
];

export function quoteFor(key: string): string {
  const a = QUOTES[key] ?? QUOTES.tourist;
  return a[(Math.random() * a.length) | 0];
}

export function bystanderQuote(): string {
  return BYSTANDER[(Math.random() * BYSTANDER.length) | 0];
}

const splatGeo = new THREE.SphereGeometry(0.12, 8, 6);

export function makeSplat(): THREE.Group {
  const g = new THREE.Group();
  g.name = "splat";
  const mat = new THREE.MeshLambertMaterial({ color: 0xe8e0c8 });
  for (let i = 0; i < 5; i++) {
    const m = new THREE.Mesh(splatGeo, mat);
    m.scale.set(0.7 + Math.random() * 1.1, 0.35 + Math.random() * 0.5, 0.8 + Math.random());
    m.position.set((Math.random() - 0.5) * 0.28, 0.02 + Math.random() * 0.08, 0.12 + Math.random() * 0.1);
    g.add(m);
  }
  return g;
}

export function makeBubble(text: string): THREE.Sprite {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 128;
  const g = c.getContext("2d");
  if (g) {
    g.clearRect(0, 0, 512, 128);
    g.fillStyle = "rgba(15, 22, 26, 0.92)";
    round(g, 16, 16, 480, 80, 18);
    g.fill();
    g.fillStyle = "#f0ece4";
    g.beginPath();
    g.moveTo(48, 96);
    g.lineTo(64, 96);
    g.lineTo(40, 120);
    g.fill();
    g.fillStyle = "#f0ece4";
    g.font = "700 36px sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text.slice(0, 28), 256, 56);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const spr = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }),
  );
  spr.name = "bubble";
  spr.scale.set(3.4, 0.85, 1);
  spr.position.set(0, 4.6, 0);
  spr.userData.tex = tex;
  return spr;
}

export function killBubble(spr: THREE.Sprite | null) {
  if (!spr) return;
  const tex = spr.userData.tex as THREE.CanvasTexture | undefined;
  tex?.dispose();
  (spr.material as THREE.SpriteMaterial).dispose();
  spr.parent?.remove(spr);
}

function round(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

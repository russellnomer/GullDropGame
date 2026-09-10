import * as THREE from "three";
import { manageTexture } from "./assets";

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("2d");
  draw(ctx, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return manageTexture(t);
}

function hexRgb(hex: number): [number, number, number] {
  return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
}

export function faceMap(skin: number, seed: number): THREE.CanvasTexture {
  return canvasTex(512, 512, (g, w, h) => {
    const [r, gv, b] = hexRgb(skin);
    g.fillStyle = `rgb(${r},${gv},${b})`;
    g.fillRect(0, 0, w, h);
    const cheek = `rgba(${Math.max(0, r - 30)},${Math.max(0, gv - 50)},${Math.max(0, b - 40)},0.22)`;
    g.fillStyle = cheek;
    g.beginPath();
    g.ellipse(w * 0.32, h * 0.58, 48, 32, 0, 0, Math.PI * 2);
    g.ellipse(w * 0.68, h * 0.58, 48, 32, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#f7f4ef";
    g.beginPath();
    g.ellipse(w * 0.35, h * 0.46, 38, 22, 0, 0, Math.PI * 2);
    g.ellipse(w * 0.65, h * 0.46, 38, 22, 0, 0, Math.PI * 2);
    g.fill();
    const iris = ["#3d4a5c", "#4a6fa5", "#5a4636", "#2a5a3a"][seed % 4];
    g.fillStyle = iris;
    g.beginPath();
    g.arc(w * 0.35, h * 0.46, 14, 0, Math.PI * 2);
    g.arc(w * 0.65, h * 0.46, 14, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#0d0d10";
    g.beginPath();
    g.arc(w * 0.35, h * 0.46, 7, 0, Math.PI * 2);
    g.arc(w * 0.65, h * 0.46, 7, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "rgba(255,255,255,0.85)";
    g.beginPath();
    g.arc(w * 0.33, h * 0.44, 4, 0, Math.PI * 2);
    g.arc(w * 0.63, h * 0.44, 4, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "#1a1a1c";
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(w * 0.26, h * 0.4);
    g.quadraticCurveTo(w * 0.35, h * 0.36, w * 0.44, h * 0.4);
    g.moveTo(w * 0.56, h * 0.4);
    g.quadraticCurveTo(w * 0.65, h * 0.36, w * 0.74, h * 0.4);
    g.stroke();
    g.fillStyle = `rgba(${Math.max(0, r - 50)},${Math.max(0, gv - 70)},${Math.max(0, b - 60)},0.35)`;
    g.beginPath();
    g.ellipse(w * 0.5, h * 0.58, 18, 14, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "#8a3a3a";
    g.lineWidth = 4;
    g.beginPath();
    g.ellipse(w * 0.5, h * 0.7, 22, 10, 0, 0.15, Math.PI - 0.15);
    g.stroke();
  });
}

export function furMap(hex: number): THREE.CanvasTexture {
  return canvasTex(256, 256, (g, w, h) => {
    const [r, gv, b] = hexRgb(hex);
    g.fillStyle = `rgb(${r},${gv},${b})`;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1800; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      g.strokeStyle = `rgba(${r + 30},${gv + 20},${b + 10},${0.15 + Math.random() * 0.25})`;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (Math.random() - 0.5) * 6, y - 8 - Math.random() * 10);
      g.stroke();
    }
  });
}

export function featherMap(): THREE.CanvasTexture {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = "#ece8e0";
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 18; i++) {
      const x = (i / 18) * w;
      g.fillStyle = i % 2 === 0 ? "#d8d2c8" : "#c4b8a4";
      g.fillRect(x, 0, w / 18 + 1, h);
      g.strokeStyle = "rgba(40,36,32,0.18)";
      g.beginPath();
      g.moveTo(x + w / 36, 0);
      g.lineTo(x + w / 36, h);
      g.stroke();
    }
  });
}

export function shirtMap(hex: number): THREE.CanvasTexture {
  return canvasTex(256, 256, (g, w, h) => {
    const [r, gv, b] = hexRgb(hex);
    g.fillStyle = `rgb(${r},${gv},${b})`;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = `rgba(255,255,255,0.08)`;
    for (let y = 0; y < h; y += 8) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(w, y);
      g.stroke();
    }
    g.fillStyle = `rgba(0,0,0,0.12)`;
    g.fillRect(w * 0.46, 0, w * 0.08, h);
  });
}

function mat(color: number, extra: THREE.MeshStandardMaterialParameters = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.04, ...extra });
}

const GEO = {
  head: new THREE.SphereGeometry(0.18, 24, 18),
  ear: new THREE.SphereGeometry(0.045, 10, 8),
  neck: new THREE.CylinderGeometry(0.07, 0.08, 0.12, 12),
  torso: new THREE.CapsuleGeometry(0.18, 0.32, 4, 14),
  hip: new THREE.CapsuleGeometry(0.19, 0.15, 4, 14),
  arm: new THREE.CapsuleGeometry(0.045, 0.28, 4, 10),
  forearm: new THREE.CapsuleGeometry(0.04, 0.25, 4, 10),
  hand: new THREE.SphereGeometry(0.05, 10, 8),
  thigh: new THREE.CapsuleGeometry(0.065, 0.3, 4, 10),
  calf: new THREE.CapsuleGeometry(0.05, 0.3, 4, 10),
  shoe: new THREE.BoxGeometry(0.1, 0.08, 0.22),
  hair: new THREE.SphereGeometry(0.19, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
};

export function makeHuman(shirt: number, role: string | null, kind: string, seed: number): THREE.Group {
  const g = new THREE.Group();
  const skins = [0xe8c4a0, 0xc9a07a, 0x8d5a3a, 0xf0d4b8];
  const skinHex = skins[seed % skins.length];
  const skinM = mat(skinHex, { map: faceMap(skinHex, seed), roughness: 0.48 });
  const shirtHex =
    role === "lawyer" || role === "politician" || role === "insurance"
      ? 0x1c2430
      : role === "realtor"
        ? 0x3d4a5c
        : role === "hoa"
          ? 0xd9c4a3
            : kind === "vendor"
              ? 0x1c2430
          : role === "parking" || kind === "cop"
            ? 0x1a242c
            : kind === "lifeguard"
              ? 0xc45c4a
              : kind === "swimmer"
                ? 0x4a6fa5
                : kind === "tanner"
                  ? 0xe8c4a0
                  : kind === "volleyball"
                    ? 0xf0ece4
            : role === "crypto"
              ? 0x141416
              : role === "influencer"
                ? 0x5eb7ae
                : shirt;
  const shirtM = mat(shirtHex, { map: shirtMap(shirtHex), roughness: 0.62 });
  const pantsM = mat(
    kind === "cop" ? 0x151b22 : kind === "lifeguard" ? 0xc45c4a : kind === "swimmer" || kind === "tanner" ? 0x4a6fa5 : 0x2a3238,
    { roughness: 0.7 },
  );
  const hairM = mat([0x1a1a1c, 0x3a2414, 0x6a5340, 0xc4b8a4, 0x2a1a12][seed % 5]);

  const head = new THREE.Mesh(GEO.head, skinM);
  head.position.y = 1.7;
  head.castShadow = true;
  head.name = "head";
  const neck = new THREE.Mesh(GEO.neck, skinM);
  neck.position.y = 1.5;
  const torso = new THREE.Mesh(GEO.torso, shirtM);
  torso.position.y = 1.16;
  torso.castShadow = true;
  torso.receiveShadow = true;
  const hip = new THREE.Mesh(GEO.hip, pantsM);
  hip.scale.set(1, 0.55, 0.85);
  hip.position.y = 0.82;
  const hair = new THREE.Mesh(GEO.hair, hairM);
  hair.position.y = 1.78;
  hair.name = "hair";
  const earL = new THREE.Mesh(GEO.ear, skinM);
  earL.position.set(-0.2, 1.7, 0);
  const earR = earL.clone();
  earR.position.x = 0.2;

  const armL = new THREE.Group();
  armL.name = "armL";
  armL.position.set(-0.28, 1.38, 0);
  const uL = new THREE.Mesh(GEO.arm, shirtM);
  uL.position.y = -0.16;
  const fL = new THREE.Mesh(GEO.forearm, skinM);
  fL.position.y = -0.46;
  const hL = new THREE.Mesh(GEO.hand, skinM);
  hL.position.y = -0.64;
  armL.add(uL, fL, hL);

  const armR = new THREE.Group();
  armR.name = "armR";
  armR.position.set(0.28, 1.38, 0);
  const uR = new THREE.Mesh(GEO.arm, shirtM);
  uR.position.y = -0.16;
  const fR = new THREE.Mesh(GEO.forearm, skinM);
  fR.position.y = -0.46;
  const hR = new THREE.Mesh(GEO.hand, skinM);
  hR.position.y = -0.64;
  armR.add(uR, fR, hR);

  const thighL = new THREE.Mesh(GEO.thigh, pantsM);
  thighL.position.set(-0.1, 0.58, 0);
  const thighR = thighL.clone();
  thighR.position.x = 0.1;
  const calfL = new THREE.Mesh(GEO.calf, pantsM);
  calfL.position.set(-0.1, 0.24, 0);
  const calfR = calfL.clone();
  calfR.position.x = 0.1;
  const shoeM = mat(0x1a1a1c, { roughness: 0.4, metalness: 0.12 });
  const sL = new THREE.Mesh(GEO.shoe, shoeM);
  sL.position.set(-0.1, 0.05, 0.04);
  const sR = sL.clone();
  sR.position.x = 0.1;

  g.add(head, neck, torso, hip, hair, earL, earR, armL, armR, thighL, thighR, calfL, calfR, sL, sR);
  dressRole(g, role, kind, shirtM, hairM);
  head.scale.setScalar(1.28);
  hair.scale.setScalar(1.22);
  g.scale.setScalar(2.05);
  return g;
}

function dressRole(g: THREE.Group, role: string | null, kind: string, shirtM: THREE.MeshStandardMaterial, hairM: THREE.MeshStandardMaterial) {
  if (kind === "cop") {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.1, 14), mat(0x151b22, { roughness: 0.35 }));
    cap.position.y = 1.92;
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.03, 0.16), mat(0x0d1014));
    brim.position.set(0, 1.88, 0.14);
    const badge = new THREE.Mesh(new THREE.CircleGeometry(0.045, 10), mat(0xc9a227, { metalness: 0.8, roughness: 0.25, emissive: 0xc9a227, emissiveIntensity: 0.2 }));
    badge.position.set(0.12, 1.28, 0.22);
    g.add(cap, brim, badge);
  }
  if (role === "politician") {
    const sash = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.035, 8, 20), mat(0xc45c4a, { roughness: 0.5 }));
    sash.rotation.x = 0.9;
    sash.position.y = 1.2;
    const flag = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.02), mat(0x3d4a8a, { emissive: 0x1a2a6a, emissiveIntensity: 0.15 }));
    flag.position.set(0.16, 1.35, 0.2);
    const pin = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), mat(0x5eb7ae, { emissive: 0x5eb7ae, emissiveIntensity: 1 }));
    pin.position.y = 2.08;
    pin.name = "spark";
    hairM.color.setHex(0xc4b8a4);
    g.add(sash, flag, pin);
  }
  if (role === "lawyer" || role === "insurance") {
    const caseM = mat(0x3a2414, { roughness: 0.4, metalness: 0.15 });
    const brief = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.08), caseM);
    brief.position.set(-0.42, 0.85, 0.08);
    const tie = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.28, 0.02), mat(0x8a1a1a));
    tie.position.set(0, 1.22, 0.22);
    g.add(brief, tie);
  }
  if (role === "hoa") {
    const clip = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 0.02), mat(0xf0ece4));
    clip.position.set(0.32, 1.2, 0.12);
    g.add(clip);
  }
  if (role === "influencer" || kind === "selfie") {
    const glass = mat(0x1a1a1c, { metalness: 0.6, roughness: 0.15 });
    const gl = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 0.02), glass);
    gl.position.set(-0.08, 1.72, 0.18);
    const gr = gl.clone();
    gr.position.x = 0.08;
    g.add(gl, gr);
  }
  if (kind === "lifeguard") {
    const visor = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.08, 12), mat(0xc45c4a));
    visor.position.y = 1.92;
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.03, 0.18), mat(0xc45c4a));
    brim.position.set(0, 1.88, 0.14);
    const whistle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.03), mat(0xf0ece4, { metalness: 0.3 }));
    whistle.position.set(0, 1.28, 0.24);
    const shades = mat(0x1a1a1c, { metalness: 0.6, roughness: 0.2 });
    const gl = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 0.02), shades);
    gl.position.set(-0.08, 1.72, 0.18);
    const gr = gl.clone();
    gr.position.x = 0.08;
    g.add(visor, brim, whistle, gl, gr);
  }
  if (kind === "vendor") {
    const wrap = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), mat(0xf0ece4));
    wrap.position.y = 1.8;
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.035, 8, 14), mat(0x1a1a1c));
    band.rotation.x = Math.PI / 2;
    band.position.y = 1.86;
    const vest = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.4, 0.28), mat(0x3a2414, { roughness: 0.7 }));
    vest.position.y = 1.18;
    g.add(wrap, band, vest);
    hairM.color.setHex(0x1a1a1c);
  }
  if (kind === "star") {
    const spark = g.getObjectByName("spark");
    if (!spark) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), mat(0x5eb7ae, { emissive: 0x5eb7ae, emissiveIntensity: 1 }));
      s.position.y = 2.08;
      s.name = "spark";
      g.add(s);
    }
  }
}

const SQ = {
  pelvis: new THREE.CapsuleGeometry(0.14, 0.14, 4, 10),
  torso: new THREE.CylinderGeometry(0.12, 0.15, 0.26, 10),
  belly: new THREE.CylinderGeometry(0.11, 0.14, 0.25, 8, 1, false, 0, Math.PI),
  neck: new THREE.CylinderGeometry(0.07, 0.09, 0.1, 8),
  head: new THREE.SphereGeometry(0.13, 14, 12),
  cheek: new THREE.SphereGeometry(0.06, 10, 8),
  snout: new THREE.ConeGeometry(0.055, 0.1, 8),
  ear: new THREE.ConeGeometry(0.04, 0.1, 8),
  inner: new THREE.ConeGeometry(0.025, 0.08, 8),
  eye: new THREE.SphereGeometry(0.015, 8, 6),
  nose: new THREE.SphereGeometry(0.012, 8, 6),
  upperArm: new THREE.CapsuleGeometry(0.04, 0.12, 4, 8),
  forearm: new THREE.CapsuleGeometry(0.035, 0.12, 4, 8),
  paw: new THREE.SphereGeometry(0.035, 8, 6),
  thigh: new THREE.CapsuleGeometry(0.07, 0.14, 4, 8),
  calf: new THREE.CapsuleGeometry(0.05, 0.14, 4, 8),
  foot: new THREE.BoxGeometry(0.06, 0.03, 0.12),

  tailBase: new THREE.CapsuleGeometry(0.07, 0.18, 4, 8),
  tailMid: new THREE.CapsuleGeometry(0.11, 0.24, 4, 8),
  tailTip: new THREE.ConeGeometry(0.1, 0.3, 8),

  hatCrown: new THREE.CylinderGeometry(0.1, 0.11, 0.1, 12),
  hatBand: new THREE.CylinderGeometry(0.112, 0.112, 0.02, 12),
  hatBrim: new THREE.CylinderGeometry(0.17, 0.17, 0.01, 12),

  jacketBody: new THREE.CylinderGeometry(0.13, 0.16, 0.28, 10, 1, true, -Math.PI*0.8, Math.PI*1.6),

  gunBarrel: new THREE.CylinderGeometry(0.015, 0.015, 0.2, 8),
  gunStock: new THREE.BoxGeometry(0.025, 0.06, 0.04),
  acornBase: new THREE.SphereGeometry(0.04, 8, 6),
  acornCap: new THREE.ConeGeometry(0.05, 0.03, 8),

  tie: new THREE.BoxGeometry(0.04, 0.2, 0.02),
  chain: new THREE.TorusGeometry(0.1, 0.015, 8, 18),
  scar: new THREE.BoxGeometry(0.015, 0.08, 0.01),
  spark: new THREE.SphereGeometry(0.05, 8, 6),
};

const MATS = {
  furN: null as THREE.MeshStandardMaterial | null,
  furB: null as THREE.MeshStandardMaterial | null,
  furCream: null as THREE.MeshStandardMaterial | null,
  pink: null as THREE.MeshStandardMaterial | null,
  suitN: null as THREE.MeshStandardMaterial | null,
  suitB: null as THREE.MeshStandardMaterial | null,
  shirt: null as THREE.MeshStandardMaterial | null,
  tieN: null as THREE.MeshStandardMaterial | null,
  tieB: null as THREE.MeshStandardMaterial | null,
  hatN: null as THREE.MeshStandardMaterial | null,
  hatB: null as THREE.MeshStandardMaterial | null,
  bandN: null as THREE.MeshStandardMaterial | null,
  bandB: null as THREE.MeshStandardMaterial | null,
  nose: null as THREE.MeshStandardMaterial | null,
  eye: null as THREE.MeshStandardMaterial | null,
  gunB: null as THREE.MeshStandardMaterial | null,
  gunS: null as THREE.MeshStandardMaterial | null,
  acB: null as THREE.MeshStandardMaterial | null,
  acC: null as THREE.MeshStandardMaterial | null,
  chain: null as THREE.MeshStandardMaterial | null,
  scar: null as THREE.MeshStandardMaterial | null,
  spkN: null as THREE.MeshStandardMaterial | null,
  spkB: null as THREE.MeshStandardMaterial | null,
};

function getSqMats(boss: boolean) {
  if (!MATS.furCream) {
    const fn = 0x7a7468;
    const fb = 0x5a5248;
    const fc = 0xe0d4c8;
    MATS.furN = mat(fn, { map: furMap(fn), roughness: 0.82 });
    MATS.furB = mat(fb, { map: furMap(fb), roughness: 0.82 });
    MATS.furCream = mat(fc, { map: furMap(fc), roughness: 0.85 });
    MATS.pink = mat(0xc08060, { roughness: 0.55 });
    MATS.suitN = mat(0x3d4a5c, { roughness: 0.6 });
    MATS.suitB = mat(0x2a3238, { roughness: 0.45 });
    MATS.shirt = mat(0xf0ece4, { roughness: 0.8 });
    MATS.tieN = mat(0x1a1a1c);
    MATS.tieB = mat(0x8a1a1a);
    MATS.hatN = mat(0x3a3a3a);
    MATS.hatB = mat(0x1a1a1c);
    MATS.bandN = mat(0x1a1a1c);
    MATS.bandB = mat(0x8a1a1a);
    MATS.nose = mat(0x1a1a1c);
    MATS.eye = mat(0x0a0a0a, { roughness: 0.3 });
    MATS.gunB = mat(0x1a1a1c, { metalness: 0.8 });
    MATS.gunS = mat(0x5a341c);
    MATS.acB = mat(0x6a3a18);
    MATS.acC = mat(0x4a2a10);
    MATS.chain = mat(0xc9a227, { metalness: 0.9, roughness: 0.22, emissive: 0xc9a227, emissiveIntensity: 0.25 });
    MATS.scar = mat(0x8a1a1a);
    MATS.spkN = mat(0xc49a6a, { emissive: 0xc49a6a, emissiveIntensity: 0.9 });
    MATS.spkB = mat(0xc45c4a, { emissive: 0xc45c4a, emissiveIntensity: 0.9 });
  }
  return {
    fur: boss ? MATS.furB! : MATS.furN!,
    furCream: MATS.furCream!,
    pink: MATS.pink!,
    suit: boss ? MATS.suitB! : MATS.suitN!,
    shirt: MATS.shirt!,
    tie: boss ? MATS.tieB! : MATS.tieN!,
    hat: boss ? MATS.hatB! : MATS.hatN!,
    band: boss ? MATS.bandB! : MATS.bandN!,
    nose: MATS.nose!,
    eye: MATS.eye!,
    gunB: MATS.gunB!,
    gunS: MATS.gunS!,
    acB: MATS.acB!,
    acC: MATS.acC!,
    chain: MATS.chain!,
    scar: MATS.scar!,
    spk: boss ? MATS.spkB! : MATS.spkN!,
  };
}

export function makeSquirrelRig(boss: boolean): THREE.Group {
  const g = new THREE.Group();
  const m = getSqMats(boss);

  const bodyRoot = new THREE.Group();
  bodyRoot.name = "bodyRoot";
  bodyRoot.position.y = 0.25;

  const pelvis = new THREE.Mesh(SQ.pelvis, m.fur);
  pelvis.position.set(0, 0.15, -0.02);
  pelvis.rotation.x = 0.1;
  bodyRoot.add(pelvis);

  const torso = new THREE.Mesh(SQ.torso, m.shirt);
  torso.position.set(0, 0.36, 0.02);
  torso.rotation.x = 0.25;
  bodyRoot.add(torso);

  const belly = new THREE.Mesh(SQ.belly, m.furCream);
  belly.position.set(0, 0, 0.02);
  torso.add(belly);

  const jacket = new THREE.Mesh(SQ.jacketBody, m.suit);
  jacket.position.set(0, 0, 0);
  torso.add(jacket);

  const tie = new THREE.Mesh(SQ.tie, m.tie);
  tie.position.set(0, 0.05, 0.13);
  tie.rotation.x = 0.1;
  torso.add(tie);

  const neck = new THREE.Mesh(SQ.neck, m.furCream);
  neck.position.set(0, 0.18, 0.05);
  neck.rotation.x = -0.15;
  torso.add(neck);

  const headRoot = new THREE.Group();
  headRoot.position.set(0, 0.08, 0.02);
  neck.add(headRoot);

  const head = new THREE.Mesh(SQ.head, m.fur);
  headRoot.add(head);

  const snout = new THREE.Mesh(SQ.snout, m.furCream);
  snout.position.set(0, -0.02, 0.12);
  snout.rotation.x = Math.PI / 2;
  headRoot.add(snout);

  const cheekL = new THREE.Mesh(SQ.cheek, m.furCream);
  cheekL.position.set(-0.07, -0.03, 0.1);
  const cheekR = cheekL.clone();
  cheekR.position.x = 0.07;
  headRoot.add(cheekL, cheekR);

  const eyeL = new THREE.Mesh(SQ.eye, m.eye);
  eyeL.position.set(-0.09, 0.04, 0.09);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.09;
  headRoot.add(eyeL, eyeR);

  const nose = new THREE.Mesh(SQ.nose, m.nose);
  nose.position.set(0, 0.04, 0.06);
  snout.add(nose);

  const earL = new THREE.Mesh(SQ.ear, m.fur);
  earL.position.set(-0.09, 0.12, -0.02);
  earL.rotation.set(-0.1, 0.2, -0.2);
  const earR = new THREE.Mesh(SQ.ear, m.fur);
  earR.position.set(0.09, 0.12, -0.02);
  earR.rotation.set(-0.1, -0.2, 0.2);

  const inL = new THREE.Mesh(SQ.inner, m.pink);
  inL.position.set(0, 0.01, 0.012);
  earL.add(inL);
  const inR = new THREE.Mesh(SQ.inner, m.pink);
  inR.position.set(0, 0.01, 0.012);
  earR.add(inR);
  headRoot.add(earL, earR);

  const hat = new THREE.Group();
  hat.position.set(0, 0.12, 0);
  hat.rotation.x = -0.15;
  const hCrown = new THREE.Mesh(SQ.hatCrown, m.hat);
  hCrown.position.y = 0.05;
  const hBand = new THREE.Mesh(SQ.hatBand, m.band);
  hBand.position.y = 0.01;
  const hBrim = new THREE.Mesh(SQ.hatBrim, m.hat);
  hBrim.position.y = 0;
  hat.add(hCrown, hBand, hBrim);
  headRoot.add(hat);

  const armL = new THREE.Group();
  armL.name = "armL";
  armL.position.set(-0.18, 0.62, 0.04);
  const shL = new THREE.Mesh(SQ.upperArm, m.suit);
  shL.position.set(0, -0.08, 0);
  const faL = new THREE.Mesh(SQ.forearm, m.fur);
  faL.position.set(0, -0.2, 0.02);
  faL.rotation.x = -0.2;
  const hL = new THREE.Mesh(SQ.paw, m.fur);
  hL.position.set(0, -0.08, 0.01);
  faL.add(hL);
  armL.add(shL, faL);
  armL.rotation.x = -Math.PI / 2;
  armL.rotation.z = 0.2;

  const gun = new THREE.Group();
  gun.name = "acornGun";
  gun.position.set(0, -0.26, 0.05);
  gun.rotation.x = Math.PI / 2;
  const barrel = new THREE.Mesh(SQ.gunBarrel, m.gunB);
  barrel.position.z = 0.05;
  barrel.rotation.x = Math.PI / 2;
  const stock = new THREE.Mesh(SQ.gunStock, m.gunS);
  stock.position.y = -0.05;
  const acBase = new THREE.Mesh(SQ.acornBase, m.acB);
  acBase.position.z = 0.15;
  acBase.scale.set(1, 1, 1.4);
  const acCap = new THREE.Mesh(SQ.acornCap, m.acC);
  acCap.position.z = 0.18;
  acCap.rotation.x = -Math.PI / 2;
  gun.add(barrel, stock, acBase, acCap);
  armL.add(gun);

  const armR = new THREE.Group();
  armR.name = "armR";
  armR.position.set(0.18, 0.62, 0.04);
  const shR = new THREE.Mesh(SQ.upperArm, m.suit);
  shR.position.set(0, -0.08, 0);
  const faR = new THREE.Mesh(SQ.forearm, m.fur);
  faR.position.set(0, -0.2, 0.02);
  faR.rotation.x = -0.2;
  const hR = new THREE.Mesh(SQ.paw, m.fur);
  hR.position.set(0, -0.08, 0.01);
  faR.add(hR);
  armR.add(shR, faR);

  const legL = new THREE.Group();
  legL.name = "legL";
  legL.position.set(-0.12, 0.345, -0.02);
  const thL = new THREE.Mesh(SQ.thigh, m.fur);
  thL.name = "thighL";
  thL.position.set(0, -0.07, 0.05);
  thL.rotation.x = -0.4;
  const caL = new THREE.Mesh(SQ.calf, m.fur);
  caL.name = "calfL";
  caL.position.set(0, -0.18, -0.02);
  caL.rotation.x = 0.4;
  const ftL = new THREE.Mesh(SQ.foot, m.furCream);
  ftL.position.set(0, -0.33, 0.04);
  legL.add(thL, caL, ftL);

  const legR = new THREE.Group();
  legR.name = "legR";
  legR.position.set(0.12, 0.345, -0.02);
  const thR = new THREE.Mesh(SQ.thigh, m.fur);
  thR.name = "thighR";
  thR.position.set(0, -0.07, 0.05);
  thR.rotation.x = -0.4;
  const caR = new THREE.Mesh(SQ.calf, m.fur);
  caR.name = "calfR";
  caR.position.set(0, -0.18, -0.02);
  caR.rotation.x = 0.4;
  const ftR = new THREE.Mesh(SQ.foot, m.furCream);
  ftR.position.set(0, -0.33, 0.04);
  legR.add(thR, caR, ftR);

  const tailBase = new THREE.Group();
  tailBase.name = "tailBase";
  tailBase.position.set(0, 0.3, -0.15);
  tailBase.rotation.x = -0.4;
  tailBase.rotation.y = 0.25;

  const tB = new THREE.Mesh(SQ.tailBase, m.fur);
  tB.position.set(0, 0.1, -0.05);
  tB.rotation.x = -0.2;

  const tM1 = new THREE.Mesh(SQ.tailMid, m.fur);
  tM1.position.set(0, 0.28, -0.14);
  tM1.rotation.x = 0.1;

  const tM2 = new THREE.Mesh(SQ.tailMid, m.fur);
  tM2.scale.set(1.1, 1, 0.9);
  tM2.position.set(0, 0.48, -0.12);
  tM2.rotation.x = 0.4;

  const tTip = new THREE.Mesh(SQ.tailTip, m.fur);
  tTip.position.set(0, 0.65, -0.02);
  tTip.rotation.x = 0.8;

  const tM1L = tM1.clone();
  tM1L.position.set(-0.07, 0.26, -0.13);
  tM1L.rotation.z = 0.2;
  tM1L.scale.set(0.8, 0.9, 0.8);
  const tM1R = tM1.clone();
  tM1R.position.set(0.07, 0.26, -0.13);
  tM1R.rotation.z = -0.2;
  tM1R.scale.set(0.8, 0.9, 0.8);

  const tM2L = tM2.clone();
  tM2L.position.set(-0.08, 0.45, -0.11);
  tM2L.rotation.z = 0.25;
  tM2L.scale.set(0.8, 0.9, 0.8);
  const tM2R = tM2.clone();
  tM2R.position.set(0.08, 0.45, -0.11);
  tM2R.rotation.z = -0.25;
  tM2R.scale.set(0.8, 0.9, 0.8);

  tailBase.add(tB, tM1, tM2, tTip, tM1L, tM1R, tM2L, tM2R);

  bodyRoot.add(armL, armR, tailBase);
  g.add(bodyRoot, legL, legR);

  if (boss) {
    const chain = new THREE.Mesh(SQ.chain, m.chain);
    chain.position.set(0, 0.12, 0.1);
    chain.rotation.x = 1.2;
    torso.add(chain);

    const scar = new THREE.Mesh(SQ.scar, m.scar);
    scar.position.set(-0.05, 0.03, 0.09);
    scar.rotation.z = 0.4;
    headRoot.add(scar);

    g.scale.setScalar(2.65);
  } else {
    g.scale.setScalar(2.15);
  }

  g.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });

  const spark = new THREE.Mesh(SQ.spark, m.spk);
  spark.position.y = boss ? 1.6 : 1.3;
  spark.name = "spark";
  g.add(spark);

  return g;
}

const GULL = {
  body: new THREE.CapsuleGeometry(0.18, 0.28, 4, 16),
  head: new THREE.CapsuleGeometry(0.11, 0.08, 4, 14),
  neck: new THREE.CapsuleGeometry(0.06, 0.15, 4, 12),
  beak: new THREE.ConeGeometry(0.035, 0.22, 10),
  eye: new THREE.SphereGeometry(0.02, 10, 8),
  pupil: new THREE.SphereGeometry(0.01, 8, 6),
  wingBone: new THREE.CapsuleGeometry(0.055, 0.52, 4, 10),
  covert: new THREE.SphereGeometry(0.3, 14, 10),
  feather: new THREE.ConeGeometry(0.07, 0.54, 8),
  tailFeather: new THREE.ConeGeometry(0.055, 0.38, 8),
  shin: new THREE.CylinderGeometry(0.018, 0.024, 0.13, 8),
  toe: new THREE.CapsuleGeometry(0.018, 0.075, 3, 8),
};

let _feather: THREE.CanvasTexture | null = null;
function feathers() {
  if (!_feather) {
    _feather = featherMap();
    _feather.wrapS = _feather.wrapT = THREE.RepeatWrapping;
    _feather.repeat.set(2, 1);
  }
  return _feather;
}

export function makeGullRig(kind: "world" | "fpv", white: THREE.MeshStandardMaterial, grey: THREE.MeshStandardMaterial, beakM: THREE.MeshStandardMaterial): THREE.Group {
  const g = new THREE.Group();
  grey.map = feathers();
  grey.needsUpdate = true;

  const body = new THREE.Mesh(GULL.body, white);
  body.rotation.x = Math.PI / 2;
  body.scale.set(0.9, 1.2, 0.85);

  const mantle = new THREE.Mesh(GULL.body, grey);
  mantle.rotation.x = Math.PI / 2;
  mantle.scale.set(0.85, 1.0, 0.65);
  mantle.position.set(0, 0.08, -0.02);

  const head = new THREE.Mesh(GULL.head, white);
  head.rotation.x = Math.PI / 2;
  head.scale.set(0.95, 1.1, 0.95);
  head.position.set(0, 0.18, 0.32);

  const neck = new THREE.Mesh(GULL.neck, white);
  neck.position.set(0, 0.1, 0.22);
  neck.rotation.x = 0.7;

  const beakU = new THREE.Mesh(GULL.beak, beakM);
  beakU.rotation.x = Math.PI / 2 + 0.05;
  beakU.position.set(0, 0.16, 0.48);

  const beakL = new THREE.Mesh(GULL.beak, beakM);
  beakL.scale.set(0.85, 0.7, 0.85);
  beakL.rotation.x = Math.PI / 2 + 0.18;
  beakL.position.set(0, 0.12, 0.46);
  beakL.name = "beakL";

  const eyeW = mat(0xf4e0b0, { emissive: 0xf4e0b0, emissiveIntensity: 0.15 });
  const eL = new THREE.Mesh(GULL.eye, eyeW);
  eL.position.set(-0.08, 0.2, 0.4);
  const eR = eL.clone();
  eR.position.x = 0.08;

  const pL = new THREE.Mesh(GULL.pupil, mat(0x0d0d10));
  pL.position.set(-0.09, 0.2, 0.42);
  const pR = pL.clone();
  pR.position.x = 0.09;

  const ring = mat(0xc45c4a, { roughness: 0.4 });
  const rL = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.006, 8, 12), ring);
  rL.position.copy(eL.position);
  rL.lookAt(eL.position.x - 1, eL.position.y, eL.position.z);
  const rR = rL.clone();
  rR.position.copy(eR.position);
  rR.lookAt(eR.position.x + 1, eR.position.y, eR.position.z);

  const primTipM = mat(0x24262a, { roughness: 0.68 });

  const wingL = new THREE.Group();
  wingL.name = "wingL";
  wingL.position.set(-0.2, 0.06, 0.05);

  const wingR = new THREE.Group();
  wingR.name = "wingR";
  wingR.position.set(0.2, 0.06, 0.05);

  const addWing = (wing: THREE.Group, side: number) => {
    const bone = new THREE.Mesh(GULL.wingBone, grey);
    bone.rotation.z = side * Math.PI / 2;
    bone.position.set(side * 0.31, 0, -0.02);
    const cover = new THREE.Mesh(GULL.covert, grey);
    cover.scale.set(1.35, 0.16, 0.58);
    cover.position.set(side * 0.43, 0.005, -0.04);
    cover.rotation.y = side * 0.12;
    wing.add(bone, cover);
    // Staggered flight feathers create a flexible, tapered airfoil rather than a flat slab.
    for (let i = 0; i < 5; i++) {
      const feather = new THREE.Mesh(i > 2 ? GULL.feather : GULL.tailFeather, i > 2 ? primTipM : grey);
      const span = 0.48 + i * 0.14;
      feather.rotation.z = side * Math.PI / 2;
      feather.rotation.y = side * (0.08 + i * 0.035);
      feather.position.set(side * span, -0.012 - i * 0.006, -0.13 - i * 0.025);
      feather.scale.set(1, 1, 0.82 + i * 0.06);
      wing.add(feather);
    }
  };
  addWing(wingL, -1);
  addWing(wingR, 1);

  const tail = new THREE.Group();
  tail.position.set(0, 0.02, -0.34);
  for (let i = -2; i <= 2; i++) {
    const feather = new THREE.Mesh(GULL.tailFeather, i === -2 || i === 2 ? primTipM : white);
    feather.rotation.x = Math.PI / 2;
    feather.rotation.z = i * 0.12;
    feather.position.set(i * 0.045, 0, -0.08 - Math.abs(i) * 0.015);
    tail.add(feather);
  }

  const footM = mat(0xe08932, { roughness: 0.6 });
  const addFoot = (side: number) => {
    const foot = new THREE.Group();
    foot.position.set(side * 0.06, -0.17, -0.1);
    const shin = new THREE.Mesh(GULL.shin, footM);
    shin.rotation.x = 0.22;
    shin.position.y = -0.035;
    foot.add(shin);
    for (let toe = -1; toe <= 1; toe++) {
      const digit = new THREE.Mesh(GULL.toe, footM);
      digit.rotation.x = Math.PI / 2 + toe * 0.14;
      digit.rotation.z = toe * 0.18;
      digit.position.set(toe * 0.028, -0.11, 0.035);
      foot.add(digit);
    }
    return foot;
  };
  const footL = addFoot(-1);
  const footR = addFoot(1);

  g.add(body, mantle, head, neck, beakU, beakL, eL, eR, pL, pR, rL, rR, wingL, wingR, tail, footL, footR);

  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });

  if (kind === "fpv") {
    g.scale.setScalar(1.15);
    g.rotation.x = 0.15;
  } else {
    g.scale.setScalar(2.6);
  }
  return g;
}

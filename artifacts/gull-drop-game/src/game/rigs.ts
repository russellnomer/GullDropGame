import * as THREE from "three";

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("2d");
  draw(ctx, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
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
  head: new THREE.SphereGeometry(0.2, 24, 18),
  ear: new THREE.SphereGeometry(0.045, 10, 8),
  neck: new THREE.CylinderGeometry(0.08, 0.1, 0.12, 12),
  torso: new THREE.CylinderGeometry(0.2, 0.24, 0.62, 14),
  hip: new THREE.SphereGeometry(0.2, 12, 10),
  arm: new THREE.CylinderGeometry(0.055, 0.065, 0.34, 10),
  forearm: new THREE.CylinderGeometry(0.045, 0.055, 0.3, 10),
  hand: new THREE.SphereGeometry(0.055, 10, 8),
  thigh: new THREE.CylinderGeometry(0.075, 0.09, 0.38, 10),
  calf: new THREE.CylinderGeometry(0.055, 0.07, 0.36, 10),
  shoe: new THREE.BoxGeometry(0.12, 0.08, 0.24),
  hair: new THREE.SphereGeometry(0.21, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
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
  body: new THREE.SphereGeometry(0.22, 18, 14),
  head: new THREE.SphereGeometry(0.16, 18, 14),
  ear: new THREE.ConeGeometry(0.07, 0.16, 10),
  inner: new THREE.ConeGeometry(0.045, 0.1, 8),
  eye: new THREE.SphereGeometry(0.04, 12, 10),
  pupil: new THREE.SphereGeometry(0.022, 10, 8),
  nose: new THREE.SphereGeometry(0.03, 10, 8),
  leg: new THREE.CylinderGeometry(0.035, 0.045, 0.16, 8),
  paw: new THREE.SphereGeometry(0.04, 8, 6),
  tail: new THREE.SphereGeometry(0.1, 12, 10),
};

export function makeSquirrelRig(boss: boolean): THREE.Group {
  const g = new THREE.Group();
  const furHex = boss ? 0x5a5248 : 0x7a7468;
  const fur = mat(furHex, { map: furMap(furHex), roughness: 0.82 });
  const belly = mat(0xeeeae2, { roughness: 0.7 });
  const pink = mat(0xc08060, { roughness: 0.55 });
  const body = new THREE.Mesh(SQ.body, fur);
  body.scale.set(1, 0.95, 1.25);
  body.position.y = 0.38;
  body.castShadow = true;
  const bellyM = new THREE.Mesh(SQ.body, belly);
  bellyM.scale.set(0.72, 0.7, 0.55);
  bellyM.position.set(0, 0.34, 0.12);
  const head = new THREE.Mesh(SQ.head, fur);
  head.position.set(0, 0.62, 0.18);
  head.castShadow = true;
  const earL = new THREE.Mesh(SQ.ear, fur);
  earL.position.set(-0.1, 0.78, 0.14);
  const earR = earL.clone();
  earR.position.x = 0.1;
  const inL = new THREE.Mesh(SQ.inner, pink);
  inL.position.set(-0.1, 0.76, 0.16);
  const inR = inL.clone();
  inR.position.x = 0.1;
  const eyeW = mat(0xf4f1ea);
  const eyeL = new THREE.Mesh(SQ.eye, eyeW);
  eyeL.position.set(-0.07, 0.66, 0.3);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.07;
  const pupil = mat(0x0d0d10);
  const pL = new THREE.Mesh(SQ.pupil, pupil);
  pL.position.set(-0.07, 0.66, 0.335);
  const pR = pL.clone();
  pR.position.x = 0.07;
  const nose = new THREE.Mesh(SQ.nose, mat(0x1a1a1c));
  nose.position.set(0, 0.6, 0.34);
  const tail = new THREE.Group();
  tail.position.set(0, 0.4, -0.22);
  for (let i = 0; i < 6; i++) {
    const s = new THREE.Mesh(SQ.tail, fur);
    const t = i / 5;
    s.scale.setScalar(1.1 - t * 0.45);
    s.position.set(0, t * 0.55, -t * 0.42);
    tail.add(s);
  }
  const fl = new THREE.Mesh(SQ.leg, fur);
  fl.position.set(-0.1, 0.16, 0.12);
  const fr = fl.clone();
  fr.position.x = 0.1;
  const bl = fl.clone();
  bl.position.set(-0.1, 0.16, -0.12);
  const br = fl.clone();
  br.position.set(0.1, 0.16, -0.12);
  g.add(body, bellyM, head, earL, earR, inL, inR, eyeL, eyeR, pL, pR, nose, tail, fl, fr, bl, br);
  if (boss) {
    const pinstripe = mat(0x2a3238, { roughness: 0.45, metalness: 0.08 });
    const jacket = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.38, 0.32), pinstripe);
    jacket.position.set(0, 0.42, 0.02);
    const chain = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.018, 8, 18), mat(0xc9a227, { metalness: 0.9, roughness: 0.22, emissive: 0xc9a227, emissiveIntensity: 0.25 }));
    chain.position.set(0, 0.5, 0.12);
    chain.rotation.x = 1.2;
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.1, 14), mat(0x1a1a1c));
    hat.position.set(0, 0.84, 0.16);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.025, 14), mat(0x1a1a1c));
    brim.position.set(0, 0.79, 0.16);
    const scar = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.12, 0.01), mat(0x8a1a1a));
    scar.position.set(-0.06, 0.68, 0.32);
    const acornM = mat(0x6a3a18, { roughness: 0.7 });
    const a1 = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), acornM);
    a1.position.set(0.16, 0.32, 0.22);
    const a2 = a1.clone();
    a2.position.x = 0.22;
    g.add(jacket, chain, hat, brim, scar, a1, a2);
    g.scale.setScalar(2.65);
  } else {
    g.scale.setScalar(2.15);
  }
  const spark = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), mat(boss ? 0xc45c4a : 0xc49a6a, { emissive: boss ? 0xc45c4a : 0xc49a6a, emissiveIntensity: 0.9 }));
  spark.position.y = boss ? 1.15 : 0.88;
  spark.name = "spark";
  g.add(spark);
  return g;
}

const GULL = {
  body: new THREE.SphereGeometry(0.2, 20, 16),
  head: new THREE.SphereGeometry(0.12, 18, 14),
  neck: new THREE.CylinderGeometry(0.06, 0.09, 0.14, 12),
  beak: new THREE.ConeGeometry(0.035, 0.16, 10),
  eye: new THREE.SphereGeometry(0.022, 10, 8),
  pupil: new THREE.SphereGeometry(0.012, 8, 6),
  wing: new THREE.BoxGeometry(0.85, 0.035, 0.28),
  prim: new THREE.BoxGeometry(0.55, 0.02, 0.14),
  tail: new THREE.BoxGeometry(0.12, 0.02, 0.22),
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
  body.scale.set(1, 0.72, 1.45);
  body.castShadow = true;
  const mantle = new THREE.Mesh(GULL.body, grey);
  mantle.scale.set(0.92, 0.5, 1.1);
  mantle.position.set(0, 0.06, -0.04);
  const head = new THREE.Mesh(GULL.head, white);
  head.position.set(0, 0.12, 0.28);
  const neck = new THREE.Mesh(GULL.neck, white);
  neck.position.set(0, 0.06, 0.18);
  neck.rotation.x = 0.6;
  const beakU = new THREE.Mesh(GULL.beak, beakM);
  beakU.rotation.x = Math.PI / 2;
  beakU.position.set(0, 0.12, 0.42);
  const beakL = new THREE.Mesh(GULL.beak, beakM);
  beakL.scale.set(0.85, 0.7, 0.85);
  beakL.rotation.x = Math.PI / 2 + 0.12;
  beakL.position.set(0, 0.08, 0.4);
  beakL.name = "beakL";
  const eyeW = mat(0xf4e0b0, { emissive: 0xf4e0b0, emissiveIntensity: 0.15 });
  const eL = new THREE.Mesh(GULL.eye, eyeW);
  eL.position.set(-0.07, 0.16, 0.36);
  const eR = eL.clone();
  eR.position.x = 0.07;
  const pL = new THREE.Mesh(GULL.pupil, mat(0x0d0d10));
  pL.position.set(-0.07, 0.16, 0.38);
  const pR = pL.clone();
  pR.position.x = 0.07;
  const ring = mat(0xc45c4a, { roughness: 0.4 });
  const rL = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.006, 8, 12), ring);
  rL.position.copy(eL.position);
  const rR = rL.clone();
  rR.position.x = 0.07;
  const wingL = new THREE.Group();
  wingL.name = "wingL";
  wingL.position.set(-0.22, 0.04, 0);
  const wL = new THREE.Mesh(GULL.wing, grey);
  wL.position.x = -0.38;
  const p1 = new THREE.Mesh(GULL.prim, grey);
  p1.position.set(-0.78, 0, 0.02);
  p1.rotation.z = 0.15;
  wingL.add(wL, p1);
  wL.castShadow = true;
  p1.castShadow = true;
  const wingR = new THREE.Group();
  wingR.name = "wingR";
  wingR.position.set(0.22, 0.04, 0);
  const wR = new THREE.Mesh(GULL.wing, grey);
  wR.position.x = 0.38;
  const p2 = new THREE.Mesh(GULL.prim, grey);
  p2.position.set(0.78, 0, 0.02);
  p2.rotation.z = -0.15;
  wingR.add(wR, p2);
  wR.castShadow = true;
  p2.castShadow = true;
  const tail = new THREE.Mesh(GULL.tail, white);
  tail.position.set(0, 0, -0.32);
  g.add(body, mantle, head, neck, beakU, beakL, eL, eR, pL, pR, rL, rR, wingL, wingR, tail);
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) m.castShadow = true;
  });
  if (kind === "fpv") {
    g.scale.setScalar(1.15);
    g.rotation.x = 0.15;
  } else {
    g.scale.setScalar(2.6);
  }
  return g;
}

import * as THREE from "three";

const loader = new THREE.TextureLoader();
const cache = new Map<string, THREE.Texture>();

export function gameTex(file: string, repeatX = 1, repeatY = 1, clamp = false): THREE.Texture {
  const key = `${file}:${repeatX}:${repeatY}:${clamp}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const t = loader.load(`/game/${file}`);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 16;
  t.wrapS = t.wrapT = clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  cache.set(key, t);
  return t;
}

export function portraitOf(kind: string, role: string | null): THREE.Texture {
  if (kind === "custard") return gameTex("custard.jpg", 1, 1, true);
  if (kind === "selfie" || kind === "proposal") return gameTex("selfie.jpg", 1, 1, true);
  if (kind === "cop") return gameTex("cop.jpg", 1, 1, true);
  if (role === "lawyer" || role === "insurance") return gameTex("lawyer.jpg", 1, 1, true);
  if (role === "politician") return gameTex("pol.jpg", 1, 1, true);
  if (role === "influencer" || role === "crypto") return gameTex("influencer.jpg", 1, 1, true);
  return gameTex("tourist.jpg", 1, 1, true);
}

let oval: THREE.CanvasTexture | null = null;

let sqAlpha: THREE.CanvasTexture | null = null;

export function squirrelAlpha(): THREE.CanvasTexture {
  if (sqAlpha) return sqAlpha;
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d");
  if (!g) throw new Error("2d");
  g.fillStyle = "#000";
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = "#fff";
  g.beginPath();
  g.ellipse(118, 150, 70, 88, 0, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.ellipse(175, 95, 42, 70, 0.5, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.ellipse(118, 78, 48, 42, 0, 0, Math.PI * 2);
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.needsUpdate = true;
  sqAlpha = t;
  return t;
}

export function ovalAlpha(): THREE.CanvasTexture {
  if (oval) return oval;
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d");
  if (!g) throw new Error("2d");
  g.fillStyle = "#000";
  g.fillRect(0, 0, 256, 256);
  const grd = g.createRadialGradient(128, 148, 36, 128, 132, 118);
  grd.addColorStop(0, "#ffffff");
  grd.addColorStop(0.62, "#e8e8e8");
  grd.addColorStop(1, "#000000");
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.needsUpdate = true;
  oval = t;
  return t;
}

export function applyEnv(renderer: THREE.WebGLRenderer, scene: THREE.Scene) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  loader.load("/game/sky.jpg", (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.mapping = THREE.EquirectangularReflectionMapping;
    const env = pmrem.fromEquirectangular(tex).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.72;
    pmrem.dispose();
  });
}

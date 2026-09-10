import * as THREE from "three";
import { fault } from "./log";

const loader = new THREE.TextureLoader();
const cache = new Map<string, THREE.Texture>();
const managedTextures = new Set<THREE.Texture>();
const assetState = new Map<string, { status: "loading" | "ready" | "failed"; role: TextureRole; hits: number }>();
let maxAnisotropy = 1;

export type TextureRole = "color" | "data" | "alpha" | "environment";

/** Called once the renderer exists; avoids assuming a desktop GPU limit. */
export function configureTextureQuality(renderer: THREE.WebGLRenderer, requestedAnisotropy: number) {
  maxAnisotropy = Math.max(1, Math.min(requestedAnisotropy, renderer.capabilities.getMaxAnisotropy()));
  for (const texture of managedTextures) {
    if (texture.anisotropy === maxAnisotropy) continue;
    texture.anisotropy = maxAnisotropy;
    // WebGL sampler state is applied on upload; invalidate cached maps after policy changes.
    texture.needsUpdate = true;
  }
}

/** Registers generated textures with the same sampler budget as loaded assets. */
export function manageTexture<T extends THREE.Texture>(texture: T): T {
  managedTextures.add(texture);
  texture.anisotropy = maxAnisotropy;
  texture.needsUpdate = true;
  return texture;
}

export function assetDiagnostics() {
  const entries = [...assetState.entries()];
  return {
    cached: cache.size,
    ready: entries.filter(([, value]) => value.status === "ready").length,
    loading: entries.filter(([, value]) => value.status === "loading").length,
    failed: entries.filter(([, value]) => value.status === "failed").map(([file]) => file),
    maxAnisotropy,
  };
}

export function gameTex(file: string, repeatX = 1, repeatY = 1, clamp = false, role: TextureRole = "color"): THREE.Texture {
  const key = `${file}:${repeatX}:${repeatY}:${clamp}:${role}`;
  const hit = cache.get(key);
  if (hit) {
    const state = assetState.get(key);
    if (state) state.hits++;
    return hit;
  }
  const url = `${import.meta.env.BASE_URL}game/${file}`;
  const state: { status: "loading" | "ready" | "failed"; role: TextureRole; hits: number } = { status: "loading", role, hits: 0 };
  assetState.set(key, state);
  const t = loader.load(
    url,
    () => { state.status = "ready"; },
    undefined,
    (err) => {
      state.status = "failed";
      // The texture remains valid (albeit empty), allowing gameplay to continue.
      fault("warn", `Asset failed to load: ${file}`, err);
    },
  );
  t.colorSpace = role === "color" || role === "environment" ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  manageTexture(t);
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
  t.colorSpace = THREE.NoColorSpace;
  manageTexture(t);
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
  t.colorSpace = THREE.NoColorSpace;
  manageTexture(t);
  oval = t;
  return t;
}

export function applyEnv(renderer: THREE.WebGLRenderer, scene: THREE.Scene) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  loader.load(
    `${import.meta.env.BASE_URL}game/sky.jpg`,
    (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.mapping = THREE.EquirectangularReflectionMapping;
      const env = pmrem.fromEquirectangular(tex).texture;
      scene.environment?.dispose();
      scene.environment = env;
      scene.environmentIntensity = 0.72;
      tex.dispose();
      pmrem.dispose();
    },
    undefined,
    (err) => {
      pmrem.dispose();
      fault("warn", "Asset failed to load: sky.jpg; continuing without image-based lighting", err);
    },
  );
}

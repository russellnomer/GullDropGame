import * as THREE from "three";
import { manageTexture } from "./assets";

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  if (!g) throw new Error("2d");
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return manageTexture(t);
}

export function makeWoodTexture(): THREE.CanvasTexture {
  const t = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = "#6a5340";
    g.fillRect(0, 0, w, h);
    const n = 10;
    for (let i = 0; i < n; i++) {
      const x = (i / n) * w;
      g.fillStyle = i % 2 === 0 ? "#7a5e48" : "#5a4636";
      g.fillRect(x, 0, w / n + 1, h);
      g.fillStyle = i % 3 === 0 ? "#8a6a52" : "#4a382c";
      g.fillRect(x + w / n - 3, 0, 3, h);
      for (let k = 0; k < 40; k++) {
        g.strokeStyle = `rgba(30,18,10,${0.04 + Math.random() * 0.08})`;
        g.beginPath();
        const yy = Math.random() * h;
        g.moveTo(x + 2, yy);
        g.lineTo(x + w / n - 4, yy + (Math.random() - 0.5) * 30);
        g.stroke();
      }
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function makeSandTexture(): THREE.CanvasTexture {
  const t = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = "#c9b48a";
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2000; i++) {
      g.fillStyle = Math.random() > 0.5 ? "#d8c49a" : "#b89a72";
      g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function makeAsphalt(): THREE.CanvasTexture {
  const t = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = "#3a3a3c";
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 3000; i++) {
      g.fillStyle = `rgba(255,255,255,${Math.random() * 0.08})`;
      g.fillRect(Math.random() * w, Math.random() * h, Math.random() * 4, Math.random() * 4);
      g.fillStyle = `rgba(10,10,12,${Math.random() * 0.15})`;
      g.fillRect(Math.random() * w, Math.random() * h, Math.random() * 8, Math.random() * 8);
    }
    // tire tracks / grime lines
    for (let i = 0; i < 5; i++) {
      g.fillStyle = `rgba(15,15,18,0.12)`;
      g.fillRect(w * 0.2 + Math.random() * 20, 0, 40, h);
      g.fillRect(w * 0.7 + Math.random() * 20, 0, 40, h);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** A tiny repeatable map that breaks up otherwise flat inland masonry and concrete. */
export function makeCityGrimeTexture(): THREE.CanvasTexture {
  const t = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = "#b0a79a";
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 32) {
      g.fillStyle = "rgba(55,45,37,0.16)";
      g.fillRect(0, y, w, 2);
    }
    for (let i = 0; i < 420; i++) {
      const shade = 55 + ((i * 47) % 45);
      g.fillStyle = `rgba(${shade},${shade - 8},${shade - 14},${0.025 + (i % 5) * 0.012})`;
      const x = (i * 71) % w;
      const y = (i * 113) % h;
      g.fillRect(x, y, 1 + (i % 5), 1 + ((i * 3) % 7));
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 2);
  return t;
}

export function makeSkyTexture(): THREE.CanvasTexture {
  return canvasTex(8, 512, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, "#1a2a44");
    grd.addColorStop(0.45, "#7aa0c4");
    grd.addColorStop(0.72, "#e8b48a");
    grd.addColorStop(1, "#f0d4b0");
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
  });
}

export function makeWaterMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color(0x0e3a48) },
      uMid: { value: new THREE.Color(0x1f6a78) },
      uSun: { value: new THREE.Color(0xffe2c4) },
      uSunDir: { value: new THREE.Vector3(-0.62, 0.64, 0.45).normalize() },
    },
    transparent: false,
    vertexShader: `
      varying vec2 vUv;
       varying vec3 vWorld;
       varying vec3 vWaveNormal;
      uniform float uTime;
      void main() {
        vUv = uv;
        vec3 p = position;
        p.z += sin(p.x * 0.05 + uTime * 0.7) * 0.22 + cos(p.y * 0.04 + uTime * 0.45) * 0.16;
         float dx = cos(p.x * 0.05 + uTime * 0.7) * 0.011;
         float dz = -sin(p.y * 0.04 + uTime * 0.45) * 0.0064;
         vWaveNormal = normalize(vec3(-dx, 1.0, -dz));
         vec4 world = modelMatrix * vec4(p, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      uniform vec3 uDeep;
      uniform vec3 uMid;
      uniform vec3 uSun;
       uniform vec3 uSunDir;
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vWorld;
       varying vec3 vWaveNormal;
      void main() {
        float wave = 0.5 + 0.5 * sin(vWorld.x * 0.12 + vWorld.z * 0.09 + uTime * 0.8);
         vec3 normal = normalize(vWaveNormal);
         vec3 viewDir = normalize(cameraPosition - vWorld);
         float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 4.5);
         vec3 reflection = mix(vec3(0.16, 0.28, 0.36), vec3(0.94, 0.66, 0.45), clamp(reflect(-viewDir, normal).y * 0.7 + 0.3, 0.0, 1.0));
         vec3 halfDir = normalize(viewDir + uSunDir);
         float spec = pow(max(dot(normal, halfDir), 0.0), 110.0);
        vec3 col = mix(uDeep, uMid, wave);
         col = mix(col, reflection, 0.12 + fresnel * 0.72);
         col += uSun * spec * (0.7 + fresnel * 0.45);
         col += uSun * 0.035;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

export type PbrCompanionMaps = {
  normalMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  aoMap: THREE.CanvasTexture;
};

/** Copies the UV transform contract of a colour map onto its linear PBR maps. */
export function matchPbrMapsToAlbedo(maps: PbrCompanionMaps, albedo: THREE.Texture) {
  for (const map of [maps.normalMap, maps.roughnessMap, maps.aoMap]) {
    map.wrapS = albedo.wrapS;
    map.wrapT = albedo.wrapT;
    map.repeat.copy(albedo.repeat);
    map.offset.copy(albedo.offset);
    map.center.copy(albedo.center);
    map.rotation = albedo.rotation;
    map.matrixAutoUpdate = albedo.matrixAutoUpdate;
    if (!map.matrixAutoUpdate) map.matrix.copy(albedo.matrix);
    else map.updateMatrix();
    map.needsUpdate = true;
  }
}

/**
 * Small, tileable linear-data maps used beside the photographic colour maps.
 * Keeping these procedural avoids shipping a second large image set while giving
 * raking sunlight useful micro-relief on the boardwalk and city materials.
 */
export function makePbrCompanionMaps(surface: "wood" | "sand" | "asphalt" | "facade" | "masonry"): PbrCompanionMaps {
  const size = 128;
  const makeLinear = (paint: (data: Uint8ClampedArray, x: number, y: number) => void) => {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const g = c.getContext("2d");
    if (!g) throw new Error("2d");
    const image = g.createImageData(size, size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) paint(image.data, x, y);
    g.putImageData(image, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.NoColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return manageTexture(t);
  };
  const hash = (x: number, y: number) => ((x * 17 + y * 43 + x * y * 3) & 31) / 31;
  const grain = surface === "wood" ? 0.9 : surface === "asphalt" ? 0.55 : surface === "sand" ? 0.3 : 0.42;
  const normalMap = makeLinear((d, x, y) => {
    const ridge = surface === "wood" ? Math.sin(y * 0.44) * 0.65 + Math.sin(y * 1.3) * 0.2 : hash(x, y) - 0.5;
    const i = (y * size + x) * 4;
    d[i] = 128 + ridge * 22 * grain;
    d[i + 1] = 128 + (hash(y, x) - 0.5) * 18 * grain;
    d[i + 2] = 255; d[i + 3] = 255;
  });
  const roughnessMap = makeLinear((d, x, y) => {
    const seam = surface === "masonry" || surface === "facade" ? (y % 16 < 2 ? -20 : 0) : 0;
    const v = Math.max(35, Math.min(245, 170 + seam + (hash(x, y) - 0.5) * 52 + (surface === "sand" ? 35 : 0)));
    const i = (y * size + x) * 4; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
  });
  const aoMap = makeLinear((d, x, y) => {
    const seam = (surface === "masonry" || surface === "facade") && (x % 32 < 2 || y % 16 < 2) ? 150 : 230;
    const i = (y * size + x) * 4; d[i] = d[i + 1] = d[i + 2] = seam; d[i + 3] = 255;
  });
  return { normalMap, roughnessMap, aoMap };
}

export function makeFacade(kind: "casino" | "hotel" | "shop"): THREE.CanvasTexture {
  return canvasTex(512, 1024, (g, w, h) => {
    const base = kind === "casino" ? "#4a353d" : kind === "hotel" ? "#a3998a" : "#556059";
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);

    // Add grime
    for (let i = 0; i < 2000; i++) {
      g.fillStyle = `rgba(30, 25, 20, ${Math.random() * 0.1})`;
      g.fillRect(Math.random() * w, Math.random() * h, Math.random() * 10, Math.random() * 10);
    }

    g.fillStyle = kind === "casino" ? "#a84738" : "#4a8a83";
    g.fillRect(0, 0, w, 60);
    g.fillStyle = "#e0dacd";
    g.font = "bold 32px sans-serif";
    g.textAlign = "center";
    g.fillText(kind === "casino" ? "CASINO" : kind === "hotel" ? "HOTEL" : "ARCADE", w / 2, 42);

    // Window rhythm and depth
    const cols = 5;
    const rows = 12;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = 32 + c * 92;
        const y = 100 + r * 76;
        // Sill
        g.fillStyle = `rgba(20, 20, 20, 0.4)`;
        g.fillRect(x - 2, y - 2, 60, 60);
        // Glass
        g.fillStyle = Math.random() > 0.45 ? "#d4c89e" : "#121a24";
        g.fillRect(x, y, 56, 56);
        // Window frames
        g.fillStyle = "#2a2a2a";
        g.fillRect(x + 26, y, 4, 56);
        g.fillRect(x, y + 26, 56, 4);
      }
    }
  });
}

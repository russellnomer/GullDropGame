import * as THREE from "three";

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  if (!g) throw new Error("2d");
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
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
  t.anisotropy = 16;
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
  const t = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = "#3a3a3c";
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 800; i++) {
      g.fillStyle = `rgba(255,255,255,${Math.random() * 0.06})`;
      g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
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
    },
    transparent: false,
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorld;
      uniform float uTime;
      void main() {
        vUv = uv;
        vec3 p = position;
        p.z += sin(p.x * 0.05 + uTime * 0.7) * 0.22 + cos(p.y * 0.04 + uTime * 0.45) * 0.16;
        vec4 world = modelMatrix * vec4(p, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      uniform vec3 uDeep;
      uniform vec3 uMid;
      uniform vec3 uSun;
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vWorld;
      void main() {
        float wave = 0.5 + 0.5 * sin(vWorld.x * 0.12 + vWorld.z * 0.09 + uTime * 0.8);
        float spec = pow(max(0.0, sin(vWorld.x * 0.35 + vWorld.z * 0.22 - uTime * 1.6)), 22.0);
        vec3 col = mix(uDeep, uMid, wave);
        col += uSun * spec * 0.55;
        col += uSun * 0.08;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

export function makeFacade(kind: "casino" | "hotel" | "shop"): THREE.CanvasTexture {
  return canvasTex(256, 512, (g, w, h) => {
    const base = kind === "casino" ? "#5a3a48" : kind === "hotel" ? "#c4b8a4" : "#6a7a6e";
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    g.fillStyle = kind === "casino" ? "#c45c4a" : "#5eb7ae";
    g.fillRect(0, 0, w, 36);
    g.fillStyle = "#f0ece4";
    g.font = "bold 22px sans-serif";
    g.textAlign = "center";
    g.fillText(kind === "casino" ? "CASINO" : kind === "hotel" ? "HOTEL" : "ARCADE", w / 2, 26);
    const cols = 4;
    const rows = 8;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = 24 + c * 56;
        const y = 56 + r * 54;
        g.fillStyle = Math.random() > 0.35 ? "#f3e5ab" : "#1a2430";
        g.fillRect(x, y, 32, 36);
      }
    }
  });
}

import * as THREE from "three";
import { BOARDWALK, SAND_Y } from "./world";
import { makeHuman } from "./rigs";
import { bystanderQuote, killBubble, makeBubble, makeSplat } from "./reactions";

export type NpcKind =
  | "tourist"
  | "custard"
  | "selfie"
  | "proposal"
  | "nap"
  | "balloon"
  | "feeder"
  | "hotdog"
  | "star"
  | "cop"
  | "tanner"
  | "swimmer"
  | "lifeguard"
  | "volleyball"
  | "vendor"
  | "rider";

export type StarRole = "lawyer" | "politician" | "realtor" | "hoa" | "parking" | "influencer" | "crypto" | "insurance";

export type Npc = {
  kind: NpcKind;
  starRole: StarRole | null;
  alive: boolean;
  hit: boolean;
  x: number;
  y: number;
  z: number;
  yaw: number;
  speed: number;
  walk: number;
  panic: number;
  eat: number;
  partner: Npc | null;
  group: THREE.Group;
  cone: THREE.Object3D | null;
  item: THREE.Object3D | null;
  react: number;
  glance: number;
  splat: THREE.Object3D | null;
  bubble: THREE.Sprite | null;
  mount: THREE.Object3D | null;
};

const SHIRTS = [0xc45c4a, 0x5eb7ae, 0xf0ece4, 0x4a6fa5, 0xd9c4a3, 0x3d4a5c, 0x7a5a3a];
const ROLES: StarRole[] = ["lawyer", "politician", "realtor", "hoa", "parking", "influencer", "crypto", "insurance"];

function pick<T>(a: T[]): T {
  return a[(Math.random() * a.length) | 0];
}

function std(color: number, extra: THREE.MeshStandardMaterialParameters = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.65, metalness: 0.05, ...extra });
}

function beachKind(k: NpcKind) {
  return k === "tanner" || k === "swimmer" || k === "lifeguard" || k === "volleyball";
}

const _world = new THREE.Vector3();

function makePerson(shirt: number, role: StarRole | null, kind: NpcKind, seed: number): THREE.Group {
  return makeHuman(shirt, role, kind, seed);
}

function makeCone(): THREE.Group {
  const g = new THREE.Group();
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.22, 8), std(0xd2a05a));
  cone.position.y = -0.08;
  const scoop = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), std(0xf4e0b0));
  scoop.position.y = 0.08;
  g.add(cone, scoop);
  g.name = "cone";
  return g;
}

export function faceCards(root: THREE.Object3D, px: number, py: number, pz: number) {
  root.traverse((o) => {
    if (o.name === "card") o.lookAt(px, py, pz);
  });
}

export class Crowd {
  group = new THREE.Group();
  npcs: Npc[] = [];

  spawnAll(benches: THREE.Vector3[], photo: THREE.Vector3, kiosk: THREE.Vector3) {
    const pack = [
      [0.8, 8],
      [-1.6, 6],
      [2.2, 4],
      [-3.1, 2],
      [1.1, 0],
      [-0.4, -3],
      [3.4, -6],
      [-2.4, -8],
      [0.2, -12],
      [4.0, -16],
      [-3.6, -18],
      [1.8, -22],
      [-1.0, -26],
      [2.6, -30],
      [-4.2, -34],
      [0.6, -38],
    ] as const;
    for (const [x, z] of pack) this.spawn("tourist", x, z);
    for (let i = 0; i < 18; i++) this.spawn("tourist");
    this.spawn("custard", kiosk.x - 1.4, kiosk.z + 2.2);
    this.spawn("custard", kiosk.x + 0.8, kiosk.z + 4.5);
    this.spawn("custard");
    this.spawn("selfie", photo.x + 0.6, photo.z);
    this.spawn("selfie");
    const a = this.spawn("proposal", photo.x - 1.2, photo.z + 6);
    const b = this.spawn("proposal", photo.x - 0.4, photo.z + 6.4);
    a.partner = b;
    b.partner = a;
    for (let i = 0; i < Math.min(5, benches.length); i++) {
      const p = benches[i * 3] ?? benches[i];
      this.spawn("nap", p.x, p.z);
    }
    this.spawn("balloon");
    this.spawn("balloon");
    this.spawn("feeder");
    this.spawn("feeder");
    this.spawn("hotdog");
    this.spawn("hotdog");
    for (const role of ROLES) this.spawn("star", undefined, undefined, role);
    this.spawn("cop");
    this.spawn("cop");
    this.spawn("cop");
    this.spawnBeach();
    for (let i = 0; i < 5; i++) this.spawn("vendor", -2 + (i % 2) * 4, -40 + i * 38);
  }

  seatRides(ferrisCars: THREE.Group[], coasterCar: THREE.Group, carousel: THREE.Group) {
    for (let i = 0; i < ferrisCars.length; i += 2) this.spawn("rider", 0, 0, undefined, ferrisCars[i]);
    this.spawn("rider", 0, 0, undefined, coasterCar);
    this.spawn("rider", 0.35, 0, undefined, coasterCar);
    for (const seat of carousel.children) {
      if (seat.name === "cseat") this.spawn("rider", 0, 0, undefined, seat);
    }
  }

  private spawnBeach() {
    for (const z of [-90, 8, 118]) this.spawn("lifeguard", -16.5, z);
    for (let i = 0; i < 10; i++) this.spawn("tanner", -20 - Math.random() * 18, -160 + i * 32 + Math.random() * 10);
    for (let i = 0; i < 8; i++) this.spawn("swimmer", -70 + Math.random() * 18, -140 + i * 38 + Math.random() * 12);
    for (let i = 0; i < 6; i++) this.spawn("volleyball", -34 + Math.random() * 16, -120 + i * 42);
  }

  spawn(kind: NpcKind, x?: number, z?: number, starRole?: StarRole, mount?: THREE.Object3D): Npc {
    const role = kind === "star" ? (starRole ?? pick(ROLES)) : null;
    const group = makePerson(
      kind === "cop" ? 0x1c2430 : kind === "lifeguard" ? 0xc45c4a : pick(SHIRTS),
      role,
      kind,
      this.npcs.length,
    );
    let cone: THREE.Object3D | null = null;
    let item: THREE.Object3D | null = null;
    if (kind === "custard") {
      cone = makeCone();
      const arm = group.getObjectByName("armR");
      if (arm) {
        cone.position.set(0, -0.28, 0.08);
        arm.add(cone);
        arm.rotation.x = -1.2;
      }
    }
    if (kind === "selfie") {
      const phone = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.02), std(0x1a1a1c));
      const arm = group.getObjectByName("armL");
      if (arm) {
        phone.position.set(0, -0.35, 0.08);
        arm.add(phone);
        arm.rotation.x = -2.2;
      }
      item = phone;
    }
    if (kind === "balloon") {
      const balloons = new THREE.Group();
      const cols = [0xc45c4a, 0x5eb7ae, 0xf0ece4];
      for (let i = 0; i < 5; i++) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), std(cols[i % cols.length]));
        s.position.set((i - 2) * 0.16, 1.1 + (i % 2) * 0.12, 0.1);
        balloons.add(s);
      }
      balloons.position.y = 0.2;
      group.add(balloons);
      item = balloons;
    }
    if (kind === "hotdog") {
      const dog = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.2, 8), std(0xd2a05a));
      dog.rotation.z = Math.PI / 2;
      const arm = group.getObjectByName("armR");
      if (arm) {
        dog.position.set(0, -0.28, 0.06);
        arm.add(dog);
        arm.rotation.x = -1.1;
      }
      item = dog;
    }
    if (kind === "star") {
      const spark = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 8, 6),
        std(0x5eb7ae, { emissive: 0x5eb7ae, emissiveIntensity: 0.9 }),
      );
      spark.position.y = 2.15;
      spark.name = "spark";
      group.add(spark);
    }
    if (kind === "lifeguard") {
      const buoy = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.05, 8, 14), std(0xc45c4a, { emissive: 0xc45c4a, emissiveIntensity: 0.2 }));
      buoy.rotation.x = 0.4;
      const arm = group.getObjectByName("armL");
      if (arm) {
        buoy.position.set(0, -0.4, 0.05);
        arm.add(buoy);
        arm.rotation.x = -0.8;
      }
      item = buoy;
    }
    if (kind === "swimmer") {
      const tube = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.1, 8, 16), std(0xc45c4a));
      tube.rotation.x = Math.PI / 2;
      tube.position.y = 0.7;
      group.add(tube);
      item = tube;
    }
    if (kind === "volleyball") {
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), std(0xf0ece4));
      const arm = group.getObjectByName("armR");
      if (arm) {
        ball.position.set(0, -0.55, 0.04);
        arm.add(ball);
        arm.rotation.x = -1.4;
      }
      item = ball;
    }
    if (kind === "vendor") {
      const cart = makePushCart();
      group.add(cart);
      item = cart;
    }
    const sand = kind === "tanner" || kind === "volleyball";
    const surf = kind === "swimmer";
    const n: Npc = {
      kind,
      starRole: role,
      alive: true,
      hit: false,
      x: x ?? (surf ? -70 + Math.random() * 20 : sand || kind === "lifeguard" ? -36 + Math.random() * 18 : -5 + Math.random() * 10),
      y: kind === "lifeguard" ? SAND_Y + 3.15 : surf ? 0.15 : sand ? SAND_Y : BOARDWALK.y,
      z: z ?? (sand || surf || kind === "lifeguard" ? -180 + Math.random() * 360 : Math.random() < 0.5 ? -50 + Math.random() * 80 : -180 + Math.random() * 360),
      yaw: Math.random() * Math.PI * 2,
      speed: 1.1 + Math.random() * 0.9,
      walk: Math.random() * 10,
      panic: 0,
      eat: kind === "custard" ? 0.4 + Math.random() * 0.5 : 0,
      partner: null,
      group,
      cone,
      item,
      react: (Math.random() * 3) | 0,
      glance: 0,
      splat: null,
      bubble: null,
      mount: mount ?? null,
    };
    group.position.set(n.x, n.y, n.z);
    if (mount) {
      this.group.remove(group);
      group.position.set(0, 0.55, 0);
      group.scale.setScalar(1.05);
      mount.add(group);
    } else {
      this.group.add(group);
    }
    this.npcs.push(n);
    return n;
  }

  respawn(n: Npc, kind: NpcKind) {
    this.clearFx(n);
    n.kind = kind;
    n.alive = true;
    n.hit = false;
    n.panic = 0;
    n.glance = 0;
    n.react = (Math.random() * 3) | 0;
    n.eat = kind === "custard" ? 0.5 : 0;
    if (kind === "rider" && n.mount) {
      n.group.visible = true;
      n.group.position.set(0, 0.55, 0);
      n.group.rotation.set(0, 0, 0);
      n.mount.add(n.group);
      const head = n.group.getObjectByName("head");
      if (head) head.rotation.set(0, 0, 0);
      return;
    }
    if (kind === "vendor") {
      n.x = -5 + Math.random() * 10;
      n.y = BOARDWALK.y;
      n.z = -180 + Math.random() * 360;
    } else if (kind === "swimmer") {
      n.x = -70 + Math.random() * 20;
      n.y = 0.15;
      n.z = -180 + Math.random() * 360;
    } else if (kind === "tanner" || kind === "volleyball") {
      n.x = -36 + Math.random() * 18;
      n.y = SAND_Y;
      n.z = -180 + Math.random() * 360;
    } else if (kind === "lifeguard") {
      n.x = -16.5;
      n.y = SAND_Y + 3.15;
      n.z = [-90, 8, 118][(Math.random() * 3) | 0];
    } else {
      n.x = -5 + Math.random() * 10;
      n.y = BOARDWALK.y;
      n.z = -180 + Math.random() * 360;
    }
    n.group.visible = true;
    n.group.rotation.set(0, n.yaw, 0);
    n.group.position.set(n.x, n.y, n.z);
    const head = n.group.getObjectByName("head");
    if (head) head.rotation.set(0, 0, 0);
  }

  reactHit(n: Npc, text: string) {
    this.clearFx(n);
    n.hit = true;
    n.panic = 0.01;
    n.react = (Math.random() * 3) | 0;
    const splat = makeSplat();
    const head = n.group.getObjectByName("head");
    if (head) {
      splat.position.set(0, 0.12, 0.16);
      head.add(splat);
    } else {
      splat.position.set(0, 3.5, 0.2);
      n.group.add(splat);
    }
    n.splat = splat;
    const bubble = makeBubble(text);
    bubble.scale.set(1.7, 0.42, 1);
    bubble.position.set(0, 2.35, 0);
    n.group.add(bubble);
    n.bubble = bubble;
    this.flash(n);
  }

  glance(n: Npc) {
    if (n.hit || n.glance > 0) return;
    n.glance = 1.5;
    const bubble = makeBubble(bystanderQuote());
    bubble.scale.set(1.35, 0.34, 1);
    bubble.position.y = 2.2;
    n.group.add(bubble);
    n.bubble = bubble;
  }

  clearFx(n: Npc) {
    if (n.splat) {
      n.splat.parent?.remove(n.splat);
      n.splat = null;
    }
    killBubble(n.bubble);
    n.bubble = null;
    n.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.material && "emissiveIntensity" in (m.material as THREE.MeshStandardMaterial)) {
        const mat = m.material as THREE.MeshStandardMaterial;
        if (mat.emissiveIntensity > 0.2 && mat.emissive.getHex() === 0xf4f1ea) {
          mat.emissiveIntensity = 0;
        }
      }
    });
  }

  update(dt: number) {
    for (const n of this.npcs) {
      if (!n.alive) continue;
      if (n.hit) {
        n.panic += dt;
        const p = n.panic;
        const head = n.group.getObjectByName("head");
        const armL = n.group.getObjectByName("armL");
        const armR = n.group.getObjectByName("armR");
        if (n.react === 0) {
          if (head) head.rotation.x = -0.55 + Math.sin(p * 14) * 0.08;
          if (armR) {
            armR.rotation.x = -2.1;
            armR.rotation.z = Math.sin(p * 22) * 0.7;
          }
          if (armL) armL.rotation.x = -1.6 + Math.sin(p * 18) * 0.4;
          n.group.rotation.z = Math.sin(p * 16) * 0.12;
        } else if (n.react === 1) {
          if (head) head.rotation.x = -0.95;
          n.group.rotation.x = -0.25;
          if (armL) armL.rotation.x = -2.4;
          if (armR) armR.rotation.x = -2.4;
          n.group.position.y = n.y + Math.abs(Math.sin(p * 10)) * 0.12;
        } else {
          n.yaw += dt * 3;
          n.x += -Math.sin(n.yaw) * 3.2 * dt;
          n.z += -Math.cos(n.yaw) * 3.2 * dt;
          if (armL) armL.rotation.x = Math.sin(p * 24) * 1.4;
          if (armR) armR.rotation.x = Math.sin(p * 24 + 1) * 1.4;
          n.group.position.y = n.y + Math.abs(Math.sin(p * 20)) * 0.35;
        }
        n.group.rotation.y = n.yaw;
        n.group.position.x = n.x;
        n.group.position.z = n.z;
        if (n.bubble) n.bubble.position.y = 2.35 + Math.sin(p * 8) * 0.05;
        if (p > 2.6) {
          n.alive = false;
          n.group.visible = false;
          this.respawn(n, n.kind === "star" || n.kind === "cop" || n.kind === "vendor" || n.kind === "rider" || beachKind(n.kind) ? n.kind : "tourist");
        }
        continue;
      }
      if (n.glance > 0) {
        n.glance -= dt;
        if (n.bubble) (n.bubble.material as THREE.SpriteMaterial).opacity = Math.min(1, n.glance * 2);
        if (n.glance <= 0) {
          killBubble(n.bubble);
          n.bubble = null;
        }
      }
      n.walk += dt * n.speed * 4;
      if (n.kind === "rider") {
        const w = n.group.getWorldPosition(_world);
        n.x = w.x;
        n.y = w.y;
        n.z = w.z;
        continue;
      }
      if (n.kind === "custard") {
        n.eat = Math.max(0, n.eat - dt * 0.045);
        if (n.eat <= 0 && n.cone) n.cone.visible = false;
      }
      if (n.kind === "nap" || n.kind === "tanner") {
        n.group.rotation.x = -1.05;
        n.group.position.set(n.x, n.y + 0.15, n.z);
        continue;
      }
      if (n.kind === "lifeguard") {
        n.yaw += dt * 0.35;
        n.group.position.set(n.x, n.y, n.z);
        n.group.rotation.set(0, n.yaw, 0);
        continue;
      }
      n.group.rotation.x = 0;
      if (n.kind !== "proposal") {
        n.x += -Math.sin(n.yaw) * n.speed * dt;
        n.z += -Math.cos(n.yaw) * n.speed * dt;
        if (n.kind === "swimmer") {
          if (n.x < -78 || n.x > -48) n.yaw += Math.PI;
          n.y = 0.12 + Math.abs(Math.sin(n.walk * 0.4)) * 0.35;
        } else if (n.kind === "volleyball") {
          if (n.x < -40 || n.x > -12) n.yaw += Math.PI;
        } else {
          if (n.x < -6.5 || n.x > 6.5) n.yaw += Math.PI;
        }
        if (n.z < -210 || n.z > 210) n.yaw += Math.PI;
      }
      n.group.position.set(n.x, n.y, n.z);
      n.group.rotation.y = n.yaw;
      const armL = n.group.getObjectByName("armL");
      const armR = n.group.getObjectByName("armR");
      if (armL && n.kind !== "selfie") armL.rotation.x = Math.sin(n.walk) * 0.55;
      if (armR && n.kind !== "custard" && n.kind !== "hotdog") armR.rotation.x = Math.sin(n.walk + Math.PI) * 0.55;
    }
  }

  hitTest(x: number, y: number, z: number, r: number): { npc: Npc; cone: boolean } | null {
    for (const n of this.npcs) {
      if (!n.alive || n.hit) continue;
      const dx = x - n.x;
      const dz = z - n.z;
      const bodyY = n.kind === "tanner" || n.kind === "nap" ? n.y + 0.6 : n.y + (n.kind === "rider" ? 0.8 : 2.1);
      const dy = y - bodyY;
      const rad = n.kind === "tanner" || n.kind === "swimmer" || n.kind === "rider" || n.kind === "vendor" ? 1.3 : 1.05;
      if (dx * dx + dz * dz > (rad + r) * (rad + r) || Math.abs(dy) > (n.kind === "tanner" ? 1.3 : n.kind === "rider" ? 3.2 : 2.4)) continue;
      let cone = false;
      if (n.cone && n.kind === "custard") {
        const cy = n.y + 2.6;
        if (Math.abs(y - cy) < 0.7) cone = true;
      }
      return { npc: n, cone };
    }
    return null;
  }

  inRadius(x: number, z: number, r: number, except: Npc | null): Npc[] {
    const out: Npc[] = [];
    const r2 = r * r;
    for (const n of this.npcs) {
      if (!n.alive || n.hit || n === except) continue;
      const dx = n.x - x;
      const dz = n.z - z;
      if (dx * dx + dz * dz <= r2) out.push(n);
    }
    return out;
  }

  flash(n: Npc) {
    n.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.material && "emissive" in (m.material as THREE.MeshStandardMaterial)) {
        const mat = m.material as THREE.MeshStandardMaterial;
        mat.emissive = new THREE.Color(0xf4f1ea);
        mat.emissiveIntensity = 0.55;
      }
    });
  }
}

function makePushCart(): THREE.Group {
  const g = new THREE.Group();
  g.name = "cart";
  const wood = std(0x6a5340);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.55, 1.15), wood);
  body.position.set(0, 0.55, -0.75);
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 1.2), std(0x3a2414));
  shelf.position.set(0, 0.85, -0.75);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.4, 8), std(0xf0ece4));
  pole.position.set(0, 1.5, -0.75);
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.7, 0.28, 8, 1, true), std(0xc45c4a, { side: THREE.DoubleSide }));
  shade.position.set(0, 2.15, -0.75);
  const w1 = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.08, 10), std(0x1a1a1c));
  w1.rotation.z = Math.PI / 2;
  w1.position.set(-0.4, 0.16, -0.35);
  const w2 = w1.clone();
  w2.position.x = 0.4;
  const w3 = w1.clone();
  w3.position.set(-0.4, 0.16, -1.1);
  const w4 = w1.clone();
  w4.position.set(0.4, 0.16, -1.1);
  const pretzel = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.03, 6, 10), std(0xd2a05a));
  pretzel.position.set(0.12, 0.95, -0.55);
  g.add(body, shelf, pole, shade, w1, w2, w3, w4, pretzel);
  return g;
}

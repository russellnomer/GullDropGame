import * as THREE from "three";
import { BOARDWALK } from "./world";
import { makeSquirrelRig } from "./rigs";
import { gameTex, squirrelAlpha } from "./assets";
import { killBubble, makeBubble, makeSplat, quoteFor } from "./reactions";

export type Squirrel = {
  id: number;
  boss: boolean;
  alive: boolean;
  hit: boolean;
  hp: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  speed: number;
  panic: number;
  throwCd: number;
  walk: number;
  group: THREE.Group;
  bubble: THREE.Sprite | null;
  splat: THREE.Object3D | null;
};

export type Acorn = {
  alive: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  mesh: THREE.Mesh;
};

const FUR = [0x7a4a2a, 0x5a341c, 0x8a5a32, 0x3a2414];
let sid = 1;

function std(color: number, extra: THREE.MeshStandardMaterialParameters = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.04, ...extra });
}

function makeSquirrel(boss: boolean): THREE.Group {
  const g = makeSquirrelRig(boss);
  const shots = ["sq-side.jpg", "sq-front.jpg", "sq-up.jpg", "sq-look.jpg", "sq-board.jpg"];
  const file = boss ? "sq-up.jpg" : shots[(Math.random() * shots.length) | 0];
  const card = new THREE.Mesh(
    new THREE.PlaneGeometry(boss ? 2.6 : 2.15, boss ? 3.3 : 2.7),
    new THREE.MeshStandardMaterial({
      map: gameTex(file, 1, 1, true),
      alphaMap: squirrelAlpha(),
      transparent: true,
      alphaTest: 0.18,
      roughness: 0.55,
      metalness: 0.02,
      side: THREE.DoubleSide,
    }),
  );
  card.name = "card";
  card.position.set(0, boss ? 1.05 : 0.82, 0.42);
  g.add(card);
  return g;
}

export class SquirrelMafia {
  group = new THREE.Group();
  list: Squirrel[] = [];
  acorns: Acorn[] = [];

  constructor() {
    const geo = new THREE.SphereGeometry(0.08, 8, 6);
    const mat = std(0x6a3a18, { roughness: 0.8 });
    for (let i = 0; i < 16; i++) {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      this.group.add(mesh);
      this.acorns.push({ alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, mesh });
    }
  }

  spawnAll() {
    for (let i = 0; i < 6; i++) this.spawn(false, -5.2 + Math.random() * 10.4, 92 + Math.random() * 48);
    for (let i = 0; i < 5; i++) this.spawn(false, -5.2 + Math.random() * 10.4, -10 + Math.random() * 90);
    for (let i = 0; i < 3; i++) this.spawn(false, -5.2 + Math.random() * 10.4, -170 + Math.random() * 40);
    this.spawn(true, 5.4, 112);
  }

  spawn(boss: boolean, x: number, z: number): Squirrel {
    const group = makeSquirrel(boss);
    const s: Squirrel = {
      id: sid++,
      boss,
      alive: true,
      hit: false,
      hp: boss ? 3 : 1,
      x,
      y: BOARDWALK.y,
      z,
      yaw: Math.random() * Math.PI * 2,
      speed: boss ? 2.1 : 1.6 + Math.random() * 0.8,
      panic: 0,
      throwCd: 1 + Math.random() * 2,
      walk: Math.random() * 10,
      group,
      bubble: null,
      splat: null,
    };
    group.position.set(s.x, s.y, s.z);
    this.group.add(group);
    this.list.push(s);
    return s;
  }

  update(dt: number, px: number, py: number, pz: number, wanted: number, playing: boolean) {
    if (!playing) return;
    const agro = wanted >= 2;
    for (const s of this.list) {
      if (!s.alive) continue;
      s.walk += dt * 8;
      s.throwCd = Math.max(0, s.throwCd - dt);
      if (s.hit) {
        s.panic += dt;
        s.yaw += dt * 10;
        s.group.rotation.y = s.yaw;
        s.group.position.set(s.x, s.y + Math.abs(Math.sin(s.panic * 20)) * 0.25, s.z);
        if (s.panic > 1.4) {
          s.alive = false;
          s.group.visible = false;
          if (!s.boss) this.respawn(s);
        }
        continue;
      }
      const dx = px - s.x;
      const dz = pz - s.z;
      const dist = Math.hypot(dx, dz);
      if (agro && dist < 42) {
        s.yaw = Math.atan2(-dx, -dz);
        if (dist > 8) {
          s.x += Math.sin(s.yaw) * -s.speed * 1.3 * dt;
          s.z += Math.cos(s.yaw) * -s.speed * 1.3 * dt;
        }
        if (s.throwCd <= 0 && dist < 28 && py < 22) {
          this.throwAt(s, px, py, pz);
          s.throwCd = s.boss ? 0.7 : 1.4 + Math.random();
        }
      } else {
        s.yaw += dt * 0.4 * (s.id % 2 === 0 ? 1 : -1);
        s.x += -Math.sin(s.yaw) * s.speed * dt;
        s.z += -Math.cos(s.yaw) * s.speed * dt;
      }
      s.x = THREE.MathUtils.clamp(s.x, -6.4, 6.4);
      s.z = THREE.MathUtils.clamp(s.z, -200, 200);
      s.group.position.set(s.x, s.y + Math.abs(Math.sin(s.walk)) * 0.08, s.z);
      s.group.rotation.y = s.yaw;
    }
    this.updateAcorns(dt);
  }

  throwAt(s: Squirrel, px: number, py: number, pz: number) {
    const slot = this.acorns.find((a) => !a.alive);
    if (!slot) return;
    slot.alive = true;
    slot.x = s.x;
    slot.y = s.y + (s.boss ? 1.1 : 0.7);
    slot.z = s.z;
    const dx = px - slot.x;
    const dy = py - slot.y;
    const dz = pz - slot.z;
    const len = Math.hypot(dx, dy, dz) || 1;
    const spd = s.boss ? 22 : 16;
    slot.vx = (dx / len) * spd;
    slot.vy = (dy / len) * spd + 2;
    slot.vz = (dz / len) * spd;
    slot.mesh.visible = true;
    slot.mesh.position.set(slot.x, slot.y, slot.z);
  }

  updateAcorns(dt: number) {
    for (const a of this.acorns) {
      if (!a.alive) continue;
      a.vy -= 14 * dt;
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      a.z += a.vz * dt;
      a.mesh.position.set(a.x, a.y, a.z);
      if (a.y < 0.2 || Math.abs(a.x) > 80 || Math.abs(a.z) > 240) {
        a.alive = false;
        a.mesh.visible = false;
      }
    }
  }

  hitPlayer(px: number, py: number, pz: number, r: number): boolean {
    for (const a of this.acorns) {
      if (!a.alive) continue;
      const dx = a.x - px;
      const dy = a.y - py;
      const dz = a.z - pz;
      if (dx * dx + dy * dy + dz * dz < (r + 0.18) * (r + 0.18)) {
        a.alive = false;
        a.mesh.visible = false;
        return true;
      }
    }
    return false;
  }

  hitTest(x: number, y: number, z: number, r: number): Squirrel | null {
    for (const s of this.list) {
      if (!s.alive || s.hit) continue;
      const dx = x - s.x;
      const dy = y - (s.y + (s.boss ? 0.7 : 0.4));
      const dz = z - s.z;
      const rad = s.boss ? 1.6 : 1.15;
      if (Math.abs(dx) < rad + r && Math.abs(dz) < rad + r && Math.abs(dy) < 1.5 + r) return s;
    }
    return null;
  }

  wound(s: Squirrel): boolean {
    s.hp -= 1;
    if (s.hp > 0) {
      this.say(s, quoteFor("squirrel"));
      return false;
    }
    s.hit = true;
    s.panic = 0.01;
    this.say(s, quoteFor(s.boss ? "don" : "squirrel"));
    const splat = makeSplat();
    splat.position.set(0, 0.9, 0.3);
    splat.scale.setScalar(0.7);
    s.group.add(splat);
    s.splat = splat;
    return true;
  }

  say(s: Squirrel, text: string) {
    killBubble(s.bubble);
    const bubble = makeBubble(text);
    bubble.scale.set(1.5, 0.38, 1);
    bubble.position.set(0, 1.35, 0);
    s.group.add(bubble);
    s.bubble = bubble;
  }

  respawn(s: Squirrel) {
    killBubble(s.bubble);
    s.bubble = null;
    if (s.splat) {
      s.splat.parent?.remove(s.splat);
      s.splat = null;
    }
    s.alive = true;
    s.hit = false;
    s.hp = 1;
    s.panic = 0;
    s.x = -5 + Math.random() * 10;
    s.z = -160 + Math.random() * 320;
    s.group.visible = true;
    s.group.position.set(s.x, s.y, s.z);
  }

  reset() {
    for (const a of this.acorns) {
      a.alive = false;
      a.mesh.visible = false;
    }
    for (const s of this.list) {
      killBubble(s.bubble);
      s.bubble = null;
      if (s.splat) {
        s.splat.parent?.remove(s.splat);
        s.splat = null;
      }
      s.alive = true;
      s.hit = false;
      s.hp = s.boss ? 3 : 1;
      s.panic = 0;
      s.group.visible = true;
    }
  }
}

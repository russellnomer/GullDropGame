import * as THREE from "three";
import { makeGullRig } from "./rigs";

export type FlockMark = { x: number; y: number; z: number; alive: boolean };

type Bird = {
  mesh: THREE.Group;
  delay: number;
  dumped: boolean;
  ax: number;
  ay: number;
  az: number;
  ang: number;
  glob: THREE.Mesh;
};

const COUNT = 12;

function makeGull(mat: THREE.MeshStandardMaterial, beakMat: THREE.MeshStandardMaterial): THREE.Group {
  const grey = new THREE.MeshStandardMaterial({ color: 0xc8c2b8, roughness: 0.48, metalness: 0.04 });
  return makeGullRig("world", mat, grey, beakMat);
}

export class Flock {
  group = new THREE.Group();
  active = false;
  target: FlockMark | null = null;
  tx = 0;
  ty = 0;
  tz = 0;
  t = 0;
  dumped = false;
  launchN = 8;
  private birds: Bird[] = [];
  private white: THREE.MeshStandardMaterial;
  private globMat: THREE.MeshStandardMaterial;

  constructor(private readonly random: () => number = Math.random) {
    this.white = new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.48, metalness: 0.04 });
    const beak = new THREE.MeshStandardMaterial({ color: 0xe08932, roughness: 0.4 });
    this.globMat = new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.7 });
    for (let i = 0; i < COUNT; i++) {
      const mesh = makeGull(this.white, beak);
      mesh.visible = false;
      const glob = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), this.globMat);
      glob.visible = false;
      glob.scale.set(0.85, 1.2, 0.85);
      this.group.add(mesh, glob);
      this.birds.push({ mesh, glob, delay: i * 0.055, dumped: false, ax: 0, ay: 0, az: 0, ang: i * 0.7 });
    }
  }

  setLook(bird: number, drop: number, n: number) {
    this.white.color.setHex(bird);
    this.globMat.color.setHex(drop);
    this.launchN = n;
  }

  launch(from: THREE.Vector3, target: FlockMark) {
    this.active = true;
    this.target = target;
    this.t = 0;
    this.dumped = false;
    this.tx = target.x;
    this.ty = target.y + 3.2;
    this.tz = target.z;
    for (let i = 0; i < this.birds.length; i++) {
      const b = this.birds[i];
      if (i >= this.launchN) {
        b.mesh.visible = false;
        b.glob.visible = false;
        continue;
      }
      b.dumped = false;
      b.mesh.visible = true;
      b.glob.visible = false;
      b.ax = from.x + (this.random() - 0.5) * 10;
      b.ay = from.y + 4 + this.random() * 5;
      b.az = from.z + (this.random() - 0.5) * 10;
      b.ang = this.random() * Math.PI * 2;
      b.mesh.position.set(b.ax, b.ay, b.az);
    }
  }

  reset() {
    this.active = false;
    this.target = null;
    this.t = 0;
    this.dumped = false;
    for (const b of this.birds) {
      b.mesh.visible = false;
      b.glob.visible = false;
      b.dumped = false;
    }
  }

  update(dt: number): { strike: boolean; dumps: Array<{ x: number; y: number; z: number }> } {
    const dumps: Array<{ x: number; y: number; z: number }> = [];
    if (!this.active) return { strike: false, dumps };
    this.t += dt;
    if (this.target?.alive) {
      this.tx = this.target.x;
      this.ty = this.target.y + 3.2;
      this.tz = this.target.z;
    }
    for (let i = 0; i < this.birds.length; i++) {
      const b = this.birds[i];
      if (i >= this.launchN) continue;
      const local = Math.max(0, this.t - b.delay);
      b.ang += dt * (3.4 + i * 0.12);
      const radius = THREE.MathUtils.lerp(7.2, 0.55, Math.min(1, local / 0.7));
      const hoverY = this.ty + 1.1 + Math.sin(local * 9 + i) * 0.35;
      const wantX = this.tx + Math.cos(b.ang) * radius;
      const wantZ = this.tz + Math.sin(b.ang) * radius;
      const k = 1 - Math.exp(-8 * dt);
      b.ax += (wantX - b.ax) * k;
      b.az += (wantZ - b.az) * k;
      b.ay += (hoverY - b.ay) * k;
      b.mesh.position.set(b.ax, b.ay, b.az);
      b.mesh.lookAt(this.tx, this.ty - 1.2, this.tz);
      const flap = 0.45 + Math.sin(this.t * 22 + i) * 0.4;
      const lw = b.mesh.getObjectByName("wingL");
      const rw = b.mesh.getObjectByName("wingR");
      if (lw) lw.rotation.z = flap;
      if (rw) rw.rotation.z = -flap;
      if (!b.dumped && local > 0.62) {
        b.dumped = true;
        b.glob.visible = true;
        b.glob.position.set(b.ax, b.ay - 0.2, b.az);
        dumps.push({ x: b.ax, y: b.ay - 0.2, z: b.az });
      }
      if (b.glob.visible) {
        b.glob.position.y -= 18 * dt;
        if (b.glob.position.y < this.ty - 3.4) b.glob.visible = false;
      }
    }
    let strike = false;
    if (!this.dumped && this.t > 0.82) {
      this.dumped = true;
      strike = true;
    }
    if (this.t > 2.5) this.reset();
    return { strike, dumps };
  }
}

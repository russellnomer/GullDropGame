import * as THREE from "three";

type P = {
  alive: boolean;
  life: number;
  max: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  s: number;
};

const N = 220;
const dummy = new THREE.Object3D();
const _c = new THREE.Color();

export class ParticlePool {
  mesh: THREE.InstancedMesh;
  private items: P[];
  private colors: THREE.InstancedBufferAttribute;

  constructor() {
    const geo = new THREE.SphereGeometry(0.08, 6, 5);
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    this.mesh = new THREE.InstancedMesh(geo, mat, N);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.items = [];
    const arr = new Float32Array(N * 3);
    this.colors = new THREE.InstancedBufferAttribute(arr, 3);
    this.mesh.instanceColor = this.colors;
    for (let i = 0; i < N; i++) {
      this.items.push({ alive: false, life: 0, max: 1, x: 0, y: -40, z: 0, vx: 0, vy: 0, vz: 0, s: 1 });
      dummy.position.set(0, -40, 0);
      dummy.scale.setScalar(0.001);
      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  burst(x: number, y: number, z: number, n: number, color: number, speed: number, lift = 2) {
    _c.setHex(color);
    let spawned = 0;
    for (let i = 0; i < N && spawned < n; i++) {
      const p = this.items[i];
      if (p.alive) continue;
      p.alive = true;
      p.life = 0;
      p.max = 0.35 + Math.random() * 0.45;
      p.x = x;
      p.y = y;
      p.z = z;
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * speed;
      p.vx = Math.cos(a) * r;
      p.vz = Math.sin(a) * r;
      p.vy = lift + Math.random() * speed;
      p.s = 0.5 + Math.random() * 1.2;
      this.mesh.setColorAt(i, _c);
      spawned++;
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  update(dt: number) {
    let dirty = false;
    for (let i = 0; i < N; i++) {
      const p = this.items[i];
      if (!p.alive) continue;
      p.life += dt;
      if (p.life >= p.max) {
        p.alive = false;
        dummy.position.set(0, -40, 0);
        dummy.scale.setScalar(0.001);
        dummy.updateMatrix();
        this.mesh.setMatrixAt(i, dummy.matrix);
        dirty = true;
        continue;
      }
      p.vy -= 12 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      const k = 1 - p.life / p.max;
      dummy.position.set(p.x, p.y, p.z);
      dummy.scale.setScalar(p.s * k);
      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);
      dirty = true;
    }
    if (dirty) this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/**
 * ai-gulls.ts — Threat AI for Mafia Mode.
 *
 * Part of: Gull Drop
 * Created: 2026-09-08
 * Last modified: 2026-09-08 by Replit Agent
 *
 * HUMAN REVIEW NOTES:
 * Recycles existing gull geometry into lightweight autonomous threats that circle the player.
 */

import * as THREE from "three";
import { makeGullRig } from "./rigs";

export type AIGull = {
  respawnTime: number;
  id: number;
  alive: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  pitch: number;
  group: THREE.Group;
  rig: any; // Simplified rig
  wingL: THREE.Object3D | null;
  wingR: THREE.Object3D | null;
};

/** Controls enemy flock behavior and instances the gull rig for Mafia Mode */
export class AIGulls {
  group = new THREE.Group();
  list: AIGull[] = [];
  private rng: () => number;

  constructor(rng: () => number = Math.random) {
    this.rng = rng;

    const white = new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.45 });
    const grey = new THREE.MeshStandardMaterial({ color: 0xc8c2b8, roughness: 0.55 });
    const beak = new THREE.MeshStandardMaterial({ color: 0xe08932, roughness: 0.4 });

    for (let i = 0; i < 8; i++) {
      const g = makeGullRig("world", white, grey, beak);
      g.visible = false;
      this.group.add(g);
      this.list.push({
        id: i, alive: false,
        x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0,
        group: g,
        rig: g,
        wingL: g.getObjectByName("wingL") || null,
        wingR: g.getObjectByName("wingR") || null,
        respawnTime: 0,
      });
    }
  }

  dispose() {
    this.group.clear();
    // Assuming rig materials are handled centrally or we could clear them here.
  }

  reset() {
    for (const g of this.list) {
      g.alive = false;
      g.group.visible = false;
      g.respawnTime = 0;
    }
  }

  spawnAll() {
    this.spawn(-15, 12, -40);
    this.spawn(10, 15, 20);
    this.spawn(-5, 18, -120);
  }

  spawn(x: number, y: number, z: number) {
    const slot = this.list.find(g => !g.alive);
    if (!slot) return;

    slot.alive = true;
    slot.x = x; slot.y = y; slot.z = z;
    slot.vx = (this.rng() - 0.5) * 5;
    slot.vy = 0;
    slot.vz = (this.rng() - 0.5) * 5;
    slot.group.visible = true;
  }

  update(dt: number, px: number, py: number, pz: number, time: number) {
    for (const g of this.list) {
      if (!g.alive) {
        if (g.respawnTime > 0) {
          g.respawnTime -= dt;
          if (g.respawnTime <= 0) {
            g.respawnTime = 0;
            g.alive = true; g.group.visible = true; g.vx = (this.rng() - 0.5) * 5; g.vz = (this.rng() - 0.5) * 5; g.y = 15 + this.rng()*10;
          }
        }
        continue;
      }

      // Basic flocking / circling logic
      const dx = px - g.x;
      const dz = pz - g.z;
      const dist = Math.hypot(dx, dz);

      // Move towards player if far, circle if close
      if (dist > 20) {
        g.vx += (dx / dist) * dt * 2;
        g.vz += (dz / dist) * dt * 2;
      } else {
        const perpX = -dz / dist;
        const perpZ = dx / dist;
        g.vx += perpX * dt * 4;
        g.vz += perpZ * dt * 4;
      }

      // Dampen velocity
      g.vx *= 0.98;
      g.vz *= 0.98;

      // Limit speed
      const speed = Math.hypot(g.vx, g.vz);
      if (speed > 8) {
        g.vx = (g.vx / speed) * 8;
        g.vz = (g.vz / speed) * 8;
      }

      g.x += g.vx * dt;
      g.z += g.vz * dt;

      // Bob up and down
      g.y += Math.sin(time * 2 + g.id) * dt * 2;

      g.yaw = Math.atan2(-g.vx, -g.vz);

      g.group.position.set(g.x, g.y, g.z);
      g.group.rotation.y = g.yaw;

      // Flap
      if (g.wingL) g.wingL.rotation.z = Math.sin(time * 8 + g.id) * 0.4;
      if (g.wingR) g.wingR.rotation.z = -Math.sin(time * 8 + g.id) * 0.4;
    }
  }

  hitTest(x: number, y: number, z: number, r: number): AIGull | null {
    for (const g of this.list) {
      if (!g.alive) continue;
      const dx = g.x - x;
      const dy = g.y - y;
      const dz = g.z - z;
      if (dx*dx + dy*dy + dz*dz < r*r) return g;
    }
    return null;
  }

  kill(g: AIGull) {
    g.alive = false;
    g.group.visible = false;
    g.respawnTime = 5;
  }

  /** Grounds every active gull inside a fictional Fizz Bomb foam radius. */
  groundInRadius(x: number, y: number, z: number, radius: number): number {
    let grounded = 0;
    const radiusSq = radius * radius;
    for (const gull of this.list) {
      if (!gull.alive) continue;
      const dx = gull.x - x;
      const dy = gull.y - y;
      const dz = gull.z - z;
      if (dx * dx + dy * dy + dz * dz > radiusSq) continue;
      this.kill(gull);
      grounded++;
    }
    return grounded;
  }
}

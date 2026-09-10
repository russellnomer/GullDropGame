/**
 * stray-cats.ts — Lightweight deterministic procedural cat NPCs.
 *
 * Part of: Gull Drop
 * Created: 2026-09-08
 * Last modified: 2026-09-08 by Replit Agent
 *
 * HUMAN REVIEW NOTES:
 * Manages states (idle/groom/stalk/chase/flee) without relying on physics engines.
 * Integrates into Mafia and Gull modes for varied threat mechanics.
 */

import * as THREE from "three";
import { makeCatRig } from "./cat-rig";
import { BOARDWALK, onBoardwalk } from "./world";

export type CatState = "idle" | "groom" | "stalk" | "chase" | "pounce" | "flee" | "cooldown";

export type Cat = {
  id: number;
  alive: boolean;
  state: CatState;
  stateTimer: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  speed: number;
  group: THREE.Group;
  rig: any; // Add rig properties later
  home: THREE.Vector3;
};

/** Manages a fixed-size pool of deterministic stray cat NPCs */
export class StrayCats {
  group = new THREE.Group();
  list: Cat[] = [];
  private rng: () => number;

  constructor(rng: () => number = Math.random) {
    this.rng = rng;
  }

  /** Places initial cats across predefined world locations */
  dispose() {
    this.list.forEach(c => c.rig.dispose?.());
    this.group.clear();
    this.list = [];
  }

  reset() {
    for (const c of this.list) {
      c.alive = false;
      c.group.visible = false;
      c.state = "cooldown";
      c.stateTimer = 999;
    }
  }

  /** Places initial cats across predefined world locations */
  spawnAll() {
    if (this.list.length > 0) {
      // Just re-activate existing pool
      const locations = [[-6, -40], [24, -120], [-4, 60], [38, 40], [68, -80]];
      let i = 0;
      for (const c of this.list) {
        if (i < locations.length) {
          const loc = locations[i++];
          c.x = loc[0];
          c.z = loc[1];
          c.y = onBoardwalk(c.x, c.z) ? BOARDWALK.y : 0.4;
          c.alive = true;
          c.state = "idle";
          c.stateTimer = 2 + this.rng() * 4;
          c.speed = 0;
          c.yaw = this.rng() * Math.PI * 2;
          c.group.position.set(c.x, c.y, c.z);
          c.group.rotation.y = c.yaw;
          c.group.visible = true;
        }
      }
      return;
    }
    const locations = [
      [-6, -40], [24, -120], [-4, 60], [38, 40], [68, -80]
    ];
    let id = 0;
    for (const loc of locations) {
      this.spawn(id++, loc[0], loc[1]);
    }
  }

  spawn(id: number, x: number, z: number) {
    const y = onBoardwalk(x, z) ? BOARDWALK.y : 0.4;
    const { group, anim } = makeCatRig(this.rng());

    group.position.set(x, y, z);
    const yaw = this.rng() * Math.PI * 2;
    group.rotation.y = yaw;

    this.group.add(group);

    this.list.push({
      id,
      alive: true,
      state: "idle",
      stateTimer: 2 + this.rng() * 4,
      x, y, z, yaw, speed: 0,
      group,
      rig: anim,
      home: new THREE.Vector3(x, y, z)
    });
  }

  /** Advances cat state machines and handles player proximity tracking */
  update(dt: number, px: number, py: number, pz: number, mode: string) {
    for (const c of this.list) {
      if (!c.alive) continue;

      c.stateTimer -= dt;

      // Basic state machine
      if (c.stateTimer <= 0) {
        if (c.state === "idle") {
          c.state = this.rng() > 0.5 ? "groom" : "stalk";
          c.stateTimer = 2 + this.rng() * 3;
          c.speed = c.state === "stalk" ? 0.8 : 0;
          if (c.state === "stalk") c.yaw += (this.rng() - 0.5) * 2;
        } else if (c.state === "groom" || c.state === "stalk") {
          c.state = "idle";
          c.stateTimer = 1 + this.rng() * 2;
          c.speed = 0;
        } else if (c.state === "chase" || c.state === "pounce") {
          c.state = "cooldown";
          c.stateTimer = 3;
          c.speed = 0;
        } else if (c.state === "flee" || c.state === "cooldown") {
          c.state = "idle";
          c.stateTimer = 2;
          c.speed = 0;
        }
      }

      // Player interaction (Mafia mode or low Gull)
      const dx = px - c.x;
      const dy = py - c.y;
      const dz = pz - c.z;
      const dist = Math.hypot(dx, dz);

      if (mode === "mafia" && c.state !== "flee" && c.state !== "cooldown" && c.state !== "pounce" && dist < 12 && py < c.y + 2) {
        if (dist < 2.5) {
          c.state = "pounce";
          c.stateTimer = 0.6;
          c.speed = 9;
        } else {
          c.state = "chase";
          c.yaw = Math.atan2(-dx, -dz);
          c.speed = 4.5;
          c.stateTimer = 0.5; // Always chasing
        }
      } else if (mode === "gull" && c.state !== "flee" && c.state !== "cooldown" && c.state !== "pounce" && dist < 8 && py < c.y + 2.4) {
        if (dist < 2.5) {
          c.state = "pounce";
          c.stateTimer = 0.6;
          c.speed = 9;
        } else {
          c.state = "chase";
          c.yaw = Math.atan2(-dx, -dz);
          c.speed = 4.0;
          c.stateTimer = 0.5;
        }
      }

      // Movement
      if (c.state === "chase" || c.state === "flee" || c.state === "stalk" || c.state === "pounce") {
        c.x += -Math.sin(c.yaw) * c.speed * dt;
        c.z += -Math.cos(c.yaw) * c.speed * dt;

        // Boundaries roughly
        c.x = THREE.MathUtils.clamp(c.x, -10, 80);
        c.z = THREE.MathUtils.clamp(c.z, -240, 240);
        c.y = onBoardwalk(c.x, c.z) ? BOARDWALK.y : 0.4;

        c.group.position.set(c.x, c.y, c.z);
        c.group.rotation.y = c.yaw;
      }

      // Animation
      c.rig.update(dt, c.state, c.speed);
    }
  }

  hitTest(x: number, y: number, z: number, r: number): Cat | null {
    for (const c of this.list) {
      if (!c.alive || c.state !== "pounce") continue;
      const dx = c.x - x;
      const dy = c.y - y;
      const dz = c.z - z;
      if (dx*dx + dy*dy + dz*dz < r*r) {
        c.state = "cooldown";
        c.stateTimer = 3;
        c.speed = 0;
        return c;
      }
    }
    return null;
  }
  
  scare(x: number, z: number) {
    for (const c of this.list) {
      if (!c.alive) continue;
      const dx = c.x - x;
      const dz = c.z - z;
      if (dx*dx + dz*dz < 25) {
        c.state = "flee";
        c.stateTimer = 2;
        c.speed = 8;
        c.yaw = Math.atan2(-dx, -dz); // Run away
      }
    }
  }
}

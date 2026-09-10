/**
 * tribute.ts — Pooled tribute points for Mafia mode.
 *
 * Part of: Gull Drop
 * Created: 2026-09-08
 * Last modified: 2026-09-08 by Replit Agent
 *
 * HUMAN REVIEW NOTES:
 * Maintains a fixed array of interactable points to limit object allocation overhead.
 */


import * as THREE from "three";
import { BOARDWALK, onBoardwalk } from "./world";

export type TributeOp = {
  respawnTime: number;
  id: number;
  x: number;
  y: number;
  z: number;
  amount: number;
  active: boolean;
  mesh: THREE.Mesh;
};

/** Controls a pooled set of interaction nodes for extorting respect */
export class TributeManager {
  group = new THREE.Group();
  ops: TributeOp[] = [];

  constructor() {
    const geo = new THREE.BoxGeometry(0.6, 0.6, 0.6);
    const mat = new THREE.MeshBasicMaterial({ color: 0xc49a6a, wireframe: true, transparent: true, opacity: 0.5 });

    // Create fixed pool
    for (let i = 0; i < 15; i++) {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      this.group.add(mesh);
      this.ops.push({
        id: i, x: 0, y: 0, z: 0, amount: 0, active: false, mesh, respawnTime: 0
      });
    }
  }

  /** Allocates tribute targets around vendors and key stores */
  dispose() {
    for (const op of this.ops) {
      if (op.mesh.geometry) op.mesh.geometry.dispose();
      if (op.mesh.material && !Array.isArray(op.mesh.material)) op.mesh.material.dispose();
    }
    this.group.clear();
  }

  reset() {
    for (const op of this.ops) {
      op.active = false;
      op.mesh.visible = false;
      op.respawnTime = 0;
    }
  }

  /** Allocates tribute targets around vendors and key stores */
  spawnAll() {
    // Stores
    this.spawn(34, -132, 100);
    this.spawn(35, -74, 100);
    this.spawn(35, -18, 100);
    this.spawn(36, 42, 50);
    this.spawn(35, 98, 50);
    this.spawn(65, -98, 50);

    // Boardwalk locations
    this.spawn(8, -88, 200); // Taffy
    this.spawn(-6, -62, 75); // Photo
    this.spawn(6, -8, 75); // Kiosk

    // Street vendors
    this.spawn(-2, -40, 50);
    this.spawn(2, -2, 50);
  }

  spawn(x: number, z: number, amount: number) {
    const slot = this.ops.find(o => !o.active);
    if (!slot) return;

    slot.active = true;
    slot.x = x;
    slot.y = onBoardwalk(x, z) ? BOARDWALK.y + 0.5 : 0.9;
    slot.z = z;
    slot.amount = amount;
    slot.mesh.position.set(x, slot.y, z);
    slot.mesh.visible = true;
  }

  update(dt: number, time: number) {
    for (const op of this.ops) {
      if (op.active) {
        op.mesh.rotation.y += dt;
        op.mesh.scale.setScalar(1 + Math.sin(time * 5) * 0.1);
      } else if (op.respawnTime > 0) {
        op.respawnTime -= dt;
        if (op.respawnTime <= 0) {
          op.respawnTime = 0;
          op.active = true; op.mesh.visible = true;
        }
      }
    }
  }

  hitTest(x: number, y: number, z: number, r: number): TributeOp | null {
    for (const op of this.ops) {
      if (!op.active) continue;
      const dx = op.x - x;
      const dy = op.y - y;
      const dz = op.z - z;
      if (dx*dx + dy*dy + dz*dz < r*r) return op;
    }
    return null;
  }

  collect(op: TributeOp) {
    op.active = false;
    op.mesh.visible = false;
    op.respawnTime = 15;
  }
}

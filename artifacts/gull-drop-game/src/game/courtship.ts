/**
 * courtship.ts — Deterministic background vignettes for animal courtship.
 *
 * Part of: Gull Drop
 * Created: 2026-09-08
 *
 * HUMAN REVIEW NOTES:
 * Implements Task 29: non-explicit, slapstick comedy courtship.
 * Uses dedicated rig instances to avoid hijacking score-bearing NPCs.
 * Enforces strict safety invariants (no explicit geometry/motion).
 */

import * as THREE from "three";
import { makeGullRig, makeSquirrelRig } from "./rigs";
import { playHit, playPlop, playSquawk, playThump } from "./audio";

type CourtshipState = "idle" | "approach" | "gift" | "approval" | "censored" | "aftermath";

export class CourtshipVignette {
  kind: "gull" | "squirrel";
  state: CourtshipState = "idle";
  timer: number = 0;
  
  actorA: THREE.Group;
  actorB: THREE.Group;
  prop: THREE.Group;
  gift: THREE.Mesh;
  
  cx: number = 0;
  cy: number = 0;
  cz: number = 0;
  
  private rng: () => number;

  constructor(kind: "gull" | "squirrel", rng: () => number) {
    this.kind = kind;
    this.rng = rng;

    if (kind === "gull") {
      const white = new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.45 });
      const grey = new THREE.MeshStandardMaterial({ color: 0xc8c2b8, roughness: 0.55 });
      const beak = new THREE.MeshStandardMaterial({ color: 0xe08932, roughness: 0.4 });
      this.actorA = makeGullRig("world", white, grey, beak);
      this.actorB = makeGullRig("world", white, grey, beak);
      
      const fryGeo = new THREE.BoxGeometry(0.05, 0.3, 0.05);
      const fryMat = new THREE.MeshStandardMaterial({ color: 0xddaa44 });
      this.gift = new THREE.Mesh(fryGeo, fryMat);
    } else {
      this.actorA = makeSquirrelRig(false);
      this.actorB = makeSquirrelRig(false);
      
      const acornGeo = new THREE.SphereGeometry(0.12, 8, 8);
      const acornMat = new THREE.MeshStandardMaterial({ color: 0x6a3a18 });
      this.gift = new THREE.Mesh(acornGeo, acornMat);
    }

    this.actorA.visible = false;
    this.actorB.visible = false;
    
    // Fully opaque privacy prop (a comic oversized crate)
    this.prop = new THREE.Group();
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(2.5, 2.5, 2.5),
      new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.9 })
    );
    box.position.y = 1.25; // Sit on ground
    
    // Add "FRAGILE" or similar marking using a simple darker plane
    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 0.5),
      new THREE.MeshBasicMaterial({ color: 0x4a2a10 })
    );
    label.position.set(0, 1.25, 1.26);
    this.prop.add(box, label);
    
    this.prop.visible = false;
    this.gift.visible = false;
    this.actorA.add(this.gift);
  }

  // Deterministic state transitions and behavior
  update(dt: number, time: number) {
    if (this.state === "idle") {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.start();
      }
      return;
    }

    this.timer += dt;

    if (this.state === "approach") {
      // Walk towards each other over 3 seconds
      const duration = 3.0;
      const progress = Math.min(this.timer / duration, 1.0);
      
      const dist = 3 - (progress * 2); // Start 3 units apart, end 1 unit apart
      
      this.actorA.position.set(this.cx - dist, this.cy, this.cz);
      this.actorB.position.set(this.cx + dist, this.cy, this.cz);
      
      this.actorA.lookAt(this.cx, this.cy, this.cz);
      this.actorB.lookAt(this.cx, this.cy, this.cz);
      
      // Bobbing walk animation
      const reduceMotion = typeof window !== 'undefined' ? window.matchMedia("(prefers-reduced-motion: reduce)").matches : false;
      const bob = reduceMotion ? 0 : Math.abs(Math.sin(this.timer * 10)) * 0.1;
      this.actorA.position.y = this.cy + bob;
      this.actorB.position.y = this.cy + bob;

      if (progress >= 1.0) {
        this.state = "gift";
        this.timer = 0;
      }
    } else if (this.state === "gift") {
      const duration = 2.0;
      this.actorA.position.y = this.cy;
      this.actorB.position.y = this.cy;
      
      this.gift.visible = true;
      this.gift.position.set(0, 0.5, 0.5); // Hold it out in front
      
      if (this.timer >= duration) {
        this.state = "approval";
        this.timer = 0;
      }
    } else if (this.state === "approval") {
      const duration = 2.0;
      
      // Actor B jumps excitedly
      const reduceMotion = typeof window !== 'undefined' ? window.matchMedia("(prefers-reduced-motion: reduce)").matches : false;
      const jump = reduceMotion ? 0 : Math.abs(Math.sin(this.timer * 15)) * 0.4;
      this.actorB.position.y = this.cy + jump;
      
      if (this.timer >= duration) {
        this.state = "censored";
        this.timer = 0;
        this.prop.visible = true;
        this.prop.position.set(this.cx, this.cy + 10, this.cz); // Drop from sky
      }
    } else if (this.state === "censored") {
      const duration = 4.0;
      
      // Box drops instantly with a slapstick effect
      if (this.timer < 0.2) {
        this.prop.position.y = this.cy + 10 * (1 - (this.timer / 0.2));
      } else {
        if (this.timer >= 0.2 && this.timer - dt < 0.2) {
          playThump(); // Initial thud
        }
        
        this.prop.position.y = this.cy;
        
        // Completely hide actors to maintain invariant (no explicit geometry/motion)
        this.actorA.visible = false;
        this.actorB.visible = false;
        
        const reduceMotion = typeof window !== 'undefined' ? window.matchMedia("(prefers-reduced-motion: reduce)").matches : false;
        if (!reduceMotion) {
          // Jitter box
          this.prop.position.x = this.cx + (this.rng() - 0.5) * 0.3;
          this.prop.position.z = this.cz + (this.rng() - 0.5) * 0.3;
          this.prop.rotation.z = (this.rng() - 0.5) * 0.25;
          this.prop.rotation.x = (this.rng() - 0.5) * 0.25;
        }
        
        // Random off-screen slapstick audio
        if (this.rng() < dt * 4) {
          if (this.kind === "gull") playSquawk();
          else playHit();
        }
        if (this.rng() < dt * 1.5) {
          playThump();
        }
      }
      
      if (this.timer >= duration) {
        this.state = "aftermath";
        this.timer = 0;
        this.prop.visible = false;
        this.actorA.visible = true;
        this.actorB.visible = true;
        this.gift.visible = false;
        
        // Both face completely away in embarrassment/exhaustion
        this.actorA.rotation.y += Math.PI;
        this.actorB.rotation.y += Math.PI;
        
        // Reset base height
        this.actorA.position.y = this.cy;
        this.actorB.position.y = this.cy;
        
        playPlop(); // Comical pop sound as box disappears
      }
    } else if (this.state === "aftermath") {
      const duration = 3.0;
      const progress = Math.min(this.timer / duration, 1.0);
      
      // Run/fly away in opposite directions rapidly
      const dist = 1 + progress * 6;
      this.actorA.position.set(this.cx - dist, this.cy, this.cz);
      this.actorB.position.set(this.cx + dist, this.cy, this.cz);
      
      // Frantic escape animation
      const reduceMotion = typeof window !== 'undefined' ? window.matchMedia("(prefers-reduced-motion: reduce)").matches : false;
      const bob = reduceMotion ? 0 : Math.abs(Math.sin(this.timer * 25)) * 0.3;
      this.actorA.position.y = this.cy + bob;
      this.actorB.position.y = this.cy + bob;
      
      if (progress >= 1.0) {
        this.reset();
      }
    }
  }

  start() {
    this.state = "approach";
    this.timer = 0;
    
    // Deterministic safe locations for background visibility without gameplay disruption
    const squirrelSpots = [
      { x: -5, y: 2.2, z: 20 },
      { x: -10, y: 2.2, z: -30 },
      { x: -2, y: 2.2, z: 120 },
      { x: -5, y: 2.2, z: -100 },
    ];
    
    const gullSpots = [
      { x: 5, y: 0.2, z: 50 }, 
      { x: 12, y: 0.2, z: -40 }, 
      { x: 18, y: 0.2, z: 80 }, 
      { x: -12, y: 0.2, z: -80 },
    ];
    
    const spots = this.kind === "gull" ? gullSpots : squirrelSpots;
    const spot = spots[Math.floor(this.rng() * spots.length)];
    this.cx = spot.x;
    this.cy = spot.y;
    this.cz = spot.z;
    
    this.actorA.visible = true;
    this.actorB.visible = true;
    this.prop.visible = false;
    this.gift.visible = false;
  }

  reset() {
    this.state = "idle";
    this.timer = 10 + this.rng() * 20; // Re-trigger randomly between 10s and 30s
    this.actorA.visible = false;
    this.actorB.visible = false;
    this.prop.visible = false;
  }
}

export class CourtshipManager {
  group = new THREE.Group();
  vignettes: CourtshipVignette[] = [];

  constructor(rng: () => number) {
    const gullVignette = new CourtshipVignette("gull", rng);
    const squirrelVignette = new CourtshipVignette("squirrel", rng);
    
    this.group.add(gullVignette.actorA, gullVignette.actorB, gullVignette.prop);
    this.group.add(squirrelVignette.actorA, squirrelVignette.actorB, squirrelVignette.prop);
    
    this.vignettes.push(gullVignette, squirrelVignette);
    this.reset();
  }

  update(dt: number, time: number) {
    for (const v of this.vignettes) {
      v.update(dt, time);
    }
  }

  reset() {
    for (const v of this.vignettes) {
      v.reset();
    }
    // Stagger initial start times to avoid synchronized routines
    if (this.vignettes[0]) this.vignettes[0].timer = 3.0;
    if (this.vignettes[1]) this.vignettes[1].timer = 12.0;
  }
}

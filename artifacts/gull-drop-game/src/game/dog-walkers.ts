import * as THREE from "three";
import { makeHuman } from "./rigs";
import { BOARDWALK, SAND_Y, onBeach } from "./world";
import { bystanderQuote, killBubble, makeBubble, makeSplat } from "./reactions";

const DOG = {
  torso: new THREE.CapsuleGeometry(0.1, 0.28, 4, 12),
  head: new THREE.SphereGeometry(0.09, 12, 10),
  snout: new THREE.CapsuleGeometry(0.05, 0.08, 4, 10),
  ear: new THREE.BoxGeometry(0.03, 0.1, 0.06),
  leg: new THREE.CapsuleGeometry(0.03, 0.18, 4, 8),
  tail: new THREE.CapsuleGeometry(0.025, 0.2, 4, 8)
};

function makeDogRig(seed: number): THREE.Group {
  const g = new THREE.Group();
  const furHex = [0xd2a05a, 0x1a1a1c, 0xf0ece4, 0x6a3a18][seed % 4];
  const fur = new THREE.MeshStandardMaterial({ color: furHex, roughness: 0.8 });

  const torso = new THREE.Mesh(DOG.torso, fur);
  torso.rotation.x = Math.PI / 2;
  torso.position.y = 0.22;
  
  const head = new THREE.Mesh(DOG.head, fur);
  head.position.set(0, 0.35, 0.2);
  head.name = "head";
  
  const snout = new THREE.Mesh(DOG.snout, fur);
  snout.rotation.x = Math.PI / 2;
  snout.position.set(0, 0.32, 0.28);
  
  const earL = new THREE.Mesh(DOG.ear, fur);
  earL.position.set(-0.06, 0.38, 0.15);
  earL.rotation.z = 0.2;
  const earR = earL.clone();
  earR.position.x = 0.06;
  earR.rotation.z = -0.2;
  
  const legFL = new THREE.Mesh(DOG.leg, fur);
  legFL.position.set(-0.05, 0.1, 0.12);
  legFL.name = "legFL";
  const legFR = legFL.clone();
  legFR.position.x = 0.05;
  legFR.name = "legFR";
  
  const legBL = new THREE.Mesh(DOG.leg, fur);
  legBL.position.set(-0.05, 0.1, -0.12);
  legBL.name = "legBL";
  const legBR = legBL.clone();
  legBR.position.x = 0.05;
  legBR.name = "legBR";
  
  const tail = new THREE.Mesh(DOG.tail, fur);
  tail.position.set(0, 0.26, -0.22);
  tail.rotation.x = -0.4;
  tail.name = "tail";
  
  g.add(torso, head, snout, earL, earR, legFL, legFR, legBL, legBR, tail);
  
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
  
  g.scale.setScalar(1.2);
  return g;
}

export type DogWalkerPair = {
  active: boolean;
  beach: boolean;
  hitPerson: boolean;
  hitDog: boolean;
  x: number;
  y: number;
  z: number;
  yaw: number;
  speed: number;
  walk: number;
  panic: number;
  personGroup: THREE.Group;
  dogGroup: THREE.Group;
  leash: THREE.Line;
  splat: THREE.Object3D | null;
  bubble: THREE.Sprite | null;
  react: number;
};

export class DogWalkers {
  group = new THREE.Group();
  pairs: DogWalkerPair[] = [];
  private leashMat = new THREE.LineBasicMaterial({ color: 0x1a1a1c, linewidth: 2 });
  private _world = new THREE.Vector3();
  
  constructor(private readonly random: () => number) {}

  spawnAll() {
    for (let i = 0; i < 4; i++) this.spawn(false);
    for (let i = 0; i < 2; i++) this.spawn(true);
  }

  private resetPair(p: DogWalkerPair) {
    p.active = true;
    p.hitPerson = false;
    p.hitDog = false;
    p.panic = 0;
    p.walk = this.random() * 10;
    p.speed = 1.0 + this.random() * 0.4;
    p.x = p.beach ? -20 - this.random() * 20 : -6 + this.random() * 12;
    p.y = p.beach ? SAND_Y : BOARDWALK.y;
    p.z = -200 + this.random() * 400;
    p.yaw = this.random() * Math.PI * 2;
    
    p.personGroup.visible = true;
    p.dogGroup.visible = true;
    p.leash.visible = true;

    p.personGroup.position.set(p.x, p.y, p.z);
    p.personGroup.rotation.set(0, p.yaw, 0);

    const dX = p.x - Math.cos(p.yaw) * 1.2 - Math.sin(p.yaw) * 0.5;
    const dZ = p.z + Math.sin(p.yaw) * 1.2 - Math.cos(p.yaw) * 0.5;
    p.dogGroup.position.set(dX, p.y, dZ);
    p.dogGroup.rotation.set(0, p.yaw, 0);
    
    // Reset person limbs
    const headP = p.personGroup.getObjectByName("head");
    if (headP) headP.rotation.set(0, 0, 0);
    const armL = p.personGroup.getObjectByName("armL");
    if (armL) armL.rotation.set(0, 0, 0);
    const armR = p.personGroup.getObjectByName("armR");
    if (armR) armR.rotation.set(0, 0, 0);
    
    // Reset dog limbs
    const headD = p.dogGroup.getObjectByName("head");
    if (headD) headD.rotation.set(0, 0, 0);
    const tail = p.dogGroup.getObjectByName("tail");
    if (tail) tail.rotation.set(-0.4, 0, 0);
    const legFL = p.dogGroup.getObjectByName("legFL");
    if (legFL) legFL.rotation.set(0, 0, 0);
    const legFR = p.dogGroup.getObjectByName("legFR");
    if (legFR) legFR.rotation.set(0, 0, 0);
    const legBL = p.dogGroup.getObjectByName("legBL");
    if (legBL) legBL.rotation.set(0, 0, 0);
    const legBR = p.dogGroup.getObjectByName("legBR");
    if (legBR) legBR.rotation.set(0, 0, 0);

    this.clearFx(p);
  }

  private spawn(beach: boolean) {
    const pGroup = makeHuman(0x5eb7ae, null, "tourist", this.pairs.length);
    const dGroup = makeDogRig(this.pairs.length);
    
    // Create leash line
    const lGeo = new THREE.BufferGeometry();
    const lPos = new Float32Array(6);
    lGeo.setAttribute("position", new THREE.BufferAttribute(lPos, 3));
    const leash = new THREE.Line(lGeo, this.leashMat);
    leash.frustumCulled = false;

    this.group.add(pGroup, dGroup, leash);

    const pair: DogWalkerPair = {
      active: true,
      beach,
      hitPerson: false,
      hitDog: false,
      x: 0,
      y: 0,
      z: 0,
      yaw: 0,
      speed: 0,
      walk: 0,
      panic: 0,
      personGroup: pGroup,
      dogGroup: dGroup,
      leash,
      splat: null,
      bubble: null,
      react: 0,
    };
    this.pairs.push(pair);
    this.resetPair(pair);
  }

  reset() {
    for (const p of this.pairs) {
      this.resetPair(p);
    }
  }

  update(dt: number) {
    for (const p of this.pairs) {
      if (!p.active) continue;

      if (p.hitPerson || p.hitDog) {
        p.panic += dt;
        const pt = p.panic;
        
        // both flee
        p.yaw += dt * 2.5;
        p.x += -Math.sin(p.yaw) * 4.5 * dt;
        p.z += -Math.cos(p.yaw) * 4.5 * dt;
        
        p.personGroup.position.set(p.x, p.y + Math.abs(Math.sin(pt * 20)) * 0.25, p.z);
        p.personGroup.rotation.set(0, p.yaw, Math.sin(pt * 16) * 0.12);
        
        const dX = p.x + Math.sin(p.yaw - 0.5) * 1.5;
        const dZ = p.z + Math.cos(p.yaw - 0.5) * 1.5;
        p.dogGroup.position.set(dX, p.y + Math.abs(Math.sin(pt * 24)) * 0.2, dZ);
        p.dogGroup.rotation.set(0, p.yaw, 0);

        if (p.bubble) p.bubble.position.y = p.y + 2.35 + Math.sin(pt * 8) * 0.05;

        // Dog shakes it off if it was hit
        if (p.hitDog) {
          const head = p.dogGroup.getObjectByName("head");
          if (head) head.rotation.z = Math.sin(pt * 30) * 0.4;
          const tail = p.dogGroup.getObjectByName("tail");
          if (tail) tail.rotation.y = Math.sin(pt * 40) * 0.6;
        }

        if (pt > 2.2) {
          this.resetPair(p);
        }
      } else {
        p.walk += dt * p.speed * 4;
        p.x += -Math.sin(p.yaw) * p.speed * dt;
        p.z += -Math.cos(p.yaw) * p.speed * dt;
        
        if (p.beach) {
          if (p.x < -40 || p.x > -12) p.yaw += Math.PI;
        } else {
          if (p.x < -6.5 || p.x > 6.5) p.yaw += Math.PI;
        }
        if (p.z < -210 || p.z > 210) p.yaw += Math.PI;
        
        p.personGroup.position.set(p.x, p.y, p.z);
        p.personGroup.rotation.y = p.yaw;
        
        const armL = p.personGroup.getObjectByName("armL");
        const armR = p.personGroup.getObjectByName("armR");
        if (armL) armL.rotation.x = Math.sin(p.walk) * 0.55;
        if (armR) {
          armR.rotation.x = -0.4; // hold leash
        }

        const dX = p.x - Math.cos(p.yaw) * 1.2 - Math.sin(p.yaw) * 0.5;
        const dZ = p.z + Math.sin(p.yaw) * 1.2 - Math.cos(p.yaw) * 0.5;
        p.dogGroup.position.set(dX, p.y + Math.abs(Math.sin(p.walk * 1.5)) * 0.05, dZ);
        p.dogGroup.rotation.y = p.yaw + Math.sin(p.walk * 0.5) * 0.1;
        
        const legFL = p.dogGroup.getObjectByName("legFL");
        const legFR = p.dogGroup.getObjectByName("legFR");
        const legBL = p.dogGroup.getObjectByName("legBL");
        const legBR = p.dogGroup.getObjectByName("legBR");
        const tail = p.dogGroup.getObjectByName("tail");
        if (legFL) legFL.rotation.x = Math.sin(p.walk * 1.5) * 0.4;
        if (legFR) legFR.rotation.x = Math.sin(p.walk * 1.5 + Math.PI) * 0.4;
        if (legBL) legBL.rotation.x = Math.sin(p.walk * 1.5 + Math.PI) * 0.4;
        if (legBR) legBR.rotation.x = Math.sin(p.walk * 1.5) * 0.4;
        if (tail) tail.rotation.y = Math.sin(p.walk * 2) * 0.2;
      }
      
      // Update Leash
      if (p.leash.visible) {
        const armR = p.personGroup.getObjectByName("armR");
        let hx = p.x, hy = p.y + 1.2, hz = p.z;
        if (armR) {
          armR.children[armR.children.length - 1].getWorldPosition(this._world);
          hx = this._world.x; hy = this._world.y; hz = this._world.z;
        }
        
        const neck = p.dogGroup.getObjectByName("head");
        let nx = p.dogGroup.position.x, ny = p.dogGroup.position.y + 0.4, nz = p.dogGroup.position.z;
        if (neck) {
          neck.getWorldPosition(this._world);
          nx = this._world.x; ny = this._world.y - 0.1; nz = this._world.z;
        }
        
        const pos = p.leash.geometry.attributes.position as THREE.BufferAttribute;
        pos.setXYZ(0, hx, hy, hz);
        pos.setXYZ(1, nx, ny, nz);
        pos.needsUpdate = true;
      }
    }
  }

  hitTest(x: number, y: number, z: number, r: number): { pair: DogWalkerPair; target: "person" | "dog" } | null {
    let closestPair: DogWalkerPair | null = null;
    let closestTarget: "person" | "dog" | null = null;
    let bestScore = Infinity;

    for (const p of this.pairs) {
      if (!p.active || p.hitPerson || p.hitDog) continue;
      
      // Person
      const dx1 = x - p.x;
      const dy1 = y - (p.y + 2.1);
      const dz1 = z - p.z;
      const r1 = 1.05;
      const hitPerson = dx1 * dx1 + dz1 * dz1 <= (r1 + r) * (r1 + r) && Math.abs(dy1) <= 2.4;
      
      // Dog
      const dPos = p.dogGroup.position;
      const dx2 = x - dPos.x;
      const dy2 = y - (dPos.y + 0.5);
      const dz2 = z - dPos.z;
      const r2 = 0.8;
      const hitDog = dx2 * dx2 + dz2 * dz2 <= (r2 + r) * (r2 + r) && Math.abs(dy2) <= 1.0;

      if (hitPerson) {
        const score1 = Math.sqrt(dx1 * dx1 + dy1 * dy1 + dz1 * dz1) / r1;
        if (score1 < bestScore) {
          bestScore = score1;
          closestPair = p;
          closestTarget = "person";
        }
      }
      
      if (hitDog) {
        const score2 = Math.sqrt(dx2 * dx2 + dy2 * dy2 + dz2 * dz2) / r2;
        if (score2 < bestScore) {
          bestScore = score2;
          closestPair = p;
          closestTarget = "dog";
        }
      }
    }
    return closestPair && closestTarget ? { pair: closestPair, target: closestTarget } : null;
  }

  reactHit(p: DogWalkerPair, target: "person" | "dog") {
    this.clearFx(p);
    p.panic = 0.01;
    p.react = (this.random() * 3) | 0;
    
    if (target === "person") {
      p.hitPerson = true;
      const splat = makeSplat();
      const head = p.personGroup.getObjectByName("head");
      if (head) {
        splat.position.set(0, 0.12, 0.16);
        head.add(splat);
      } else {
        splat.position.set(0, 3.5, 0.2);
        p.personGroup.add(splat);
      }
      p.splat = splat;
      
      const lines = ["NOT THE DOG", "WE'RE WALKING HERE", "HE JUST GOT GROOMED"];
      const text = lines[(this.random() * lines.length) | 0];
      const bubble = makeBubble(text);
      bubble.scale.set(1.7, 0.42, 1);
      bubble.position.set(0, p.y + 2.35, 0);
      this.group.add(bubble);
      p.bubble = bubble;
      
      this.flash(p.personGroup);
    } else {
      p.hitDog = true;
      const splat = makeSplat();
      const head = p.dogGroup.getObjectByName("head");
      if (head) {
        splat.position.set(0, 0.12, 0.12);
        head.add(splat);
      }
      p.splat = splat;
      
      const lines = ["BAD BIRD", "HE DIDN'T DO ANYTHING", "LEAVE HIM ALONE"];
      const text = lines[(this.random() * lines.length) | 0];
      const bubble = makeBubble(text);
      bubble.scale.set(1.7, 0.42, 1);
      bubble.position.set(0, p.y + 2.35, 0);
      this.group.add(bubble);
      p.bubble = bubble;
      
      this.flash(p.dogGroup);
    }
  }

  clearFx(p: DogWalkerPair) {
    if (p.splat) {
      p.splat.parent?.remove(p.splat);
      p.splat.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          if (Array.isArray(m.material)) m.material.forEach((mat) => mat.dispose());
          else m.material.dispose();
        }
      });
      p.splat = null;
    }
    killBubble(p.bubble);
    p.bubble = null;
    
    const unflash = (g: THREE.Group) => {
      g.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && m.material && "emissiveIntensity" in (m.material as THREE.MeshStandardMaterial)) {
          const mat = m.material as THREE.MeshStandardMaterial;
          if (mat.emissiveIntensity > 0.2 && mat.emissive.getHex() === 0xf4f1ea) {
            mat.emissiveIntensity = 0;
          }
        }
      });
    };
    unflash(p.personGroup);
    unflash(p.dogGroup);
  }

  flash(g: THREE.Group) {
    g.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.material && "emissive" in (m.material as THREE.MeshStandardMaterial)) {
        const mat = m.material as THREE.MeshStandardMaterial;
        mat.emissive = new THREE.Color(0xf4f1ea);
        mat.emissiveIntensity = 0.55;
      }
    });
  }

  dispose() {
    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();

    for (const p of this.pairs) {
      this.clearFx(p);
      const walk = (g: THREE.Group) => {
        g.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.isMesh) {
            // Note: Geometries for humans/dogs are shared module-level constants.
            // Only dispose materials that were created uniquely per rig.
            if (Array.isArray(m.material)) {
              m.material.forEach((mat) => {
                materials.add(mat);
                if ((mat as any).map) textures.add((mat as any).map);
              });
            } else if (m.material) {
              materials.add(m.material);
              if ((m.material as any).map) textures.add((m.material as any).map);
            }
          }
        });
        this.group.remove(g);
      };
      walk(p.personGroup);
      walk(p.dogGroup);
      p.leash.geometry.dispose();
      this.group.remove(p.leash);
    }
    
    textures.forEach((tex) => tex.dispose());
    materials.forEach((mat) => mat.dispose());
    this.leashMat.dispose();
    this.pairs = [];
  }
}

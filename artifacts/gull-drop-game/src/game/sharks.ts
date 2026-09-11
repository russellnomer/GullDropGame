import * as THREE from "three";
import { makeSplat } from "./reactions";
import { track } from "./analytics";
import { OCEAN_PLAYFIELD } from "./ocean-playfield";

export type Shark = {
  greatWhite: boolean;
  active: boolean;
  x: number;
  y: number;
  z: number;
  yaw: number;
  vx: number;
  vz: number;
  state: "patrol" | "telegraph" | "breach" | "cooldown";
  stateTime: number;
  checkT: number;
  mesh: THREE.Group;
  fin: THREE.Mesh;
  visualWaterRadius: number;
};

export const SHARK_PATROL_LANES = OCEAN_PLAYFIELD.sharkPatrolLanes;

export const SHARK_ATTACK_BOUNDS = Object.freeze({
  minX: Math.max(OCEAN_PLAYFIELD.renderedWater.minX, OCEAN_PLAYFIELD.flight.minX),
  maxX: Math.min(OCEAN_PLAYFIELD.renderedWater.maxX, OCEAN_PLAYFIELD.flight.maxX),
  minZ: Math.max(OCEAN_PLAYFIELD.renderedWater.minZ, OCEAN_PLAYFIELD.flight.minZ),
  maxZ: Math.min(OCEAN_PLAYFIELD.renderedWater.maxZ, OCEAN_PLAYFIELD.flight.maxZ),
});

export const REQUIRED_SHARK_COUNT = 6;

const SHARK = {
  body: new THREE.CapsuleGeometry(0.35, 1.4, 8, 12),
  snout: new THREE.ConeGeometry(0.35, 0.8, 12),
  dorsal: new THREE.ConeGeometry(0.18, 0.45, 4),
  pectoral: new THREE.ConeGeometry(0.15, 0.6, 4),
  tailBase: new THREE.ConeGeometry(0.12, 0.5, 8),
  tailFin: new THREE.ConeGeometry(0.25, 0.7, 4),
};

function makeSharkRig(greatWhite: boolean): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: greatWhite ? 0x59646a : 0x4a5a6a, roughness: 0.66, metalness: 0.04 });
  const finMat = new THREE.MeshStandardMaterial({ color: 0xa9c2c8, roughness: 0.52, metalness: 0.08 });
  const bellyMat = new THREE.MeshStandardMaterial({ color: 0xe0ded8, roughness: 0.78 });

  const body = new THREE.Mesh(SHARK.body, mat);
  body.rotation.x = Math.PI / 2;
  body.position.set(0, 0, 0);
  if (greatWhite) body.scale.set(1.18, 1.22, 1.08);

  if (greatWhite) {
    const belly = new THREE.Mesh(SHARK.body, bellyMat);
    belly.rotation.x = Math.PI / 2;
    belly.scale.set(1.05, 1.12, 0.58);
    belly.position.y = -0.29;

    // The reference is dominated by a blunt head and a broad, forward-facing
    // open mouth, so the Great White receives a dedicated head instead of the
    // generic pointed cone used by the smaller sharks.
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.52, 18, 12), mat);
    head.scale.set(1.02, 0.88, 1.28);
    head.position.set(0, 0.02, 0.98);
    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 10), bellyMat);
    muzzle.scale.set(1.04, 0.72, 0.76);
    muzzle.position.set(0, -0.15, 1.35);

    const jaw = new THREE.Group();
    jaw.name = "greatWhiteJaw";
    jaw.position.set(0, -0.13, 1.58);
    const mouthDark = new THREE.Mesh(
      new THREE.CircleGeometry(0.34, 20),
      new THREE.MeshStandardMaterial({ color: 0x2a1112, roughness: 0.82, side: THREE.DoubleSide }),
    );
    mouthDark.scale.set(1, 0.78, 1);
    const gum = new THREE.Mesh(
      new THREE.TorusGeometry(0.34, 0.055, 8, 24),
      new THREE.MeshStandardMaterial({ color: 0xa84d58, roughness: 0.72 }),
    );
    gum.scale.set(1, 0.78, 1);
    gum.position.z = 0.012;
    jaw.add(mouthDark, gum);

    const toothMaterial = new THREE.MeshStandardMaterial({ color: 0xfff4d6, roughness: 0.58 });
    for (let index = 0; index < 14; index += 1) {
      const angle = (index / 14) * Math.PI * 2;
      const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.034, 0.16, 5), toothMaterial);
      tooth.position.set(Math.cos(angle) * 0.29, Math.sin(angle) * 0.225, 0.07);
      tooth.rotation.z = -angle + Math.PI / 2;
      tooth.scale.y = index % 2 === 0 ? 1 : 0.82;
      jaw.add(tooth);
    }

    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x050607, roughness: 0.4 });
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), eyeMat);
    eyeL.position.set(-0.38, 0.19, 1.18);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.31;
    eyeR.position.x = 0.38;

    const gillMaterial = new THREE.MeshStandardMaterial({ color: 0x512b2d, roughness: 0.82 });
    for (const side of [-1, 1]) {
      for (let slit = 0; slit < 3; slit += 1) {
        const gill = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.2, 0.035), gillMaterial);
        gill.position.set(side * 0.39, 0.02, 0.68 - slit * 0.11);
        gill.rotation.z = side * 0.16;
        g.add(gill);
      }
    }
    g.add(belly, head, muzzle, jaw, eyeL, eyeR);
  }

  const snout = new THREE.Mesh(SHARK.snout, mat);
  snout.rotation.x = Math.PI / 2;
  snout.position.set(0, 0, 0.7 + 0.4);
  snout.visible = !greatWhite;

  const dorsal = new THREE.Mesh(SHARK.dorsal, finMat);
  dorsal.position.set(0, 0.45, 0.2);
  dorsal.rotation.x = -0.2;
  dorsal.name = "dorsal";

  const pecL = new THREE.Mesh(SHARK.pectoral, mat);
  pecL.position.set(-0.4, -0.1, 0.4);
  pecL.rotation.z = -1.2;
  pecL.rotation.y = -0.3;
  const pecR = pecL.clone();
  pecR.position.x = 0.4;
  pecR.rotation.z = 1.2;
  pecR.rotation.y = 0.3;

  const tail = new THREE.Group();
  tail.position.set(0, 0, -0.7);
  const tBase = new THREE.Mesh(SHARK.tailBase, mat);
  tBase.rotation.x = -Math.PI / 2;
  tBase.position.z = -0.25;
  const tFin = new THREE.Mesh(SHARK.tailFin, mat);
  tFin.position.z = -0.6;
  tFin.rotation.x = Math.PI / 2;
  tail.add(tBase, tFin);
  tail.name = "tail";

  g.add(body, snout, dorsal, pecL, pecR, tail);
  g.scale.setScalar(greatWhite ? 3.75 : 2.15);
  
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });

  return g;
}

function measureAnchorRadius(object: THREE.Object3D): number {
  object.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(object);
  let radius = 0;

  for (const x of [bounds.min.x, bounds.max.x]) {
    for (const y of [bounds.min.y, bounds.max.y]) {
      for (const z of [bounds.min.z, bounds.max.z]) {
        radius = Math.max(radius, Math.hypot(x, y, z));
      }
    }
  }

  return radius;
}

export function getSharkAttackBounds(shark: Shark): typeof SHARK_ATTACK_BOUNDS {
  if (!shark.greatWhite) return SHARK_ATTACK_BOUNDS;

  const margin = shark.visualWaterRadius;
  return {
    minX: Math.max(SHARK_ATTACK_BOUNDS.minX, OCEAN_PLAYFIELD.renderedWater.minX + margin),
    maxX: Math.min(SHARK_ATTACK_BOUNDS.maxX, OCEAN_PLAYFIELD.renderedWater.maxX - margin),
    minZ: Math.max(SHARK_ATTACK_BOUNDS.minZ, OCEAN_PLAYFIELD.renderedWater.minZ + margin),
    maxZ: Math.min(SHARK_ATTACK_BOUNDS.maxZ, OCEAN_PLAYFIELD.renderedWater.maxZ - margin),
  };
}

function clampAttackPosition(shark: Shark): void {
  const bounds = getSharkAttackBounds(shark);
  shark.x = Math.max(bounds.minX, Math.min(bounds.maxX, shark.x));
  shark.z = Math.max(bounds.minZ, Math.min(bounds.maxZ, shark.z));
}

export class Sharks {
  group = new THREE.Group();
  sharks: Shark[] = [];
  
  constructor(private readonly random: () => number) {}

  spawnAll() {
    for (let i = 0; i < REQUIRED_SHARK_COUNT; i++) {
      const greatWhite = i === 0;
      const rig = makeSharkRig(greatWhite);
      const dorsal = rig.getObjectByName("dorsal") as THREE.Mesh;
      this.group.add(rig);
      
      this.sharks.push({
        greatWhite,
        active: true,
        x: SHARK_PATROL_LANES.maxX - this.random() * (SHARK_PATROL_LANES.maxX - SHARK_PATROL_LANES.minX),
        y: -1.5,
        z: SHARK_PATROL_LANES.minZ + this.random() * (SHARK_PATROL_LANES.maxZ - SHARK_PATROL_LANES.minZ),
        yaw: this.random() * Math.PI * 2,
        vx: 0,
        vz: 0,
        state: "patrol",
        stateTime: 0,
        checkT: greatWhite ? 0.25 : this.random() * 2.0,
        mesh: rig,
        fin: dorsal,
        visualWaterRadius: greatWhite ? measureAnchorRadius(rig) : 0,
      });
    }
  }

  reset() {
    this.group.visible = true;
    for (const s of this.sharks) {
      s.active = true;
      s.state = "patrol";
      s.stateTime = 0;
      s.checkT = s.greatWhite ? 0.25 : this.random() * 2.0;
      s.x = SHARK_PATROL_LANES.maxX - this.random() * (SHARK_PATROL_LANES.maxX - SHARK_PATROL_LANES.minX);
      s.y = -1.5;
      s.z = SHARK_PATROL_LANES.minZ + this.random() * (SHARK_PATROL_LANES.maxZ - SHARK_PATROL_LANES.minZ);
      s.yaw = this.random() * Math.PI * 2;
      s.mesh.position.set(s.x, s.y, s.z);
      s.mesh.visible = true;
    }
  }

  update(dt: number, px: number, py: number, pz: number, mode: "gull" | "mafia") {
    if (mode === "mafia") {
      this.group.visible = false;
      return;
    }
    this.group.visible = true;

    for (const s of this.sharks) {
      s.stateTime += dt;
      
      const tail = s.mesh.getObjectByName("tail");
      if (tail) tail.rotation.y = Math.sin(s.stateTime * (s.state === "patrol" ? 4 : 12)) * 0.25;

      if (s.state === "patrol") {
        // Keep the dorsal fin brushing the surface so attentive players can see
        // ocean activity before the close-range breach telegraph begins.
        s.y = -1.0;
        const speed = 4;
        s.vx = Math.sin(s.yaw) * speed;
        s.vz = Math.cos(s.yaw) * speed;
        s.x += s.vx * dt;
        s.z += s.vz * dt;
        
        if (s.x > SHARK_PATROL_LANES.maxX || s.x < SHARK_PATROL_LANES.minX) {
          s.yaw = Math.PI * 2 - s.yaw;
          s.x = Math.max(SHARK_PATROL_LANES.minX, Math.min(SHARK_PATROL_LANES.maxX, s.x));
        }
        if (s.z > SHARK_PATROL_LANES.maxZ || s.z < SHARK_PATROL_LANES.minZ) {
          s.yaw = Math.PI - s.yaw;
          s.z = Math.max(SHARK_PATROL_LANES.minZ, Math.min(SHARK_PATROL_LANES.maxZ, s.z));
        }
        
        s.mesh.rotation.set(0, s.yaw, 0);

        // Telegraph if gull is low over water and near
        s.checkT -= dt;
        if (s.checkT <= 0) {
          s.checkT = s.greatWhite ? 0.65 + this.random() * 0.7 : 1.0 + this.random() * 1.5;
          const dx = px - s.x;
          const dz = pz - s.z;
          const attackRangeSq = s.greatWhite ? 1225 : 400;
          if (py < (s.greatWhite ? 18 : 12) && px < -20 && dx * dx + dz * dz < attackRangeSq) {
            s.state = "telegraph";
            s.stateTime = 0;
            s.yaw = Math.atan2(dx, dz);
          }
        }
      } else if (s.state === "telegraph") {
        s.y = -0.28; // Fin and wake become unmistakable before the breach.
        const speed = 16;
        const dx = px - s.x;
        const dz = pz - s.z;
        const targetYaw = Math.atan2(dx, dz);
        // Turn towards player smoothly
        let dYaw = targetYaw - s.yaw;
        while (dYaw > Math.PI) dYaw -= Math.PI * 2;
        while (dYaw < -Math.PI) dYaw += Math.PI * 2;
        s.yaw += Math.sign(dYaw) * Math.min(Math.abs(dYaw), dt * 3);
        
        s.vx = Math.sin(s.yaw) * speed;
        s.vz = Math.cos(s.yaw) * speed;
        s.x += s.vx * dt;
        s.z += s.vz * dt;
        s.mesh.rotation.set(0, s.yaw, 0);
        
        if (s.stateTime > 1.2) {
          s.state = "breach";
          s.stateTime = 0;
          track("shark_breach", { mode, species: s.greatWhite ? "great_white" : "shark" });
        }
      } else if (s.state === "breach") {
        const t = s.stateTime;
        // parabolic arc up to y=6
        s.y = -0.5 + 28 * t - 32 * t * t;
        const speed = 12;
        s.x += s.vx * dt;
        s.z += s.vz * dt;
        
        // Pitch based on vertical velocity
        const vy = 28 - 64 * t;
        const pitch = -Math.atan2(vy, speed);
        s.mesh.rotation.set(pitch, s.yaw, 0);
        
        if (s.y < -1.5) {
          s.state = "cooldown";
          s.stateTime = 0;
          s.y = -1.5;
        }
      } else if (s.state === "cooldown") {
        s.y = -1.5;
        s.mesh.rotation.set(0, s.yaw, 0);
        if (s.stateTime > 5) {
          s.state = "patrol";
          s.stateTime = 0;
          s.yaw = this.random() * Math.PI * 2;
        }
      }

      if (s.state !== "patrol") clampAttackPosition(s);
      
      s.mesh.position.set(s.x, s.y, s.z);
    }
  }

  consumeAttack(px: number, py: number, pz: number, radius: number): "greatWhite" | "shark" | null {
    for (const s of this.sharks) {
      if (s.state === "breach") {
        // active bite window during upward / early breach
        if (s.stateTime > 0.1 && s.stateTime < 0.6) {
          const dx = px - s.x;
          const dy = py - s.y;
          const dz = pz - s.z;
          if (dx * dx + dy * dy + dz * dz < (3 + radius) * (3 + radius)) {
            // successful bite, prevent multiple hits in same frame/attack
            s.state = "cooldown"; 
            s.stateTime = 0;
            return s.greatWhite ? "greatWhite" : "shark";
          }
        }
      }
    }
    return null;
  }

  dispose() {
    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();

    for (const s of this.sharks) {
      s.mesh.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
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
      this.group.remove(s.mesh);
    }
    
    textures.forEach((tex) => tex.dispose());
    materials.forEach((mat) => mat.dispose());
    this.sharks = [];
  }
}

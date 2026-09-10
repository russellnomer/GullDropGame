import * as THREE from "three";
import { makeSplat } from "./reactions";
import { track } from "./analytics";

export type Shark = {
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
};

const SHARK = {
  body: new THREE.CapsuleGeometry(0.35, 1.4, 8, 12),
  snout: new THREE.ConeGeometry(0.35, 0.8, 12),
  dorsal: new THREE.ConeGeometry(0.18, 0.45, 4),
  pectoral: new THREE.ConeGeometry(0.15, 0.6, 4),
  tailBase: new THREE.ConeGeometry(0.12, 0.5, 8),
  tailFin: new THREE.ConeGeometry(0.25, 0.7, 4),
};

function makeSharkRig(): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x4a5a6a, roughness: 0.6, metalness: 0.1 });

  const body = new THREE.Mesh(SHARK.body, mat);
  body.rotation.x = Math.PI / 2;
  body.position.set(0, 0, 0);

  const snout = new THREE.Mesh(SHARK.snout, mat);
  snout.rotation.x = Math.PI / 2;
  snout.position.set(0, 0, 0.7 + 0.4);

  const dorsal = new THREE.Mesh(SHARK.dorsal, mat);
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
  g.scale.setScalar(1.5);
  
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });

  return g;
}

export class Sharks {
  group = new THREE.Group();
  sharks: Shark[] = [];
  
  constructor(private readonly random: () => number) {}

  spawnAll() {
    for (let i = 0; i < 4; i++) {
      const rig = makeSharkRig();
      const dorsal = rig.getObjectByName("dorsal") as THREE.Mesh;
      this.group.add(rig);
      
      this.sharks.push({
        active: true,
        x: -40 - this.random() * 40,
        y: -1.5,
        z: -200 + this.random() * 400,
        yaw: this.random() * Math.PI * 2,
        vx: 0,
        vz: 0,
        state: "patrol",
        stateTime: 0,
        checkT: this.random() * 2.0,
        mesh: rig,
        fin: dorsal,
      });
    }
  }

  reset() {
    for (const s of this.sharks) {
      s.state = "patrol";
      s.stateTime = 0;
      s.checkT = this.random() * 2.0;
      s.x = -40 - this.random() * 40;
      s.y = -1.5;
      s.z = -200 + this.random() * 400;
      s.yaw = this.random() * Math.PI * 2;
      s.mesh.position.set(s.x, s.y, s.z);
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
        s.y = -1.5;
        const speed = 4;
        s.vx = Math.sin(s.yaw) * speed;
        s.vz = Math.cos(s.yaw) * speed;
        s.x += s.vx * dt;
        s.z += s.vz * dt;
        
        if (s.x > -24 || s.x < -100) {
          s.yaw = Math.PI * 2 - s.yaw;
          s.x = Math.max(-100, Math.min(-24, s.x));
        }
        if (s.z > 230 || s.z < -230) {
          s.yaw = Math.PI - s.yaw;
          s.z = Math.max(-230, Math.min(230, s.z));
        }
        
        s.mesh.rotation.set(0, s.yaw, 0);

        // Telegraph if gull is low over water and near
        s.checkT -= dt;
        if (s.checkT <= 0) {
          s.checkT = 1.0 + this.random() * 1.5;
          const dx = px - s.x;
          const dz = pz - s.z;
          if (py < 12 && px < -20 && dx * dx + dz * dz < 400) {
            s.state = "telegraph";
            s.stateTime = 0;
            s.yaw = Math.atan2(dx, dz);
          }
        }
      } else if (s.state === "telegraph") {
        s.y = -0.5; // Fin breaks surface
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
          track("shark_breach", { mode });
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
      
      s.mesh.position.set(s.x, s.y, s.z);
    }
  }

  consumeAttack(px: number, py: number, pz: number, radius: number): boolean {
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
            return true;
          }
        }
      }
    }
    return false;
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

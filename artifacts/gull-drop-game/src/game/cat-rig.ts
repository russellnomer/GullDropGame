/**
 * cat-rig.ts — Procedural geometry for Stray Cats.
 *
 * Part of: Gull Drop
 * Created: 2026-09-08
 * Last modified: 2026-09-08 by Replit Agent
 *
 * HUMAN REVIEW NOTES:
 * Rig geometry with no imported assets. Uses hierarchical groups to provide walk and chase cycles.
 */

import * as THREE from "three";

const FUR_COLORS = [0x111111, 0xdddddd, 0xda8228, 0x888888, 0x3d2817];

function mat(color: number) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.1 });
}

/** Assembles a procedural stray cat rig and provides animation cycle hooks */
export function makeCatRig(seed: number) {
  const g = new THREE.Group();

  const col = FUR_COLORS[Math.floor(seed * 100) % FUR_COLORS.length];
  const fur = mat(col);
  const white = mat(0xffffff);

  // Torso
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.25, 4, 12), fur);
  torso.rotation.x = Math.PI / 2;
  torso.position.y = 0.2;

  // Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), fur);
  head.position.set(0, 0.3, 0.2);

  // Muzzle
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), white);
  muzzle.position.set(0, 0.25, 0.28);

  // Ears
  const earGeo = new THREE.ConeGeometry(0.04, 0.08, 4);
  const earL = new THREE.Mesh(earGeo, fur);
  earL.position.set(-0.06, 0.38, 0.18);
  earL.rotation.x = -0.1;
  const earR = new THREE.Mesh(earGeo, fur);
  earR.position.set(0.06, 0.38, 0.18);
  earR.rotation.x = -0.1;

  // Legs
  const legGeo = new THREE.CapsuleGeometry(0.03, 0.15, 4, 8);

  const flL = new THREE.Group();
  flL.position.set(-0.08, 0.18, 0.1);
  const flLM = new THREE.Mesh(legGeo, fur);
  flLM.position.y = -0.075;
  flL.add(flLM);

  const flR = new THREE.Group();
  flR.position.set(0.08, 0.18, 0.1);
  const flRM = new THREE.Mesh(legGeo, fur);
  flRM.position.y = -0.075;
  flR.add(flRM);

  const blL = new THREE.Group();
  blL.position.set(-0.08, 0.18, -0.15);
  const blLM = new THREE.Mesh(legGeo, fur);
  blLM.position.y = -0.075;
  blL.add(blLM);

  const blR = new THREE.Group();
  blR.position.set(0.08, 0.18, -0.15);
  const blRM = new THREE.Mesh(legGeo, fur);
  blRM.position.y = -0.075;
  blR.add(blRM);

  // Tail
  const tail = new THREE.Group();
  tail.position.set(0, 0.25, -0.25);
  const tailM = new THREE.Mesh(new THREE.CapsuleGeometry(0.02, 0.25, 4, 8), fur);
  tailM.position.y = 0.125;
  tail.add(tailM);
  tail.rotation.x = -0.4;

  g.add(torso, head, muzzle, earL, earR, flL, flR, blL, blR, tail);

  g.traverse(o => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });

  let animTime = 0;

  return {
    group: g,
    anim: {
      update: (dt: number, state: string, speed: number) => {
        animTime += dt;

        if (state === "idle" || state === "cooldown") {
          head.rotation.x = Math.sin(animTime * 0.5) * 0.1;
          head.rotation.y = Math.sin(animTime * 0.3) * 0.2;
          tail.rotation.x = -0.4 + Math.sin(animTime) * 0.1;
          tail.rotation.z = Math.sin(animTime * 1.2) * 0.2;
          flL.rotation.x = 0; flR.rotation.x = 0;
          blL.rotation.x = 0; blR.rotation.x = 0;
          torso.position.y = 0.2;
        } else if (state === "groom") {
          head.rotation.x = 0.5;
          head.rotation.y = 0.2;
          tail.rotation.x = -0.2;
          torso.position.y = 0.15;
          flL.rotation.x = -0.5;
        } else if (state === "chase" || state === "flee" || state === "pounce") {
          const w = animTime * speed * 4;
          flL.rotation.x = Math.sin(w) * 0.8;
          flR.rotation.x = Math.sin(w + Math.PI) * 0.8;
          blL.rotation.x = Math.sin(w + Math.PI) * 0.8;
          blR.rotation.x = Math.sin(w) * 0.8;
          torso.position.y = 0.2 + Math.abs(Math.sin(w*2)) * 0.05;
          tail.rotation.x = -0.8;
          head.rotation.x = 0;
        } else if (state === "stalk") {
          const w = animTime * speed * 3;
          flL.rotation.x = Math.sin(w) * 0.4;
          flR.rotation.x = Math.sin(w + Math.PI) * 0.4;
          blL.rotation.x = Math.sin(w + Math.PI) * 0.4;
          blR.rotation.x = Math.sin(w) * 0.4;
          torso.position.y = 0.12;
          head.position.y = 0.2;
          tail.rotation.x = -0.1;
        }
      }
    }
  };
}

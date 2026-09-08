import * as THREE from "three";
import { Input } from "./input";
import { Crowd, type Npc, type NpcKind } from "./npcs";
import { applyEnv } from "./assets";
import { makeGullRig } from "./rigs";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { SMAAPass } from "three/examples/jsm/postprocessing/SMAAPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ParticlePool } from "./particles";
import { Flock } from "./flock";
import { buildWorld, districtName, onBoardwalk, type World } from "./world";
import { useGame } from "./store";
import { playBonus, playChirp, playGag, playHit, playPlop, playScream, playSquawk, playThump, playYell, resumeAudio, unlockAudio } from "./audio";
import { quoteFor } from "./reactions";
import { bindGame } from "./runtime";
import { fault } from "./log";
import { SquirrelMafia, type Squirrel } from "./squirrels";
import { jobList } from "./jobs";
import { equippedSkin, loadSave, writeSave } from "./progress";

type Drop = { alive: boolean; x: number; y: number; z: number; vx: number; vy: number; vz: number; mesh: THREE.Mesh };

const SENS = 0.0022;
const FLY_SPEED = 18;
const STRAFE_SPEED = 14;
const CLIMB_SPEED = 10;
const MIN_Y = 2.1;
const MAX_Y = 36;
const FIRE_CD = 0.32;
const FLOCK_CD = 12;
const BOARDWALK_Y = 2.2;
const WORLD_UP = new THREE.Vector3(0, 1, 0);
const LOCAL_X = new THREE.Vector3(1, 0, 0);
const LOCAL_FWD = new THREE.Vector3(0, 0, -1);

const LINES: Record<string, string[]> = {
  tourist: ["FACE PAINT", "AIRMAIL", "THEY LOOKED UP", "DIRECT HIT"],
  custardCone: ["CUSTARD INTERRUPTED", "CONE DOWN", "DESSERT DENIED"],
  custardBody: ["SUNDAE ON A SHIRT", "MELTED DREAMS"],
  selfie: ["MID-SELFIE", "STORY RUINED"],
  proposal: ["KNEES WERE A MISTAKE", "RING CHECK DENIED"],
  nap: ["NAP RUINED", "RISE AND SHINE"],
  balloon: ["BALLOON MASSACRE", "HELIUM TAX"],
  feeder: ["FED THE WRONG GULL"],
  hotdog: ["DOG DOWN"],
  lawyer: ["OBJECTION OVERRULED", "BILLABLE HOUR"],
  politician: ["TOWN HALL ADJOURNED", "BIPARTISAN GLAZE", "RE-ELECT NOBODY"],
  realtor: ["AS-IS, NO RETURNS"],
  hoa: ["VIOLATION ISSUED"],
  parking: ["METER EXPIRED"],
  influencer: ["DEMONETIZED"],
  crypto: ["WENT TO ZERO"],
  insurance: ["CLAIM DENIED"],
  swarm: ["FLOCK COMMITTEE", "THEY BROUGHT FRIENDS"],
  swarmPol: ["CONSTITUENT SERVICES", "TOWN HALL PACKED"],
  cop: ["BADGE DOWN", "OFFICER DOWNWIND"],
  squirrel: ["NUT JOB", "TAIL RAT"],
  don: ["DON DOWN", "FAMILY BUSINESS"],
};

const PTS: Record<string, number> = {
  tourist: 100,
  custardCone: 500,
  custardBody: 275,
  selfie: 350,
  proposal: 800,
  nap: 200,
  balloon: 400,
  feeder: 450,
  hotdog: 225,
  lawyer: 1200,
  politician: 1500,
  realtor: 1000,
  hoa: 1100,
  parking: 900,
  influencer: 1000,
  crypto: 1000,
  insurance: 1100,
  star: 1000,
  cop: 650,
  squirrel: 400,
  don: 2500,
  vendor: 575,
  rider: 850,
  tanner: 240,
  swimmer: 320,
  lifeguard: 900,
  volleyball: 360,
};

function line(k: string): string {
  const a = LINES[k] ?? LINES.tourist;
  return a[(Math.random() * a.length) | 0];
}

export class GullDropGame {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(70, 1, 0.1, 560);
  private overlayScene = new THREE.Scene();
  private overlayCam = new THREE.PerspectiveCamera(50, 1, 0.05, 10);
  private world: World;
  private crowd = new Crowd();
  private flock = new Flock();
  private mafia = new SquirrelMafia();
  private particles = new ParticlePool();
  private input: Input;
  private drops: Drop[] = [];
  private viewmodel: THREE.Group;
  private body: THREE.Group;
  private groundShadow: THREE.Mesh;
  private dropShade: THREE.Mesh[] = [];
  private ambient: THREE.Object3D[] = [];
  private sqCards: THREE.Object3D[] = [];
  private jank = 0;
  private lean = false;
  private cardT = 0;
  private patron = false;
  private yaw = 0;
  private pitch = -0.18;
  private orient = new THREE.Quaternion();
  private _up = new THREE.Vector3();
  private _qYaw = new THREE.Quaternion();
  private _qPit = new THREE.Quaternion();
  private _qRol = new THREE.Quaternion();
  private _qTgt = new THREE.Quaternion();
  private _eul = new THREE.Euler(0, 0, 0, "YXZ");
  private x = 0;
  private y = 14;
  private z = 72;
  private vx = 0;
  private vy = 0;
  private vz = 0;
  private fireCd = 0;
  private flockCd = 0;
  private comboT = 0;
  private combo = 0;
  private score = 0;
  private time = 0;
  private trauma = 0;
  private hitstop = 0;
  private bob = 0;
  private attractT = 0;
  private hudAcc = 0;
  private alertT = 0;
  private last = 0;
  private disposed = false;
  private canvas: HTMLCanvasElement;
  private callId = 1;
  private _fwd = new THREE.Vector3();
  private _right = new THREE.Vector3();
  private _look = new THREE.Vector3();
  private _wish = new THREE.Vector3();
  private eventT = 8;
  private lock: Npc | null = null;
  private lockSq: Squirrel | null = null;
  private ring: THREE.Mesh;
  private wanted = 0;
  private wantedDecay = 0;
  private health = 3;
  private groundedT = 0;
  private jobI = 0;
  private jobP = 0;
  private tramZ = -40;
  private coasterT = 0;
  private jobs = jobList();
  private dropMat!: THREE.MeshLambertMaterial;
  private plumage: THREE.MeshStandardMaterial[] = [];
  private fries: Array<{ x: number; y: number; z: number; taken: number; mesh: THREE.Mesh }> = [];
  private flockMax = FLOCK_CD;
  private flash = 0;
  private composer: EffectComposer | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0xc4b090, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.autoClear = false;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    this.renderer.shadowMap.enabled = !coarse;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.world = buildWorld(this.scene);
    applyEnv(this.renderer, this.scene);
    this.crowd.spawnAll(this.world.benches, this.world.photoSpot, this.world.kiosk);
    this.crowd.seatRides(this.world.ferrisCars, this.world.coasterCar, this.world.carousel);
    this.mafia.spawnAll();
    this.scene.add(this.crowd.group);
    this.scene.add(this.mafia.group);
    this.scene.add(this.particles.mesh);
    this.scene.add(this.flock.group);
    this.world.group.traverse((o) => {
      if (o.name === "ambientGull") this.ambient.push(o);
    });
    this.mafia.group.traverse((o) => {
      if (o.name === "card") this.sqCards.push(o);
    });
    this.ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.72, 0.055, 8, 28),
      new THREE.MeshBasicMaterial({ color: 0x5eb7ae, transparent: true, opacity: 0.9, depthWrite: false }),
    );
    this.ring.rotation.x = Math.PI / 2;
    this.ring.visible = false;
    this.scene.add(this.ring);

    this.viewmodel = makeViewmodel();
    this.viewmodel.scale.setScalar(0.52);
    this.viewmodel.position.set(0.04, -0.18, 0.02);
    this.viewmodel.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.material && (m.material as THREE.MeshStandardMaterial).color) {
        const mat = m.material as THREE.MeshStandardMaterial;
        if (mat.color.getHex() === 0xf4f1ea || mat.color.getHex() === 0xc8c2b8) this.plumage.push(mat);
      }
    });
    this.overlayScene.add(this.viewmodel);
    this.overlayScene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const vl = new THREE.DirectionalLight(0xffe6c8, 0.8);
    vl.position.set(0.4, 1, 0.6);
    this.overlayScene.add(vl);

    const white = new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.45 });
    const grey = new THREE.MeshStandardMaterial({ color: 0xc8c2b8, roughness: 0.55 });
    const beak = new THREE.MeshStandardMaterial({ color: 0xe08932, roughness: 0.4 });
    this.body = makeGullRig("world", white, grey, beak);
    this.body.traverse((o) => {
      o.layers.set(2);
      const m = o as THREE.Mesh;
      if (m.isMesh) m.castShadow = true;
    });
    this.scene.add(this.body);
    this.groundShadow = makeWingShadow();
    this.scene.add(this.groundShadow);

    if (!coarse) {
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.composer.addPass(new SMAAPass());
      this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(1600, 900), 0.22, 0.42, 0.86));
    }

    this.input = new Input(canvas);
    this.buildDrops();
    this.spawnFries();
    this.applyLook();
    this.resize();
    window.addEventListener("resize", this.onResize);
    document.addEventListener("pointerlockchange", this.onLock);
    document.addEventListener("visibilitychange", this.onVis);
    bindGame(this);
    this.wireProbe();
    this.last = performance.now();
    this.renderer.setAnimationLoop(this.loop);
  }

  private onResize = () => this.resize();
  private onLock = () => useGame.getState().setLocked(document.pointerLockElement === this.canvas);
  private onVis = () => {
    if (!document.hidden) resumeAudio();
  };

  private buildDrops() {
    const geo = new THREE.SphereGeometry(0.11, 8, 6);
    geo.scale(0.85, 1.15, 0.85);
    this.dropMat = new THREE.MeshLambertMaterial({ color: 0xf4f1ea });
    const shadeMat = new THREE.MeshBasicMaterial({ color: 0x1a120c, transparent: true, opacity: 0.28, depthWrite: false });
    for (let i = 0; i < 24; i++) {
      const mesh = new THREE.Mesh(geo, this.dropMat);
      mesh.visible = false;
      mesh.castShadow = true;
      this.scene.add(mesh);
      const shade = new THREE.Mesh(new THREE.CircleGeometry(0.22, 12), shadeMat);
      shade.rotation.x = -Math.PI / 2;
      shade.visible = false;
      this.scene.add(shade);
      this.dropShade.push(shade);
      this.drops.push({ alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, mesh });
    }
  }

  private resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
    this.overlayCam.aspect = w / Math.max(1, h);
    this.overlayCam.updateProjectionMatrix();
    this.composer?.setSize(w, h);
    this.composer?.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  }

  private loop = (now: number) => {
    if (this.disposed) return;
    try {
      const raw = (now - this.last) / 1000;
      if (raw > 0.05) this.jank += 1;
      else this.jank = Math.max(0, this.jank - 1);
      if (this.jank > 10 && !this.lean) this.goLean();
      const dt = Math.min(raw, 0.05);
      this.last = now;
      this.update(dt);
      this.render(dt);
    } catch (err) {
      fault("error", "frame", err);
    }
  };

  private goLean() {
    this.lean = true;
    this.renderer.shadowMap.enabled = false;
    this.composer = null;
    fault("warn", "Dropped shadows and bloom to keep the boards moving");
  }

  private update(dt: number) {
    const st = useGame.getState();
    this.world.ferris.rotation.z += dt * 0.18;
    const fz = this.world.ferris.rotation.z;
    for (const car of this.world.ferrisCars) car.rotation.z = -fz;
    this.world.carousel.rotation.y += dt * 0.55;
    this.coasterT += dt * 0.35;
    const ct = this.coasterT;
    this.world.coasterCar.position.set(
      -38 - 16 * Math.cos(ct),
      2.2 + 3.2 + 5.5 * Math.abs(Math.sin(ct * 2)),
      -150 + 7 * Math.sin(ct),
    );
    this.world.coasterCar.lookAt(-38 - 16 * Math.cos(ct + 0.15), this.world.coasterCar.position.y, -150 + 7 * Math.sin(ct + 0.15));
    this.world.waterMat.uniforms.uTime.value += dt;
    this.tickAmbientGulls(dt);
    this.crowd.update(st.phase === "paused" ? 0 : dt);
    this.particles.update(dt);
    if (st.phase === "playing") {
      this.mafia.update(dt, this.x, this.y, this.z, this.wanted, true);
      this.tramZ += dt * 7;
      if (this.tramZ > 200) this.tramZ = -200;
      this.world.tram.position.z = this.tramZ;
      this.cardT += dt;
      if (this.cardT > 0.12) {
        this.cardT = 0;
        for (const c of this.sqCards) c.lookAt(this.x, this.y, this.z);
      }
    }
    if (st.phase !== "paused" && (st.phase === "playing" || this.flock.active)) this.tickFlock(dt);

    if (st.phase === "menu" || st.phase === "gameover") {
      this.ring.visible = false;
      this.attractT += dt;
      const t = this.attractT;
      this.camera.position.set(-16 + Math.sin(t * 0.12) * 8, 10 + Math.sin(t * 0.2) * 2.2, 28 + Math.cos(t * 0.1) * 55);
      this.camera.lookAt(2, 3.4, Math.sin(t * 0.08) * 18);
      return;
    }

    if (this.input.consumePause()) {
      if (st.phase === "playing") {
        st.pause();
        document.exitPointerLock();
      } else if (st.phase === "paused") st.resume();
    }
    if (useGame.getState().phase !== "playing") return;

    if (this.groundedT > 0) {
      this.groundedT -= dt;
      if (this.groundedT <= 0) useGame.getState().patch({ grounded: false });
    }
    if (this.hitstop > 0) {
      this.hitstop -= dt;
      return;
    }

    this.time += dt;
    const frenzy = this.wanted >= 4;
    this.comboT = Math.max(0, this.comboT - dt);
    if (this.comboT <= 0) this.combo = 0;
    this.fireCd = Math.max(0, this.fireCd - dt);
    this.flockCd = Math.max(0, this.flockCd - dt);
    this.trauma = Math.max(0, this.trauma - dt * 1.8);
    this.alertT = Math.max(0, this.alertT - dt);
    this.flash = Math.max(0, this.flash - dt * 4);
    if (this.x < -24) {
      this.wantedDecay -= dt;
      if (this.wantedDecay <= 0 && this.wanted > 0) {
        this.wanted -= 1;
        this.wantedDecay = 10;
      }
    } else this.wantedDecay = 12;

    this.eventT -= dt;
    if (this.eventT <= 0) {
      this.eventT = 7 + Math.random() * 6;
      this.specialEvent();
    }

    const look = this.input.consumeLook();
    const touchLook = useGame.getState().consumeLook();
    const mx = look.x + touchLook.x;
    const my = look.y + touchLook.y;
    if (mx !== 0) {
      this._qYaw.setFromAxisAngle(WORLD_UP, -mx * SENS);
      this.orient.premultiply(this._qYaw);
    }
    if (my !== 0) {
      this._qPit.setFromAxisAngle(LOCAL_X, -my * SENS);
      this.orient.multiply(this._qPit);
    }
    const roll = this.input.roll();
    if (roll !== 0) {
      this._qRol.setFromAxisAngle(LOCAL_FWD, roll * 2.6 * dt);
      this.orient.multiply(this._qRol);
    }
    this.orient.normalize();
    this.syncLook();
    if (this.input.leveling() || useGame.getState().touch.level) this.levelOut(dt);

    const touch = useGame.getState().touch;
    const throttle = THREE.MathUtils.clamp(this.input.throttle() + touch.moveY, -1, 1);
    const strafe = THREE.MathUtils.clamp(this.input.strafe() + touch.moveX, -1, 1);
    const climb = THREE.MathUtils.clamp(this.input.climb() + touch.climb, -1, 1);

    const wish = this._wish.set(0, 0, 0);
    wish.addScaledVector(this._look, throttle);
    wish.addScaledVector(this._right, strafe * (STRAFE_SPEED / FLY_SPEED));
    wish.y += climb * 0.85;
    if (wish.lengthSq() > 1) wish.normalize();

    const accel = 28;
    const ax = 1 - Math.exp(-accel * dt);
    this.vx += (wish.x * FLY_SPEED - this.vx) * ax;
    this.vy += (wish.y * CLIMB_SPEED + this._look.y * throttle * 6 - this.vy) * ax;
    this.vz += (wish.z * FLY_SPEED - this.vz) * ax;
    if (wish.lengthSq() < 0.01) {
      const fr = 1 - Math.exp(-3.2 * dt);
      this.vx *= 1 - fr;
      this.vy *= 1 - fr;
      this.vz *= 1 - fr;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.z += this.vz * dt;
    this.x = THREE.MathUtils.clamp(this.x, -70, 42);
    this.z = THREE.MathUtils.clamp(this.z, -210, 210);
    this.y = THREE.MathUtils.clamp(this.y, MIN_Y, MAX_Y);
    this.resolveBuildings();
    this.bob += dt * (4 + Math.hypot(this.vx, this.vz) * 0.4);

    if ((this.input.consumeFire() || touch.fire) && this.fireCd <= 0) this.shoot();
    this.updateLock();
    const swarmBtn = this.input.consumeFlock() || touch.swarm;
    if (touch.swarm) useGame.getState().setTouch({ swarm: false });
    if (swarmBtn) this.trySwarm();
    this.updateDrops(dt);
    if (this.mafia.hitPlayer(this.x, this.y - 0.2, this.z, 0.9)) this.onAcornHit();
    this.tickFries(dt);
    this.nudgeStory();

    this.hudAcc += dt;
    if (this.hudAcc > 0.16) {
      this.hudAcc = 0;
      const g = useGame.getState();
      g.patch({
        score: this.score,
        combo: this.combo,
        timeLeft: this.time,
        cooldown: this.fireCd / FIRE_CD,
        swarmCd: 1 - this.flockCd / this.flockMax,
        lockHint: this.lockLabel(),
        frenzy,
        flash: this.flash,
        inverted: this._up.y < 0.25,
        wanted: this.wanted,
        district: districtName(this.x, this.z),
        jobTitle: this.jobs[this.jobI]?.title ?? "BOARDS ARE YOURS",
        jobBlurb: this.jobs[this.jobI]?.blurb ?? "Clock out whenever. The family remembers.",
        jobProg: this.jobP,
        jobGoal: this.jobs[this.jobI]?.goal ?? 0,
        nextTitle: this.jobs[this.jobI + 1]?.title ?? "FREE ROAM",
        jobArrow: this.jobArrow(),
        health: this.health,
        elapsed: this.time,
        yaw: this.yaw,
        playerX: this.x,
        playerZ: this.z,
        blips: this.mafia.list.filter((s) => s.alive).map((s) => ({ x: s.x, z: s.z, k: s.boss ? ("don" as const) : ("sq" as const) })),
        alert: this.alertT > 0 ? g.alert : null,
      });
    }
  }

  private resolveBuildings() {
    const r = 0.7;
    for (const b of this.world.colliders) {
      if (this.x + r < b.minX || this.x - r > b.maxX || this.z + r < b.minZ || this.z - r > b.maxZ || this.y < b.minY || this.y > b.maxY + 2)
        continue;
      const dx1 = this.x + r - b.minX;
      const dx2 = b.maxX - (this.x - r);
      const dz1 = this.z + r - b.minZ;
      const dz2 = b.maxZ - (this.z - r);
      const m = Math.min(dx1, dx2, dz1, dz2);
      if (m === dx1) this.x = b.minX - r;
      else if (m === dx2) this.x = b.maxX + r;
      else if (m === dz1) this.z = b.minZ - r;
      else this.z = b.maxZ + r;
      this.vx *= 0.2;
      this.vz *= 0.2;
    }
  }

  private shoot() {
    this.fireCd = FIRE_CD;
    playPlop();
    playSquawk();
    this.trauma = Math.min(1, this.trauma + 0.18);
    this._qPit.setFromAxisAngle(LOCAL_X, 0.03);
    this.orient.multiply(this._qPit);
    this.syncLook();
    const slot = this.drops.find((d) => !d.alive);
    if (!slot) return;
    const origin = this.camera.position;
    slot.alive = true;
    slot.x = origin.x + this._look.x * 0.9;
    slot.y = origin.y + this._look.y * 0.9 - 0.35;
    slot.z = origin.z + this._look.z * 0.9;
    slot.vx = this._look.x * 22 + this.vx * 0.25;
    slot.vy = this._look.y * 22 - 2;
    slot.vz = this._look.z * 22 + this.vz * 0.25;
    slot.mesh.visible = true;
    slot.mesh.position.set(slot.x, slot.y, slot.z);
  }

  private updateDrops(dt: number) {
    for (const d of this.drops) {
      if (!d.alive) continue;
      d.vy -= 26 * dt;
      const nx = d.x + d.vx * dt;
      const ny = d.y + d.vy * dt;
      const nz = d.z + d.vz * dt;
      const hit = this.crowd.hitTest(nx, ny, nz, 0.16);
      if (hit) {
        this.onNpcHit(hit.npc, hit.cone, nx, ny, nz);
        this.killDrop(d);
        continue;
      }
      const sq = this.mafia.hitTest(nx, ny, nz, 0.16);
      if (sq) {
        this.onSquirrelHit(sq, nx, ny, nz, false);
        this.killDrop(d);
        continue;
      }
      if (this.hitBuilding(nx, ny, nz) || ny < 0.1) {
        this.particles.burst(nx, ny, nz, 8, 0xf4f1ea, 2, 1);
        this.killDrop(d);
        continue;
      }
      if (ny < BOARDWALK_Y + 0.2 && onBoardwalk(nx, nz)) {
        this.particles.burst(nx, BOARDWALK_Y + 0.25, nz, 12, 0xf4f1ea, 2.4, 1.4);
        playHit(false);
        this.killDrop(d);
        continue;
      }
      d.x = nx;
      d.y = ny;
      d.z = nz;
      d.mesh.position.set(nx, ny, nz);
      d.mesh.rotation.x += dt * 8;
      const si = this.drops.indexOf(d);
      const sh = this.dropShade[si];
      if (sh) {
        const alt = Math.max(0.05, ny - BOARDWALK_Y);
        sh.visible = true;
        sh.position.set(nx + alt * 0.14, shadeGround(nx, nz), nz - alt * 0.05);
        sh.scale.setScalar(0.65 + Math.min(1.8, alt * 0.14));
        (sh.material as THREE.MeshBasicMaterial).opacity = 0.34 * (1 - Math.min(0.75, alt / 16));
      }
    }
  }

  private hitBuilding(x: number, y: number, z: number): boolean {
    for (const b of this.world.colliders) {
      if (x > b.minX && x < b.maxX && y > b.minY && y < b.maxY && z > b.minZ && z < b.maxZ) return true;
    }
    return false;
  }

  private killDrop(d: Drop) {
    d.alive = false;
    d.mesh.visible = false;
    const sh = this.dropShade[this.drops.indexOf(d)];
    if (sh) sh.visible = false;
  }

  private poseShadow(flap: number) {
    this.body.visible = true;
    this.body.position.set(this.x, this.y, this.z);
    this.body.quaternion.copy(this.orient);
    const lw = this.body.getObjectByName("wingL");
    const rw = this.body.getObjectByName("wingR");
    if (lw) lw.rotation.z = flap;
    if (rw) rw.rotation.z = -flap;
    const alt = Math.max(0, this.y - BOARDWALK_Y);
    const t = Math.min(1, alt / 16);
    this.groundShadow.visible = true;
    this.groundShadow.position.set(this.x + alt * 0.32, shadeGround(this.x, this.z), this.z - alt * 0.1);
    this.groundShadow.rotation.set(-Math.PI / 2, 0, -this.yaw + flap * 0.08);
    const spread = 1.05 + t * 2.6 + flap * 0.35;
    this.groundShadow.scale.set(spread, 0.85 + t, 1);
    const mat = this.groundShadow.material as THREE.MeshBasicMaterial;
    mat.opacity = 0.5 * (1 - t * 0.62);
  }

  private onNpcHit(n: Npc, cone: boolean, x: number, y: number, z: number, swarm = false) {
    let key: string = n.kind;
    if (n.kind === "custard") key = cone ? "custardCone" : "custardBody";
    if (n.kind === "star" && n.starRole) key = n.starRole;
    if (swarm) key = n.starRole === "politician" ? "swarmPol" : "swarm";
    const spoken = quoteFor(key);
    this.crowd.reactHit(n, spoken);
    if (n.partner && !n.partner.hit) this.crowd.reactHit(n.partner, quoteFor("proposal"));
    const near = this.crowd.inRadius(n.x, n.z, 4.2, n);
    for (const b of near.slice(0, 2)) this.crowd.glance(b);
    if (n.cone && cone) n.cone.visible = false;
    if (n.item && n.kind === "balloon") n.item.visible = false;
    const scoreKey = n.kind === "custard" ? (cone ? "custardCone" : "custardBody") : n.kind === "star" && n.starRole ? n.starRole : n.kind;
    const base = PTS[scoreKey] ?? 100;
    this.combo += 1;
    this.comboT = 2.4;
    const mult = this.combo >= 6 ? 3 : this.combo >= 4 ? 2 : this.combo >= 2 ? 1.5 : 1;
    const frenzy = this.wanted >= 4 ? 2 : 1;
    const pts = Math.round(base * mult * frenzy * (swarm ? 2.25 : 1) * this.patronMult());
    this.score += pts;
    this.trauma = Math.min(1, this.trauma + (swarm ? 0.85 : 0.35));
    this.hitstop = swarm ? 0.1 : 0.04;
    this.flash = Math.min(1, this.flash + (swarm ? 0.7 : 0.35));
    this.particles.burst(x, y, z, swarm ? 36 : cone ? 22 : 14, cone ? 0xf3e5ab : 0xf4f1ea, swarm ? 6.5 : 3.2, 2.2);
    playHit(!!cone || swarm);
    playScream();
    playGag();
    if (n.kind === "star" || n.kind === "cop" || n.kind === "selfie" || n.kind === "vendor") playYell();
    if (cone || n.kind === "star" || n.kind === "rider" || swarm) playBonus();
    const stats = { ...useGame.getState().stats };
    stats.hits += 1;
    stats.comboMax = Math.max(stats.comboMax, this.combo);
    if (scoreKey === "custardCone" || scoreKey === "custardBody") stats.custards += 1;
    if (n.kind === "selfie") stats.selfies += 1;
    if (n.kind === "proposal") stats.proposals += 1;
    if (n.kind === "nap") stats.naps += 1;
    if (n.kind === "balloon") stats.balloons += 1;
    if (n.kind === "feeder") stats.feeders += 1;
    if (n.kind === "hotdog") stats.dogs += 1;
    if (n.kind === "star") stats.suits += 1;
    if (n.starRole === "politician") stats.pols += 1;
    if (swarm) stats.swarms += 1;
    if (n.kind === "cop" || n.starRole === "politician" || n.kind === "star" || n.kind === "lifeguard") this.bumpWanted(n.kind === "cop" || n.kind === "lifeguard" ? 2 : 1);
    this.jobTick("hits", 1);
    if (scoreKey === "custardCone") this.jobTick("custard", 1);
    if (n.starRole === "politician") this.jobTick("pol", 1);
    const callouts = [{ id: this.callId++, title: spoken, pts }, ...useGame.getState().callouts].slice(0, 4);
    useGame.getState().patch({ score: this.score, combo: this.combo, stats, callouts, alert: spoken });
    this.alertT = 1.6;
    window.setTimeout(() => {
      const g = useGame.getState();
      g.patch({ callouts: g.callouts.filter((c) => c.id !== callouts[0].id) });
    }, 2200);
  }

  private bumpWanted(n: number) {
    this.wanted = Math.min(5, this.wanted + n);
    this.wantedDecay = 14;
    const stats = { ...useGame.getState().stats };
    stats.wantedMax = Math.max(stats.wantedMax, this.wanted);
    useGame.getState().patch({ stats, wanted: this.wanted });
  }

  private jobTick(kind: string, n: number) {
    const job = this.jobs[this.jobI];
    if (!job || job.kind !== kind) return;
    this.jobP = Math.min(job.goal, this.jobP + n);
    if (this.jobP >= job.goal) {
      this.score += Math.round((job.id === "daily" ? 2000 : 1500) * this.patronMult());
      const stats = { ...useGame.getState().stats };
      stats.jobs += 1;
      if (job.id === "daily") writeSave({ dailyDone: true, dailyDate: new Date().toISOString().slice(0, 10) });
      this.jobI = Math.min(this.jobs.length, this.jobI + 1);
      this.jobP = 0;
      this.alertT = 3.2;
      const next = this.jobs[this.jobI];
      useGame.getState().patch({
        score: this.score,
        stats,
        alert: next ? next.radio : "Uncle Beaky: The boards are ours. Stay ugly.",
      });
      playBonus();
    } else if (job.goal - this.jobP === 1) {
      this.alertT = 2.4;
      const line =
        job.kind === "custard"
          ? "Uncle Beaky: One cone left. Don't let her finish it."
          : job.kind === "hits"
            ? "Uncle Beaky: One more walker. Make it count."
            : job.kind === "squirrel"
              ? "Uncle Beaky: One tail-rat. Then the Don."
              : "Uncle Beaky: Finish it.";
      useGame.getState().patch({ alert: line });
    }
  }

  private onSquirrelHit(s: Squirrel, x: number, y: number, z: number, swarm: boolean) {
    playChirp();
    this.particles.burst(x, y, z, swarm ? 28 : 12, 0x8a5a32, 4, 2);
    if (!this.mafia.wound(s)) {
      this.score += 150;
      this.bumpWanted(1);
      useGame.getState().patch({ score: this.score });
      return;
    }
    this.combo += 1;
    this.comboT = 2.4;
    const key = s.boss ? "don" : "squirrel";
    const pts = Math.round((PTS[key] ?? 400) * (this.combo >= 2 ? 1.5 : 1) * (this.wanted >= 4 ? 2 : 1) * (swarm ? 2.25 : 1) * this.patronMult());
    this.score += pts;
    this.bumpWanted(s.boss ? 3 : 1);
    const stats = { ...useGame.getState().stats };
    stats.hits += 1;
    stats.squirrels += 1;
    stats.comboMax = Math.max(stats.comboMax, this.combo);
    const spoken = quoteFor(key);
    const callouts = [{ id: this.callId++, title: spoken, pts }, ...useGame.getState().callouts].slice(0, 4);
    useGame.getState().patch({ score: this.score, combo: this.combo, stats, callouts, alert: spoken });
    this.alertT = 1.4;
    this.jobTick("squirrel", 1);
    if (s.boss) this.jobTick("don", 1);
    playHit(true);
    if (s.boss) playBonus();
  }

  private onAcornHit() {
    playThump();
    this.combo = 0;
    this.trauma = Math.min(1, this.trauma + 0.55);
    this.health -= 1;
    this.particles.burst(this.x, this.y, this.z, 10, 0x6a3a18, 3, 1);
    if (this.health <= 0) {
      this.health = 3;
      this.groundedT = 2.2;
      this.x = -32;
      this.y = 16;
      this.vx = this.vy = this.vz = 0;
      this.alertT = 2.2;
      useGame.getState().patch({ grounded: true, health: 3, alert: "GROUNDED" });
      return;
    }
    this.alertT = 1.2;
    useGame.getState().patch({ health: this.health, combo: 0, alert: "ACORN TO THE BEAK" });
  }

  private tickFlock(dt: number) {
    const { strike, dumps } = this.flock.update(dt);
    for (const d of dumps) {
      this.particles.burst(d.x, d.y, d.z, 6, 0xf4f1ea, 2.2, 1.2);
      playPlop();
    }
    if (strike) this.swarmStrike();
  }

  private updateLock() {
    if (!this.flock.active) {
      this.lock = this.pickLock();
      this.lockSq = this.lock ? null : this.pickSqLock();
    }
    const mark = this.lock && this.lock.alive && !this.lock.hit ? this.lock : this.lockSq && this.lockSq.alive && !this.lockSq.hit ? this.lockSq : null;
    const ringMat = this.ring.material as THREE.MeshBasicMaterial;
    if (mark) {
      this.ring.visible = true;
      this.ring.position.set(mark.x, mark.y + 0.08, mark.z);
      this.ring.rotation.z += 0.04;
      ringMat.color.setHex(0x5eb7ae);
    } else {
      const job = this.jobMark();
      if (job) {
        this.ring.visible = true;
        this.ring.position.set(job.x, job.y + 0.08, job.z);
        this.ring.rotation.z += 0.03;
        ringMat.color.setHex(0xf3e5ab);
      } else {
        this.ring.visible = false;
        this.lock = null;
        this.lockSq = null;
      }
    }
  }

  private pickLock(): Npc | null {
    let best: Npc | null = null;
    let bestDot = 0.82;
    for (const n of this.crowd.npcs) {
      if (!n.alive || n.hit) continue;
      const dx = n.x - this.x;
      const dy = n.y + 1.05 - this.y;
      const dz = n.z - this.z;
      const len = Math.hypot(dx, dy, dz);
      if (len < 2.2 || len > 62) continue;
      const dot = (dx * this._look.x + dy * this._look.y + dz * this._look.z) / len;
      if (dot > bestDot) {
        bestDot = dot;
        best = n;
      }
    }
    return best;
  }

  private pickSqLock(): Squirrel | null {
    let best: Squirrel | null = null;
    let bestDot = 0.82;
    for (const n of this.mafia.list) {
      if (!n.alive || n.hit) continue;
      const dx = n.x - this.x;
      const dy = n.y + 0.5 - this.y;
      const dz = n.z - this.z;
      const len = Math.hypot(dx, dy, dz);
      if (len < 2.2 || len > 62) continue;
      const dot = (dx * this._look.x + dy * this._look.y + dz * this._look.z) / len;
      if (dot > bestDot) {
        bestDot = dot;
        best = n;
      }
    }
    return best;
  }

  private lockLabel(): string | null {
    if (this.lockSq?.boss) return "DON NOCCIOLA";
    if (this.lockSq) return "SQUIRREL";
    if (!this.lock) return null;
    if (this.lock.kind === "cop") return "COP";
    if (this.lock.starRole) return this.lock.starRole.toUpperCase();
    if (this.lock.kind === "custard") return "CUSTARD";
    if (this.lock.kind === "selfie") return "SELFIE";
    if (this.lock.kind === "proposal") return "PROPOSAL";
    return this.lock.kind.toUpperCase();
  }

  private trySwarm() {
    if (this.flockCd > 0 || this.flock.active) {
      this.alertT = 1.4;
      useGame.getState().patch({ alert: this.flockCd > 0 ? "FLOCK STILL COMING BACK" : "FLOCK BUSY" });
      return;
    }
    if (!this.lock && !this.lockSq) {
      this.alertT = 1.4;
      useGame.getState().patch({ alert: "PUT THE RETICLE ON A MARK" });
      return;
    }
    const mark = this.lockSq ?? this.lock;
    if (!mark) return;
    this.flock.launch(new THREE.Vector3(this.x, this.y, this.z), mark);
    this.flockCd = this.flockMax;
    playSquawk();
    this.alertT = 1.8;
    useGame.getState().patch({ alert: `FLOCK ON ${this.lockLabel() ?? "MARK"}` });
  }

  private swarmStrike() {
    const t = this.flock.target;
    const x = this.flock.tx;
    const y = Math.max(this.flock.ty - 2, 3);
    const z = this.flock.tz;
    this.particles.burst(x, y, z, 40, 0xf4f1ea, 7, 4);
    const sq = this.mafia.hitTest(x, y, z, 1.4);
    if (sq && sq.alive && !sq.hit) this.onSquirrelHit(sq, sq.x, sq.y + 0.6, sq.z, true);
    else if (t && "kind" in t && t.alive && !(t as Npc).hit) {
      const n = t as Npc;
      this.onNpcHit(n, n.kind === "custard" && n.eat > 0.05, n.x, n.y + 1.2, n.z, true);
    }
    const splash = this.crowd.inRadius(x, z, 3.1, this.lock);
    for (const n of splash) this.onNpcHit(n, false, n.x, n.y + 1.1, n.z, false);
    for (const s of this.mafia.list) {
      if (!s.alive || s.hit || s === sq) continue;
      if ((s.x - x) ** 2 + (s.z - z) ** 2 < 3.1 * 3.1) this.onSquirrelHit(s, s.x, s.y + 0.5, s.z, false);
    }
    if (splash.length >= 2) {
      this.alertT = 2;
      useGame.getState().patch({ alert: "CIVIC ENGAGEMENT" });
    }
  }

  private specialEvent() {
    if (Math.random() < 0.28) {
      this.crowd.spawn("star", undefined, undefined, "politician");
      this.alertT = 2.8;
      useGame.getState().patch({ alert: "FACT-FINDING TOUR ON THE BOARDS" });
      return;
    }
    const kinds: NpcKind[] = ["custard", "selfie", "feeder", "hotdog", "balloon", "vendor", "tanner", "swimmer"];
    const k = kinds[(Math.random() * kinds.length) | 0];
    const dead = this.crowd.npcs.find((n) => !n.alive);
    if (dead) this.crowd.respawn(dead, k);
    else this.crowd.spawn(k);
    this.alertT = 2.2;
    useGame.getState().patch({ alert: "NEW MARK ON THE BOARDS" });
  }

  private render(dt: number) {
    const playing = useGame.getState().phase === "playing";
    if (playing) {
      const shake = this.trauma * this.trauma;
      this.camera.position.set(this.x + (Math.random() * 2 - 1) * shake * 0.35, this.y + Math.sin(this.bob) * 0.08, this.z);
      this.camera.quaternion.copy(this.orient);
      const flap = 0.35 + Math.sin(this.bob * 2.2) * 0.35;
      const lw = this.viewmodel.getObjectByName("wingL");
      const rw = this.viewmodel.getObjectByName("wingR");
      if (lw) lw.rotation.z = flap;
      if (rw) rw.rotation.z = -flap;
      this.poseShadow(flap);
    } else {
      this.body.visible = false;
      this.groundShadow.visible = false;
    }
    this.renderer.clear();
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
    if (playing) {
      this.renderer.clearDepth();
      this.renderer.render(this.overlayScene, this.overlayCam);
    }
    void dt;
  }

  begin() {
    unlockAudio();
    useGame.getState().start();
    this.score = 0;
    this.combo = 0;
    this.comboT = 0;
    this.time = 0;
    this.x = 0;
    this.y = 7.2;
    this.z = 16;
    this.setHorizon(0, -0.2);
    this.vx = this.vy = this.vz = 0;
    this.fireCd = 0;
    this.flockCd = 0;
    this.trauma = 0;
    this.eventT = 5;
    this.lock = null;
    this.lockSq = null;
    this.wanted = 0;
    this.health = 3;
    this.patron = loadSave().patron;
    this.jobs = jobList();
    this.jobI = 0;
    this.jobP = 0;
    this.groundedT = 0;
    this.ring.visible = false;
    this.flock.reset();
    this.mafia.reset();
    for (const d of this.drops) this.killDrop(d);
    for (const f of this.fries) f.taken = 0;
    this.applyLook();
    this.alertT = 3.4;
    useGame.getState().patch({ alert: this.jobs[0]?.radio ?? "Uncle Beaky: That's a cone. Don't think. Drop." });
    this.tryLock();
  }

  private jobMark(): { x: number; y: number; z: number } | null {
    const job = this.jobs[this.jobI];
    if (!job) return null;
    let best: { x: number; y: number; z: number } | null = null;
    let bestD = 1e9;
    const consider = (x: number, y: number, z: number) => {
      const d = (x - this.x) * (x - this.x) + (z - this.z) * (z - this.z);
      if (d < bestD) {
        bestD = d;
        best = { x, y, z };
      }
    };
    if (job.kind === "squirrel" || job.kind === "don") {
      for (const s of this.mafia.list) {
        if (!s.alive || s.hit) continue;
        if (job.kind === "don" && !s.boss) continue;
        consider(s.x, s.y, s.z);
      }
      return best;
    }
    for (const n of this.crowd.npcs) {
      if (!n.alive || n.hit) continue;
      if (job.kind === "custard" && n.kind !== "custard") continue;
      if (job.kind === "pol" && n.starRole !== "politician") continue;
      if (job.kind === "hits" && n.kind === "nap") continue;
      consider(n.x, n.y, n.z);
    }
    return best;
  }

  private jobArrow(): number {
    const m = this.jobMark();
    if (!m) return 0;
    const dx = m.x - this.x;
    const dz = m.z - this.z;
    const fx = this._fwd.x;
    const fz = this._fwd.z;
    const rx = this._fwd.z;
    const rz = -this._fwd.x;
    return Math.atan2(dx * rx + dz * rz, dx * fx + dz * fz);
  }

  private tickAmbientGulls(dt: number) {
    for (const o of this.ambient) {
      const u = o.userData as { a: number; r: number; y: number; s: number };
      u.a += dt * u.s;
      o.position.set(Math.cos(u.a) * u.r, u.y, Math.sin(u.a) * u.r * 1.8);
    }
  }

  private nudgeStory() {
    if (this.alertT > 0.4) return;
    const job = this.jobs[this.jobI];
    if (job?.kind === "custard") {
      for (const n of this.crowd.npcs) {
        if (n.alive && n.kind === "custard" && !n.hit && n.eat < 0.16) {
          this.alertT = 2.2;
          useGame.getState().patch({ alert: "SHE'S ABOUT TO FINISH THE CONE" });
          return;
        }
      }
    }
  }

  applyLook() {
    const save = loadSave();
    const skin = equippedSkin(save);
    this.dropMat.color.setHex(skin.drop);
    for (const m of this.plumage) m.color.setHex(skin.bird);
    this.flock.setLook(skin.bird, skin.drop, save.patron ? 12 : 8);
    this.flockMax = save.patron ? 8 : FLOCK_CD;
  }

  private setHorizon(yaw: number, pitch: number) {
    this._eul.set(pitch, yaw, 0, "YXZ");
    this.orient.setFromEuler(this._eul);
    this.syncLook();
  }

  private syncLook() {
    this._look.set(0, 0, -1).applyQuaternion(this.orient);
    this._right.set(1, 0, 0).applyQuaternion(this.orient);
    this._up.set(0, 1, 0).applyQuaternion(this.orient);
    this._fwd.set(this._look.x, 0, this._look.z);
    if (this._fwd.lengthSq() < 1e-5) this._fwd.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    this._fwd.normalize();
    if (this._look.x * this._look.x + this._look.z * this._look.z > 1e-5) {
      this.yaw = Math.atan2(-this._look.x, -this._look.z);
    }
    this.pitch = Math.asin(THREE.MathUtils.clamp(this._look.y, -1, 1));
  }

  private levelOut(dt: number) {
    this._qTgt.setFromEuler(this._eul.set(-0.18, this.yaw, 0, "YXZ"));
    this.orient.slerp(this._qTgt, 1 - Math.exp(-7 * dt));
    this.orient.normalize();
    this.syncLook();
  }

  private patronMult() {
    return this.patron ? 1.5 : 1;
  }

  private spawnFries() {
    const mat = new THREE.MeshStandardMaterial({ color: 0xf3e5ab, emissive: 0xf3e5ab, emissiveIntensity: 0.45, roughness: 0.5 });
    const geo = new THREE.BoxGeometry(0.35, 0.45, 0.35);
    for (let i = 0; i < 8; i++) {
      const mesh = new THREE.Mesh(geo, mat);
      const z = -160 + i * 42;
      const x = i % 2 === 0 ? -4.2 : 4.2;
      mesh.position.set(x, 2.7, z);
      this.scene.add(mesh);
      this.fries.push({ x, y: 2.7, z, taken: 0, mesh });
    }
  }

  private tickFries(dt: number) {
    for (const f of this.fries) {
      if (f.taken > 0) {
        f.taken -= dt;
        f.mesh.visible = f.taken <= 0;
        continue;
      }
      f.mesh.rotation.y += 0.04;
      f.mesh.position.y = 2.7 + Math.sin(this.time * 3 + f.z) * 0.15;
      const dx = this.x - f.x;
      const dz = this.z - f.z;
      const dy = this.y - f.y;
      if (dx * dx + dz * dz + dy * dy < 2.2 * 2.2) {
        f.taken = 18;
        f.mesh.visible = false;
        const pts = Math.round(250 * this.patronMult());
        this.score += pts;
        this.combo += 1;
        this.comboT = 2.4;
        this.particles.burst(f.x, f.y, f.z, 16, 0xf3e5ab, 3, 2);
        playBonus();
        this.alertT = 1.4;
        const callouts = [{ id: this.callId++, title: "BOARDWALK FRIES", pts }, ...useGame.getState().callouts].slice(0, 5);
        useGame.getState().patch({ score: this.score, combo: this.combo, callouts, alert: "STOLEN FRIES" });
      }
    }
  }

  tryLock() {
    try {
      const p = this.canvas.requestPointerLock();
      if (p && typeof (p as Promise<void>).catch === "function") (p as Promise<void>).catch(() => undefined);
    } catch {
      /* drag-look fallback */
    }
  }

  dispose() {
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    window.removeEventListener("resize", this.onResize);
    document.removeEventListener("pointerlockchange", this.onLock);
    document.removeEventListener("visibilitychange", this.onVis);
    this.input.dispose();
    bindGame(null);
    this.renderer.dispose();
  }

  private wireProbe() {
    window.__controlsTest = {
      getYaw: () => this.yaw,
      getSpeed: () => Math.hypot(this.vx, this.vz),
      getX: () => this.x,
      getZ: () => this.z,
      getUpY: () => this._up.y,
      getSquirrels: () => this.mafia.list.filter((s) => s.alive).length,
      nudgeLook: (x, y) => {
        this.input.lookDX += x;
        this.input.lookDY += y;
      },
      setKeys: (codes) => this.input.setKeys(codes),
      setSteer: (v) => {
        this.input.steerInject = v;
      },
    };
  }
}

function shadeGround(x: number, z: number) {
  if (onBoardwalk(x, z)) return BOARDWALK_Y + 0.07;
  if (x < -8) return 0.46;
  return BOARDWALK_Y + 0.07;
}

function makeWingShadow(): THREE.Mesh {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d");
  if (g) {
    g.clearRect(0, 0, 256, 256);
    g.fillStyle = "#0d0d10";
    g.beginPath();
    g.ellipse(128, 128, 28, 52, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(128, 118);
    g.quadraticCurveTo(40, 90, 18, 128);
    g.quadraticCurveTo(40, 150, 128, 138);
    g.fill();
    g.beginPath();
    g.moveTo(128, 118);
    g.quadraticCurveTo(216, 90, 238, 128);
    g.quadraticCurveTo(216, 150, 128, 138);
    g.fill();
    g.beginPath();
    g.moveTo(116, 170);
    g.lineTo(128, 210);
    g.lineTo(140, 170);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 3.4),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.45, depthWrite: false, fog: false }),
  );
  m.renderOrder = 2;
  m.rotation.x = -Math.PI / 2;
  return m;
}

function makeViewmodel(): THREE.Group {
  const wrap = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.5, metalness: 0.04 });
  const grey = new THREE.MeshStandardMaterial({ color: 0xc8c2b8, roughness: 0.42, metalness: 0.05 });
  const beak = new THREE.MeshStandardMaterial({ color: 0xe08932, roughness: 0.38 });
  const g = makeGullRig("fpv", white, grey, beak);
  g.position.set(0, -0.2, -0.38);
  g.rotation.x = 0.42;
  wrap.add(g);
  return wrap;
}

declare global {
  interface Window {
    __controlsTest?: {
      getYaw: () => number;
      getSpeed: () => number;
      getX: () => number;
      getZ: () => number;
      getUpY?: () => number;
      getSquirrels?: () => number;
      nudgeLook?: (x: number, y: number) => void;
      setKeys?: (codes: string[]) => void;
      setSteer?: (v: number) => void;
    };
  }
}

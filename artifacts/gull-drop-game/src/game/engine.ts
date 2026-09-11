import * as THREE from "three";
import { Input } from "./input";
import { Crowd, type Npc, type NpcKind } from "./npcs";
import { makeGullRig } from "./rigs";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { SMAAPass } from "three/examples/jsm/postprocessing/SMAAPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ParticlePool } from "./particles";
import { Flock } from "./flock";
import { buildWorld, districtName, onBoardwalk, tickWorldMotion, type Aabb, type World } from "./world";
import { useGame } from "./store";
import { playBonus, playHit, playPlop, playSquawk, playThump, playVictimReaction, resumeAudio, unlockAudio, type VictimReaction } from "./audio";
import { quoteFor } from "./reactions";
import { bindGame } from "./runtime";
import { track } from "./analytics";
import { fault } from "./log";
import { SquirrelMafia, type Squirrel } from "./squirrels";
import { jobList } from "./jobs";
import { equippedSkin, equippedWeapon, loadSave, writeSave } from "./progress";
import { TrafficManager } from "./traffic";
import { StrayCats } from "./stray-cats";
import { DogWalkers, type DogWalkerPair } from "./dog-walkers";
import { Sharks } from "./sharks";
import { TributeManager } from "./tribute";
import { AIGulls } from "./ai-gulls";
import { CourtshipManager } from "./courtship";
import { makeSquirrelRig } from "./rigs";
import { applyEnv, assetDiagnostics, configureTextureQuality } from "./assets";

type Drop = { alive: boolean; age: number; trailT: number; x: number; y: number; z: number; vx: number; vy: number; vz: number; mesh: THREE.Mesh };

const SENS = 0.0022;
const FLY_SPEED = 18;
const STRAFE_SPEED = 14;
const CLIMB_SPEED = 10;
const MIN_Y = 2.1;
const MAX_Y = 36;

/**
 * rayAabbEntryDistance — Returns the nearest distance where a finite ray segment
 * enters a padded building box, or null when the segment misses.
 *
 * @param origin - Camera-boom origin in world space.
 * @param direction - Normalized boom direction.
 * @param maxDistance - Desired boom length.
 * @param box - Building collision bounds.
 * @returns The nearest entry distance, or null when unobstructed.
 *
 * Business context: keeps the ground camera outside façades without allocating
 * temporary arrays or raycaster objects in the frame loop.
 */
function rayAabbEntryDistance(
  origin: THREE.Vector3,
  direction: THREE.Vector3,
  maxDistance: number,
  box: Aabb,
): number | null {
  let near = 0;
  let far = maxDistance;
  const padding = 0.25;

  const testAxis = (axisOrigin: number, axisDirection: number, min: number, max: number) => {
    if (Math.abs(axisDirection) < 1e-6) return axisOrigin >= min && axisOrigin <= max;
    const inverse = 1 / axisDirection;
    let entry = (min - axisOrigin) * inverse;
    let exit = (max - axisOrigin) * inverse;
    if (entry > exit) [entry, exit] = [exit, entry];
    near = Math.max(near, entry);
    far = Math.min(far, exit);
    return near <= far;
  };

  if (!testAxis(origin.x, direction.x, box.minX - padding, box.maxX + padding)) return null;
  if (!testAxis(origin.y, direction.y, box.minY - padding, box.maxY + padding)) return null;
  if (!testAxis(origin.z, direction.z, box.minZ - padding, box.maxZ + padding)) return null;
  return near >= 0 && near <= maxDistance ? near : null;
}
const FIRE_CD = 0.32;
const FLOCK_CD = 12;
const BOARDWALK_Y = 2.2;
const WORLD_UP = new THREE.Vector3(0, 1, 0);
const LOCAL_X = new THREE.Vector3(1, 0, 0);
const LOCAL_FWD = new THREE.Vector3(0, 0, -1);

type QualityTier = "high" | "medium" | "low";
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
  vip: ["HIGH ROLLER RINSED", "ROOFTOP WHALE"],
  pitboss: ["CRAPS BOSS JACKPOT", "HOUSE RULES REWRITTEN"],
  car: ["PARKING VALIDATED", "SEDAN SUNDAE"],
  bus: ["BUS LOAD BLESSED", "GAMBLER EXPRESS"],
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
  vip: 1800,
  pitboss: 8000,
  car: 700,
  bus: 1400,
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

  private crowd = new Crowd(() => this.random());

  private flock = new Flock(() => this.random());

  private mafia = new SquirrelMafia(() => this.random());

  private traffic = new TrafficManager(() => this.random());

  private strayCats = new StrayCats(() => this.random());

  private dogWalkers = new DogWalkers(() => this.random());

  private sharks = new Sharks(() => this.random());

  private tributes = new TributeManager();

  private aiGulls = new AIGulls(() => this.random());

  private courtship = new CourtshipManager(() => this.random());

  private mafiaPlayer: THREE.Group;

  private cameraBoom = new THREE.Group();

  private pYaw = 0;

  private pPitch = 0;

  private pAnim = 0;

  private mafiaActionT = 0;

  private mafiaActionCd = 0;

  private tributeUntil = new WeakMap<Npc, number>();

  private nestedColliders = new Set<number>();
  private roundNests: THREE.Group[] = [];

  private particles = new ParticlePool();

  private input: Input;

  private drops: Drop[] = [];

  private viewmodel: THREE.Group;

  /** Short-lived overlay pellet that visually bridges the vent to the world shot. */
  private viewmodelDrop: THREE.Mesh;

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

  private _v1 = new THREE.Vector3();

  private _v2 = new THREE.Vector3();

  private _v3 = new THREE.Vector3();

  private _q1 = new THREE.Quaternion();

  private x = 0;

  private y = 14;

  private z = 72;

  private vx = 0;

  private vy = 0;

  private vz = 0;

  private fireCd = 0;

  /** Brief rear-body lift used to make the drop action readable in chase view. */
  private poopPoseT = 0;

  private flockCd = 0;

  private comboT = 0;

  private combo = 0;

  private score = 0;

  private time = 0;

  private activeTimeouts: number[] = [];

  private trauma = 0;

  private hitstop = 0;

  private sharkTraumaCd = 0;

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

  private rngState = 0x6d2b79f5;

  private perfAcc = 0;

  private perfFrames = 0;

  private perfFrameMs = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.quality = chooseQuality();
    const budget = RENDER_BUDGETS[this.quality];
    // The chase gull lives on layer 2 so it can cast independently controlled shadows.
    this.camera.layers.enable(2);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: this.quality !== "low", alpha: false, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, budget.pixelRatio));
    this.renderer.setClearColor(0xc4b090, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.autoClear = false;
    this.renderer.shadowMap.enabled = budget.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    configureTextureQuality(this.renderer, budget.anisotropy);
    this.setTrafficQuality();

    this.world = buildWorld(this.scene);
    // World construction may request textures after the renderer policy is established.
    configureTextureQuality(this.renderer, budget.anisotropy);
    // Exposed only as a lightweight browser diagnostic, not a per-frame UI update.
    // Composer and overlay can each issue renders; account for their combined work per frame.
    this.renderer.info.autoReset = false;
    applyEnv(this.renderer, this.scene);
    this.crowd.spawnAll(this.world.benches, this.world.photoSpot, this.world.kiosk, this.world.rooftopTargets);
    this.crowd.seatRides(this.world.ferrisCars, this.world.coasterCar, this.world.carousel);
    this.mafia.spawnAll();
    this.strayCats.spawnAll();
    this.dogWalkers.spawnAll();
    this.sharks.spawnAll();
    this.scene.add(this.crowd.group);
    this.scene.add(this.mafia.group);
    this.scene.add(this.traffic.group);
    this.scene.add(this.strayCats.group);
    this.scene.add(this.dogWalkers.group);
    this.scene.add(this.sharks.group);
    this.scene.add(this.tributes.group);
    this.scene.add(this.aiGulls.group);
    this.scene.add(this.courtship.group);

    this.mafiaPlayer = makeSquirrelRig(false);
    this.mafiaPlayer.visible = false;
    this.scene.add(this.mafiaPlayer);
    this.scene.add(this.cameraBoom);
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
    // Keep the entire bird below the reticle: head, wings, body, and tail remain
    // visible without covering the target or clipping through the camera.
    this.viewmodel.scale.setScalar(0.38);
    this.viewmodel.position.set(0, -0.42, -1.9);
    this.viewmodel.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.material && (m.material as THREE.MeshStandardMaterial).color) {
        const mat = m.material as THREE.MeshStandardMaterial;
        if (mat.color.getHex() === 0xf4f1ea || mat.color.getHex() === 0xc8c2b8) this.plumage.push(mat);
      }
    });
    this.overlayScene.add(this.viewmodel);
    this.viewmodelDrop = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.72 }),
    );
    this.viewmodelDrop.visible = false;
    this.overlayScene.add(this.viewmodelDrop);
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

    this.configurePostprocessing();

    this.input = new Input(canvas);
    this.buildDrops();
    this.spawnFries();
    this.applyLook();
    this.resize();
    window.addEventListener("resize", this.onResize);
    this.resizeObserver = new ResizeObserver(this.onResize);
    this.resizeObserver.observe(canvas);
    window.visualViewport?.addEventListener("resize", this.onResize);
    document.addEventListener("pointerlockchange", this.onLock);
    document.addEventListener("visibilitychange", this.onVis);
    bindGame(this);
    this.wireProbe();
    this.last = performance.now();
    this.renderer.setAnimationLoop(this.loop);
  }

  private onResize = () => this.resize();
  private resizeObserver?: ResizeObserver;

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
      this.drops.push({ alive: false, age: 0, trailT: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, mesh });
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
    this.composer?.setPixelRatio(Math.min(window.devicePixelRatio || 1, RENDER_BUDGETS[this.quality].pixelRatio));
  }

  private loop = (now: number) => {
    if (this.disposed) return;
    try {
      const raw = (now - this.last) / 1000;
      if (raw > 0.05) this.jank += 1;
      else this.jank = Math.max(0, this.jank - 1);
      const dt = Math.min(raw, 0.05);
      this.last = now;
      this.update(dt);
      this.render(dt);
      this.sampleWorldMetrics(raw);
    } catch (err) {
      fault("error", "frame", err);
    }
  };

  private goLean() {
    const next: Record<QualityTier, QualityTier> = { high: "medium", medium: "low", low: "low" };
    const tier = next[this.quality];
    if (tier === this.quality) return;
    this.lean = tier === "low";
    this.quality = tier;
    this.qualityDowngrades++;
    const budget = RENDER_BUDGETS[tier];
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, budget.pixelRatio));
    this.renderer.shadowMap.enabled = budget.shadows;
    configureTextureQuality(this.renderer, budget.anisotropy);
    this.setTrafficQuality();
    this.configurePostprocessing();
    this.resize();
    fault("warn", `Rendering quality reduced to ${tier} to preserve responsiveness`);
  }

  private sampleWorldMetrics(rawDt: number) {
    this.perfAcc += rawDt;
    this.perfFrames++;
    this.perfFrameMs += rawDt * 1000;
    if (this.perfAcc < 5) return;
    const averageFrameMs = this.perfFrameMs / this.perfFrames;
    const budget = RENDER_BUDGETS[this.quality];
    // A five-second sample prevents transient loading/GC spikes from changing quality.
    if (averageFrameMs > budget.targetFrameMs) this.slowQualityWindows++;
    else this.slowQualityWindows = Math.max(0, this.slowQualityWindows - 1);
    this.qualityCooldown = Math.max(0, this.qualityCooldown - this.perfAcc);
    if (this.slowQualityWindows >= 2 && this.qualityCooldown <= 0 && this.quality !== "low") {
      this.goLean();
      this.slowQualityWindows = 0;
      // Require another full sustained interval before a subsequent downgrade.
      this.qualityCooldown = 10;
    }
    const info = this.renderer.info.render;
    const metrics = {
      fps: Math.round((this.perfFrames / this.perfAcc) * 10) / 10,
      frameMs: Math.round(averageFrameMs * 10) / 10,
      calls: info.calls,
      triangles: info.triangles,
      cityInstances: this.world.metrics.instances,
      animatedCityNodes: this.world.metrics.animatedNodes,
      quality: this.quality,
      budget: RENDER_BUDGETS[this.quality],
      qualityDowngrades: this.qualityDowngrades,
      slowQualityWindows: this.slowQualityWindows,
      qualityCooldown: Math.round(this.qualityCooldown * 10) / 10,
      assets: assetDiagnostics(),
    };
    (window as Window & { __gullWorldMetrics?: typeof metrics }).__gullWorldMetrics = metrics;
    (window as Window & { __gullRenderDiagnostics?: typeof metrics }).__gullRenderDiagnostics = metrics;
    this.perfAcc = 0;
    this.perfFrames = 0;
    this.perfFrameMs = 0;
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
    tickWorldMotion(this.world, this.time + this.attractT, dt);
    this.tickAmbientGulls(dt);
    this.crowd.update(st.phase === "paused" ? 0 : dt);
    this.dogWalkers.update(st.phase === "paused" ? 0 : dt);
    if (st.phase === "playing") {
      this.traffic.update(dt);
      this.strayCats.update(dt, this.x, this.y, this.z, st.mode);
      this.sharks.update(dt, this.x, this.y, this.z, st.mode);
      this.tributes.update(dt, this.time);
      this.aiGulls.update(dt, this.x, this.y, this.z, this.time);
      const reducedMotion =
        typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      this.courtship.update(dt, {
        reducedMotion: reducedMotion || this.quality === "low"
      });
    }
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
      this.mafiaPlayer.visible = false;
      this.body.visible = false;
      this.groundShadow.visible = false;
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

    if (useGame.getState().mode === "mafia" && (this.time >= 90 || this.health <= 0)) {
      if (useGame.getState().phase === "playing") {
        document.exitPointerLock();
        useGame.getState().end();
      }
      return;
    }

    const frenzy = this.wanted >= 4;
    this.comboT = Math.max(0, this.comboT - dt);
    if (this.comboT <= 0) this.combo = 0;
    this.fireCd = Math.max(0, this.fireCd - dt);
    this.poopPoseT = Math.max(0, this.poopPoseT - dt);
    this.flockCd = Math.max(0, this.flockCd - dt);
    this.trauma = Math.max(0, this.trauma - dt * 1.8);
    this.sharkTraumaCd = Math.max(0, this.sharkTraumaCd - dt);
    const mode = useGame.getState().mode;

    if (mode === "mafia") {
      this.mafiaPlayer.visible = true;
      this.body.visible = false;
      this.groundShadow.visible = false;
      this.viewmodel.visible = false;
    } else {
      this.mafiaPlayer.visible = false;
      this.body.visible = true;
      this.groundShadow.visible = true;
      this.viewmodel.visible = true;
    }

    this.alertT = Math.max(0, this.alertT - dt);
    this.flash = Math.max(0, this.flash - dt * 4);
    this.wantedDecay -= dt;
    if (this.wantedDecay <= 0 && this.wanted > 0) {
      this.wanted -= 1;
      this.wantedDecay = mode === "mafia" ? 6 : 10;
      useGame.getState().patch({ wanted: this.wanted });
    }
    if (mode === "gull" && this.x >= -24) {
      this.wantedDecay = 12; // In gull mode, wanted only decays over the water (x < -24)
    }

    this.eventT -= dt;
    if (this.eventT <= 0) {
      this.eventT = 7 + this.random() * 6;
      this.specialEvent();
    }


    const look = this.input.consumeLook();
    const touchLook = useGame.getState().consumeLook();
    const mx = look.x + touchLook.x;
    const my = look.y + touchLook.y;

    const touch = useGame.getState().touch;
    const throttle = THREE.MathUtils.clamp(this.input.throttle() + touch.moveY, -1, 1);
    const strafe = THREE.MathUtils.clamp(this.input.strafe() + touch.moveX, -1, 1);
    const climb = THREE.MathUtils.clamp(this.input.climb() + touch.climb, -1, 1);

    if (useGame.getState().mode === "gull") {
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

      if (climb > 0 && this.vy < -5) {
        this.trauma = Math.min(1, this.trauma + climb * 2.0 * Math.min(1, Math.abs(this.vy) / 20) * dt);
      }

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
      this.x = THREE.MathUtils.clamp(this.x, -70, 104);
      this.z = THREE.MathUtils.clamp(this.z, -230, 230);
      this.y = THREE.MathUtils.clamp(this.y, MIN_Y, 44);
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

      const cat = this.strayCats.hitTest(this.x, this.y, this.z, 2.4);
      if (cat) {
        this.particles.burst(this.x, this.y, this.z, 20, 0xc45c4a, 4, 1.5);
        track("cat_threat", { mode: "gull", stolen: 0 });
        this.onAcornHit();
      }

      if (this.sharkTraumaCd <= 0 && this.sharks.consumeAttack(this.x, this.y, this.z, 0.4)) {
        this.sharkTraumaCd = 1.0;
        this.particles.burst(this.x, this.y, this.z, 30, 0xc4cacc, 6, 2.5); // dramatic splash particles
        playThump(); // using thump/impact for splash
        track("shark_attack", { mode: "gull" });
        this.onSharkHit();
      }
    } else {
      // Mafia Mode Updates
      this.updateMafiaMode(dt, mx, my, throttle, strafe);
    }


    this.hudAcc += dt;
    if (this.hudAcc > 0.16) {
      this.hudAcc = 0;
      const g = useGame.getState();
      const bombAim = this.projectBombImpact();
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
        bombAimX: bombAim.x,
        bombAimY: bombAim.y,
        bombAimVisible: bombAim.visible,
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

  /** Projects the current gravity-driven drop trajectory into HUD percentages. */
  private projectBombImpact(): { x: number; y: number; visible: boolean } {
    const rear = this._v1.set(0, 0, 1).applyQuaternion(this.orient);
    const down = this._v2.set(0, -1, 0).applyQuaternion(this.orient);
    const startX = this.x + rear.x * 0.46 + down.x * 0.34;
    const startY = this.y + rear.y * 0.46 + down.y * 0.34;
    const startZ = this.z + rear.z * 0.46 + down.z * 0.34;
    const dropVx = this.vx * 0.94;
    const dropVy = Math.min(-1.8, this.vy * 0.28);
    const dropVz = this.vz * 0.94;

    let impactX = startX;
    let impactZ = startZ;
    let groundY = this.shadeGround(impactX, startY, impactZ);
    let flightTime = 0;
    // Two passes account for the predicted point crossing between beach,
    // boardwalk, and pier surfaces without running a full projectile simulation.
    for (let pass = 0; pass < 2; pass += 1) {
      const altitude = Math.max(0.05, startY - groundY);
      flightTime = (dropVy + Math.sqrt(dropVy * dropVy + 52 * altitude)) / 26;
      impactX = startX + dropVx * flightTime;
      impactZ = startZ + dropVz * flightTime;
      groundY = this.shadeGround(impactX, startY, impactZ);
    }

    const projected = new THREE.Vector3(impactX, groundY + 0.08, impactZ).project(this.camera);
    return {
      x: THREE.MathUtils.clamp((projected.x * 0.5 + 0.5) * 100, 5, 95),
      y: THREE.MathUtils.clamp((-projected.y * 0.5 + 0.5) * 100, 8, 88),
      visible: projected.z >= -1 && projected.z <= 1,
    };
  }

  private shoot() {
    this.fireCd = FIRE_CD;
    this.poopPoseT = 0.28;
    this.viewmodelDrop.visible = true;
    playPlop();
    playSquawk();
    this.trauma = Math.min(1, this.trauma + 0.11);
    const slot = this.drops.find((d) => !d.alive);
    if (!slot) return;
    const rear = this._v1.set(0, 0, 1).applyQuaternion(this.orient);
    const down = this._v2.set(0, -1, 0).applyQuaternion(this.orient);
    slot.alive = true;
    slot.age = 0;
    slot.trailT = 0;
    slot.x = this.x + rear.x * 0.46 + down.x * 0.34;
    slot.y = this.y + rear.y * 0.46 + down.y * 0.34;
    slot.z = this.z + rear.z * 0.46 + down.z * 0.34;

    // Gull drops behave like bombs rather than bullets: they inherit horizontal
    // flight momentum and immediately fall from the rear vent under gravity.
    slot.vx = this.vx * 0.94;
    slot.vy = Math.min(-1.8, this.vy * 0.28);
    slot.vz = this.vz * 0.94;
    slot.mesh.visible = true;
    slot.mesh.position.set(slot.x, slot.y, slot.z);
  }

  private updateDrops(dt: number) {
    for (const d of this.drops) {
      if (!d.alive) continue;
      d.age += dt;
      d.trailT -= dt;
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
      const dwHit = this.dogWalkers.hitTest(nx, ny, nz, 0.16);
      if (dwHit) {
        this.onDogWalkerHit(dwHit.pair, dwHit.target, nx, ny, nz);
        this.killDrop(d);
        continue;
      }
      const sq = this.mafia.hitTest(nx, ny, nz, 0.16);
      if (sq) {
        this.onSquirrelHit(sq, nx, ny, nz, false);
        this.killDrop(d);
        continue;
      }
      const vehicle = this.traffic.hitTest(nx, ny, nz, 0.16);
      if (vehicle) {
        this.onTrafficHit(vehicle.kind, nx, ny, nz);
        this.traffic.hit(vehicle);
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
      if (d.age < 0.42 && d.trailT <= 0) {
        d.trailT = 0.055;
        this.particles.drip(nx, ny + 0.08, nz, d.vx, d.vy, d.vz);
      }
      const si = this.drops.indexOf(d);
      const sh = this.dropShade[si];
      if (sh) {
        const alt = Math.max(0.05, ny - BOARDWALK_Y);
        sh.visible = true;
        sh.position.set(nx + alt * 0.14, this.shadeGround(nx, ny, nz), nz - alt * 0.05);
        sh.scale.setScalar(0.65 + Math.min(1.8, alt * 0.14));
        (sh.material as THREE.MeshBasicMaterial).opacity = 0.34 * (1 - Math.min(0.75, alt / 16));
      }
    }
  }

  private updateMafiaMode(dt: number, mx: number, my: number, throttle: number, strafe: number) {
    const st = useGame.getState();
    const touch = st.touch;
    const walkSpeed = 6;

    // Camera boom rotation
    this.pYaw -= mx * 0.005;
    this.pPitch -= my * 0.005;
    this.pPitch = THREE.MathUtils.clamp(this.pPitch, -1.2, 0.85);

    // Movement relative to camera
    const wish = this._v1.set(strafe, 0, -throttle);
    if (wish.lengthSq() > 1) wish.normalize();
    const moving = wish.lengthSq() > 0;

    if (moving) {
      const q = this._q1.setFromAxisAngle(WORLD_UP, this.pYaw);
      wish.applyQuaternion(q);

      this.vx = wish.x * walkSpeed;
      this.vz = wish.z * walkSpeed;
      this.pAnim += dt * 15;

      // Face movement direction
      this.yaw = Math.atan2(this.vx, this.vz);
    } else {
      this.vx *= 0.8;
      this.vz *= 0.8;
      this.pAnim = 0;
    }

    const queuedAction = this.input.consumeMafiaAction() ?? touch.mafiaAction;
    if (touch.mafiaAction) st.setTouch({ mafiaAction: null });
    this.mafiaActionCd = Math.max(0, this.mafiaActionCd - dt);
    this.mafiaActionT = Math.max(0, this.mafiaActionT - dt);

    const groundedY = this.shadeGround(this.x, this.y, this.z);
    const grounded = this.y <= groundedY + 0.04;
    if (grounded) {
      this.y = groundedY;
      if (this.vy < 0) this.vy = 0;
    }

    if (queuedAction === "jump" && grounded) {
      this.vy = 8.5;
      this.mafiaActionT = 0.55;
    } else if (queuedAction === "pounce" && this.mafiaActionCd <= 0) {
      const forward = this.mafiaForward(this._v3);
      this.vx = forward.x * 13;
      this.vz = forward.z * 13;
      this.vy = Math.max(this.vy, 5.5);
      this.mafiaActionT = 0.5;
      this.mafiaActionCd = 0.8;
    } else if ((queuedAction === "climb" || this.input.down("KeyC")) && this.nearClimbableIndex() >= 0) {
      this.vy = 6;
      this.vx *= 0.2;
      this.vz *= 0.2;
      this.mafiaActionT = 0.45;
    }

    this.vy -= 19 * dt;
    this.x += this.vx * dt;
    this.z += this.vz * dt;
    const destinationGround = this.shadeGround(this.x, this.y, this.z);
    this.y = Math.max(destinationGround, this.y + this.vy * dt);

    this.x = THREE.MathUtils.clamp(this.x, -70, 104);
    this.z = THREE.MathUtils.clamp(this.z, -230, 230);
    this.resolveBuildings();

    this.mafiaPlayer.position.set(this.x, this.y, this.z);

    // Animate limbs
    const bodyRoot = this.mafiaPlayer.getObjectByName("bodyRoot");
    if (bodyRoot) bodyRoot.position.y = 0.25 - Math.abs(Math.sin(this.pAnim)) * 0.05;

    const armL = this.mafiaPlayer.getObjectByName("armL");
    const armR = this.mafiaPlayer.getObjectByName("armR");
    const legL = this.mafiaPlayer.getObjectByName("legL");
    const legR = this.mafiaPlayer.getObjectByName("legR");
    const thighL = this.mafiaPlayer.getObjectByName("thighL");
    const thighR = this.mafiaPlayer.getObjectByName("thighR");
    const calfL = this.mafiaPlayer.getObjectByName("calfL");
    const calfR = this.mafiaPlayer.getObjectByName("calfR");
    if (armL) armL.rotation.x = -Math.PI / 2 + Math.sin(this.pAnim) * 0.5;
    if (armR) armR.rotation.x = Math.sin(this.pAnim + Math.PI) * 0.5;
    if (legL) legL.rotation.x = 0;
    if (legR) legR.rotation.x = 0;
    if (thighL) thighL.rotation.x = -0.4 - Math.sin(this.pAnim) * 0.25;
    if (thighR) thighR.rotation.x = -0.4 + Math.sin(this.pAnim) * 0.25;
    if (calfL) calfL.rotation.x = 0.4 + Math.sin(this.pAnim) * 0.15;
    if (calfR) calfR.rotation.x = 0.4 - Math.sin(this.pAnim) * 0.15;

    const tailBase = this.mafiaPlayer.getObjectByName("tailBase");
    if (tailBase) {
      tailBase.rotation.y = 0.25 + Math.sin(this.time * 2.5) * 0.15;
      tailBase.rotation.z = Math.sin(this.time * 2.5) * 0.1;
    }

    if (this.mafiaActionT > 0) {
      if (bodyRoot) bodyRoot.rotation.x = queuedAction === "pounce" ? -0.8 : -0.25;
    } else if (bodyRoot) {
      bodyRoot.rotation.x = 0;
    }

    // Use the same YXZ frame for camera and movement so pitch never changes ground heading.
    this.cameraBoom.position.set(this.x, this.y + 1, this.z);
    this.cameraBoom.rotation.set(this.pPitch, this.pYaw, 0, "YXZ");
    this.cameraBoom.updateMatrixWorld(true);
    // Face the travel direction while moving so the squirrel never moonwalks.
    // At rest, return to camera aim so the visible gun and its projectile agree.
    if (!moving) this.yaw = this.pYaw;
    this.mafiaPlayer.rotation.y = this.yaw;

    this.camera.position.copy(this.cameraBoom.position);
    const offset = this._v2.set(0, 0.5, 4);
    offset.applyMatrix4(this.cameraBoom.matrixWorld);

    // Clip the complete boom segment so long façades cannot swallow the camera.
    const camDir = this._v3.subVectors(offset, this.cameraBoom.position);
    const camDist = camDir.length();
    camDir.normalize();

    let closestClip = camDist;
    for (const b of this.world.colliders) {
      const hitDistance = rayAabbEntryDistance(this.cameraBoom.position, camDir, closestClip, b);
      if (hitDistance !== null) closestClip = Math.max(0.35, hitDistance - 0.2);
    }

    this.camera.position.copy(this.cameraBoom.position).addScaledVector(camDir, closestClip);
    this.camera.lookAt(this.x, this.y + 1, this.z);

        // Acorn shooting
    const nextStats = { ...st.mafiaStats };
    let didShoot = false;
    let bankAlert = null;
    let gainedWanted = 0;

    if ((this.input.consumeFire() || touch.fire) && this.fireCd <= 0) {
      const weapon = equippedWeapon(loadSave());
      this.fireCd = weapon.fireDelay;
      nextStats.acornCd = this.fireCd;
      this.shootAcorn();
      didShoot = true;
      if (this.random() < 0.2) gainedWanted++;
    }

    // Interaction
    const interactBtn = this.input.consumeInteract() || touch.interact;
    if (touch.interact) st.setTouch({ interact: false });

    let prompt = null;
    const trib = this.tributes.hitTest(this.x, this.y, this.z, 2.5);
    const dx = this.x - this.world.den.x;
    const dz = this.z - this.world.den.z;
    const nearDen = Math.hypot(dx, dz) < 4;
    const nearbyHuman = !trib && !nearDen ? this.nearestHuman(3.2) : null;
    if (nearbyHuman) {
      const alreadyAsked = (this.tributeUntil.get(nearbyHuman) ?? 0) > this.time;
      prompt = alreadyAsked ? "Tribute settled · Q scratch · R bite" : "Press E to demand food tribute · Q scratch · R bite";
      if (interactBtn) {
        if (alreadyAsked) {
          bankAlert = "THIS TARGET ALREADY PAID OR REFUSED";
        } else {
        this.tributeUntil.set(nearbyHuman, this.time + 30);
        const paid = this.random() < 0.58;
        this.crowd.glance(nearbyHuman);
        if (paid) {
          const amount = 35 + Math.floor(this.random() * 40);
          nextStats.unbanked += amount;
          nextStats.chain += 1;
          nextStats.maxChain = Math.max(nextStats.maxChain, nextStats.chain);
          nextStats.chainTimer = 6;
          bankAlert = `TRIBUTE PAID · ${amount} RESPECT`;
          track("human_tribute", { result: "paid", amount });
        } else {
          bankAlert = "TRIBUTE DENIED · ATTACK OR MOVE ON";
          gainedWanted++;
          track("human_tribute", { result: "denied" });
        }
        }
      }
    }

    if ((queuedAction === "scratch" || queuedAction === "bite") && this.mafiaActionCd <= 0) {
      const reward = this.mafiaMelee(queuedAction);
      this.mafiaActionCd = queuedAction === "bite" ? 0.75 : 0.45;
      this.mafiaActionT = 0.35;
      if (reward > 0) {
        nextStats.unbanked += reward;
        nextStats.chain += 1;
        nextStats.maxChain = Math.max(nextStats.maxChain, nextStats.chain);
        nextStats.chainTimer = 6;
        gainedWanted += queuedAction === "bite" ? 2 : 1;
        bankAlert = `${queuedAction.toUpperCase()} · ${reward} RESPECT`;
      }
    }

    if (queuedAction === "nest" && this.mafiaActionCd <= 0) {
      const nestTarget = this.nearClimbableIndex();
      if (nestTarget >= 0 && !this.nestedColliders.has(nestTarget)) {
        this.nestedColliders.add(nestTarget);
        this.buildVisibleNest();
        nextStats.unbanked += 100;
        nextStats.chain += 1;
        nextStats.maxChain = Math.max(nextStats.maxChain, nextStats.chain);
        nextStats.chainTimer = 6;
        this.mafiaActionCd = 2;
        this.mafiaActionT = 1.2;
        bankAlert = "TARGET NESTED · 100 RESPECT";
        this.particles.burst(this.x, this.y + 1, this.z, 24, 0x8b5a2b, 3, 1.2);
        track("nest_built", { mode: "mafia" });
      } else {
        bankAlert = nestTarget >= 0 ? "THIS TARGET ALREADY HAS A NEST" : "FIND A WALL, GATE, OR PIER SUPPORT";
      }
    }
    if (trib) {
      const isTaffyShop = trib.kind === "taffy-shop";
      prompt = isTaffyShop
        ? "Inside Taffy Shop · Press E to demand peanuts for protection"
        : `Press E to collect ${trib.amount} respect`;
      if (interactBtn) {
        track("tribute_collect", { amount: trib.amount, location: isTaffyShop ? "taffy-shop" : "boardwalk" });
        this.tributes.collect(trib);
        nextStats.chain += 1;
        nextStats.maxChain = Math.max(nextStats.maxChain, nextStats.chain);
        nextStats.unbanked += trib.amount * Math.min(nextStats.chain, 5);
        nextStats.chainTimer = 6;
        gainedWanted++;
        bankAlert = isTaffyShop
          ? `PROTECTION PAID · ${trib.amount} PEANUTS`
          : `TRIBUTE COLLECTED · ${trib.amount} RESPECT`;

        this.particles.burst(this.x, this.y + 1, this.z, 15, 0xc49a6a, 4, 1.5);
      }
    }

    // Chain decay
    if (nextStats.chain > 0) {
      nextStats.chainTimer -= dt;
      if (nextStats.chainTimer <= 0) {
        nextStats.chain = 0;
        nextStats.chainTimer = 0;
      }
    }

    // Bank check (e.g. den)
    if (nearDen) {
      prompt = "Press E to Bank Respect";
      if (interactBtn && nextStats.unbanked > 0) {
        nextStats.banked += nextStats.unbanked;
        nextStats.unbanked = 0;
        nextStats.chain = 0;
        nextStats.chainTimer = 0;
        bankAlert = "RESPECT BANKED";
        this.particles.burst(this.x, this.y + 2, this.z, 30, 0xc9a227, 6, 2);
      }
    }

    // Cat interaction
    const cat = this.strayCats.hitTest(this.x, this.y, this.z, 1.5);
    let catWarning = false;
    if (cat) {
      catWarning = true;
      this.trauma = Math.min(1, this.trauma + 0.4);
      this.health -= 1;
      this.flash = 0.5;
      this.hitstop = 0.1;

      const stolen = Math.min(nextStats.unbanked, 50);
      track("cat_threat", { mode: "mafia", stolen });
      if (nextStats.unbanked > 0) {
         nextStats.unbanked -= stolen;
      }
      nextStats.chain = 0;
      nextStats.chainTimer = 0;
      bankAlert = "CAT ATTACK - RESPECT LOST";
    }

    nextStats.prompt = prompt;
    nextStats.catWarning = catWarning;

    // AI Gulls hit test inside updateMafiaAcorns
    // We need to return points from updateMafiaAcorns
    const aiPts = this.updateMafiaAcorns(dt);
    if (aiPts > 0) {
      nextStats.unbanked += aiPts;
      nextStats.chainTimer = 6; // refresh chain on shootdown
    }

    if (gainedWanted > 0) this.bumpWanted(gainedWanted);

    this.score = nextStats.banked + nextStats.unbanked;
    const updates: any = { mafiaStats: nextStats, score: this.score };
    if (bankAlert) {
      updates.alert = bankAlert;
      updates.combo = 0;
    }
    st.patch(updates);
  }

  private updateMafiaAcorns(dt: number): number {
    let aiPts = 0;
    for (const d of this.drops) {
      if (!d.alive) continue;
      d.age += dt;
      d.vy -= 12 * dt;
      const nx = d.x + d.vx * dt;
      const ny = d.y + d.vy * dt;
      const nz = d.z + d.vz * dt;

      const aiGull = this.aiGulls.hitTest(nx, ny, nz, 1.0);
      if (aiGull) {
        const weapon = equippedWeapon(loadSave());
        if (weapon.effect === "fizz") {
          const grounded = this.aiGulls.groundInRadius(nx, ny, nz, 7);
          aiPts += grounded * 160;
          this.particles.burst(nx, ny, nz, 42, 0xb9fff4, 7, 2.8);
          track("fizz_bomb_detonated", { grounded });
        } else {
          this.aiGulls.kill(aiGull);
          aiPts += 200 * weapon.damage;
          this.particles.burst(aiGull.x, aiGull.y, aiGull.z, 20, 0xf4f1ea, 5, 2);
        }
        this.killDrop(d);
        track("acorn_hit_gull", { mode: "mafia" });
        continue;
      }

      const human = this.crowd.hitTest(nx, ny, nz, 0.3);
      if (human) {
        this.crowd.reactHit(human.npc, "ACORN ENFORCEMENT");
        this.killDrop(d);
        aiPts += 60 * equippedWeapon(loadSave()).damage;
        this.bumpWanted(1);
        this.particles.burst(nx, ny, nz, 12, 0x6a3a18, 3, 1.5);
        track("acorn_hit_human", { mode: "mafia" });
        continue;
      }

      if (this.hitBuilding(nx, ny, nz) || ny < this.shadeGround(nx,ny,nz)) {
        const weapon = equippedWeapon(loadSave());
        if (weapon.effect === "fizz") {
          const grounded = this.aiGulls.groundInRadius(nx, ny, nz, 7);
          aiPts += grounded * 160;
          this.particles.burst(nx, ny, nz, 42, 0xb9fff4, 7, 2.8);
          track("fizz_bomb_detonated", { grounded });
        } else {
          this.particles.burst(nx, ny, nz, 8, 0x6a3a18, 2, 1);
        }
        this.strayCats.scare(nx, nz);
        this.killDrop(d);
        continue;
      }

      d.x = nx; d.y = ny; d.z = nz;
      d.mesh.position.set(nx, ny, nz);
    }
    return aiPts;
  }

  private shootAcorn() {
    const slot = this.drops.find((d) => !d.alive);
    if (!slot) return;

    this.cameraBoom.updateMatrixWorld(true);
    const dir = this._v1.set(0, 0, -1).transformDirection(this.cameraBoom.matrixWorld);
    this.yaw = Math.atan2(dir.x, dir.z); // Turn the visible gun toward mouse aim before spawning its projectile.

    slot.alive = true;
    slot.age = 0;
    slot.x = this.x + dir.x * 1.15;
    slot.y = this.y + 1.05;
    slot.z = this.z + dir.z * 1.15;
    const weapon = equippedWeapon(loadSave());
    slot.vx = dir.x * weapon.velocity;
    slot.vy = dir.y * weapon.velocity + 6;
    slot.vz = dir.z * weapon.velocity;
    (slot.mesh.material as THREE.MeshLambertMaterial).color.setHex(weapon.color);
    slot.mesh.visible = true;
    slot.mesh.position.set(slot.x, slot.y, slot.z);
  }

  /** Creates a persistent round-owned twig nest at the accepted build position. */
  private buildVisibleNest(): void {
    const nest = new THREE.Group();
    const twigMaterial = new THREE.MeshStandardMaterial({ color: 0x5a3b22, roughness: 1 });
    const liningMaterial = new THREE.MeshStandardMaterial({ color: 0x9b7448, roughness: 1 });
    const base = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.13, 7, 18), twigMaterial);
    base.rotation.x = Math.PI / 2;
    const lining = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.43, 0.1, 12), liningMaterial);
    lining.position.y = -0.03;
    nest.add(base, lining);
    for (let index = 0; index < 8; index++) {
      const twig = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 1.05, 5), twigMaterial);
      twig.rotation.z = Math.PI / 2;
      twig.rotation.y = (index / 8) * Math.PI;
      twig.position.y = 0.08 + (index % 2) * 0.04;
      nest.add(twig);
    }
    nest.position.set(this.x, this.y + 0.18, this.z);
    nest.rotation.y = this.pYaw;
    nest.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.isMesh) mesh.castShadow = true;
    });
    this.scene.add(nest);
    this.roundNests.push(nest);
  }

  /**
   * mafiaForward — Computes the squirrel's canonical world-space facing vector.
   *
   * @param target - Reusable vector that receives the result.
   * @returns The normalized horizontal direction matching the rig's local +Z face.
   *
   * Business context: locomotion, muzzle direction, pounces, and melee must agree
   * so the squirrel never walks or attacks backwards.
   */
  private mafiaForward(target: THREE.Vector3): THREE.Vector3 {
    return target.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)).normalize();
  }

  /**
   * nearestHuman — Finds the nearest active pedestrian in interaction range.
   *
   * @param radius - Maximum horizontal targeting distance.
   * @returns The nearest eligible NPC, or null when nobody can be targeted.
   *
   * Business context: Mafia squirrels demand food from people rather than from
   * anonymous pickup boxes, while mounted riders remain invalid tribute targets.
   */
  private nearestHuman(radius: number): Npc | null {
    let nearest: Npc | null = null;
    let best = radius * radius;
    for (const npc of this.crowd.inRadius(this.x, this.z, radius, null)) {
      if (npc.kind === "rider" || npc.kind === "swimmer") continue;
      const distance = (npc.x - this.x) ** 2 + (npc.z - this.z) ** 2;
      if (distance < best) {
        best = distance;
        nearest = npc;
      }
    }
    return nearest;
  }

  /**
   * mafiaMelee — Resolves a scratch or bite against a person in front of the player.
   *
   * @param kind - Scratch has more reach; bite grants more respect.
   * @returns Respect awarded for a successful hit.
   *
   * Business context: denied tribute can be enforced with readable close-range
   * actions without sending Mafia points through Gull scoring or blotter stats.
   */
  private mafiaMelee(kind: "scratch" | "bite"): number {
    const target = this.nearestHuman(kind === "scratch" ? 2.6 : 1.8);
    if (!target) return 0;
    const toTarget = this._v2.set(target.x - this.x, 0, target.z - this.z).normalize();
    if (toTarget.dot(this.mafiaForward(this._v3)) < 0.2) return 0;
    this.crowd.reactHit(target, kind === "bite" ? "THAT SQUIRREL BIT ME!" : "I GOT SCRATCHED!");
    this.particles.burst(target.x, target.y + 1.2, target.z, kind === "bite" ? 18 : 12, 0x8b5a2b, 3.5, 1.4);
    track("mafia_melee", { kind });
    return kind === "bite" ? 90 : 55;
  }

  /**
   * isNearClimbable — Checks for a nearby building face that can support climbing
   * or a nest.
   *
   * @returns True when the squirrel is close to a collider wall.
   *
   * Business context: climbing and nest building are contextual skills, avoiding
   * unrestricted vertical flight in the ground-based Mafia mode.
   */
  private nearClimbableIndex(): number {
    const margin = 1.25;
    return this.world.colliders.findIndex((box) => (
      this.y <= box.maxY + 1 &&
      this.x >= box.minX - margin && this.x <= box.maxX + margin &&
      this.z >= box.minZ - margin && this.z <= box.maxZ + margin &&
      !(this.x > box.minX && this.x < box.maxX && this.z > box.minZ && this.z < box.maxZ)
    ));
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

  private onTrafficHit(kind: "car" | "bus", x: number, y: number, z: number) {
    const base = PTS[kind];
    this.combo += 1;
    this.comboT = 2.4;
    const mult = this.combo >= 6 ? 3 : this.combo >= 4 ? 2 : this.combo >= 2 ? 1.5 : 1;
    const pts = Math.round(base * mult * (this.wanted >= 4 ? 2 : 1));
    const spoken = kind === "bus" ? "GAMBLER EXPRESS" : "PARKING VALIDATED";
    this.score += pts;
    this.trauma = Math.min(1, this.trauma + 0.3);
    this.hitstop = 0.05;
    this.flash = Math.min(1, this.flash + 0.38);
    this.particles.burst(x, y, z, kind === "bus" ? 28 : 18, 0xf4f1ea, kind === "bus" ? 5 : 3.6, 2);
    playVictimReaction(kind);
    const stats = { ...useGame.getState().stats };
    stats.hits += 1;
    stats.comboMax = Math.max(stats.comboMax, this.combo);
    const callouts = [{ id: this.callId++, title: spoken, pts }, ...useGame.getState().callouts].slice(0, 4);
    useGame.getState().patch({ score: useGame.getState().mode === "mafia" ? useGame.getState().score : this.score, combo: this.combo, stats, callouts, alert: spoken });
    this.alertT = 1.7;
    this.trackTimeout(window.setTimeout(() => {
      const g = useGame.getState();
      g.patch({ callouts: g.callouts.filter((c) => c.id !== callouts[0].id) });
    }, 2200));
  }

  private poseShadow(flap: number) {
    this.body.visible = true;
    this.body.position.set(this.x, this.y, this.z);
    this.body.quaternion.copy(this.orient);
    // Keep the world gull readable from its chase offset without entering the aim ray.
    this.body.translateZ(1.85);
    this.body.translateY(-0.48);
    const lw = this.body.getObjectByName("wingL");
    const rw = this.body.getObjectByName("wingR");
    if (lw) lw.rotation.z = flap;
    if (rw) rw.rotation.z = -flap;
    const groundY = this.shadeGround(this.x, this.y, this.z);
    const alt = Math.max(0, this.y - groundY);
    const t = Math.min(1, alt / 16);
    this.groundShadow.visible = true;
    this.groundShadow.position.set(this.x + alt * 0.32, groundY + 0.03, this.z - alt * 0.1);
    this.groundShadow.rotation.set(-Math.PI / 2, 0, -this.yaw + flap * 0.08);
    const spread = 1.05 + t * 2.6 + flap * 0.35;
    this.groundShadow.scale.set(spread, 0.85 + t, 1);
    const mat = this.groundShadow.material as THREE.MeshBasicMaterial;
    mat.opacity = 0.5 * (1 - t * 0.62);
  }

  /**
   * Resolves the highest valid shadow receiver beneath a flying object.
   * Rooftop collider tops take priority over boardwalk, beach, road, and city grade.
   */
  private shadeGround(x: number, y: number, z: number): number {
    let ground = onBoardwalk(x, z) ? BOARDWALK_Y + 0.07 : x < -8 ? 0.46 : 0.34;
    for (const collider of this.world.colliders) {
      const overFootprint =
        x > collider.minX
        && x < collider.maxX
        && z > collider.minZ
        && z < collider.maxZ;
      const top = collider.roofY ?? collider.maxY;
      if (overFootprint && top <= y + 0.2) {
        ground = Math.max(ground, top);
      }
    }
    return ground;
  }

  private onDogWalkerHit(pair: DogWalkerPair, target: "person" | "dog", x: number, y: number, z: number) {
    playVictimReaction("gag");
    this.particles.burst(x, y, z, 14, 0xe8e0c8, 3, 1.4);
    this.dogWalkers.reactHit(pair, target);

    if (target === "person") {
      this.combo++;
      this.comboT = 3;
      const pts = 250 * this.combo;
      this.score += pts;
      const st = useGame.getState();
      const callouts = [{ id: this.callId++, title: "WALKER RUINED", pts }, ...st.callouts].slice(0, 4);
      st.patch({
        stats: { ...st.stats, dogWalkers: st.stats.dogWalkers + 1, hits: st.stats.hits + 1 },
        callouts,
        alert: "WALKER RUINED"
      });
      this.alertT = 1.6;
      this.trackTimeout(window.setTimeout(() => {
        const g = useGame.getState();
        g.patch({ callouts: g.callouts.filter((c) => c.id !== callouts[0].id) });
      }, 2200));
      track("dog_walker_hit", { mode: st.mode });
    } else {
      this.combo++;
      this.comboT = 3;
      const pts = 150 * this.combo;
      this.score += pts;
      const st = useGame.getState();
      const callouts = [{ id: this.callId++, title: "BAD GULL", pts }, ...st.callouts].slice(0, 4);
      st.patch({
        stats: { ...st.stats, dogs: st.stats.dogs + 1, hits: st.stats.hits + 1 },
        callouts,
        alert: "BAD GULL"
      });
      this.alertT = 1.6;
      this.trackTimeout(window.setTimeout(() => {
        const g = useGame.getState();
        g.patch({ callouts: g.callouts.filter((c) => c.id !== callouts[0].id) });
      }, 2200));
      track("dog_hit", { mode: st.mode });
    }
  }

  private onNpcHit(n: Npc, cone: boolean, x: number, y: number, z: number, swarm = false) {
    let key: string = n.kind;
    if (n.kind === "custard") key = cone ? "custardCone" : "custardBody";
    if (n.kind === "star" && n.starRole) key = n.starRole;
    if (swarm) key = n.starRole === "politician" ? "swarmPol" : "swarm";
    const spoken = n.kind === "pitboss" ? "CRAPS PIT BOSS JACKPOT!" : quoteFor(key);
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
    const pts = Math.round(base * mult * frenzy * (swarm ? 2.25 : 1));
    this.score += pts;
    this.trauma = Math.min(1, this.trauma + (swarm ? 0.85 : 0.35));
    this.hitstop = swarm ? 0.1 : 0.04;
    this.flash = Math.min(1, this.flash + (swarm ? 0.7 : 0.35));
    this.particles.burst(x, y, z, swarm ? 36 : cone ? 22 : 14, cone ? 0xf3e5ab : 0xf4f1ea, swarm ? 6.5 : 3.2, 2.2);
    playVictimReaction(this.reactionFor(n.kind, cone, swarm));
    const stats = { ...useGame.getState().stats };
    stats.hits += 1;
    stats.comboMax = Math.max(stats.comboMax, this.combo);
    if (scoreKey === "custardCone" || scoreKey === "custardBody") stats.custards += 1;
    if (n.kind === "selfie") stats.selfies += 1;
    if (n.kind === "proposal") stats.proposals += 1;
    if (n.kind === "nap") stats.naps += 1;
    if (n.kind === "balloon") stats.balloons += 1;
    if (n.kind === "feeder") stats.feeders += 1;
    if (n.kind === "hotdog") stats.hotdogs += 1;
    if (n.kind === "star") stats.suits += 1;
    if (n.starRole === "politician") stats.pols += 1;
    if (swarm) stats.swarms += 1;
    if (n.kind === "cop" || n.starRole === "politician" || n.kind === "star" || n.kind === "lifeguard" || n.kind === "pitboss") this.bumpWanted(n.kind === "cop" || n.kind === "lifeguard" || n.kind === "pitboss" ? 2 : 1);
    this.jobTick("hits", 1);
    if (scoreKey === "custardCone") this.jobTick("custard", 1);
    if (n.starRole === "politician") this.jobTick("pol", 1);
    const callouts = [{ id: this.callId++, title: spoken, pts }, ...useGame.getState().callouts].slice(0, 4);
    useGame.getState().patch({ score: useGame.getState().mode === "mafia" ? useGame.getState().score : this.score, combo: this.combo, stats, callouts, alert: spoken });
    this.alertT = 1.6;
    this.trackTimeout(window.setTimeout(() => {
      const g = useGame.getState();
      g.patch({ callouts: g.callouts.filter((c) => c.id !== callouts[0].id) });
    }, 2200));
  }

  private reactionFor(kind: NpcKind, cone: boolean, swarm: boolean): VictimReaction {
    if (swarm) return "swarm";
    if (kind === "pitboss") return "pitboss";
    if (kind === "vip") return "vip";
    if (kind === "star") return "showstopper";
    if (kind === "cop" || kind === "lifeguard") return "authority";
    if (kind === "selfie" || kind === "vendor" || kind === "rider" || kind === "balloon") return "surprised";
    if (cone || kind === "custard" || kind === "feeder" || kind === "hotdog") return "gag";
    return "ordinary";
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
      this.score += job.id === "daily" ? 2000 : 1500;
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
    playVictimReaction("squirrel");
    this.particles.burst(x, y, z, swarm ? 28 : 12, 0x8a5a32, 4, 2);
    if (!this.mafia.wound(s)) {
      this.score += 150;
      this.bumpWanted(1);
      useGame.getState().patch({ score: useGame.getState().mode === "mafia" ? useGame.getState().score : this.score });
      return;
    }
    this.combo += 1;
    this.comboT = 2.4;
    const key = s.boss ? "don" : "squirrel";
    const pts = Math.round((PTS[key] ?? 400) * (this.combo >= 2 ? 1.5 : 1) * (this.wanted >= 4 ? 2 : 1) * (swarm ? 2.25 : 1));
    this.score += pts;
    this.bumpWanted(s.boss ? 3 : 1);
    const stats = { ...useGame.getState().stats };
    stats.hits += 1;
    stats.squirrels += 1;
    stats.comboMax = Math.max(stats.comboMax, this.combo);
    const spoken = quoteFor(key);
    const callouts = [{ id: this.callId++, title: spoken, pts }, ...useGame.getState().callouts].slice(0, 4);
    useGame.getState().patch({ score: useGame.getState().mode === "mafia" ? useGame.getState().score : this.score, combo: this.combo, stats, callouts, alert: spoken });
    this.alertT = 1.4;
    this.jobTick("squirrel", 1);
    if (s.boss) this.jobTick("don", 1);
    playHit(true);
    if (s.boss) playBonus();
  }

  private onSharkHit() {
    this.combo = 0;
    this.trauma = Math.min(1, this.trauma + 0.85);
    this.health -= 1;
    this.alertT = 2.0;
    useGame.getState().patch({ alert: "SHARK ATTACK" });
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
    if (this.lock.kind === "vip") return "VIP HIGH ROLLER";
    if (this.lock.kind === "pitboss") return "CRAPS PIT BOSS";
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
    if (this.random() < 0.28) {
      this.crowd.spawn("star", undefined, undefined, "politician");
      this.alertT = 2.8;
      useGame.getState().patch({ alert: "FACT-FINDING TOUR ON THE BOARDS" });
      return;
    }
    const kinds: NpcKind[] = ["custard", "selfie", "feeder", "hotdog", "balloon", "vendor", "tanner", "swimmer"];
    const k = kinds[(this.random() * kinds.length) | 0];
    const dead = this.crowd.npcs.find((n) => !n.alive);
    if (dead) this.crowd.respawn(dead, k);
    else this.crowd.spawn(k);
    this.alertT = 2.2;
    useGame.getState().patch({ alert: "NEW MARK ON THE BOARDS" });
  }

  private render(dt: number) {
    // Reset once so diagnostics include composer passes and the first-person overlay.
    this.renderer.info.reset();
    const st = useGame.getState();
    const playing = st.phase === "playing";
    if (playing) {
      const reduceMotion = typeof window !== 'undefined' ? window.matchMedia("(prefers-reduced-motion: reduce)").matches : false;
      const shake = reduceMotion ? 0 : this.trauma * this.trauma;

      if (st.mode === "mafia") {
        if (shake > 0) {
            this.camera.position.add(this._v1.set((Math.random() * 2 - 1) * shake * 0.15, (Math.random() * 2 - 1) * shake * 0.15, 0));
        }
      } else {
        const bobY = reduceMotion ? 0 : Math.sin(this.bob) * 0.08;
        this.camera.position.set(this.x + (Math.random() * 2 - 1) * shake * 0.35, this.y + bobY, this.z);
        this.camera.quaternion.copy(this.orient);
        const flap = 0.35 + Math.sin(this.bob * 2.2) * 0.35;
        const poopPose = this.poopPoseT > 0 ? Math.sin((this.poopPoseT / 0.28) * Math.PI) : 0;
        this.viewmodel.position.set(0, -0.42 + poopPose * 0.08, -1.9);
        this.viewmodel.rotation.x = -0.08 - poopPose * 0.18;
        if (this.poopPoseT > 0) {
          const releaseProgress = 1 - this.poopPoseT / 0.28;
          // Start at the visible vent and fall beneath the bird; the world drop
          // continues the same bomb-like motion instead of converging on gun aim.
          this.viewmodelDrop.visible = true;
          this.viewmodelDrop.position.set(
            0,
            -0.43 - releaseProgress * 0.62,
            -1.56 - releaseProgress * 0.22,
          );
          // The references show a brief irregular stream rather than a perfect
          // pellet, so elongate the handoff before it separates into the world shot.
          const releaseScale = 1 - releaseProgress * 0.45;
          this.viewmodelDrop.scale.set(
            releaseScale * (0.7 + releaseProgress * 0.3),
            releaseScale * (1.9 - releaseProgress * 0.55),
            releaseScale * 0.7,
          );
        } else {
          this.viewmodelDrop.visible = false;
        }
        const lw = this.viewmodel.getObjectByName("wingL");
        const rw = this.viewmodel.getObjectByName("wingR");
        // During release the Gull braces with broad, raised wings instead of
        // continuing a normal flap cycle, matching the supplied flight photos.
        if (lw) lw.rotation.z = THREE.MathUtils.lerp(flap, 0.76, poopPose);
        if (rw) rw.rotation.z = THREE.MathUtils.lerp(-flap, -0.76, poopPose);
        const tail = this.viewmodel.getObjectByName("tail");
        if (tail) tail.rotation.x = -poopPose * 0.48;
        const footL = this.viewmodel.getObjectByName("footL");
        const footR = this.viewmodel.getObjectByName("footR");
        if (footL) footL.rotation.x = poopPose * 0.72;
        if (footR) footR.rotation.x = poopPose * 0.72;
        this.poseShadow(flap);
      }
    } else {
      this.body.visible = false;
      this.groundShadow.visible = false;
      this.mafiaPlayer.visible = false;
    }
    this.renderer.clear();
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
    if (playing && st.mode === "gull") {
      this.renderer.clearDepth();
      this.renderer.render(this.overlayScene, this.overlayCam);
    }
    void dt;
  }

    private trackTimeout(id: number) {
    this.activeTimeouts.push(id);
    return id;
  }

  begin() {
    for (const id of this.activeTimeouts) clearTimeout(id);
    this.activeTimeouts = [];
    this.score = 0;
    this.combo = 0;
    this.time = 0;
    this.hitstop = 0;
    this.trauma = 0;
    this.alertT = 0;
    this.flash = 0;
    this.wanted = 0;
    this.health = 3;
    this.vx = 0;
    this.vy = 0;
    this.vz = 0;
    this.fireCd = 0;
    this.mafiaActionT = 0;
    this.mafiaActionCd = 0;
    this.tributeUntil = new WeakMap<Npc, number>();
    this.nestedColliders.clear();
    for (const nest of this.roundNests) this.scene.remove(nest);
    this.roundNests = [];
    this.flockCd = 0;
    this.lock = null;
    this.lockSq = null;
    this.wantedDecay = 12;
    this.groundedT = 0;
    this.sharkTraumaCd = 0;

    // Reset inputs properly
    useGame.getState().resetInput();
    this.input.reset();

    // Install the round seed before any subsystem consumes randomness.
    this.rngState = useGame.getState().challenge?.seed ?? crypto.getRandomValues(new Uint32Array(1))[0];
    this.eventT = 7 + this.random() * 6;

    const mode = useGame.getState().mode;

    // Manage Entities per-mode
    this.strayCats.reset();
    this.courtship.reset();

    if (mode === "mafia") {
      this.tributes.reset();
      this.aiGulls.reset();
      this.strayCats.spawnAll();
      this.tributes.spawnAll();
      this.aiGulls.spawnAll();

      this.x = this.world.den.x + 2;
      this.z = this.world.den.z + 2;
      this.y = 1;
      this.pYaw = 0;
      this.pPitch = -0.2;
      this.yaw = Math.PI;
    } else {
      this.tributes.reset(); // Safely hid them all
      this.aiGulls.reset();
      this.strayCats.spawnAll(); // Cats exist in gull mode too

      this.x = 2;
      this.z = -140;
      this.y = 20;
      this.yaw = 0;
      this.pitch = -0.18;
      this._eul.set(this.pitch, this.yaw, 0, "YXZ"); this.orient.setFromEuler(this._eul);
    }

    this.patron = loadSave().patron;
    this.jobs = jobList();
    this.jobI = 0;
    this.jobP = 0;
    this.groundedT = 0;
    this.ring.visible = false;
    this.crowd.reset();
    this.flock.reset();
    this.mafia.reset();
    this.traffic.reset();
    this.dogWalkers.reset();
    this.sharks.reset();
    for (const d of this.drops) this.killDrop(d);
    for (const f of this.fries) f.taken = 0;
    this.applyLook();
    this.alertT = 3.4;
    useGame.getState().patch({ alert: this.jobs[0]?.radio ?? "Uncle Beaky: That's a cone. Don't think. Drop." });
    this.tryLock();
  }

  /**
   * Produces the next deterministic value for score-affecting world events.
   * Challenge runs begin from their shared URL seed; ordinary runs use a fresh seed.
   */
  private random(): number {
    this.rngState = (this.rngState + 0x6d2b79f5) >>> 0;
    let value = this.rngState;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
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
    (this.viewmodelDrop.material as THREE.MeshStandardMaterial).color.setHex(skin.drop);
    const weapon = equippedWeapon(save);
    const gun = this.mafiaPlayer.getObjectByName("acornGun");
    gun?.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.isMesh && mesh.material && "color" in mesh.material) {
        (mesh.material as THREE.MeshStandardMaterial).color.setHex(weapon.color);
      }
    });
    for (const m of this.plumage) m.color.setHex(skin.bird);
    this.flock.setLook(skin.bird, skin.drop, 8);
    this.flockMax = FLOCK_CD;
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
        const pts = 250;
        this.score += pts;
        this.combo += 1;
        this.comboT = 2.4;
        this.particles.burst(f.x, f.y, f.z, 16, 0xf3e5ab, 3, 2);
        playBonus();
        this.alertT = 1.4;
        const callouts = [{ id: this.callId++, title: "BOARDWALK FRIES", pts }, ...useGame.getState().callouts].slice(0, 5);
        useGame.getState().patch({ score: useGame.getState().mode === "mafia" ? useGame.getState().score : this.score, combo: this.combo, callouts, alert: "STOLEN FRIES" });
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
    window.visualViewport?.removeEventListener("resize", this.onResize);
    this.resizeObserver?.disconnect();
    document.removeEventListener("pointerlockchange", this.onLock);
    document.removeEventListener("visibilitychange", this.onVis);
    this.input.dispose();
    this.strayCats.dispose();
    this.tributes.dispose();
    this.aiGulls.dispose();
    this.dogWalkers.dispose();
    this.sharks.dispose();
    for (const nest of this.roundNests) this.scene.remove(nest);
    this.roundNests = [];
    bindGame(null);
    this.composer?.dispose();
    this.scene.environment?.dispose();
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

  private quality: QualityTier;

  private qualityDowngrades = 0;

  private slowQualityWindows = 0;

  private qualityCooldown = 0;

  private configurePostprocessing() {
    this.composer?.dispose();
    this.composer = null;
    const mode = RENDER_BUDGETS[this.quality].postprocess;
    if (mode === "none") return;
    const composer = new EffectComposer(this.renderer);
    composer.addPass(new RenderPass(this.scene, this.camera));
    composer.addPass(new SMAAPass());
    if (mode === "bloom") composer.addPass(new UnrealBloomPass(new THREE.Vector2(1600, 900), 0.22, 0.42, 0.86));
    this.composer = composer;
  }

  private setTrafficQuality() {
    // Kept structural while the traffic module evolves; current and newer managers both work.
    const traffic = this.traffic as unknown as { setQuality?: (tier: QualityTier) => void };
    traffic.setQuality?.(this.quality);
  }
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
  // A shallow top-down angle exposes the head and tail simultaneously while the
  // bird's body stays beneath the center aiming line.
  g.position.set(0, 0, 0);
  g.rotation.set(-0.12, Math.PI, 0);
  wrap.add(g);
  return wrap;
}

declare global {
  interface Window {
    /** Read-only snapshot updated every five seconds; useful in browser devtools. */
    __gullRenderDiagnostics?: {
      fps: number;
      frameMs: number;
      calls: number;
      triangles: number;
      cityInstances: number;
      animatedCityNodes: number;
      quality: QualityTier;
      budget: RenderBudget;
      qualityDowngrades: number;
      slowQualityWindows: number;
      qualityCooldown: number;
      assets: ReturnType<typeof assetDiagnostics>;
    };
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

const RENDER_BUDGETS: Record<QualityTier, RenderBudget> = {
  high: { pixelRatio: 2, anisotropy: 8, shadows: true, postprocess: "bloom", targetFrameMs: 20 },
  medium: { pixelRatio: 1.5, anisotropy: 4, shadows: true, postprocess: "smaa", targetFrameMs: 27 },
  low: { pixelRatio: 1, anisotropy: 1, shadows: false, postprocess: "none", targetFrameMs: 34 },
};

function chooseQuality(): QualityTier {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const memory = nav.deviceMemory ?? 4;
  const cores = navigator.hardwareConcurrency ?? 4;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  if (coarse || memory <= 2 || cores <= 2) return "low";
  if (memory <= 4 || cores <= 4 || window.devicePixelRatio > 2.5) return "medium";
  return "high";
}

type RenderBudget = {
  pixelRatio: number;
  anisotropy: number;
  shadows: boolean;
  postprocess: "bloom" | "smaa" | "none";
  targetFrameMs: number;
};

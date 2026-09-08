import * as THREE from "three";
import { makeWaterMaterial } from "./textures";
import { gameTex } from "./assets";

export type Aabb = { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number };

export type World = {
  group: THREE.Group;
  colliders: Aabb[];
  benches: THREE.Vector3[];
  photoSpot: THREE.Vector3;
  kiosk: THREE.Vector3;
  den: THREE.Vector3;
  tram: THREE.Group;
  ferris: THREE.Group;
  ferrisCars: THREE.Group[];
  coaster: THREE.Group;
  coasterCar: THREE.Group;
  carousel: THREE.Group;
  water: THREE.Mesh;
  waterMat: THREE.ShaderMaterial;
  sun: THREE.DirectionalLight;
  shared: THREE.Material[];
  geos: THREE.BufferGeometry[];
};

const BOARD_Y = 2.2;
const BOARD_MIN_X = -8;
const BOARD_MAX_X = 8;
export const SAND_Y = 0.4;
export const BOARDWALK = { y: BOARD_Y, minX: BOARD_MIN_X, maxX: BOARD_MAX_X, minZ: -220, maxZ: 220 };

function aabb(x: number, y: number, z: number, w: number, h: number, d: number): Aabb {
  return { minX: x - w / 2, maxX: x + w / 2, minY: y, maxY: y + h, minZ: z - d / 2, maxZ: z + d / 2 };
}

export function onBoardwalk(x: number, z: number): boolean {
  return x > BOARD_MIN_X - 0.4 && x < BOARD_MAX_X + 0.4 && z > -222 && z < 222;
}

export function onBeach(x: number, z: number): boolean {
  return x < -9 && x > -82 && z > -210 && z < 210;
}

export function districtName(x: number, z: number): string {
  if (x < -12 && z < -128 && z > -172) return "STEEL PIER";
  if (x > 24) return "THE MARINA";
  if (x < -22) return "THE ATLANTIC";
  if (z < -175) return "OCEAN TOWER";
  if (z < -140) return "STEEL PIER";
  if (z < -105) return "HARD CLAM";
  if (z < -75) return "THE RESORT";
  if (z < -45) return "SHOWBIRD";
  if (z < -10) return "CAROUSEL HOTEL";
  if (z < 25) return "EMPERORS";
  if (z < 65) return "TROPICALA";
  if (z < 120) return "TAFFY ROW";
  if (z < 165) return "NUT QUARTER";
  return "CHELSEA END";
}

export function buildWorld(scene: THREE.Scene): World {
  const group = new THREE.Group();
  scene.add(group);
  const colliders: Aabb[] = [];
  const benches: THREE.Vector3[] = [];
  const shared: THREE.Material[] = [];
  const geos: THREE.BufferGeometry[] = [];

  scene.fog = new THREE.Fog(0xc9b59a, 90, 420);
  scene.background = new THREE.Color(0xc9b59a);

  const hemi = new THREE.HemisphereLight(0xffe6c8, 0x3a2a24, 1.05);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffd2a0, 2.35);
  sun.position.set(-80, 72, 36);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 8;
  sun.shadow.camera.far = 220;
  sun.shadow.camera.left = -55;
  sun.shadow.camera.right = 55;
  sun.shadow.camera.top = 80;
  sun.shadow.camera.bottom = -80;
  sun.shadow.bias = -0.00035;
  sun.shadow.normalBias = 0.035;
  sun.shadow.camera.layers.enable(0);
  sun.shadow.camera.layers.enable(2);
  sun.layers.enable(2);
  scene.add(sun);
  scene.add(sun.target);
  const fill = new THREE.DirectionalLight(0x7ea8c4, 0.42);
  fill.position.set(60, 22, -50);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffc090, 0.55);
  rim.position.set(-40, 12, 10);
  scene.add(rim);

  const skyTex = gameTex("sky.jpg", 1, 1, true);
  const skyGeo = new THREE.SphereGeometry(380, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.5);
  const sky = new THREE.Mesh(
    skyGeo,
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false, depthWrite: false }),
  );
  sky.position.y = 0;
  group.add(sky);

  const woodTex = gameTex("planks.jpg", 1, 22);
  woodTex.anisotropy = 16;
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(16, 0.35, 440),
    new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.88, metalness: 0.02, envMapIntensity: 0.15 }),
  );
  board.position.set(0, BOARD_Y, 0);
  board.receiveShadow = true;
  group.add(board);

  const railMat = new THREE.MeshStandardMaterial({ color: 0x8a9094, metalness: 0.65, roughness: 0.35 });
  shared.push(railMat);
  for (const x of [-7.8, 7.8]) {
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 440, 8), railMat);
    rail.rotation.x = Math.PI / 2;
    rail.position.set(x, BOARD_Y + 0.72, 0);
    group.add(rail);
    const postGeo = new THREE.CylinderGeometry(0.07, 0.08, 1.1, 8);
    for (let z = -200; z <= 200; z += 16) {
      const post = new THREE.Mesh(postGeo, railMat);
      post.position.set(x, BOARD_Y + 0.55, z);
      group.add(post);
    }
  }
  const paint = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 0.05, 440),
    new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.55, metalness: 0.1 }),
  );
  paint.position.set(-7.35, BOARD_Y + 0.2, 0);
  group.add(paint);

  const sandTex = gameTex("sand.jpg", 14, 28);
  const beach = new THREE.Mesh(
    new THREE.PlaneGeometry(90, 480),
    new THREE.MeshStandardMaterial({ map: sandTex, roughness: 0.95, metalness: 0, envMapIntensity: 0.2 }),
  );
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(-40, 0.4, 0);
  beach.receiveShadow = true;
  group.add(beach);
  addBeachSet(group);

  const waterMat = makeWaterMaterial();
  const water = new THREE.Mesh(new THREE.PlaneGeometry(260, 560, 16, 16), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(-90, 0.05, 0);
  group.add(water);

  const asphalt = gameTex("asphalt.jpg", 6, 40);
  const street = new THREE.Mesh(
    new THREE.PlaneGeometry(18, 440),
    new THREE.MeshStandardMaterial({ map: asphalt, roughness: 0.92, envMapIntensity: 0.15 }),
  );
  street.rotation.x = -Math.PI / 2;
  street.position.set(18, 0.2, 0);
  group.add(street);

  const casino = gameTex("casino.jpg", 1, 1, true);
  const hotel = gameTex("hotel.jpg", 1, 1, true);
  const shop = gameTex("shop.jpg", 1, 1, true);
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x2a3236, roughness: 0.45, metalness: 0.28, envMapIntensity: 0.6 });
  const sideMat = new THREE.MeshStandardMaterial({ color: 0x8a7a6a, roughness: 0.65, envMapIntensity: 0.25 });
  shared.push(roofMat, sideMat);

  const buildings: Array<{
    z: number;
    h: number;
    w: number;
    d: number;
    tex: number;
    name: string;
    sub: string;
    bg: string;
    fg: string;
    glow: number;
    x?: number;
  }> = [
    { z: -188, h: 32, w: 14, d: 18, tex: 1, name: "OCEAN TOWER", sub: "NORTH INLET", bg: "#0e3a48", fg: "#f0ece4", glow: 0x5eb7ae },
    { z: -152, h: 24, w: 16, d: 20, tex: 0, name: "HARD CLAM", sub: "ACROSS FROM THE PIER", bg: "#1a1a1c", fg: "#c45c4a", glow: 0xc45c4a },
    { z: -114, h: 18, w: 13, d: 16, tex: 1, name: "THE RESORT", sub: "FIRST ON THE BOARDS  ·  1978", bg: "#132028", fg: "#f0ece4", glow: 0x5eb7ae },
    { z: -80, h: 16, w: 12, d: 14, tex: 2, name: "SHOWBIRD", sub: "GULLS WELCOME", bg: "#2a1a3a", fg: "#e8c878", glow: 0xc9a227 },
    { z: -42, h: 20, w: 14, d: 16, tex: 0, name: "CAROUSEL HOTEL", sub: "PARK PLACE", bg: "#f0ece4", fg: "#b4232a", glow: 0xc45c4a },
    { z: 2, h: 22, w: 15, d: 18, tex: 1, name: "EMPERORS", sub: "CENTER OF THE BOARDS", bg: "#0d1a3a", fg: "#c9a227", glow: 0xc9a227 },
    { z: 48, h: 20, w: 16, d: 20, tex: 0, name: "TROPICALA", sub: "SOUTH END  ·  THE QUARTER", bg: "#0e3a32", fg: "#f0ece4", glow: 0x5eb7ae },
    { z: 96, h: 14, w: 10, d: 12, tex: 2, name: "TAFFY ROW", sub: "SALT WATER  ·  FUDGE", bg: "#b4232a", fg: "#f0ece4", glow: 0xc45c4a },
    { z: 138, h: 12, w: 10, d: 12, tex: 2, name: "NUT QUARTER", sub: "DON NOCCIOLA", bg: "#1a120c", fg: "#c49a6a", glow: 0xc45c4a },
    { z: 178, h: 14, w: 11, d: 13, tex: 1, name: "CHELSEA END", sub: "TOWARD VENTNOR", bg: "#3a3230", fg: "#d9c4a3", glow: 0xc9a227 },
  ];
  const facades = [casino, hotel, shop];
  for (const b of buildings) {
    const x = b.x ?? 16;
    const geo = new THREE.BoxGeometry(b.w, b.h, b.d);
    geos.push(geo);
    const facadeMat = new THREE.MeshStandardMaterial({
      map: facades[b.tex],
      roughness: 0.42,
      metalness: 0.18,
      envMapIntensity: 0.55,
      emissive: new THREE.Color(b.glow),
      emissiveIntensity: 0.08,
    });
    shared.push(facadeMat);
    const mesh = new THREE.Mesh(geo, [facadeMat, facadeMat, roofMat, sideMat, facadeMat, facadeMat]);
    mesh.position.set(x, BOARD_Y + b.h / 2, b.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    colliders.push(aabb(x, 0, b.z, b.w, BOARD_Y + b.h + 4, b.d));
    const faceX = x - b.w / 2 - 0.12;
    group.add(makeMarquee(b.name, b.sub, b.bg, b.fg, faceX, BOARD_Y + b.h * 0.62, b.z, Math.min(8.8, b.w * 0.72), 1.7));
    group.add(makeMarquee(b.name, "", b.bg, b.fg, faceX + 0.4, BOARD_Y + b.h + 1.35, b.z, Math.min(7.4, b.w * 0.62), 1.2));
    if (b.name === "EMPERORS") group.add(makeWreath(faceX, BOARD_Y + b.h * 0.38, b.z));
  }

  for (const m of [
    { z: 88, name: "GOLDEN NUT", sub: "MARINA  ·  NOT THE BOARDS", bg: "#3a2414", fg: "#c9a227", glow: 0xc9a227, h: 16 },
    { z: 118, name: "HARBOR HOUSE", sub: "MARINA DISTRICT", bg: "#132028", fg: "#5eb7ae", glow: 0x5eb7ae, h: 18 },
    { z: 148, name: "THE BOROUGH", sub: "INLAND  ·  BIG LIGHTS", bg: "#1a1428", fg: "#e8c878", glow: 0xc9a227, h: 22 },
  ]) {
    const x = 34;
    const geo = new THREE.BoxGeometry(12, m.h, 14);
    geos.push(geo);
    const mat = new THREE.MeshStandardMaterial({
      map: hotel,
      roughness: 0.45,
      metalness: 0.2,
      emissive: new THREE.Color(m.glow),
      emissiveIntensity: 0.1,
    });
    shared.push(mat);
    const mesh = new THREE.Mesh(geo, [mat, mat, roofMat, sideMat, mat, mat]);
    mesh.position.set(x, BOARD_Y + m.h / 2, m.z);
    group.add(mesh);
    colliders.push(aabb(x, 0, m.z, 12, BOARD_Y + m.h + 4, 14));
    group.add(makeMarquee(m.name, m.sub, m.bg, m.fg, x - 6.2, BOARD_Y + m.h * 0.55, m.z, 7.2, 1.5));
  }

  const pierMat = new THREE.MeshStandardMaterial({ map: woodTex, color: 0x99806a, roughness: 0.72 });
  shared.push(pierMat);
  const park = makeSteelPier(pierMat);
  group.add(park.root);
  const ferris = park.ferris;

  const kioskPos = new THREE.Vector3(6.2, BOARD_Y, -8);
  group.add(makeKiosk(kioskPos));
  colliders.push(aabb(kioskPos.x, 0, kioskPos.z, 3.2, 6, 3.2));

  const photoSpot = new THREE.Vector3(-6.5, BOARD_Y, -62);

  const denPos = new THREE.Vector3(5.4, BOARD_Y, 112);
  group.add(makeDen(denPos));
  colliders.push(aabb(denPos.x, 0, denPos.z, 4.4, 5.5, 4.4));

  const tram = makeTram();
  tram.position.set(0.15, BOARD_Y + 0.55, -40);
  group.add(tram);

  const signZ: Array<[number, string]> = [
    [-188, "OCEAN TOWER"],
    [-152, "HARD CLAM"],
    [-114, "THE RESORT"],
    [-80, "SHOWBIRD"],
    [-42, "CAROUSEL HOTEL"],
    [2, "EMPERORS"],
    [48, "TROPICALA"],
    [96, "TAFFY ROW"],
    [138, "NUT QUARTER"],
    [178, "CHELSEA END"],
  ];
  for (const [z, label] of signZ) group.add(makeStreetSign(label, -6.45, BOARD_Y, z));

  for (let z = -180; z <= 180; z += 22) {
    const b = new THREE.Vector3(5.6, BOARD_Y, z);
    benches.push(b);
    group.add(makeBench(b));
  }

  addLandmarks(group);

  const lampMat = new THREE.MeshStandardMaterial({ color: 0x2a3236, metalness: 0.55, roughness: 0.32, envMapIntensity: 0.8 });
  const bulbMat = new THREE.MeshStandardMaterial({ color: 0xf3e5ab, emissive: 0xffd8a0, emissiveIntensity: 1.6 });
  shared.push(lampMat, bulbMat);
  for (let z = -190, i = 0; z <= 190; z += 28, i++) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 4.2, 8), lampMat);
    pole.position.set(-7.2, BOARD_Y + 2.1, z);
    pole.castShadow = true;
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), bulbMat);
    bulb.position.set(-7.2, BOARD_Y + 4.3, z);
    group.add(pole, bulb);
    if (i % 5 === 0) {
      const p = new THREE.PointLight(0xffd2a0, 1.4, 18, 1.8);
      p.position.set(-7.2, BOARD_Y + 4.2, z);
      group.add(p);
    }
  }

  return {
    group,
    colliders,
    benches,
    photoSpot,
    kiosk: kioskPos,
    den: denPos,
    tram,
    ferris,
    ferrisCars: park.ferrisCars,
    coaster: park.coaster,
    coasterCar: park.coasterCar,
    carousel: park.carousel,
    water,
    waterMat,
    sun,
    shared,
    geos,
  };
}

function addLandmarks(group: THREE.Group) {
  group.add(makeCitySign());

  const taffy = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 10.5),
    new THREE.MeshStandardMaterial({ map: gameTex("taffy-shop.jpg", 1, 1, true), roughness: 0.55, metalness: 0.06 }),
  );
  taffy.position.set(8.05, BOARD_Y + 5.1, -88);
  taffy.rotation.y = -Math.PI / 2;
  group.add(taffy);
  group.add(makeTaffyCover(7.92, BOARD_Y + 7.15, -88));

  const nep = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 4.4),
    new THREE.MeshStandardMaterial({ map: gameTex("neptune.jpg", 1, 1, true), roughness: 0.6 }),
  );
  nep.position.set(6.6, BOARD_Y + 2.3, -92);
  nep.rotation.y = -0.4;
  group.add(nep);

  for (let z = -160; z <= 160; z += 46) group.add(makeChair(-5.6, BOARD_Y, z));

  const piling = new THREE.MeshStandardMaterial({ color: 0x4a3a2c, roughness: 0.9 });
  for (let i = 0; i < 18; i++) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 4.4, 8), piling);
    post.position.set(-22 - (i % 3) * 4.5, 1.4, -180 + i * 22);
    post.castShadow = true;
    group.add(post);
  }

  const white = new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.5 });
  const beak = new THREE.MeshStandardMaterial({ color: 0xe08932, roughness: 0.4 });
  for (let i = 0; i < 10; i++) {
    const g = makeAmbientGull(white, beak);
    g.name = "ambientGull";
    g.userData = { a: i * 0.7, r: 18 + (i % 4) * 8, y: 9 + (i % 3) * 3, s: 0.35 + (i % 5) * 0.08 };
    group.add(g);
  }
}

function addBeachSet(group: THREE.Group) {
  const poleM = new THREE.MeshStandardMaterial({ color: 0xf0ece4, roughness: 0.55 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x8a6a3a, roughness: 0.8 });
  const red = new THREE.MeshStandardMaterial({ color: 0xc45c4a, roughness: 0.5 });
  const cloth = [0xc45c4a, 0x5eb7ae, 0xf0ece4, 0xc9a227, 0x4a6fa5];
  for (let i = 0; i < 9; i++) {
    const u = new THREE.Group();
    const z = -150 + i * 36 + (i % 2) * 8;
    const x = -22 - (i % 3) * 7;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.2, 8), poleM);
    pole.position.y = SAND_Y + 1.6;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(1.7, 0.55, 10, 1, true), new THREE.MeshStandardMaterial({ color: cloth[i % cloth.length], side: THREE.DoubleSide, roughness: 0.7 }));
    cap.position.y = SAND_Y + 3.05;
    cap.rotation.y = i * 0.4;
    u.add(pole, cap);
    u.position.set(x, 0, z);
    group.add(u);
    const towel = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.03, 2.1),
      new THREE.MeshStandardMaterial({ color: cloth[(i + 2) % cloth.length], roughness: 0.85 }),
    );
    towel.position.set(x + 1.4, SAND_Y + 0.03, z + 0.8);
    group.add(towel);
  }
  for (const z of [-90, 8, 118]) {
    const stand = new THREE.Group();
    const deck = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.16, 1.6), wood);
    deck.position.y = SAND_Y + 3.15;
    const sl = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.1, 0.12), wood);
    sl.position.set(-0.9, SAND_Y + 1.55, -0.6);
    const sr = sl.clone();
    sr.position.x = 0.9;
    const sl2 = sl.clone();
    sl2.position.z = 0.6;
    const sr2 = sr.clone();
    sr2.position.z = 0.6;
    const rail = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 0.08), red);
    rail.position.set(0, SAND_Y + 3.55, -0.75);
    const flag = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.4, 0.04), red);
    flag.position.set(0.4, SAND_Y + 4.4, 0);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.4, 8), poleM);
    mast.position.set(0.05, SAND_Y + 3.9, 0);
    stand.add(deck, sl, sr, sl2, sr2, rail, flag, mast);
    stand.position.set(-16.5, 0, z);
    group.add(stand);
  }
}

function makeCitySign(): THREE.Group {
  const g = new THREE.Group();
  g.position.set(0, BOARD_Y, -96);
  const steel = new THREE.MeshStandardMaterial({ color: 0x2a3238, metalness: 0.55, roughness: 0.35 });
  const left = new THREE.Mesh(new THREE.BoxGeometry(0.5, 11, 0.5), steel);
  left.position.set(-8.2, 5.5, 0);
  const right = left.clone();
  right.position.x = 8.2;
  const bar = new THREE.Mesh(new THREE.BoxGeometry(17, 0.4, 0.4), steel);
  bar.position.y = 10.6;
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 256;
  const ctx = c.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#132028";
    ctx.fillRect(0, 0, 1024, 256);
    ctx.fillStyle = "#5eb7ae";
    ctx.fillRect(0, 0, 1024, 18);
    ctx.fillRect(0, 238, 1024, 18);
    ctx.fillStyle = "#f0ece4";
    ctx.font = "700 92px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("ATLANTIC CITY", 512, 128);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(16.4, 3.4, 0.35),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.45, metalness: 0.1, emissive: 0x1a3330, emissiveIntensity: 0.2 }),
  );
  board.position.y = 8.6;
  g.add(left, right, bar, board);
  return g;
}

function makeTaffyCover(x: number, y: number, z: number): THREE.Mesh {
  const c = document.createElement("canvas");
  c.width = 768;
  c.height = 320;
  const ctx = c.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#b4232a";
    ctx.beginPath();
    ctx.ellipse(384, 160, 360, 150, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#f0ece4";
    ctx.lineWidth = 10;
    ctx.stroke();
    ctx.fillStyle = "#f0ece4";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "700 48px serif";
    ctx.fillText("BOARDWALK", 384, 120);
    ctx.font = "700 64px serif";
    ctx.fillText("TAFFY", 384, 185);
    ctx.font = "600 22px sans-serif";
    ctx.fillText("SALT WATER  ·  FUDGE  ·  MACAROONS", 384, 240);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(4.6, 1.95),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4, metalness: 0.08 }),
  );
  m.position.set(x, y, z);
  m.rotation.y = -Math.PI / 2;
  return m;
}

function makeChair(x: number, y: number, z: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const wicker = new THREE.MeshStandardMaterial({ color: 0x8a6a48, roughness: 0.75 });
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.12, 0.7), wicker);
  seat.position.y = 0.55;
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.7, 0.1), wicker);
  back.position.set(0, 0.95, -0.3);
  const wheel = new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.4 });
  const w1 = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.08, 10), wheel);
  w1.rotation.z = Math.PI / 2;
  w1.position.set(-0.5, 0.16, 0.22);
  const w2 = w1.clone();
  w2.position.x = 0.5;
  g.add(seat, back, w1, w2);
  return g;
}

function makeAmbientGull(white: THREE.MeshStandardMaterial, beak: THREE.MeshStandardMaterial): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), white);
  body.scale.set(1, 0.7, 1.6);
  const wingL = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.04, 0.28), white);
  wingL.position.set(-0.45, 0.04, 0);
  const wingR = wingL.clone();
  wingR.position.x = 0.45;
  const b = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.16, 6), beak);
  b.rotation.x = Math.PI / 2;
  b.position.set(0, 0, 0.28);
  g.add(body, wingL, wingR, b);
  return g;
}

function makeMarquee(name: string, sub: string, bg: string, fg: string, x: number, y: number, z: number, w: number, h: number): THREE.Mesh {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 256;
  const ctx = c.getContext("2d");
  if (ctx) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 1024, 256);
    ctx.fillStyle = fg;
    ctx.fillRect(0, 0, 1024, 10);
    ctx.fillRect(0, 246, 1024, 10);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = sub ? "700 72px sans-serif" : "700 88px sans-serif";
    ctx.fillText(name, 512, sub ? 110 : 128);
    if (sub) {
      ctx.font = "600 28px sans-serif";
      ctx.globalAlpha = 0.9;
      ctx.fillText(sub, 512, 180);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4, metalness: 0.12, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.22 }),
  );
  m.position.set(x, y, z);
  m.rotation.y = -Math.PI / 2;
  return m;
}

function makeWreath(x: number, y: number, z: number): THREE.Mesh {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, 512, 512);
    ctx.strokeStyle = "#c9a227";
    ctx.lineWidth = 18;
    ctx.beginPath();
    ctx.arc(256, 256, 180, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#c9a227";
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const px = 256 + Math.cos(a) * 180;
      const py = 256 + Math.sin(a) * 180;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(a + 0.4);
      ctx.beginPath();
      ctx.ellipse(0, 0, 14, 28, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(
    new THREE.CircleGeometry(1.15, 24),
    new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.35, metalness: 0.4, emissive: 0xc9a227, emissiveIntensity: 0.2 }),
  );
  m.position.set(x, y, z);
  m.rotation.y = -Math.PI / 2;
  return m;
}

function makeFerrisWheel(): { wheel: THREE.Group; cars: THREE.Group[] } {
  const g = new THREE.Group();
  const cars: THREE.Group[] = [];
  const steel = new THREE.MeshStandardMaterial({ color: 0xcfd6da, roughness: 0.28, metalness: 0.85 });
  const accent = new THREE.MeshStandardMaterial({
    color: 0x5eb7ae,
    roughness: 0.35,
    metalness: 0.6,
    emissive: 0x5eb7ae,
    emissiveIntensity: 0.25,
  });
  g.add(new THREE.Mesh(new THREE.TorusGeometry(16, 0.28, 8, 48), steel));
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(16, 0.18, 6, 40), accent);
  ring2.scale.set(0.92, 0.92, 1);
  g.add(ring2);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.12, 32, 0.12), steel);
    spoke.rotation.z = a;
    g.add(spoke);
    const car = new THREE.Group();
    car.position.set(Math.cos(a) * 16, Math.sin(a) * 16, 0);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.15, 1.5), accent);
    car.add(cabin);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.12, 0.7), steel);
    seat.position.y = -0.35;
    car.add(seat);
    g.add(car);
    cars.push(car);
  }
  const post = new THREE.Mesh(new THREE.BoxGeometry(1.2, 20, 1.2), steel);
  post.position.y = -10;
  g.add(post);
  return { wheel: g, cars };
}

function makeSteelPier(deckMat: THREE.MeshStandardMaterial): {
  root: THREE.Group;
  ferris: THREE.Group;
  ferrisCars: THREE.Group[];
  coaster: THREE.Group;
  coasterCar: THREE.Group;
  carousel: THREE.Group;
} {
  const root = new THREE.Group();
  const deck = new THREE.Mesh(new THREE.BoxGeometry(68, 0.35, 16), deckMat);
  deck.position.set(-40, BOARD_Y, -150);
  deck.receiveShadow = true;
  root.add(deck);
  const piling = new THREE.MeshStandardMaterial({ color: 0x4a3a2c, roughness: 0.9 });
  for (let i = 0; i < 12; i++) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.4, 6.5, 8), piling);
    post.position.set(-12 - i * 5.2, 0.6, -150 + (i % 2 === 0 ? -6.5 : 6.5));
    root.add(post);
  }
  const rail = new THREE.MeshStandardMaterial({ color: 0x8a9094, metalness: 0.6, roughness: 0.35 });
  for (const z of [-157.4, -142.6]) {
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 66, 6), rail);
    r.rotation.z = Math.PI / 2;
    r.position.set(-40, BOARD_Y + 0.8, z);
    root.add(r);
  }
  root.add(makeMarquee("STEEL PIER", "RIDES · LIGHTS · REGRET", "#132028", "#5eb7ae", -10, BOARD_Y + 4.2, -150, 9, 1.7));
  root.add(makeMarquee("FERRIS", "DON'T LOOK DOWN", "#c45c4a", "#f0ece4", -46, BOARD_Y + 3.2, -141.5, 5.5, 1.1));
  root.add(makeMarquee("COASTER", "CAPTIVE AUDIENCE", "#1a1a1c", "#c9a227", -28, BOARD_Y + 3.2, -158.5, 6.2, 1.1));

  const booth = new THREE.Mesh(
    new THREE.BoxGeometry(4.2, 2.4, 3.2),
    new THREE.MeshStandardMaterial({ color: 0xc45c4a, roughness: 0.5 }),
  );
  booth.position.set(-14, BOARD_Y + 1.2, -150);
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(3.2, 1.2, 4),
    new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.45 }),
  );
  roof.position.set(-14, BOARD_Y + 3, -150);
  roof.rotation.y = Math.PI / 4;
  root.add(booth, roof);

  const neon = new THREE.PointLight(0x5eb7ae, 2.4, 28, 1.6);
  neon.position.set(-48, BOARD_Y + 10, -150);
  root.add(neon);

  const { wheel, cars } = makeFerrisWheel();
  wheel.position.set(-54, BOARD_Y + 18, -150);
  root.add(wheel);

  const carousel = new THREE.Group();
  carousel.position.set(-24, BOARD_Y, -150);
  const plat = new THREE.Mesh(
    new THREE.CylinderGeometry(5.2, 5.2, 0.25, 20),
    new THREE.MeshStandardMaterial({ color: 0xc45c4a, roughness: 0.5 }),
  );
  plat.position.y = 0.4;
  const top = new THREE.Mesh(
    new THREE.ConeGeometry(5.4, 1.6, 12),
    new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.4, emissive: 0xc9a227, emissiveIntensity: 0.12 }),
  );
  top.position.y = 3.4;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3.2, 8), rail);
  pole.position.y = 1.8;
  carousel.add(plat, top, pole);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const seat = new THREE.Group();
    seat.position.set(Math.cos(a) * 3.6, 0.85, Math.sin(a) * 3.6);
    const horse = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.9, 0.28),
      new THREE.MeshStandardMaterial({ color: i % 2 ? 0xf0ece4 : 0x5eb7ae, roughness: 0.55 }),
    );
    horse.position.y = 0.2;
    seat.add(horse);
    seat.name = "cseat";
    carousel.add(seat);
  }
  root.add(carousel);

  const coaster = new THREE.Group();
  const trackM = new THREE.MeshStandardMaterial({ color: 0x3d4a5c, metalness: 0.55, roughness: 0.35 });
  for (let i = 0; i < 24; i++) {
    const t = (i / 24) * Math.PI * 2;
    const x = -38 - 16 * Math.cos(t);
    const z = -150 + 7 * Math.sin(t);
    const y = BOARD_Y + 3.2 + 5.5 * Math.abs(Math.sin(t * 2));
    const seg = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.16, 0.5), trackM);
    seg.position.set(x, y, z);
    coaster.add(seg);
    if (i % 2 === 0) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, y - 0.2, 6), trackM);
      post.position.set(x, (y - 0.2) / 2, z);
      coaster.add(post);
    }
  }
  const coasterCar = new THREE.Group();
  const carBody = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.7, 1.1),
    new THREE.MeshStandardMaterial({ color: 0xc45c4a, roughness: 0.4, metalness: 0.2 }),
  );
  coasterCar.add(carBody);
  coasterCar.name = "coasterCar";
  coaster.add(coasterCar);
  root.add(coaster);

  return { root, ferris: wheel, ferrisCars: cars, coaster, coasterCar, carousel };
}

function makeKiosk(pos: THREE.Vector3): THREE.Group {
  const g = new THREE.Group();
  g.position.copy(pos);
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(3, 2.4, 2.6),
    new THREE.MeshStandardMaterial({ color: 0x5eb7ae, roughness: 0.5 }),
  );
  body.position.y = 1.2;
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(2.4, 1.1, 4),
    new THREE.MeshStandardMaterial({ color: 0xc45c4a, roughness: 0.6 }),
  );
  roof.position.y = 2.9;
  roof.rotation.y = Math.PI / 4;
  g.add(body, roof);
  return g;
}

function makeDen(pos: THREE.Vector3): THREE.Group {
  const g = new THREE.Group();
  g.position.copy(pos);
  const wood = new THREE.MeshStandardMaterial({ color: 0x5a4636, roughness: 0.8 });
  const shack = new THREE.Mesh(new THREE.BoxGeometry(3.6, 2.2, 3.2), wood);
  shack.position.y = 1.2;
  const roof = new THREE.Mesh(new THREE.BoxGeometry(4, 0.16, 3.6), new THREE.MeshStandardMaterial({ color: 0x2a3236 }));
  roof.position.y = 2.35;
  roof.rotation.z = 0.08;
  g.add(shack, roof);
  return g;
}

function makeTram(): THREE.Group {
  const g = new THREE.Group();
  g.name = "tram";
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 1.1, 4.4),
    new THREE.MeshStandardMaterial({ color: 0x5eb7ae, roughness: 0.4, metalness: 0.2 }),
  );
  body.position.y = 0.2;
  g.add(body);
  return g;
}

function makeBench(pos: THREE.Vector3): THREE.Group {
  const g = new THREE.Group();
  g.position.copy(pos);
  const wood = new THREE.MeshStandardMaterial({ color: 0x6a5340, roughness: 0.8 });
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.5), wood);
  seat.position.y = 0.45;
  g.add(seat);
  return g;
}

function makeStreetSign(label: string, x: number, y: number, z: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.06, 3.2, 6),
    new THREE.MeshStandardMaterial({ color: 0x2a3236, metalness: 0.5, roughness: 0.4 }),
  );
  pole.position.y = 1.6;
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#132028";
    ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = "#5eb7ae";
    ctx.fillRect(0, 0, 8, 64);
    ctx.fillStyle = "#f0ece4";
    ctx.font = "700 22px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, 132, 34);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const board = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), new THREE.MeshBasicMaterial({ map: tex }));
  board.position.set(0.2, 3.05, 0);
  board.rotation.y = Math.PI / 2;
  g.add(pole, board);
  return g;
}

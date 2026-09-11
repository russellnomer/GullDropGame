import * as THREE from "three";

export type TrafficVehicle = {
  mesh: THREE.Group;
  x: number;
  z: number;
  speed: number;
  dir: number;
  kind: "car" | "bus";
  hitT: number;
  wheels: THREE.Group[];
  suspension: THREE.Group[];
  detailGroups: THREE.Group[];
  shadowBody: THREE.Mesh;
  phase: number;
};

/** Small fixed pool: shared low-poly parts keep the inland approach inexpensive. */
export class TrafficManager {
  readonly group = new THREE.Group();
  private readonly vehicles: TrafficVehicle[] = [];
  private quality: "high" | "medium" | "low" = "high";

  constructor(private readonly random: () => number = Math.random) {
    const carShellGeo = new THREE.BoxGeometry(1.62, 0.48, 3.15);
    const carCabinGeo = new THREE.BoxGeometry(1.38, 0.52, 1.65);
    const busShellGeo = new THREE.BoxGeometry(1.88, 0.75, 5.35);
    const busCabinGeo = new THREE.BoxGeometry(1.7, 0.72, 4.75);
    const wheelGeo = new THREE.CylinderGeometry(0.285, 0.285, 0.19, 12);
    const hubGeo = new THREE.CylinderGeometry(0.115, 0.115, 0.202, 12);
    const bumperGeo = new THREE.BoxGeometry(1.68, 0.12, 0.16);
    const windowMat = new THREE.MeshStandardMaterial({ color: 0x263945, roughness: 0.18, metalness: 0.28, transparent: true, opacity: 0.82 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x1c2024, roughness: 0.32, metalness: 0.7 });
    const colors = [0xc45c4a, 0x5eb7ae, 0xc9a227, 0x3d4a5c];
    const bodyMats = colors.map((color) => new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.5 }));
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x16181b, roughness: 0.8 });
    const hubMat = new THREE.MeshStandardMaterial({ color: 0xaeb6bd, roughness: 0.25, metalness: 0.88 });
    const lampMat = new THREE.MeshStandardMaterial({ color: 0xffe3a4, roughness: 0.2, emissive: 0xffc65a, emissiveIntensity: 0.45 });
    const tailLampMat = new THREE.MeshStandardMaterial({ color: 0x8d1515, roughness: 0.25, emissive: 0x6e0808, emissiveIntensity: 0.35 });
    const passengerMat = new THREE.MeshStandardMaterial({ color: 0xe8c4a0, roughness: 0.7 });
    const passengerGeo = new THREE.SphereGeometry(0.13, 6, 5);
    for (let i = 0; i < 13; i++) {
      const bus = i % 5 === 0;
      const root = new THREE.Group();
      const body = new THREE.Mesh(bus ? busShellGeo : carShellGeo, bodyMats[i % bodyMats.length]);
      body.position.y = bus ? 0.82 : 0.58;
      body.receiveShadow = true;
      root.add(body);
      const cabin = new THREE.Mesh(bus ? busCabinGeo : carCabinGeo, windowMat);
      cabin.position.set(0, bus ? 1.37 : 1.03, bus ? -0.05 : -0.22);
      root.add(cabin);
      if (!bus) {
        const hood = new THREE.Mesh(new THREE.BoxGeometry(1.46, 0.14, 0.65), bodyMats[i % bodyMats.length]);
        hood.position.set(0, 0.89, 1.22);
        root.add(hood);
      }
      const details = new THREE.Group();
      details.name = "trafficDetails";
      root.add(details);
      const length = bus ? 5.35 : 3.15;
      for (const z of [-length / 2 + 0.1, length / 2 - 0.1]) {
        const bumper = new THREE.Mesh(bumperGeo, trimMat);
        bumper.position.set(0, bus ? 0.58 : 0.43, z);
        details.add(bumper);
      }
      for (const sx of [-0.55, 0.55]) {
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), lampMat);
        lamp.position.set(sx, bus ? 0.89 : 0.68, length / 2 + 0.01);
        const tailLamp = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), tailLampMat);
        tailLamp.position.set(sx, bus ? 0.89 : 0.68, -length / 2 - 0.01);
        details.add(lamp, tailLamp);
      }
      const wheels: THREE.Group[] = [];
      const suspension: THREE.Group[] = [];
      for (const sx of [-0.72, 0.72]) for (const sz of bus ? [-1.85, 1.85] : [-1.05, 1.05]) {
        const spring = new THREE.Group();
        spring.position.set(sx, 0.31, sz);
        const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.26, 8), trimMat);
        strut.position.y = 0.1;
        const wheel = new THREE.Group();
        const wheelDetails = new THREE.Group();
        wheelDetails.name = "wheelDetails";
        const tire = new THREE.Mesh(wheelGeo, wheelMat);
        tire.rotation.z = Math.PI / 2;
        const hub = new THREE.Mesh(hubGeo, hubMat);
        hub.rotation.z = Math.PI / 2;
        wheelDetails.add(hub);
        wheel.add(tire, wheelDetails);
        const suspensionDetails = new THREE.Group();
        suspensionDetails.name = "suspensionDetails";
        suspensionDetails.add(strut);
        spring.add(suspensionDetails, wheel);
        root.add(spring);
        wheels.push(wheel);
        suspension.push(spring);
      }
      // A few visible heads make the approach read as gambler traffic at distance.
      for (let p = 0; p < (bus ? 4 : 2); p++) {
        const passenger = new THREE.Mesh(passengerGeo, passengerMat);
        passenger.name = "trafficPassenger";
        passenger.position.set((p % 2 ? 0.42 : -0.42), bus ? 1.42 : 0.98, (p - 1) * (bus ? 0.8 : 0.35));
        details.add(passenger);
      }
      this.group.add(root);
      this.vehicles.push({
        mesh: root, x: i % 2 ? 54 : 88, z: -220 + this.random() * 440,
        speed: 8 + this.random() * 8, dir: i % 2 ? 1 : -1, kind: bus ? "bus" : "car",
        hitT: 0, wheels, suspension,
        detailGroups: [details, ...suspension.map((spring) => spring.getObjectByName("suspensionDetails") as THREE.Group), ...wheels.map((wheel) => wheel.getObjectByName("wheelDetails") as THREE.Group)],
        shadowBody: body, phase: i * 0.73,
      });
    }
    this.setQuality(this.quality);
    this.update(0);
  }

  /** Controls visual-only traffic cost; movement, pooling, and collision remain identical. */
  setQuality(tier: "high" | "medium" | "low") {
    this.quality = tier;
    for (const vehicle of this.vehicles) {
      vehicle.shadowBody.castShadow = tier !== "low";
      vehicle.shadowBody.receiveShadow = tier !== "low";
      for (const details of vehicle.detailGroups) {
        // Medium retains exterior cues but drops passenger and mechanical sub-detail.
        details.visible = tier === "high" || (tier === "medium" && details.name === "trafficDetails");
        details.traverse((child) => {
          if (child.name === "trafficPassenger") child.visible = tier === "high";
        });
      }
    }
  }

  update(dt: number) {
    for (const v of this.vehicles) {
      if (v.hitT > 0) {
        v.hitT -= dt;
        v.mesh.rotation.z = Math.sin(v.hitT * 28) * 0.18;
        v.mesh.scale.setScalar(1 + Math.min(v.hitT, 0.35) * 0.45);
        for (const spring of v.suspension) spring.position.y = 0.31 - Math.abs(Math.sin(v.hitT * 22)) * 0.045;
        if (v.hitT <= 0) this.respawn(v);
        continue;
      }
      v.z += v.speed * v.dir * dt;
      if (v.z > 238) v.z = -238;
      if (v.z < -238) v.z = 238;
      v.mesh.position.set(v.x, 0.34, v.z);
      v.mesh.rotation.y = v.dir > 0 ? Math.PI : 0;
      const travel = v.speed * dt / 0.285;
      for (const wheel of v.wheels) wheel.rotation.y += travel * v.dir;
      for (let i = 0; i < v.suspension.length; i++) {
        const axleBounce = Math.sin(v.z * 1.45 + v.phase + (i % 2) * 0.8) * 0.018;
        v.suspension[i].position.y = 0.31 + axleBounce;
      }
    }
  }

  hitTest(x: number, y: number, z: number, r: number): TrafficVehicle | null {
    for (const v of this.vehicles) {
      if (v.hitT > 0) continue;
      const halfZ = v.kind === "bus" ? 2.8 : 1.7;
      const halfX = v.kind === "bus" ? 1.05 : 0.9;
      if (Math.abs(x - v.x) < halfX + r && Math.abs(z - v.z) < halfZ + r && y > 0.1 && y < (v.kind === "bus" ? 2.2 : 1.5) + r) return v;
    }
    return null;
  }

  hit(v: TrafficVehicle) {
    v.hitT = 0.6;
  }

  reset() {
    for (let i = 0; i < this.vehicles.length; i++) {
      const v = this.vehicles[i];
      v.z = -220 + this.random() * 440;
      v.speed = 8 + this.random() * 8;
      v.dir = i % 2 ? 1 : -1;
      v.hitT = 0;
      v.mesh.visible = true;
      v.mesh.scale.setScalar(1);
      v.mesh.rotation.z = 0;
      for (const spring of v.suspension) spring.position.y = 0.31;
    }
  }

  private respawn(v: TrafficVehicle) {
    v.z = v.dir > 0 ? -238 : 238;
    v.speed = 8 + this.random() * 8;
    v.hitT = 0;
    v.mesh.scale.setScalar(1);
    v.mesh.rotation.z = 0;
    for (const spring of v.suspension) spring.position.y = 0.31;
  }
}
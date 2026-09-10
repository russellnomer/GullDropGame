const GAME_CODES = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Space",
  "ShiftLeft",
  "ShiftRight",
  "ControlLeft",
  "KeyC",
  "KeyF",
  "KeyG",
  "KeyQ",
  "KeyE",
  "KeyR",
  "KeyP",
  "KeyN",
  "Escape",
]);

export type MafiaAction = "jump" | "climb" | "pounce" | "scratch" | "bite" | "nest";

export class Input {
  keys = new Set<string>();
  injected: string[] | null = null;
  steerInject: number | null = null;
  lookDX = 0;
  lookDY = 0;
  dragging = false;
  lastDragX = 0;
  lastDragY = 0;
  fireHeld = false;
  fireQueued = false;
  flockQueued = false;
  pauseQueued = false;
  interactQueued = false;
  mafiaActionQueued: MafiaAction | null = null;
  private canvas: HTMLCanvasElement;
  private unsubs: Array<() => void> = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const onKeyDown = (e: KeyboardEvent) => {
      if (GAME_CODES.has(e.code)) e.preventDefault();
      this.keys.add(e.code);
      if (e.code === "KeyP" || e.code === "Escape") this.pauseQueued = true;
      if (e.code === "KeyE") this.interactQueued = true;
      if (e.code === "KeyF" || e.code === "KeyG") this.flockQueued = true;
      if (!e.repeat) {
        if (e.code === "Space") this.mafiaActionQueued = "jump";
        if (e.code === "KeyC") this.mafiaActionQueued = "climb";
        if (e.code === "ShiftLeft" || e.code === "ShiftRight") this.mafiaActionQueued = "pounce";
        if (e.code === "KeyQ") this.mafiaActionQueued = "scratch";
        if (e.code === "KeyR") this.mafiaActionQueued = "bite";
        if (e.code === "KeyN") this.mafiaActionQueued = "nest";
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      this.keys.delete(e.code);
    };
    const onBlur = () => this.keys.clear();
    const onMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      canvas.focus({ preventScroll: true });
      if (e.button === 0) {
        this.fireHeld = true;
        this.fireQueued = true;
      }
      if (e.button === 2) this.flockQueued = true;
      if (document.pointerLockElement !== canvas) {
        try {
          const lock = canvas.requestPointerLock();
          if (lock && typeof (lock as Promise<void>).catch === "function") {
            (lock as Promise<void>).catch(() => undefined);
          }
        } catch {
          /* Mouse-drag look remains available when pointer lock is unavailable. */
        }
        this.dragging = true;
        this.lastDragX = e.clientX;
        this.lastDragY = e.clientY;
      }
    };
    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) this.fireHeld = false;
      this.dragging = false;
    };
    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement === canvas) {
        this.lookDX += e.movementX;
        this.lookDY += e.movementY;
        return;
      }
      if (this.dragging) {
        this.lookDX += e.clientX - this.lastDragX;
        this.lookDY += e.clientY - this.lastDragY;
        this.lastDragX = e.clientX;
        this.lastDragY = e.clientY;
      }
    };
    const onContext = (e: Event) => e.preventDefault();
    const onVis = () => {
      if (document.hidden) this.keys.clear();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVis);
    canvas.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("contextmenu", onContext);

    this.unsubs.push(
      () => window.removeEventListener("keydown", onKeyDown),
      () => window.removeEventListener("keyup", onKeyUp),
      () => window.removeEventListener("blur", onBlur),
      () => document.removeEventListener("visibilitychange", onVis),
      () => canvas.removeEventListener("mousedown", onMouseDown),
      () => window.removeEventListener("mouseup", onMouseUp),
      () => window.removeEventListener("mousemove", onMouseMove),
      () => canvas.removeEventListener("contextmenu", onContext),
    );
  }

  down(code: string): boolean {
    if (this.injected) return this.injected.includes(code);
    return this.keys.has(code);
  }

  throttle(): number {
    let v = 0;
    if (this.down("KeyW") || this.down("ArrowUp")) v += 1;
    if (this.down("KeyS") || this.down("ArrowDown")) v -= 1;
    return v;
  }

  strafe(): number {
    if (this.steerInject != null) return -this.steerInject;
    let v = 0;
    if (this.down("KeyD") || this.down("ArrowRight")) v += 1;
    if (this.down("KeyA") || this.down("ArrowLeft")) v -= 1;
    return v;
  }

  climb(): number {
    let v = 0;
    if (this.down("Space")) v += 1;
    if (this.down("ShiftLeft") || this.down("ShiftRight") || this.down("ControlLeft") || this.down("KeyC")) v -= 1;
    return v;
  }

  roll(): number {
    let v = 0;
    if (this.down("KeyQ")) v += 1;
    if (this.down("KeyE")) v -= 1;
    return v;
  }

  leveling(): boolean {
    return this.down("KeyR");
  }

  reset() {
    this.keys.clear();
    this.lookDX = 0;
    this.lookDY = 0;
    this.fireHeld = false;
    this.fireQueued = false;
    this.flockQueued = false;
    this.pauseQueued = false;
    this.interactQueued = false;
    this.mafiaActionQueued = null;
  }

  consumeLook(): { x: number; y: number } {
    const x = this.lookDX;
    const y = this.lookDY;
    this.lookDX = 0;
    this.lookDY = 0;
    return { x, y };
  }

  consumeFire(): boolean {
    const q = this.fireQueued;
    this.fireQueued = false;
    return q || this.fireHeld;
  }

  consumeFlock(): boolean {
    const q = this.flockQueued;
    this.flockQueued = false;
    return q;
  }

  consumeInteract(): boolean {
    const q = this.interactQueued;
    this.interactQueued = false;
    return q;
  }

  /**
   * consumeMafiaAction — Returns one queued ground-combat action and clears it.
   *
   * @returns The requested Mafia action, or null when no action is queued.
   *
   * Business context: edge-triggered actions prevent held keys from repeatedly
   * firing jumps and melee attacks while preserving Gull mode's held controls.
   */
  consumeMafiaAction(): MafiaAction | null {
    const action = this.mafiaActionQueued;
    this.mafiaActionQueued = null;
    return action;
  }

  consumePause(): boolean {
    const p = this.pauseQueued;
    this.pauseQueued = false;
    return p;
  }

  setKeys(codes: string[]) {
    this.injected = codes;
  }

  dispose() {
    for (const u of this.unsubs) u();
    this.unsubs.length = 0;
  }
}

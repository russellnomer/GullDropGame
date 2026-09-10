/**
 * courtship.test.ts — Lifecycle and safety regression tests for cosmetic courtship.
 *
 * Part of: Gull Drop
 * Created: 2026-09-08
 * Last modified: 2026-09-10 by Replit Agent
 *
 * Dependencies: Vitest assertions and the deterministic courtship director.
 *
 * HUMAN REVIEW NOTES:
 * These tests inspect only cosmetic state. A score object is deliberately absent,
 * proving the vignette API has no route into competitive outcomes.
 */

import { beforeAll, describe, expect, test } from "vitest";
import { CourtshipVignette } from "./courtship";

/**
 * installCanvasStub — Supplies the small 2D canvas surface required by existing rig textures.
 *
 * @returns Nothing.
 * Side effects: Installs a test-only document object in the Node test process.
 *
 * Business context: Courtship tests validate scene state, not texture rasterization, so
 * no-op drawing methods avoid a heavyweight native canvas dependency.
 */
function installCanvasStub(): void {
  const context = new Proxy(
    {},
    {
      get(target, property) {
        if (property in target) return Reflect.get(target, property);
        return () => undefined;
      },
      set(target, property, value) {
        Reflect.set(target, property, value);
        return true;
      },
    },
  ) as CanvasRenderingContext2D;
  const canvas = {
    width: 0,
    height: 0,
    style: {},
    getContext: () => context,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  } as unknown as HTMLCanvasElement;
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { createElement: () => canvas },
  });
}

beforeAll(installCanvasStub);

const safeContext = {
  mode: "gull" as const,
  playerX: 100,
  playerY: 30,
  playerZ: 100,
  reducedMotion: false,
  threatNear: () => false,
};

describe("CourtshipVignette", () => {
  test("follows deterministic mutual-consent states", () => {
    const vignette = new CourtshipVignette("gull", () => 0.5);
    
    vignette.timer = 0;
    vignette.update(0.1, safeContext);
    expect(vignette.state).toBe("approach");
    vignette.update(3, safeContext);
    expect(vignette.state).toBe("display");
    vignette.update(2, safeContext);
    expect(vignette.state).toBe("gift");
    vignette.update(2, safeContext);
    expect(vignette.state).toBe("approval");
    vignette.update(2, safeContext);
    expect(vignette.state).toBe("privacy");
    vignette.update(1, safeContext);
    expect(vignette.state).toBe("punchline");
  });

  test("fully hides both actors throughout the offscreen punchline", () => {
    const vignette = new CourtshipVignette("gull", () => 0.5);
    vignette.start();
    vignette.state = "punchline";
    vignette.actorA.visible = false;
    vignette.actorB.visible = false;
    vignette.prop.visible = true;
    vignette.update(0.5, safeContext);

    expect(vignette.actorA.visible).toBe(false);
    expect(vignette.actorB.visible).toBe(false);
    expect(vignette.prop.visible).toBe(true);
  });

  test("isolates species by mode and cancels when a threat arrives", () => {
    const vignette = new CourtshipVignette("squirrel", () => 0.5);
    vignette.timer = 0;
    vignette.update(0.1, safeContext);
    expect(vignette.state).toBe("idle");

    const squirrelContext = { ...safeContext, mode: "mafia" as const };
    vignette.update(0.1, squirrelContext);
    expect(vignette.state).toBe("approach");
    vignette.update(0.1, { ...squirrelContext, threatNear: () => true });
    expect(vignette.state).toBe("idle");
    expect(vignette.interruptedScenes).toBe(1);
    expect(vignette.actorA.visible).toBe(false);
    expect(vignette.actorB.visible).toBe(false);
  });

  test("reset removes every visible scene object", () => {
    const vignette = new CourtshipVignette("gull", () => 0.5);
    vignette.start();
    vignette.prop.visible = true;
    vignette.reset(9);

    expect(vignette.state).toBe("idle");
    expect(vignette.timer).toBe(9);
    expect(vignette.actorA.visible).toBe(false);
    expect(vignette.actorB.visible).toBe(false);
    expect(vignette.prop.visible).toBe(false);
    expect(vignette.gift.visible).toBe(false);
  });

  test("contains no prohibited explicit state or asset names", () => {
    const prohibited = /mount|thrust|genital|fluid|pregnan|birth|silhouette/i;
    const vignette = new CourtshipVignette("gull", () => 0.5);
    const names: string[] = [];
    vignette.group.traverse((object) => names.push(object.name));

    expect(Object.keys({ idle: 1, approach: 1, display: 1, gift: 1, approval: 1, privacy: 1, punchline: 1, aftermath: 1 }).join(" ")).not.toMatch(prohibited);
    expect(names.join(" ")).not.toMatch(prohibited);
  });
});

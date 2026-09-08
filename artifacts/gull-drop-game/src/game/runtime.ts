import type { GullDropGame } from "./engine";

let current: GullDropGame | null = null;

export function bindGame(g: GullDropGame | null) {
  current = g;
}

export function currentGame() {
  return current;
}

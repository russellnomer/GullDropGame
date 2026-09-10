import { useEffect, useRef } from "react";
import { GullDropGame } from "@/game/engine";
import { fault, installFaults } from "@/game/log";

export function GameCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    installFaults();
    const canvas = ref.current;
    if (!canvas) return;
    let game: GullDropGame | null = null;
    try {
      game = new GullDropGame(canvas);
    } catch (err) {
      fault("error", "Engine failed to boot", err);
    }
    return () => {
      try {
        game?.dispose();
      } catch (err) {
        fault("warn", "dispose", err);
      }
    };
  }, []);

  return <canvas ref={ref} tabIndex={-1} className="absolute inset-0 h-full w-full touch-none" />;
}

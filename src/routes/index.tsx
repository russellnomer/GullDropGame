import { createFileRoute } from "@tanstack/react-router";
import { GameCanvas } from "@/components/game-canvas";
import { GameOverlay } from "@/components/game-overlay";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <main className="relative h-dvh w-full overflow-hidden bg-bg">
      <GameCanvas />
      <GameOverlay />
    </main>
  );
}

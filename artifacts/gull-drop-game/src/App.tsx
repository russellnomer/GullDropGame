import { GameCanvas } from '@/components/game-canvas';
import { GameOverlay } from '@/components/game-overlay';

function App() {
  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-black touch-none">
      <GameCanvas />
      <GameOverlay />
    </div>
  );
}

export default App;

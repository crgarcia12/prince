'use client';

import { useEffect, useRef } from 'react';
import { GameEngine } from './engine/game-engine';
import { CANVAS_WIDTH, ROOM_ROWS, TILE_HEIGHT } from './engine/types';

const DISPLAY_HEIGHT = ROOM_ROWS * TILE_HEIGHT + 11; // Room height + HUD

export default function GamePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = CANVAS_WIDTH;
    canvas.height = DISPLAY_HEIGHT;

    const engine = new GameEngine(canvas);
    engineRef.current = engine;
    engine.start();

    return () => {
      engine.stop();
    };
  }, []);

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center">
      <canvas
        ref={canvasRef}
        className="border border-gray-800"
        style={{
          width: '100%',
          maxWidth: '960px',
          imageRendering: 'pixelated',
          aspectRatio: `${CANVAS_WIDTH} / ${DISPLAY_HEIGHT}`,
        }}
        tabIndex={0}
        autoFocus
      />
      <div className="mt-4 text-gray-500 text-sm text-center font-mono">
        <p>Arrow Keys: Move &amp; Jump | Shift: Careful Step / Attack | Up: Block</p>
        <p>Down: Crouch / Drink Potion | ESC: Pause | Enter: Start / Retry</p>
      </div>
    </div>
  );
}

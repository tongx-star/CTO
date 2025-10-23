'use client';

import { forwardRef } from 'react';

interface GameCanvasProps {
  width?: number;
  height?: number;
}

const GameCanvas = forwardRef<HTMLCanvasElement, GameCanvasProps>((props, ref) => {
  return (
    <canvas
      ref={ref}
      width={props.width}
      height={props.height}
      style={{
        width: '100%',
        maxWidth: '640px',
        aspectRatio: '1 / 1',
        imageRendering: 'pixelated',
        border: '4px solid #3a6cb1',
        backgroundColor: '#050a10'
      }}
    />
  );
});

GameCanvas.displayName = 'GameCanvas';

export default GameCanvas;

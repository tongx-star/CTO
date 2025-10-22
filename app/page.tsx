'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type Direction = 'up' | 'down' | 'left' | 'right';
type GameState = 'waiting' | 'running' | 'paused' | 'victory' | 'defeat';

type KeysState = {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
};

interface Tank {
  x: number;
  y: number;
  direction: Direction;
  cooldown: number;
  alive: boolean;
}

interface EnemyTank extends Tank {
  changeTimer: number;
  fireTimer: number;
  id: number;
}

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  owner: 'player' | 'enemy';
  size: number;
}

interface Wall {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Level {
  playerStart: { x: number; y: number; direction: Direction };
  enemies: Omit<EnemyTank, 'cooldown' | 'alive' | 'changeTimer' | 'fireTimer' | 'id'>[];
  walls: Wall[];
}


const GRID_SIZE = 16;
const CELL_SIZE = 16;
const FIELD_SIZE = GRID_SIZE * CELL_SIZE;
const TANK_SIZE = 14;
const PLAYER_SPEED = 1.8;
const ENEMY_SPEED = 1.2;
const PLAYER_FIRE_COOLDOWN = 18;
const ENEMY_FIRE_COOLDOWN = 95;
const PLAYER_INVULNERABLE_TIME = 70;
const BULLET_SIZE = 4;
const BULLET_SPEED_PLAYER = 4.2;
const BULLET_SPEED_ENEMY = 3.2;
const FRAME_TIME = 1000 / 60;

const directionVectors: Record<Direction, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 }
};

const levels: Level[] = [
  {
    playerStart: { x: FIELD_SIZE / 2 - TANK_SIZE / 2, y: FIELD_SIZE - CELL_SIZE * 2, direction: 'up' },
    enemies: [
      { x: CELL_SIZE, y: CELL_SIZE, direction: 'down' },
      { x: FIELD_SIZE - CELL_SIZE * 2, y: CELL_SIZE, direction: 'down' },
      { x: FIELD_SIZE / 2 - TANK_SIZE / 2, y: CELL_SIZE * 2, direction: 'down' }
    ],
    walls: []
  },
  {
    playerStart: { x: FIELD_SIZE / 2 - TANK_SIZE / 2, y: FIELD_SIZE - CELL_SIZE * 2, direction: 'up' },
    enemies: [
      { x: CELL_SIZE, y: CELL_SIZE, direction: 'down' },
      { x: FIELD_SIZE - CELL_SIZE * 2, y: CELL_SIZE, direction: 'down' },
      { x: CELL_SIZE, y: FIELD_SIZE / 2 - CELL_SIZE, direction: 'right' },
      { x: FIELD_SIZE - CELL_SIZE * 2, y: FIELD_SIZE / 2, direction: 'left' }
    ],
    walls: [
      { x: FIELD_SIZE / 2 - CELL_SIZE * 2, y: FIELD_SIZE / 2 - CELL_SIZE / 2, width: CELL_SIZE * 4, height: CELL_SIZE }
    ]
  },
  {
    playerStart: { x: CELL_SIZE * 2, y: FIELD_SIZE - CELL_SIZE * 2, direction: 'up' },
    enemies: [
      { x: FIELD_SIZE - CELL_SIZE * 3, y: CELL_SIZE * 2, direction: 'down' },
      { x: FIELD_SIZE / 2, y: CELL_SIZE * 2, direction: 'left' },
      { x: CELL_SIZE * 2, y: CELL_SIZE * 5, direction: 'right' },
      { x: FIELD_SIZE - CELL_SIZE * 5, y: FIELD_SIZE / 2, direction: 'up' }
    ],
    walls: [
      { x: 0, y: FIELD_SIZE / 3, width: FIELD_SIZE / 2, height: CELL_SIZE },
      { x: FIELD_SIZE / 2, y: (FIELD_SIZE / 3) * 2, width: FIELD_SIZE / 2, height: CELL_SIZE }
    ]
  },
  {
    playerStart: { x: FIELD_SIZE / 2 - TANK_SIZE / 2, y: FIELD_SIZE - CELL_SIZE * 2, direction: 'up' },
    enemies: [
      { x: CELL_SIZE, y: CELL_SIZE, direction: 'down' },
      { x: FIELD_SIZE - CELL_SIZE * 2, y: CELL_SIZE, direction: 'down' },
      { x: CELL_SIZE, y: FIELD_SIZE - CELL_SIZE * 3, direction: 'up' },
      { x: FIELD_SIZE - CELL_SIZE * 2, y: FIELD_SIZE - CELL_SIZE * 3, direction: 'up' },
      { x: FIELD_SIZE / 2 - TANK_SIZE / 2, y: CELL_SIZE * 3, direction: 'down' }
    ],
    walls: [
      { x: CELL_SIZE * 4, y: CELL_SIZE * 4, width: CELL_SIZE, height: CELL_SIZE * 8 },
      { x: FIELD_SIZE - CELL_SIZE * 5, y: CELL_SIZE * 4, width: CELL_SIZE, height: CELL_SIZE * 8 }
    ]
  },
  {
    playerStart: { x: FIELD_SIZE / 2 - TANK_SIZE / 2, y: FIELD_SIZE / 2 - TANK_SIZE / 2, direction: 'up' },
    enemies: [
      { x: 0, y: 0, direction: 'down' },
      { x: FIELD_SIZE - TANK_SIZE, y: 0, direction: 'down' },
      { x: 0, y: FIELD_SIZE - TANK_SIZE, direction: 'up' },
      { x: FIELD_SIZE - TANK_SIZE, y: FIELD_SIZE - TANK_SIZE, direction: 'up' },
      { x: FIELD_SIZE / 2 - TANK_SIZE / 2, y: 0, direction: 'down' },
      { x: FIELD_SIZE / 2 - TANK_SIZE / 2, y: FIELD_SIZE - TANK_SIZE, direction: 'up' }
    ],
    walls: [
      { x: 0, y: FIELD_SIZE / 2 - CELL_SIZE / 2, width: FIELD_SIZE / 3, height: CELL_SIZE },
      { x: FIELD_SIZE - FIELD_SIZE / 3, y: FIELD_SIZE / 2 - CELL_SIZE / 2, width: FIELD_SIZE / 3, height: CELL_SIZE }
    ]
  }
];


const randomRange = (min: number, max: number): number => Math.random() * (max - min) + min;

const createKeysState = (): KeysState => ({
  up: false,
  down: false,
  left: false,
  right: false
});

const createPlayerTank = (level: Level): Tank => ({
  ...level.playerStart,
  cooldown: 0,
  alive: true
});

const createEnemy = (id: number, position: { x: number; y: number; direction: Direction }): EnemyTank => ({
  ...position,
  cooldown: 0,
  alive: true,
  changeTimer: randomRange(90, 220),
  fireTimer: randomRange(90, 180),
  id
});

const spawnEnemyTanks = (level: Level): EnemyTank[] =>
  level.enemies.map((enemy, i) =>
    createEnemy(i, {
      x: enemy.x,
      y: enemy.y,
      direction: enemy.direction
    })
  );

const clampTank = (tank: Tank) => {
  const min = 4;
  const max = FIELD_SIZE - TANK_SIZE - 4;
  tank.x = Math.max(min, Math.min(max, tank.x));
  tank.y = Math.max(min, Math.min(max, tank.y));
};

const intersects = (
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number
) => ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;

const isCollidingWithWalls = (x: number, y: number, width: number, height: number, walls: Wall[]) => {
  for (const wall of walls) {
    if (intersects(x, y, width, height, wall.x, wall.y, wall.width, wall.height)) {
      return true;
    }
  }
  return false;
};


const spawnBulletFromTank = (tank: Tank, owner: Bullet['owner'], bullets: Bullet[]) => {
  const vector = directionVectors[tank.direction];
  const speed = owner === 'player' ? BULLET_SPEED_PLAYER : BULLET_SPEED_ENEMY;
  const size = BULLET_SIZE;
  const centerX = tank.x + TANK_SIZE / 2 - size / 2;
  const centerY = tank.y + TANK_SIZE / 2 - size / 2;

  let x = centerX;
  let y = centerY;

  if (tank.direction === 'up') {
    y = tank.y - size;
  } else if (tank.direction === 'down') {
    y = tank.y + TANK_SIZE;
  } else if (tank.direction === 'left') {
    x = tank.x - size;
  } else {
    x = tank.x + TANK_SIZE;
  }

  bullets.push({
    x,
    y,
    vx: vector.dx * speed,
    vy: vector.dy * speed,
    owner,
    size
  });
};

const chooseEnemyDirection = (enemy: EnemyTank, player: Tank) => {
  const prioritisePlayer = Math.random() < 0.6;

  if (prioritisePlayer) {
    const horizontalGap = player.x - enemy.x;
    const verticalGap = player.y - enemy.y;

    if (Math.abs(horizontalGap) > Math.abs(verticalGap)) {
      enemy.direction = horizontalGap >= 0 ? 'right' : 'left';
    } else {
      enemy.direction = verticalGap >= 0 ? 'down' : 'up';
    }
  } else {
    const directions: Direction[] = ['up', 'down', 'left', 'right'];
    enemy.direction = directions[Math.floor(Math.random() * directions.length)];
  }

  enemy.changeTimer = randomRange(80, 200);
};

const moveEnemy = (enemy: EnemyTank, delta: number, walls: Wall[], player: Tank) => {
  const originalX = enemy.x;
  const originalY = enemy.y;
  const vector = directionVectors[enemy.direction];
  enemy.x += vector.dx * ENEMY_SPEED * delta;
  enemy.y += vector.dy * ENEMY_SPEED * delta;
  clampTank(enemy);

  if (isCollidingWithWalls(enemy.x, enemy.y, TANK_SIZE, TANK_SIZE, walls)) {
    enemy.x = originalX;
    enemy.y = originalY;
    chooseEnemyDirection(enemy, player);
  }
};

type DrawParams = {
  ctx: CanvasRenderingContext2D;
  player: Tank;
  enemies: EnemyTank[];
  bullets: Bullet[];
  walls: Wall[];
  flickerPlayer: boolean;
  state: GameState;
  time: number;
};

const drawGame = ({ ctx, player, enemies, bullets, walls, flickerPlayer, state, time }: DrawParams) => {
  ctx.clearRect(0, 0, FIELD_SIZE, FIELD_SIZE);
  ctx.fillStyle = '#0a031a';
  ctx.fillRect(0, 0, FIELD_SIZE, FIELD_SIZE);

  ctx.strokeStyle = 'rgba(75, 45, 130, 0.22)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= GRID_SIZE; i += 1) {
    const offset = i * CELL_SIZE;
    ctx.beginPath();
    ctx.moveTo(offset + 0.5, 0);
    ctx.lineTo(offset + 0.5, FIELD_SIZE);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, offset + 0.5);
    ctx.lineTo(FIELD_SIZE, offset + 0.5);
    ctx.stroke();
  }

  ctx.fillStyle = '#6a6a7a';
  walls.forEach((wall) => {
    ctx.fillRect(wall.x, wall.y, wall.width, wall.height);
  });


  const drawTank = (tank: Tank, palette: { body: string; tread: string; turret: string; shadow: string }) => {
    if (!tank.alive) {
      return;
    }

    const shadowOffset = 2;
    ctx.fillStyle = palette.shadow;
    ctx.fillRect(tank.x + shadowOffset, tank.y + shadowOffset, TANK_SIZE, TANK_SIZE);

    ctx.fillStyle = palette.body;
    ctx.fillRect(tank.x, tank.y, TANK_SIZE, TANK_SIZE);

    ctx.fillStyle = palette.tread;
    ctx.fillRect(tank.x, tank.y, TANK_SIZE, 3);
    ctx.fillRect(tank.x, tank.y + TANK_SIZE - 3, TANK_SIZE, 3);
    ctx.fillRect(tank.x, tank.y, 3, TANK_SIZE);
    ctx.fillRect(tank.x + TANK_SIZE - 3, tank.y, 3, TANK_SIZE);

    const turretSize = 6;
    const turretX = tank.x + TANK_SIZE / 2 - turretSize / 2;
    const turretY = tank.y + TANK_SIZE / 2 - turretSize / 2;

    ctx.fillStyle = palette.turret;
    ctx.fillRect(turretX, turretY, turretSize, turretSize);

    const barrelWidth = 3;
    const barrelLength = 8;
    const centerX = tank.x + TANK_SIZE / 2 - barrelWidth / 2;
    const centerY = tank.y + TANK_SIZE / 2 - barrelWidth / 2;

    if (tank.direction === 'up') {
      ctx.fillRect(centerX, tank.y - barrelLength + 2, barrelWidth, barrelLength);
    } else if (tank.direction === 'down') {
      ctx.fillRect(centerX, tank.y + TANK_SIZE - 2, barrelWidth, barrelLength);
    } else if (tank.direction === 'left') {
      ctx.fillRect(tank.x - barrelLength + 2, centerY, barrelLength, barrelWidth);
    } else {
      ctx.fillRect(tank.x + TANK_SIZE - 2, centerY, barrelLength, barrelWidth);
    }
  };

  if (player.alive) {
    const shouldDrawPlayer = !flickerPlayer || Math.floor(time / 120) % 2 === 0;

    if (shouldDrawPlayer) {
      drawTank(player, {
        body: '#23c489',
        tread: '#13855d',
        turret: '#f0ff8f',
        shadow: 'rgba(0, 0, 0, 0.35)'
      });
    }
  }

  enemies.forEach((enemy) => {
    if (!enemy.alive) {
      return;
    }

    drawTank(enemy, {
      body: '#ff5f6d',
      tread: '#a6254d',
      turret: '#ffd166',
      shadow: 'rgba(0, 0, 0, 0.45)'
    });
  });

  bullets.forEach((bullet) => {
    ctx.fillStyle = bullet.owner === 'player' ? '#f8f378' : '#ff8f5c';
    ctx.fillRect(bullet.x, bullet.y, bullet.size, bullet.size);
  });

  if (state !== 'running') {
    ctx.fillStyle = 'rgba(3, 1, 10, 0.7)';
    ctx.fillRect(0, 0, FIELD_SIZE, FIELD_SIZE);

    ctx.fillStyle = '#ffe066';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '10px "Press Start 2P", monospace';
    
    if (state === 'waiting') {
      ctx.fillText('READY TO DEPLOY', FIELD_SIZE / 2, FIELD_SIZE / 2 - 12);
      ctx.font = '8px "Press Start 2P", monospace';
      ctx.fillText('Press START button to begin', FIELD_SIZE / 2, FIELD_SIZE / 2 + 12);
    } else if (state === 'paused') {
      ctx.fillText('MISSION PAUSED', FIELD_SIZE / 2, FIELD_SIZE / 2 - 12);
      ctx.font = '8px "Press Start 2P", monospace';
      ctx.fillText('Press RESUME to continue', FIELD_SIZE / 2, FIELD_SIZE / 2 + 12);
    } else if (state === 'victory') {
      ctx.fillText('MISSION COMPLETE', FIELD_SIZE / 2, FIELD_SIZE / 2 - 12);
      ctx.font = '8px "Press Start 2P", monospace';
      ctx.fillText('Press RESTART to redeploy', FIELD_SIZE / 2, FIELD_SIZE / 2 + 12);
    } else if (state === 'defeat') {
      ctx.fillText('MISSION FAILED', FIELD_SIZE / 2, FIELD_SIZE / 2 - 12);
      ctx.font = '8px "Press Start 2P", monospace';
      ctx.fillText('Press RESTART to redeploy', FIELD_SIZE / 2, FIELD_SIZE / 2 + 12);
    }
  }
};

export default function HomePage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const keysRef = useRef<KeysState>(createKeysState());
  const playerRef = useRef<Tank>(createPlayerTank(levels[0]));
  const enemiesRef = useRef<EnemyTank[]>(spawnEnemyTanks(levels[0]));
  const bulletsRef = useRef<Bullet[]>([]);
  const wallsRef = useRef<Wall[]>(levels[0].walls);
  const lastTimeRef = useRef<number | null>(null);
  const gameStatusRef = useRef<GameState>('waiting');
  const playerHitTimerRef = useRef(0);
  const [score, setScore] = useState(0);
  const [playerHealth, setPlayerHealth] = useState(3);
  const [currentLevel, setCurrentLevel] = useState(0);
  const [enemiesRemaining, setEnemiesRemaining] = useState(enemiesRef.current.length);
  const [statusMessage, setStatusMessage] = useState('Press START to begin mission');
  const [gameState, setGameState] = useState<GameState>('waiting');
  const [resetLoopSeed, setResetLoopSeed] = useState(0);

  const updateStatusMessage = useCallback((message: string) => {
    setStatusMessage((prev) => (prev === message ? prev : message));
  }, []);

  const updateGameState = useCallback((state: GameState) => {
    setGameState((prev) => (prev === state ? prev : state));
  }, []);

  const resetGame = useCallback(
    (levelIndex = 0, isDefeat = false) => {
      if (isDefeat) {
        setPlayerHealth(3);
      }
      const level = levels[levelIndex];
      if (!level) {
        updateGameState('victory');
        updateStatusMessage('ALL MISSIONS COMPLETE! YOU ARE A HERO!');
        return;
      }

      setCurrentLevel(levelIndex);
      playerRef.current = createPlayerTank(level);
      enemiesRef.current = spawnEnemyTanks(level);
      bulletsRef.current = [];
      wallsRef.current = level.walls;
      keysRef.current = createKeysState();
      lastTimeRef.current = null;
      gameStatusRef.current = isDefeat ? 'waiting' : 'running';
      playerHitTimerRef.current = 0;

      if (levelIndex === 0) {
        setScore(0);
        setPlayerHealth(3);
      }

      setEnemiesRemaining(enemiesRef.current.length);
      if (isDefeat) {
        updateStatusMessage('Press START to begin mission');
        updateGameState('waiting');
      } else {
        updateStatusMessage(`LEVEL ${levelIndex + 1}: Destroy the rogue tanks!`);
        updateGameState('running');
      }
      setResetLoopSeed((seed) => seed + 1);
    },
    [updateGameState, updateStatusMessage]
  );

  const startGame = useCallback(() => {
    if (gameState === 'waiting') {
      gameStatusRef.current = 'running';
      updateGameState('running');
      updateStatusMessage(`LEVEL ${currentLevel + 1}: Destroy the rogue tanks!`);
      lastTimeRef.current = null;
    }
  }, [gameState, currentLevel, updateGameState, updateStatusMessage]);

  const togglePause = useCallback(() => {
    if (gameState === 'running') {
      gameStatusRef.current = 'paused';
      updateGameState('paused');
      updateStatusMessage('Game paused - Press RESUME to continue');
    } else if (gameState === 'paused') {
      gameStatusRef.current = 'running';
      updateGameState('running');
      updateStatusMessage(`LEVEL ${currentLevel + 1}: Destroy the rogue tanks!`);
      lastTimeRef.current = null;
    }
  }, [gameState, currentLevel, updateGameState, updateStatusMessage]);

  useEffect(() => {
    resetGame(currentLevel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetLoopSeed]);

  const attemptPlayerFire = useCallback(() => {
    if (gameStatusRef.current !== 'running') {
      return;
    }

    const player = playerRef.current;
    if (!player.alive || player.cooldown > 0) {
      return;
    }

    spawnBulletFromTank(player, 'player', bulletsRef.current);
    player.cooldown = PLAYER_FIRE_COOLDOWN;
    updateStatusMessage('Firing cannon!');
  }, [updateStatusMessage]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const { code } = event;

      if (code === 'ArrowUp' || code === 'KeyW') {
        event.preventDefault();
        keysRef.current.up = true;
      } else if (code === 'ArrowDown' || code === 'KeyS') {
        event.preventDefault();
        keysRef.current.down = true;
      } else if (code === 'ArrowLeft' || code === 'KeyA') {
        event.preventDefault();
        keysRef.current.left = true;
      } else if (code === 'ArrowRight' || code === 'KeyD') {
        event.preventDefault();
        keysRef.current.right = true;
      } else if (code === 'Space' || code === 'Enter') {
        event.preventDefault();
        attemptPlayerFire();
      } else if (code === 'Escape') {
        event.preventDefault();
        togglePause();
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const { code } = event;

      if (code === 'ArrowUp' || code === 'KeyW') {
        keysRef.current.up = false;
      } else if (code === 'ArrowDown' || code === 'KeyS') {
        keysRef.current.down = false;
      } else if (code === 'ArrowLeft' || code === 'KeyA') {
        keysRef.current.left = false;
      } else if (code === 'ArrowRight' || code === 'KeyD') {
        keysRef.current.right = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [attemptPlayerFire, togglePause]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    canvas.width = FIELD_SIZE;
    canvas.height = FIELD_SIZE;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      return;
    }

    ctx.imageSmoothingEnabled = false;
    let animationFrameId: number;

    const update = (timestamp: number) => {
      if (lastTimeRef.current === null) {
        lastTimeRef.current = timestamp;
      }

      const deltaFrames = Math.min((timestamp - (lastTimeRef.current ?? timestamp)) / FRAME_TIME, 3);
      lastTimeRef.current = timestamp;

      const player = playerRef.current;
      const enemies = enemiesRef.current;
      const bullets = bulletsRef.current;

      // Only update game logic when actually running
      if (gameStatusRef.current === 'running') {
        const keys = keysRef.current;

        player.cooldown = Math.max(0, player.cooldown - deltaFrames);
        playerHitTimerRef.current = Math.max(0, playerHitTimerRef.current - deltaFrames);

        if (!player.alive) {
          gameStatusRef.current = 'defeat';
          updateGameState('defeat');
        }

        const moveTank = (direction: Direction) => {
          const originalX = player.x;
          const originalY = player.y;
          player.direction = direction;
          const vector = directionVectors[direction];
          player.x += vector.dx * PLAYER_SPEED * deltaFrames;
          player.y += vector.dy * PLAYER_SPEED * deltaFrames;
          clampTank(player);

          if (isCollidingWithWalls(player.x, player.y, TANK_SIZE, TANK_SIZE, wallsRef.current)) {
            player.x = originalX;
            player.y = originalY;
          }
        };

        if (keys.up && !keys.down && !keys.left && !keys.right) {
          moveTank('up');
        } else if (keys.down && !keys.up && !keys.left && !keys.right) {
          moveTank('down');
        } else if (keys.left && !keys.right && !keys.up && !keys.down) {
          moveTank('left');
        } else if (keys.right && !keys.left && !keys.up && !keys.down) {
          moveTank('right');
        }

        enemies.forEach((enemy) => {
          if (!enemy.alive) {
            return;
          }

          enemy.cooldown = Math.max(0, enemy.cooldown - deltaFrames);
          enemy.changeTimer -= deltaFrames;
          enemy.fireTimer -= deltaFrames;

          if (enemy.changeTimer <= 0) {
            chooseEnemyDirection(enemy, player);
          }

          moveEnemy(enemy, deltaFrames, wallsRef.current, player);


          if (
            enemy.fireTimer <= 0 &&
            enemy.cooldown <= 0 &&
            Math.abs(player.x - enemy.x) < FIELD_SIZE / 1.2 &&
            Math.abs(player.y - enemy.y) < FIELD_SIZE / 1.2
          ) {
            enemy.cooldown = ENEMY_FIRE_COOLDOWN;
            enemy.fireTimer = randomRange(70, 140);

            const horizontalGap = player.x - enemy.x;
            const verticalGap = player.y - enemy.y;

            if (Math.abs(horizontalGap) > Math.abs(verticalGap)) {
              enemy.direction = horizontalGap >= 0 ? 'right' : 'left';
            } else {
              enemy.direction = verticalGap >= 0 ? 'down' : 'up';
            }

            spawnBulletFromTank(enemy, 'enemy', bullets);
            updateStatusMessage('Incoming fire!');
          }
        });

        for (let i = bullets.length - 1; i >= 0; i -= 1) {
          const bullet = bullets[i];
          bullet.x += bullet.vx * deltaFrames;
          bullet.y += bullet.vy * deltaFrames;

          if (isCollidingWithWalls(bullet.x, bullet.y, bullet.size, bullet.size, wallsRef.current)) {
            bullets.splice(i, 1);
            continue;
          }

          if (
            bullet.x < -bullet.size ||
            bullet.x > FIELD_SIZE + bullet.size ||
            bullet.y < -bullet.size ||
            bullet.y > FIELD_SIZE + bullet.size
          ) {
            bullets.splice(i, 1);
            continue;
          }

          if (bullet.owner === 'player') {
            let enemyHit = false;

            enemies.forEach((enemy) => {
              if (enemyHit || !enemy.alive) {
                return;
              }

              if (intersects(bullet.x, bullet.y, bullet.size, bullet.size, enemy.x, enemy.y, TANK_SIZE, TANK_SIZE)) {
                enemy.alive = false;
                bullets.splice(i, 1);
                enemyHit = true;
                setScore((prev) => prev + 150);

                const remaining = enemies.filter((candidate) => candidate.alive).length;
                setEnemiesRemaining(remaining);

                if (remaining <= 0) {
                 if (currentLevel + 1 < levels.length) {
                   updateStatusMessage(`LEVEL ${currentLevel + 1} CLEARED!`);
                   gameStatusRef.current = 'running';
                   setTimeout(() => {
                     resetGame(currentLevel + 1);
                   }, 2000);
                 } else {
                   gameStatusRef.current = 'victory';
                   updateGameState('victory');
                   updateStatusMessage('ALL LEVELS COMPLETE!');
                 }
                } else {
                 updateStatusMessage(`${remaining} enemy tank${remaining === 1 ? '' : 's'} remaining!`);
                }
              }
            });
          } else if (
            player.alive &&
            playerHitTimerRef.current <= 0 &&
            intersects(bullet.x, bullet.y, bullet.size, bullet.size, player.x, player.y, TANK_SIZE, TANK_SIZE)
          ) {
            bullets.splice(i, 1);
            playerHitTimerRef.current = PLAYER_INVULNERABLE_TIME;
            setPlayerHealth((prev) => {
              const next = Math.max(prev - 1, 0);

              if (next <= 0) {
                player.alive = false;
                gameStatusRef.current = 'defeat';
                updateGameState('defeat');
                updateStatusMessage('Mission failed! Tank destroyed.');
              } else {
                updateStatusMessage('Hull integrity compromised!');
              }

              return next;
            });
          }
        }
      }

      drawGame({
        ctx,
        player,
        enemies,
        bullets,
        walls: wallsRef.current,
        flickerPlayer: playerHitTimerRef.current > 0,
        state: gameState,
        time: timestamp
      });

      animationFrameId = requestAnimationFrame(update);
    };

    animationFrameId = requestAnimationFrame(update);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [gameState, resetLoopSeed, updateStatusMessage, updateGameState]);

  const hearts = playerHealth > 0 ? Array.from({ length: playerHealth }, () => '❤').join(' ') : '☠';
  const formattedScore = score.toString().padStart(6, '0');

  return (
    <main>
      <div className="canvas-shell">
        <div className="canvas-shell__header">
          <h1>Pixel Tank Battle</h1>
          <p>
            Pilot your Commander-class tank through the neon-lit arena. Use the arrow keys or WASD to move and press the space
            bar or enter to fire. Eliminate every rogue tank before they take you out.
          </p>

          <div className="status-panel">
            <div className="status-panel__section">
              <span>Score</span>
              <span className="status-panel__value">{formattedScore}</span>
            </div>
            <div className="status-panel__section">
              <span>Armor</span>
              <span className={`status-panel__value ${playerHealth <= 1 ? 'status-panel__value--danger' : ''}`}>{hearts}</span>
            </div>
            <div className="status-panel__section">
                <span>Level</span>
                <span className="status-panel__value">
                  {currentLevel + 1} / {levels.length}
                </span>
              </div>
            <div className="status-panel__section">
              <span>Enemies</span>
              <span className={`status-panel__value ${enemiesRemaining === 0 ? 'status-panel__value--success' : ''}`}>
                {enemiesRemaining}
              </span>
            </div>
            <div className="status-panel__section">
              <span>Status</span>
              <span
                className={`status-panel__value ${
                  gameState === 'victory'
                    ? 'status-panel__value--success'
                    : gameState === 'defeat'
                      ? 'status-panel__value--danger'
                      : ''
                }`}
              >
                {gameState === 'victory' ? 'Victory' : gameState === 'defeat' ? 'Critical' : gameState === 'waiting' ? 'Ready' : gameState === 'paused' ? 'Paused' : 'Engaged'}
              </span>
            </div>
          </div>
        </div>

        <canvas ref={canvasRef} className="game-canvas" />

        <div className="action-bar">
          {gameState === 'waiting' && (
            <button
              type="button"
              className="action-bar__button action-bar__button--primary"
              onClick={startGame}
            >
              Start Game
            </button>
          )}
          {(gameState === 'running' || gameState === 'paused') && (
            <button
              type="button"
              className="action-bar__button"
              onClick={togglePause}
            >
              {gameState === 'running' ? 'Pause' : 'Resume'}
            </button>
          )}
          <button type="button" className="action-bar__button" onClick={() => resetGame(currentLevel)}>
            Reset Level
          </button>
          {(gameState === 'victory' || gameState === 'defeat') && (
            <button
              type="button"
              className="action-bar__button action-bar__button--primary"
              onClick={() => resetGame(gameState === 'defeat' ? currentLevel : 0, true)}
            >
              Restart Game
            </button>
          )}
          <span className="action-bar__tip">
            Arrow keys or WASD to move — Space / Enter to shoot — ESC to pause
          </span>
        </div>

        <div className="game-log">{statusMessage}</div>
      </div>
    </main>
  );
}

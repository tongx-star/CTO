'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_LEVEL_ID, LEVELS, LEVEL_TILE_SIZE, getLevelById } from '../../lib/game/levels';
import type {
  BulletState,
  Direction,
  EnemyState,
  GameSnapshot,
  LevelDefinition,
  PlayerState,
  PowerUpState,
  PowerUpType,
  Vector2
} from '../../lib/game/types';

const PLAYER_SPEED = 120;
const ENEMY_SPEED = 85;
const BULLET_SPEED = 260;
const PLAYER_LIVES = 3;
const ENEMY_FIRE_INTERVAL = { min: 1.8, max: 3.6 };
const ENEMY_DIRECTION_INTERVAL = { min: 1.5, max: 3.5 };
const PLAYER_INVULNERABLE_DURATION = 2.4;
const POWER_UP_DURATION = 12;
const HAZARD_DAMAGE_COOLDOWN = 1.2;

type Stage = GameSnapshot['stage'];

interface RuntimeState {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  matrix: string[][];
  level: LevelDefinition;
  username: string;
  tileSize: number;
  width: number;
  height: number;
  player: PlayerState;
  playerSpawn: Vector2;
  enemies: EnemyState[];
  bullets: BulletState[];
  powerUps: PowerUpState[];
  keysPressed: Set<string>;
  score: number;
  enemiesDestroyed: number;
  stage: Stage;
  paused: boolean;
  lastHazardHit: number;
}

interface StartOptions {
  levelId: number;
  username: string;
}

const MOVEMENT_KEYS: Record<string, Direction> = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right'
};

const DIRECTIONS: readonly Direction[] = ['up', 'down', 'left', 'right'];

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function createMatrix(layout: string[]): string[][] {
  return layout.map((row) => row.split(''));
}

function findPositions(matrix: string[][], token: string): Vector2[] {
  const positions: Vector2[] = [];
  matrix.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (cell === token) {
        positions.push({ x, y });
      }
    });
  });
  return positions;
}

function randomInRange(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function buildPlayerState(spawn: Vector2, tileSize: number, username: string): PlayerState {
  const center = {
    x: spawn.x * tileSize + tileSize / 2,
    y: spawn.y * tileSize + tileSize / 2
  };

  return {
    id: 'player',
    position: center,
    direction: 'up',
    speed: PLAYER_SPEED,
    size: tileSize * 0.7,
    isPlayer: true,
    health: 1,
    lives: PLAYER_LIVES,
    invulnerableTimer: 0,
    powerUpTimer: 0,
    bulletType: 'standard',
    username,
    fireCooldown: 0
  };
}

function buildEnemies(spawns: Vector2[], tileSize: number): EnemyState[] {
  return spawns.map((spawn, index) => ({
    id: `enemy-${index}`,
    position: {
      x: spawn.x * tileSize + tileSize / 2,
      y: spawn.y * tileSize + tileSize / 2
    },
    direction: 'down',
    speed: ENEMY_SPEED,
    size: tileSize * 0.68,
    isPlayer: false,
    health: 1,
    fireCooldown: randomInRange(ENEMY_FIRE_INTERVAL.min, ENEMY_FIRE_INTERVAL.max),
    changeDirectionTimer: randomInRange(ENEMY_DIRECTION_INTERVAL.min, ENEMY_DIRECTION_INTERVAL.max)
  }));
}

function buildPowerUps(matrix: string[][], tileSize: number): PowerUpState[] {
  const typeMap: Record<string, PowerUpType> = {
    U: 'piercing',
    H: 'repair',
    X: 'hazard'
  };

  const powerUps: PowerUpState[] = [];
  matrix.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (typeMap[cell]) {
        powerUps.push({
          id: `${typeMap[cell]}-${x}-${y}`,
          position: {
            x: x * tileSize + tileSize / 2,
            y: y * tileSize + tileSize / 2
          },
          type: typeMap[cell],
          active: true
        });
      }
    });
  });
  return powerUps;
}

function isWall(matrix: string[][], x: number, y: number) {
  if (y < 0 || y >= matrix.length) return true;
  if (x < 0 || x >= matrix[0].length) return true;
  return matrix[y][x] === '#';
}

function collidesWithWall(matrix: string[][], tileSize: number, position: Vector2, size: number) {
  const half = size / 2;
  const points: Vector2[] = [
    { x: position.x - half, y: position.y - half },
    { x: position.x + half - 1, y: position.y - half },
    { x: position.x - half, y: position.y + half - 1 },
    { x: position.x + half - 1, y: position.y + half - 1 }
  ];

  return points.some((point) => {
    const tileX = Math.floor(point.x / tileSize);
    const tileY = Math.floor(point.y / tileSize);
    return isWall(matrix, tileX, tileY);
  });
}

function createSnapshot(state: RuntimeState | null): GameSnapshot {
  if (!state) {
    return {
      stage: 'idle',
      username: '',
      levelId: null,
      levelName: '未开始',
      difficulty: '-',
      lives: PLAYER_LIVES,
      score: 0,
      enemiesRemaining: 0,
      powerUp: {
        active: false,
        type: null,
        remainingTimer: 0
      },
      statusMessage: null
    };
  }

  const { level, player, enemies, score, stage } = state;

  let statusMessage: string | null = null;
  if (stage === 'paused') statusMessage = '游戏已暂停';
  if (stage === 'levelComplete') statusMessage = '关卡完成！准备下一挑战。';
  if (stage === 'gameOver') statusMessage = '坦克被击毁，游戏结束';

  const powerUpActive = player.powerUpTimer > 0 && player.bulletType === 'piercing';

  return {
    stage,
    username: player.username,
    levelId: level.id,
    levelName: level.name,
    difficulty: level.difficulty,
    lives: player.lives,
    score,
    enemiesRemaining: enemies.length,
    powerUp: {
      active: powerUpActive,
      type: powerUpActive ? 'piercing' : null,
      remainingTimer: powerUpActive ? Math.max(0, player.powerUpTimer) : 0
    },
    statusMessage
  };
}

function createRuntimeState(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  level: LevelDefinition,
  username: string
): RuntimeState {
  const matrix = createMatrix(level.layout);
  const tileSize = LEVEL_TILE_SIZE;
  const width = matrix[0].length * tileSize;
  const height = matrix.length * tileSize;

  canvas.width = width;
  canvas.height = height;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const playerSpawn = findPositions(matrix, 'P')[0] ?? { x: 1, y: 1 };
  const enemySpawns = findPositions(matrix, 'E');

  const player = buildPlayerState(playerSpawn, tileSize, username);
  const enemies = buildEnemies(enemySpawns, tileSize);
  const powerUps = buildPowerUps(matrix, tileSize);

  return {
    canvas,
    ctx,
    matrix,
    level,
    username,
    tileSize,
    width,
    height,
    player,
    playerSpawn,
    enemies,
    bullets: [],
    powerUps,
    keysPressed: new Set(),
    score: 0,
    enemiesDestroyed: 0,
    stage: 'playing',
    paused: false,
    lastHazardHit: -Infinity
  };
}

function directionToVector(direction: Direction): Vector2 {
  switch (direction) {
    case 'up':
      return { x: 0, y: -1 };
    case 'down':
      return { x: 0, y: 1 };
    case 'left':
      return { x: -1, y: 0 };
    case 'right':
    default:
      return { x: 1, y: 0 };
  }
}

function spawnBullet(state: RuntimeState, owner: PlayerState | EnemyState, type: BulletState['owner']) {
  const direction = directionToVector(owner.direction);
  const offset = owner.size / 2 + 4;

  const bullet: BulletState = {
    id: `${type}-bullet-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    position: {
      x: owner.position.x + direction.x * offset,
      y: owner.position.y + direction.y * offset
    },
    direction: owner.direction,
    speed: BULLET_SPEED,
    owner: type,
    type: type === 'player' && (owner as PlayerState).bulletType === 'piercing' ? 'piercing' : 'standard',
    remainingPierce: type === 'player' && (owner as PlayerState).bulletType === 'piercing' ? 3 : 1,
    active: true
  };

  state.bullets.push(bullet);
}

function handlePlayerInput(state: RuntimeState, delta: number) {
  const { player, keysPressed, tileSize, matrix, width, height } = state;
  let inputVector: Vector2 = { x: 0, y: 0 };
  let desiredDirection: Direction | null = null;

  for (const key of keysPressed) {
    const direction = MOVEMENT_KEYS[key];
    if (!direction) continue;
    desiredDirection = direction;
    switch (direction) {
      case 'up':
        inputVector.y -= 1;
        break;
      case 'down':
        inputVector.y += 1;
        break;
      case 'left':
        inputVector.x -= 1;
        break;
      case 'right':
        inputVector.x += 1;
        break;
    }
  }

  if (desiredDirection) {
    player.direction = desiredDirection;
  }

  const magnitude = Math.hypot(inputVector.x, inputVector.y);
  if (magnitude > 0) {
    const dx = (inputVector.x / magnitude) * player.speed * delta;
    const dy = (inputVector.y / magnitude) * player.speed * delta;

    const targetPosition: Vector2 = {
      x: clamp(player.position.x + dx, player.size / 2, width - player.size / 2),
      y: clamp(player.position.y + dy, player.size / 2, height - player.size / 2)
    };

    if (!collidesWithWall(matrix, tileSize, { x: targetPosition.x, y: player.position.y }, player.size)) {
      player.position.x = targetPosition.x;
    }

    if (!collidesWithWall(matrix, tileSize, { x: player.position.x, y: targetPosition.y }, player.size)) {
      player.position.y = targetPosition.y;
    }
  }

  player.fireCooldown = Math.max(0, player.fireCooldown - delta);
  player.invulnerableTimer = Math.max(0, player.invulnerableTimer - delta);

  if (player.powerUpTimer > 0) {
    player.powerUpTimer = Math.max(0, player.powerUpTimer - delta);
    if (player.powerUpTimer === 0 && player.bulletType === 'piercing') {
      player.bulletType = 'standard';
    }
  }
}

function updateEnemies(state: RuntimeState, delta: number) {
  const { enemies, matrix, tileSize, width, height, player } = state;

  enemies.forEach((enemy) => {
    enemy.fireCooldown -= delta;
    enemy.changeDirectionTimer -= delta;

    if (enemy.changeDirectionTimer <= 0) {
      const directions = DIRECTIONS;
      enemy.direction = directions[Math.floor(Math.random() * directions.length)];
      enemy.changeDirectionTimer = randomInRange(ENEMY_DIRECTION_INTERVAL.min, ENEMY_DIRECTION_INTERVAL.max);
    }

    const movement = directionToVector(enemy.direction);
    const dx = movement.x * enemy.speed * delta;
    const dy = movement.y * enemy.speed * delta;

    const targetPosition: Vector2 = {
      x: clamp(enemy.position.x + dx, enemy.size / 2, width - enemy.size / 2),
      y: clamp(enemy.position.y + dy, enemy.size / 2, height - enemy.size / 2)
    };

    const blockedX = collidesWithWall(matrix, tileSize, { x: targetPosition.x, y: enemy.position.y }, enemy.size);
    const blockedY = collidesWithWall(matrix, tileSize, { x: enemy.position.x, y: targetPosition.y }, enemy.size);

    if (!blockedX) {
      enemy.position.x = targetPosition.x;
    }

    if (!blockedY) {
      enemy.position.y = targetPosition.y;
    }

    if (blockedX && blockedY) {
      const directions = DIRECTIONS.filter((dir) => dir !== enemy.direction);
      enemy.direction = directions[Math.floor(Math.random() * directions.length)] ?? enemy.direction;
    }

    if (enemy.fireCooldown <= 0) {
      const horizontalDistance = Math.abs(enemy.position.x - player.position.x);
      const verticalDistance = Math.abs(enemy.position.y - player.position.y);
      if (horizontalDistance < tileSize || verticalDistance < tileSize) {
        enemy.direction = horizontalDistance < verticalDistance
          ? enemy.position.y > player.position.y ? 'up' : 'down'
          : enemy.position.x > player.position.x ? 'left' : 'right';
      }

      spawnBullet(state, enemy, 'enemy');
      enemy.fireCooldown = randomInRange(ENEMY_FIRE_INTERVAL.min, ENEMY_FIRE_INTERVAL.max);
    }
  });
}

function removeInactive<T extends { active?: boolean }>(items: T[]): T[] {
  return items.filter((item) => item.active !== false);
}

function handleBulletCollisions(state: RuntimeState, bullet: BulletState) {
  const { matrix, tileSize, enemies, player } = state;

  const tileX = Math.floor(bullet.position.x / tileSize);
  const tileY = Math.floor(bullet.position.y / tileSize);

  if (isWall(matrix, tileX, tileY)) {
    bullet.active = false;
    return;
  }

  if (bullet.owner === 'player') {
    for (const enemy of enemies) {
      const dx = Math.abs(enemy.position.x - bullet.position.x);
      const dy = Math.abs(enemy.position.y - bullet.position.y);
      if (dx <= enemy.size / 2 && dy <= enemy.size / 2) {
        enemy.health -= bullet.type === 'piercing' ? 2 : 1;
        if (enemy.health <= 0) {
          state.enemiesDestroyed += 1;
          state.score += 150;
          enemy.position.x = -9999;
          enemy.position.y = -9999;
          enemy.speed = 0;
          enemy.fireCooldown = Infinity;
          enemy.changeDirectionTimer = Infinity;
        }

        if (bullet.type === 'piercing') {
          bullet.remainingPierce -= 1;
          if (bullet.remainingPierce <= 0) {
            bullet.active = false;
          }
        } else {
          bullet.active = false;
        }
        break;
      }
    }
  } else {
    const dx = Math.abs(player.position.x - bullet.position.x);
    const dy = Math.abs(player.position.y - bullet.position.y);

    if (dx <= player.size / 2 && dy <= player.size / 2 && player.invulnerableTimer <= 0) {
      player.lives = Math.max(0, player.lives - 1);
      player.invulnerableTimer = PLAYER_INVULNERABLE_DURATION;
      player.position = {
        x: state.playerSpawn.x * tileSize + tileSize / 2,
        y: state.playerSpawn.y * tileSize + tileSize / 2
      };
      bullet.active = false;
    }
  }
}

function updateBullets(state: RuntimeState, delta: number) {
  const { bullets } = state;

  bullets.forEach((bullet) => {
    if (!bullet.active) return;

    const movement = directionToVector(bullet.direction);
    bullet.position.x += movement.x * bullet.speed * delta;
    bullet.position.y += movement.y * bullet.speed * delta;

    if (
      bullet.position.x < 0 ||
      bullet.position.y < 0 ||
      bullet.position.x > state.width ||
      bullet.position.y > state.height
    ) {
      bullet.active = false;
      return;
    }

    handleBulletCollisions(state, bullet);
  });

  state.bullets = removeInactive(bullets.filter((bullet) => bullet.active));
  state.enemies = state.enemies.filter((enemy) => enemy.health > 0);
}

function collectPowerUps(state: RuntimeState, now: number) {
  const { player, powerUps, tileSize } = state;

  powerUps.forEach((powerUp) => {
    if (!powerUp.active) return;

    const dx = Math.abs(powerUp.position.x - player.position.x);
    const dy = Math.abs(powerUp.position.y - player.position.y);
    const radius = tileSize * 0.5;

    if (dx <= radius && dy <= radius) {
      switch (powerUp.type) {
        case 'piercing':
          player.bulletType = 'piercing';
          player.powerUpTimer = POWER_UP_DURATION;
          break;
        case 'repair':
          player.lives = clamp(player.lives + 1, 0, PLAYER_LIVES);
          break;
        case 'hazard':
          if (now - state.lastHazardHit > HAZARD_DAMAGE_COOLDOWN) {
            player.lives = clamp(player.lives - 1, 0, PLAYER_LIVES);
            state.lastHazardHit = now;
          }
          break;
      }
      powerUp.active = false;
    }
  });

  state.powerUps = removeInactive(powerUps.filter((item) => item.active));
}

function drawState(state: RuntimeState) {
  const { ctx, width, height, tileSize, matrix, player, enemies, bullets, powerUps, stage } = state;

  ctx.save();
  ctx.clearRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#0c121b';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  for (let x = 0; x <= width; x += tileSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y <= height; y += tileSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  matrix.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (cell === '#') {
        ctx.fillStyle = '#1f2c3d';
        ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
        ctx.fillStyle = '#314867';
        ctx.fillRect(x * tileSize + 4, y * tileSize + 4, tileSize - 8, tileSize - 8);
      }
    });
  });

  powerUps.forEach((powerUp) => {
    if (!powerUp.active) return;
    const { position, type } = powerUp;
    switch (type) {
      case 'piercing':
        ctx.fillStyle = '#ffef5a';
        break;
      case 'repair':
        ctx.fillStyle = '#6affca';
        break;
      case 'hazard':
        ctx.fillStyle = '#ff5f7a';
        break;
    }
    ctx.beginPath();
    ctx.fillRect(position.x - tileSize * 0.3, position.y - tileSize * 0.3, tileSize * 0.6, tileSize * 0.6);
  });

  const drawTank = (tank: PlayerState | EnemyState, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(tank.position.x - tank.size / 2, tank.position.y - tank.size / 2, tank.size, tank.size);

    ctx.fillStyle = '#0c121b';
    const turretWidth = tank.size * 0.2;
    const turretLength = tank.size * 0.6;
    switch (tank.direction) {
      case 'up':
        ctx.fillRect(tank.position.x - turretWidth / 2, tank.position.y - tank.size / 2 - turretLength / 4, turretWidth, turretLength);
        break;
      case 'down':
        ctx.fillRect(tank.position.x - turretWidth / 2, tank.position.y + tank.size / 2 - turretLength * 0.75, turretWidth, turretLength);
        break;
      case 'left':
        ctx.fillRect(tank.position.x - tank.size / 2 - turretLength / 4, tank.position.y - turretWidth / 2, turretLength, turretWidth);
        break;
      case 'right':
        ctx.fillRect(tank.position.x + tank.size / 2 - turretLength * 0.75, tank.position.y - turretWidth / 2, turretLength, turretWidth);
        break;
    }
  };

  drawTank(player, '#6fffe9');
  enemies.forEach((enemy) => drawTank(enemy, '#ff6f91'));

  bullets.forEach((bullet) => {
    if (!bullet.active) return;
    ctx.fillStyle = bullet.owner === 'player' ? '#ffe066' : '#ff4f66';
    const size = bullet.type === 'piercing' ? tileSize * 0.25 : tileSize * 0.18;
    ctx.fillRect(bullet.position.x - size / 2, bullet.position.y - size / 2, size, size);
  });

  if (stage === 'paused' || stage === 'levelComplete' || stage === 'gameOver') {
    ctx.fillStyle = 'rgba(12, 18, 27, 0.7)';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#f8f9fc';
    ctx.font = '32px "Press Start 2P"';
    ctx.textAlign = 'center';
    const centerY = height / 2;
    const message = stage === 'paused' ? 'PAUSE' : stage === 'gameOver' ? 'GAME OVER' : 'STAGE CLEAR';
    ctx.fillText(message, width / 2, centerY);
  }

  ctx.restore();
}

function updateState(state: RuntimeState, delta: number, now: number) {
  handlePlayerInput(state, delta);
  updateEnemies(state, delta);
  updateBullets(state, delta);
  collectPowerUps(state, now);

  if (state.player.lives <= 0) {
    state.stage = 'gameOver';
    state.paused = true;
    state.keysPressed.clear();
  }

  if (state.enemies.length === 0) {
    state.stage = 'levelComplete';
    state.paused = true;
    state.keysPressed.clear();
  }
}

export function useGameEngine() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const previousTimestampRef = useRef<number | null>(null);
  const stateRef = useRef<RuntimeState | null>(null);
  const startOptionsRef = useRef<StartOptions>({ levelId: DEFAULT_LEVEL_ID, username: '' });
  const [snapshot, setSnapshot] = useState<GameSnapshot>(() => createSnapshot(null));

  const loop = useCallback(
    (timestamp: number) => {
      const state = stateRef.current;
      if (!state) return;

      const previous = previousTimestampRef.current ?? timestamp;
      let delta = (timestamp - previous) / 1000;
      previousTimestampRef.current = timestamp;

      if (state.stage === 'playing' && !state.paused) {
        delta = Math.min(delta, 0.05);
        updateState(state, delta, timestamp / 1000);
      }

      drawState(state);
      setSnapshot(createSnapshot(state));
      animationRef.current = requestAnimationFrame(loop);
    },
    [setSnapshot]
  );

  const initialise = useCallback(
    ({ levelId, username }: StartOptions) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.imageSmoothingEnabled = false;
      const level = getLevelById(levelId) ?? getLevelById(DEFAULT_LEVEL_ID)!;
      const runtime = createRuntimeState(canvas, ctx, level, username.trim() || '指挥官');
      stateRef.current = runtime;
      previousTimestampRef.current = null;
      startOptionsRef.current = { levelId: level.id, username: runtime.player.username };
      setSnapshot(createSnapshot(runtime));
      if (animationRef.current === null) {
        animationRef.current = requestAnimationFrame(loop);
      }
    },
    [loop]
  );

  const start = useCallback(
    ({ levelId, username }: StartOptions) => {
      initialise({ levelId, username });
    },
    [initialise]
  );

  const pause = useCallback(() => {
    const state = stateRef.current;
    if (!state) return;
    if (state.stage !== 'playing') return;
    state.paused = true;
    state.stage = 'paused';
    setSnapshot(createSnapshot(state));
  }, []);

  const resume = useCallback(() => {
    const state = stateRef.current;
    if (!state) return;
    if (state.stage !== 'paused') return;
    state.paused = false;
    state.stage = 'playing';
    previousTimestampRef.current = null;
    setSnapshot(createSnapshot(state));
  }, []);

  const reset = useCallback(() => {
    const options = startOptionsRef.current;
    initialise(options);
  }, [initialise]);

  const nextLevel = useCallback(() => {
    const current = startOptionsRef.current.levelId;
    const currentIndex = LEVELS.findIndex((level) => level.id === current);
    const next = LEVELS[(currentIndex + 1) % LEVELS.length];
    const username = startOptionsRef.current.username;
    initialise({ levelId: next.id, username });
  }, [initialise]);

  const shoot = useCallback(() => {
    const state = stateRef.current;
    if (!state) return;
    if (state.stage !== 'playing' || state.paused) return;
    if (state.player.fireCooldown > 0) return;

    spawnBullet(state, state.player, 'player');
    state.player.fireCooldown = state.player.bulletType === 'piercing' ? 0.45 : 0.6;
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const state = stateRef.current;
      if (!state) return;

      if (event.code === 'Space') {
        event.preventDefault();
        shoot();
        return;
      }

      if (MOVEMENT_KEYS[event.code]) {
        state.keysPressed.add(event.code);
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const state = stateRef.current;
      if (!state) return;

      if (MOVEMENT_KEYS[event.code]) {
        state.keysPressed.delete(event.code);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [shoot]);

  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const controls = useMemo(
    () => ({
      start,
      pause,
      resume,
      reset,
      nextLevel,
      shoot
    }),
    [start, pause, resume, reset, nextLevel, shoot]
  );

  return {
    canvasRef,
    snapshot,
    controls
  };
}

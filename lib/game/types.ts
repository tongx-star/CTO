export type Direction = 'up' | 'down' | 'left' | 'right';

export interface Vector2 {
  x: number;
  y: number;
}

export type BulletType = 'standard' | 'piercing';

export type PowerUpType = 'piercing' | 'repair' | 'hazard';

export interface LevelDefinition {
  id: number;
  name: string;
  description: string;
  layout: string[];
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface TankState {
  id: string;
  position: Vector2;
  direction: Direction;
  speed: number;
  size: number;
  isPlayer: boolean;
  health: number;
}

export interface PlayerState extends TankState {
  lives: number;
  invulnerableTimer: number;
  powerUpTimer: number;
  bulletType: BulletType;
  username: string;
  fireCooldown: number;
}

export interface EnemyState extends TankState {
  fireCooldown: number;
  changeDirectionTimer: number;
}

export interface BulletState {
  id: string;
  position: Vector2;
  direction: Direction;
  speed: number;
  owner: 'player' | 'enemy';
  type: BulletType;
  remainingPierce: number;
  active: boolean;
}

export interface PowerUpState {
  id: string;
  position: Vector2;
  type: PowerUpType;
  active: boolean;
}

export interface GameSnapshot {
  stage: 'idle' | 'playing' | 'paused' | 'levelComplete' | 'gameOver';
  username: string;
  levelId: number | null;
  levelName: string;
  difficulty: string;
  lives: number;
  score: number;
  enemiesRemaining: number;
  powerUp: {
    active: boolean;
    type: PowerUpType | null;
    remainingTimer: number;
  };
  statusMessage: string | null;
}

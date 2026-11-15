export type GameState = 'TITLE_MENU' | 'PLAYING' | 'PAUSED' | 'GAME_OVER';

export type MatchFormat = '5v5' | '7v7' | '11v11';

export type Difficulty = 'facil' | 'normal' | 'dificil';

export type TeamSide = 'home' | 'away';

export type PlayerRole = 'GK' | 'DF' | 'MF' | 'FW';

export type TackleType = 'normal' | 'aggressive';

/** Shot type taxonomy for normal & special combo shots */
export type ShotType = 'normal' | 'power' | 'finesse' | 'chip' | 'knuckle';

export type RestartType = 'throw_in' | 'corner' | 'goal_kick';

export interface ActiveRestart {
  type: RestartType;
  team: TeamSide;
  x: number;
  y: number;
  takerId: string;
  ready: boolean;
  prepTimer: number;
  aiExecuteTimer: number;
}

export interface MatchConfig {
  format: MatchFormat;
  difficulty: Difficulty;
  durationSec: number;
}

export interface TrainingConfig {
  teammates: number;
  defenders: number;
}

export interface PlayerEntity {
  id: string;
  team: TeamSide;
  number: number;
  role: PlayerRole;
  x: number;
  y: number;
  vx: number;
  vy: number;
  homeX: number;
  homeY: number;
  radius: number;
  facingAngle: number;
  tackleCooldown: number;
  lungeTimer: number;
  lungeType: TackleType | null;
  lungeVx: number;
  lungeVy: number;
  stunTimer: number;
  injuryTimer: number;
  injuryHitCooldown: number;
  comboAuraTimer: number;
  pendingComboShot?: { type: ShotType; power: number };
  aiThinkTimer: number;
  aiTackleCooldown: number;
  aiShootWindup: number;
  aiPendingShotType?: ShotType;
  gkHoldTimer: number;
  flashTimer: number;
}

export interface BallTrailPoint {
  x: number;
  y: number;
  alpha: number;
}

export interface BallEntity {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  ownerId: string | null;
  lastTouchTeam: TeamSide | null;
  lastTouchNumber: number | null;
  spinAngle: number;
  kickCooldown: number;
  isShot: boolean;
  shotType: ShotType;
  curveAx: number;
  curveAy: number;
  loftProgress: number;
  loftDuration: number;
  knucklePhase: number;
  trail: BallTrailPoint[];
}

export interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

export interface MatchStats {
  homeScore: number;
  awayScore: number;
  homeShots: number;
  awayShots: number;
  homePasses: number;
  awayPasses: number;
  homeSaves: number;
  awaySaves: number;
  homePossessionSec: number;
  awayPossessionSec: number;
  timeRemainingSec: number;
  lastGoalTeam: TeamSide | null;
  lastGoalNumber: number | null;
  goalBannerTimer: number;
}

export interface HudSnapshot {
  homeScore: number;
  awayScore: number;
  timeRemainingSec: number;
  homeShots: number;
  awayShots: number;
  homePasses: number;
  awayPasses: number;
  homeSaves: number;
  awaySaves: number;
  possessionHomePct: number;
  activePlayerNumber: number;
  hasBall: boolean;
}

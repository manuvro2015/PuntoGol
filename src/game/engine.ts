import { FORMATIONS, getPlayerRadius } from './formations';
import { soundEngine } from './sound';
import type {
  ActiveRestart,
  BallEntity,
  Difficulty,
  GameState,
  HudSnapshot,
  MatchConfig,
  MatchStats,
  Particle,
  PlayerEntity,
  RestartType,
  ShotType,
  TackleType,
  TeamSide,
  TrainingConfig,
} from './types';

export const LOGICAL_WIDTH = 1200;
export const LOGICAL_HEIGHT = 760;

export const PITCH_LEFT = 72;
export const PITCH_RIGHT = 1128;
export const PITCH_TOP = 54;
export const PITCH_BOTTOM = 706;
export const PITCH_WIDTH = PITCH_RIGHT - PITCH_LEFT;
export const PITCH_HEIGHT = PITCH_BOTTOM - PITCH_TOP;
export const PITCH_CENTER_X = (PITCH_LEFT + PITCH_RIGHT) / 2;
export const PITCH_CENTER_Y = (PITCH_TOP + PITCH_BOTTOM) / 2;

export const GOAL_HALF_HEIGHT = 76;
export const GOAL_TOP = PITCH_CENTER_Y - GOAL_HALF_HEIGHT;
export const GOAL_BOTTOM = PITCH_CENTER_Y + GOAL_HALF_HEIGHT;
export const GOAL_DEPTH = 30;

const MAX_PARTICLES = 120;

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(bx - ax, by - ay);
}

export class FootballEngine {
  public gameState: GameState = 'TITLE_MENU';
  public config: MatchConfig = {
    format: '7v7',
    difficulty: 'normal',
    durationSec: 180,
  };

  public players: PlayerEntity[] = [];
  public ball: BallEntity;
  public stats: MatchStats;
  public particles: Particle[] = [];

  public activePlayerId = '';
  public passTargetId: string | null = null;

  public isChargingShot = false;
  public shotChargeTime = 0;
  public readonly maxShotCharge = 0.5;
  public preparedShotType: ShotType = 'normal';
  public shotCallout: { text: string; color: string; x: number; y: number; timer: number } | null = null;

  public hitstopTimer = 0;
  public shakeTimer = 0;
  public shakeIntensity = 0;
  public netRippleLeft = 0;
  public netRippleRight = 0;
  public kickoffResetTimer = 0;
  public kickoffTeam: TeamSide = 'home';
  public stealGraceTimer = 0;
  public comboGraceTimer = 0;
  public activeRestart: ActiveRestart | null = null;
  public restartBannerTimer = 0;

  // Continuous held inputs & directional input buffer for special shot combos
  private heldKeys = new Set<string>();
  private recentInputBuffer: Array<{ dir: 'U' | 'D' | 'L' | 'R' | 'SPACE'; time: number }> = [];
  private queuedShot: { shotType: ShotType; expiresAt: number } | null = null;
  private virtualMove = { x: 0, y: 0, sprint: false };

  // Demo & Training mode flags
  public isDemoMode = true;
  public isTrainingMode = false;
  public trainingConfig: TrainingConfig = { teammates: 0, defenders: 0 };

  private onHudUpdate?: (snapshot: HudSnapshot) => void;
  private onMatchOver?: (snapshot: HudSnapshot) => void;
  private hudEmitAccum = 0;

  constructor(callbacks?: {
    onHudUpdate?: (snapshot: HudSnapshot) => void;
    onMatchOver?: (snapshot: HudSnapshot) => void;
  }) {
    this.onHudUpdate = callbacks?.onHudUpdate;
    this.onMatchOver = callbacks?.onMatchOver;

    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.particles.push({
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        life: 0,
        maxLife: 1,
        size: 3,
        color: '#ffffff',
      });
    }

    this.ball = this.createInitialBall();
    this.stats = this.createInitialStats();
    this.setupTeams();
  }

  private createInitialBall(): BallEntity {
    return {
      x: PITCH_CENTER_X,
      y: PITCH_CENTER_Y,
      vx: 0,
      vy: 0,
      radius: 8.5,
      ownerId: null,
      lastTouchTeam: null,
      lastTouchNumber: null,
      spinAngle: 0,
      kickCooldown: 0,
      isShot: false,
      shotType: 'normal',
      curveAx: 0,
      curveAy: 0,
      loftProgress: 0,
      loftDuration: 0,
      knucklePhase: 0,
      trail: [],
    };
  }

  private resetBallFlightEffects(): void {
    this.ball.shotType = 'normal';
    this.ball.curveAx = 0;
    this.ball.curveAy = 0;
    this.ball.loftProgress = 0;
    this.ball.loftDuration = 0;
    this.ball.knucklePhase = 0;
  }

  private createInitialStats(): MatchStats {
    return {
      homeScore: 0,
      awayScore: 0,
      homeShots: 0,
      awayShots: 0,
      homePasses: 0,
      awayPasses: 0,
      homeSaves: 0,
      awaySaves: 0,
      homePossessionSec: 0,
      awayPossessionSec: 0,
      timeRemainingSec: this.config.durationSec,
      lastGoalTeam: null,
      lastGoalNumber: null,
      goalBannerTimer: 0,
    };
  }

  public startNewMatch(newConfig: MatchConfig): void {
    this.config = { ...newConfig };
    this.isDemoMode = false;
    this.isTrainingMode = false;
    this.gameState = 'PLAYING';
    this.stats = this.createInitialStats();
    this.kickoffTeam = 'home';
    this.kickoffResetTimer = 0;
    this.activeRestart = null;
    this.restartBannerTimer = 0;
    this.isChargingShot = false;
    this.shotChargeTime = 0;
    this.preparedShotType = 'normal';
    this.queuedShot = null;
    this.comboGraceTimer = 0;
    this.shotCallout = null;
    this.hitstopTimer = 0;
    this.shakeTimer = 0;
    this.clearInputs();
    this.setupTeams();
    soundEngine.playWhistle();
    this.emitHud(true);
  }

  public startDemoLoop(): void {
    this.isDemoMode = true;
    this.isTrainingMode = false;
    this.gameState = 'TITLE_MENU';
    this.activeRestart = null;
    this.restartBannerTimer = 0;
    this.stats = this.createInitialStats();
    this.setupTeams();
  }

  public startTraining(
    newConfig: MatchConfig,
    trainingCfg: TrainingConfig = { teammates: 0, defenders: 0 }
  ): void {
    this.config = { ...newConfig };
    this.trainingConfig = {
      teammates: Math.round(clamp(trainingCfg.teammates, 0, 4)),
      defenders: Math.round(clamp(trainingCfg.defenders, 0, 4)),
    };
    this.isDemoMode = false;
    this.isTrainingMode = true;
    this.gameState = 'PLAYING';
    this.stats = this.createInitialStats();
    this.kickoffTeam = 'home';
    this.kickoffResetTimer = 0;
    this.activeRestart = null;
    this.restartBannerTimer = 0;
    this.isChargingShot = false;
    this.shotChargeTime = 0;
    this.preparedShotType = 'normal';
    this.queuedShot = null;
    this.comboGraceTimer = 0;
    this.shotCallout = null;
    this.hitstopTimer = 0;
    this.shakeTimer = 0;
    this.clearInputs();
    this.setupTrainingTeams();
    soundEngine.playWhistle();
    this.emitHud(true);
  }

  private getTrainingTeammateSlots() {
    return [
      { number: 10, role: 'MF' as const, x: PITCH_CENTER_X + 10, y: PITCH_CENTER_Y - 120 },
      { number: 7, role: 'FW' as const, x: PITCH_CENTER_X + 135, y: PITCH_CENTER_Y - 145 },
      { number: 11, role: 'FW' as const, x: PITCH_CENTER_X + 135, y: PITCH_CENTER_Y + 145 },
      { number: 8, role: 'MF' as const, x: PITCH_CENTER_X + 10, y: PITCH_CENTER_Y + 120 },
    ];
  }

  private getTrainingDefenderSlots(count: number) {
    const baseDefs = [
      { number: 4, role: 'DF' as const },
      { number: 5, role: 'DF' as const },
      { number: 2, role: 'DF' as const },
      { number: 3, role: 'DF' as const },
    ];
    const layouts: Record<number, Array<{ x: number; y: number }>> = {
      0: [],
      1: [{ x: PITCH_RIGHT - 210, y: PITCH_CENTER_Y }],
      2: [
        { x: PITCH_RIGHT - 210, y: PITCH_CENTER_Y - 72 },
        { x: PITCH_RIGHT - 210, y: PITCH_CENTER_Y + 72 },
      ],
      3: [
        { x: PITCH_RIGHT - 205, y: PITCH_CENTER_Y - 108 },
        { x: PITCH_RIGHT - 225, y: PITCH_CENTER_Y },
        { x: PITCH_RIGHT - 205, y: PITCH_CENTER_Y + 108 },
      ],
      4: [
        { x: PITCH_RIGHT - 205, y: PITCH_CENTER_Y - 140 },
        { x: PITCH_RIGHT - 190, y: PITCH_CENTER_Y - 48 },
        { x: PITCH_RIGHT - 190, y: PITCH_CENTER_Y + 48 },
        { x: PITCH_RIGHT - 205, y: PITCH_CENTER_Y + 140 },
      ],
    };
    const coords = layouts[count] ?? layouts[4];
    return coords.map((pos, idx) => ({
      ...baseDefs[idx],
      x: pos.x,
      y: pos.y,
    }));
  }

  private createPlayerEntity(
    team: TeamSide,
    number: number,
    role: PlayerEntity['role'],
    homeX: number,
    homeY: number,
    radius: number
  ): PlayerEntity {
    return {
      id: `${team}-${number}`,
      team,
      number,
      role,
      x: homeX,
      y: homeY,
      vx: 0,
      vy: 0,
      homeX,
      homeY,
      radius,
      facingAngle: team === 'home' ? 0 : Math.PI,
      tackleCooldown: 0,
      lungeTimer: 0,
      lungeType: null,
      lungeVx: 0,
      lungeVy: 0,
      stunTimer: 0,
      injuryTimer: 0,
      injuryHitCooldown: 0,
      comboAuraTimer: 0,
      aiThinkTimer: Math.random() * 0.15,
      aiTackleCooldown: 0.7 + Math.random() * 0.6,
      aiShootWindup: 0,
      gkHoldTimer: 0,
      flashTimer: 0,
    };
  }

  private setupTrainingTeams(): void {
    const radius = getPlayerRadius('7v7');
    this.players = [];

    // Human striker #9
    this.players.push(
      this.createPlayerEntity('home', 9, 'FW', PITCH_CENTER_X + 65, PITCH_CENTER_Y, radius)
    );

    // Optional Home Teammates
    const tmSlots = this.getTrainingTeammateSlots().slice(0, this.trainingConfig.teammates);
    for (const slot of tmSlots) {
      this.players.push(
        this.createPlayerEntity('home', slot.number, slot.role, slot.x, slot.y, radius)
      );
    }

    // Rival Goalkeeper #1
    this.players.push(
      this.createPlayerEntity('away', 1, 'GK', PITCH_RIGHT - 0.04 * PITCH_WIDTH, PITCH_CENTER_Y, radius)
    );

    // Optional Rival Defenders
    const defSlots = this.getTrainingDefenderSlots(this.trainingConfig.defenders);
    for (const slot of defSlots) {
      this.players.push(
        this.createPlayerEntity('away', slot.number, slot.role, slot.x, slot.y, radius)
      );
    }

    this.resetForKickoff('home');
  }

  public setTrainingCounts(teammates: number, defenders: number): void {
    if (!this.isTrainingMode) return;
    const nextTm = Math.round(clamp(teammates, 0, 4));
    const nextDef = Math.round(clamp(defenders, 0, 4));
    this.trainingConfig = { teammates: nextTm, defenders: nextDef };

    const radius = getPlayerRadius('7v7');
    const existingById = new Map(this.players.map((p) => [p.id, p]));
    const nextPlayers: PlayerEntity[] = [];

    // Keep human striker #9
    const striker =
      existingById.get('home-9') ??
      this.createPlayerEntity('home', 9, 'FW', PITCH_CENTER_X + 65, PITCH_CENTER_Y, radius);
    nextPlayers.push(striker);

    // Sync home teammates
    const desiredTm = this.getTrainingTeammateSlots().slice(0, nextTm);
    for (const slot of desiredTm) {
      const id = `home-${slot.number}`;
      const existing = existingById.get(id);
      if (existing) {
        existing.homeX = slot.x;
        existing.homeY = slot.y;
        nextPlayers.push(existing);
      } else {
        const created = this.createPlayerEntity('home', slot.number, slot.role, slot.x, slot.y, radius);
        this.spawnParticles(created.x, created.y, 10, '#34d399', 120);
        nextPlayers.push(created);
      }
    }

    // Keep rival GK #1
    const awayGk =
      existingById.get('away-1') ??
      this.createPlayerEntity('away', 1, 'GK', PITCH_RIGHT - 0.04 * PITCH_WIDTH, PITCH_CENTER_Y, radius);
    nextPlayers.push(awayGk);

    // Sync rival defenders
    const desiredDef = this.getTrainingDefenderSlots(nextDef);
    for (const slot of desiredDef) {
      const id = `away-${slot.number}`;
      const existing = existingById.get(id);
      if (existing) {
        existing.homeX = slot.x;
        existing.homeY = slot.y;
        nextPlayers.push(existing);
      } else {
        const created = this.createPlayerEntity('away', slot.number, slot.role, slot.x, slot.y, radius);
        this.spawnParticles(created.x, created.y, 10, '#f87171', 120);
        nextPlayers.push(created);
      }
    }

    const keptIds = new Set(nextPlayers.map((p) => p.id));
    if (this.ball.ownerId && !keptIds.has(this.ball.ownerId)) {
      this.ball.ownerId = null;
      this.ball.x = striker.x + striker.radius + this.ball.radius + 4;
      this.ball.y = striker.y;
      this.ball.vx = 0;
      this.ball.vy = 0;
    }
    if (!keptIds.has(this.activePlayerId)) {
      this.activePlayerId = striker.id;
    }

    this.players = nextPlayers;
    this.emitHud(true);
  }

  public resetTrainingBall(): void {
    if (!this.isTrainingMode) return;
    this.activeRestart = null;
    this.restartBannerTimer = 0;
    this.kickoffResetTimer = 0;
    this.resetForKickoff('home');
    this.emitHud(true);
  }

  public setupTeams(): void {
    const slots = FORMATIONS[this.config.format];
    const radius = getPlayerRadius(this.config.format);
    this.players = [];

    // Home team (left -> right)
    for (const slot of slots) {
      const homeX = PITCH_LEFT + slot.nx * PITCH_WIDTH;
      const homeY = PITCH_TOP + slot.ny * PITCH_HEIGHT;
      this.players.push({
        id: `home-${slot.number}`,
        team: 'home',
        number: slot.number,
        role: slot.role,
        x: homeX,
        y: homeY,
        vx: 0,
        vy: 0,
        homeX,
        homeY,
        radius,
        facingAngle: 0,
        tackleCooldown: 0,
        lungeTimer: 0,
        lungeType: null,
        lungeVx: 0,
        lungeVy: 0,
        stunTimer: 0,
        injuryTimer: 0,
        injuryHitCooldown: 0,
        comboAuraTimer: 0,
        aiThinkTimer: Math.random() * 0.15,
        aiTackleCooldown: 0.7 + Math.random() * 0.6,
        aiShootWindup: 0,
        gkHoldTimer: 0,
        flashTimer: 0,
      });
    }

    // Away team (right -> left)
    for (const slot of slots) {
      const homeX = PITCH_RIGHT - slot.nx * PITCH_WIDTH;
      const homeY = PITCH_TOP + slot.ny * PITCH_HEIGHT;
      this.players.push({
        id: `away-${slot.number}`,
        team: 'away',
        number: slot.number,
        role: slot.role,
        x: homeX,
        y: homeY,
        vx: 0,
        vy: 0,
        homeX,
        homeY,
        radius,
        facingAngle: Math.PI,
        tackleCooldown: 0,
        lungeTimer: 0,
        lungeType: null,
        lungeVx: 0,
        lungeVy: 0,
        stunTimer: 0,
        injuryTimer: 0,
        injuryHitCooldown: 0,
        comboAuraTimer: 0,
        aiThinkTimer: Math.random() * 0.15,
        aiTackleCooldown: 0.7 + Math.random() * 0.6,
        aiShootWindup: 0,
        gkHoldTimer: 0,
        flashTimer: 0,
      });
    }

    this.resetForKickoff(this.kickoffTeam);
  }

  private resetForKickoff(kickoffTeam: TeamSide): void {
    for (const p of this.players) {
      p.x = p.homeX;
      p.y = p.homeY;
      p.vx = 0;
      p.vy = 0;
      p.lungeTimer = 0;
      p.lungeType = null;
      p.stunTimer = 0;
      p.injuryTimer = 0;
      p.injuryHitCooldown = 0;
      p.comboAuraTimer = 0;
      p.pendingComboShot = undefined;
      p.tackleCooldown = 0;
      p.aiTackleCooldown = 0.7 + Math.random() * 0.5;
      p.aiShootWindup = 0;
      p.aiPendingShotType = undefined;
      p.gkHoldTimer = 0;
      p.facingAngle = p.team === 'home' ? 0 : Math.PI;
    }

    // Place striker near center spot for kickoff team
    const kicker =
      this.players.find((p) => p.team === kickoffTeam && p.role === 'FW') ??
      this.players.find((p) => p.team === kickoffTeam && p.role !== 'GK');
    if (kicker && !this.isTrainingMode) {
      kicker.x = kickoffTeam === 'home' ? PITCH_CENTER_X - 24 : PITCH_CENTER_X + 24;
      kicker.y = PITCH_CENTER_Y;
    }

    const homeStriker =
      this.players.find((p) => p.id === 'home-9') ??
      this.players.find((p) => p.team === 'home' && p.role === 'FW') ??
      this.players.find((p) => p.team === 'home' && p.role !== 'GK');
    if (homeStriker) {
      this.activePlayerId = homeStriker.id;
    }

    this.ball = this.createInitialBall();
    if (this.isTrainingMode && homeStriker) {
      this.ball.ownerId = homeStriker.id;
      this.ball.x = homeStriker.x + homeStriker.radius + this.ball.radius + 3;
      this.ball.y = homeStriker.y;
      this.stealGraceTimer = 0.5;
    }
    this.isChargingShot = false;
    this.shotChargeTime = 0;
    this.preparedShotType = 'normal';
    this.queuedShot = null;
    this.comboGraceTimer = 0;
    this.shotCallout = null;
  }

  public clearInputs(): void {
    this.heldKeys.clear();
    this.recentInputBuffer = [];
    this.virtualMove = { x: 0, y: 0, sprint: false };
    this.isChargingShot = false;
    this.shotChargeTime = 0;
    this.preparedShotType = 'normal';
    this.queuedShot = null;
    this.comboGraceTimer = 0;
  }

  public setVirtualMove(x: number, y: number, sprint = false): void {
    this.virtualMove.x = clamp(x, -1, 1);
    this.virtualMove.y = clamp(y, -1, 1);
    this.virtualMove.sprint = sprint;
  }

  /**
   * Only WASD + Space record into the combo buffer.
   * Arrow keys are dedicated strictly to player movement so combos never conflict with dribbling.
   */
  private mapComboDirection(code: string): 'U' | 'D' | 'L' | 'R' | 'SPACE' | null {
    if (code === 'KeyW') return 'U';
    if (code === 'KeyS') return 'D';
    if (code === 'KeyA') return 'L';
    if (code === 'KeyD') return 'R';
    if (code === 'Space') return 'SPACE';
    return null;
  }

  public handleKeyDown(code: string): void {
    if (this.gameState !== 'PLAYING' || this.isDemoMode) return;

    const wasHeld = this.heldKeys.has(code);
    this.heldKeys.add(code);

    if (!wasHeld) {
      // Record only WASD & Space (never Arrow keys, Z, C, V) for special shot combos
      const comboDir = this.mapComboDirection(code);
      if (comboDir) {
        const now = performance.now();
        // Reset stale combo chain if too much idle time elapsed since previous tap
        const lastEntry = this.recentInputBuffer[this.recentInputBuffer.length - 1];
        if (lastEntry && now - lastEntry.time > 650) {
          this.recentInputBuffer.length = 0;
        }
        this.recentInputBuffer.push({ dir: comboDir, time: now });
        if (this.recentInputBuffer.length > 8) {
          this.recentInputBuffer.shift();
        }
        // If Space is pressed right after X during fast simultaneous Espacio+X, upgrade to finesse
        if (comboDir === 'SPACE' && this.isChargingShot && this.preparedShotType === 'normal') {
          this.preparedShotType = 'finesse';
        }
        // Grant combo breathing room so CPUs don't instantly tackle while executing WASD combos
        const active = this.getActivePlayer();
        if (
          active &&
          (this.ball.ownerId === active.id || (!this.ball.ownerId && this.ball.lastTouchTeam === 'home'))
        ) {
          this.comboGraceTimer = 1.05;
        }
      }

      // If human team is taking a set-piece restart (saque de banda / córner / saque de puerta)
      if (this.activeRestart && this.activeRestart.ready && this.activeRestart.team === 'home') {
        if (code === 'KeyZ' || code === 'Space') {
          this.executeRestartKick(false);
        } else if (code === 'KeyX') {
          this.executeRestartKick(true);
        }
        return;
      }

      const activePlayer = this.getActivePlayer();
      if (activePlayer && activePlayer.comboAuraTimer > 0) {
        return;
      }

      // Pass or Switch (Z only — Space is reserved for Espacio+X special shots)
      if (code === 'KeyZ') {
        this.triggerPassOrSwitch();
      }
      // Switch manually
      if (code === 'KeyC') {
        this.switchToNearestPlayer();
      }
      // Shoot charge, first-time volley buffer, or Normal Tackle
      if (code === 'KeyX') {
        const active = activePlayer;
        if (active && this.ball.ownerId === active.id) {
          this.preparedShotType = this.resolvePreparedShotType();
          this.isChargingShot = true;
          this.shotChargeTime = 0;
        } else if (
          active &&
          !this.ball.ownerId &&
          this.ball.lastTouchTeam === 'home' &&
          dist(active.x, active.y, this.ball.x, this.ball.y) < 72
        ) {
          // Buffer fast combo shot when pass is about to reach controlled player
          this.queuedShot = {
            shotType: this.resolvePreparedShotType(),
            expiresAt: performance.now() + 240,
          };
          this.recentInputBuffer.length = 0;
        } else {
          this.triggerTackle('normal');
        }
      }
      // Aggressive Tackle
      if (code === 'KeyV') {
        const active = activePlayer;
        if (!active || this.ball.ownerId !== active.id) {
          this.triggerTackle('aggressive');
        }
      }
    }
  }

  public handleKeyUp(code: string): void {
    this.heldKeys.delete(code);
    if (code === 'KeyX' && this.isChargingShot) {
      this.releaseShot();
    }
  }

  public triggerTouchPass(): void {
    if (this.gameState !== 'PLAYING' || this.isDemoMode) return;
    if (this.activeRestart && this.activeRestart.ready && this.activeRestart.team === 'home') {
      this.executeRestartKick(false);
      return;
    }
    this.triggerPassOrSwitch();
  }

  public triggerTouchShootOrTackle(): void {
    if (this.gameState !== 'PLAYING' || this.isDemoMode) return;
    if (this.activeRestart && this.activeRestart.ready && this.activeRestart.team === 'home') {
      this.executeRestartKick(true);
      return;
    }
    const active = this.getActivePlayer();
    if (active && this.ball.ownerId === active.id) {
      this.isChargingShot = true;
      this.shotChargeTime = 0.28;
      this.releaseShot();
    } else {
      this.triggerTackle('normal');
    }
  }

  public triggerTouchAggressiveTackle(): void {
    if (this.gameState !== 'PLAYING' || this.isDemoMode) return;
    const active = this.getActivePlayer();
    if (!active || this.ball.ownerId !== active.id) {
      this.triggerTackle('aggressive');
    }
  }

  public triggerTouchSwitch(): void {
    if (this.gameState !== 'PLAYING' || this.isDemoMode) return;
    this.switchToNearestPlayer();
  }

  public handlePitchClick(logicalX: number, logicalY: number): void {
    if (this.gameState !== 'PLAYING' || this.isDemoMode) return;
    const active = this.getActivePlayer();
    if (!active) return;

    if (this.activeRestart && this.activeRestart.ready && this.activeRestart.team === 'home') {
      const taker = this.players.find((p) => p.id === this.activeRestart?.takerId);
      if (taker) {
        taker.facingAngle = Math.atan2(logicalY - taker.y, logicalX - taker.x);
        const clickedTeammate = this.players.find(
          (p) => p.team === 'home' && p.id !== taker.id && dist(p.x, p.y, logicalX, logicalY) < 46
        );
        this.executeRestartKick(false, clickedTeammate);
      }
      return;
    }

    if (this.ball.ownerId === active.id) {
      const dx = logicalX - active.x;
      const dy = logicalY - active.y;
      const angle = Math.atan2(dy, dx);
      active.facingAngle = angle;

      // Check if user clicked close to a teammate -> smart pass!
      const clickedTeammate = this.players.find(
        (p) => p.team === 'home' && p.id !== active.id && dist(p.x, p.y, logicalX, logicalY) < 42
      );
      if (clickedTeammate) {
        this.executePass(active, clickedTeammate);
      } else {
        this.executeShot(active, angle, 0.78);
      }
    } else {
      // Clicking near a home player switches to them; otherwise switches to closest
      const clickedHome = this.players.find(
        (p) => p.team === 'home' && dist(p.x, p.y, logicalX, logicalY) < 36
      );
      if (clickedHome) {
        this.activePlayerId = clickedHome.id;
      } else {
        this.switchToNearestPlayer();
      }
    }
  }

  public getActivePlayer(): PlayerEntity | undefined {
    return this.players.find((p) => p.id === this.activePlayerId);
  }

  private getHeldVector(): { x: number; y: number; sprint: boolean } {
    let x = this.virtualMove.x;
    let y = this.virtualMove.y;
    // Arrow keys exclusively move the player; WASD keys are reserved strictly for shot combos
    if (this.heldKeys.has('ArrowLeft')) x -= 1;
    if (this.heldKeys.has('ArrowRight')) x += 1;
    if (this.heldKeys.has('ArrowUp')) y -= 1;
    if (this.heldKeys.has('ArrowDown')) y += 1;

    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }

    const sprint =
      this.virtualMove.sprint ||
      this.heldKeys.has('ShiftLeft') ||
      this.heldKeys.has('ShiftRight');

    return { x, y, sprint };
  }

  private findBestPassTarget(passer: PlayerEntity, preferredAngle?: number): PlayerEntity | null {
    const aimAngle = preferredAngle ?? passer.facingAngle;
    const aimX = Math.cos(aimAngle);
    const aimY = Math.sin(aimAngle);

    let best: PlayerEntity | null = null;
    let bestScore = -Infinity;

    for (const tm of this.players) {
      if (tm.team !== passer.team || tm.id === passer.id) continue;
      const dx = tm.x - passer.x;
      const dy = tm.y - passer.y;
      const d = Math.hypot(dx, dy);
      if (d < 10) continue;

      const dot = (dx / d) * aimX + (dy / d) * aimY; // -1..1
      // Prefer teammates in the direction we're facing, at comfortable passing range
      const distPenalty = Math.abs(d - 210) * 0.0018;
      const gkPenalty = tm.role === 'GK' && d > 250 ? 0.5 : 0;
      const score = dot * 1.8 - distPenalty - gkPenalty;

      if (score > bestScore) {
        bestScore = score;
        best = tm;
      }
    }
    return best;
  }

  private triggerPassOrSwitch(): void {
    const active = this.getActivePlayer();
    if (!active) return;

    if (this.ball.ownerId === active.id) {
      const held = this.getHeldVector();
      const angle = Math.hypot(held.x, held.y) > 0.2 ? Math.atan2(held.y, held.x) : active.facingAngle;
      const target = this.findBestPassTarget(active, angle);
      if (target) {
        this.executePass(active, target);
      } else {
        this.executePassInDirection(active, angle);
      }
      this.isChargingShot = false;
      this.shotChargeTime = 0;
      this.preparedShotType = 'normal';
    } else {
      this.switchToNearestPlayer();
    }
  }

  private switchToNearestPlayer(): void {
    const active = this.getActivePlayer();
    if (active && this.ball.ownerId === active.id) {
      return;
    }

    let best: PlayerEntity | null = null;
    let bestDist = Infinity;

    for (const p of this.players) {
      if (p.team !== 'home' || p.id === this.activePlayerId) continue;
      const d = dist(p.x, p.y, this.ball.x, this.ball.y);
      // Avoid switching to GK unless GK is very close to ball
      if (p.role === 'GK' && d > 130) continue;
      if (d < bestDist) {
        bestDist = d;
        best = p;
      }
    }

    if (best) {
      this.activePlayerId = best.id;
    }
  }

  private executePass(passer: PlayerEntity, target: PlayerEntity): void {
    // Lead the target slightly based on their velocity
    const distance = dist(passer.x, passer.y, target.x, target.y);
    const passSpeed = clamp(420 + distance * 0.65, 440, 720);
    const travelTime = distance / passSpeed;
    const leadX = clamp(target.x + target.vx * travelTime * 0.45, PITCH_LEFT + 16, PITCH_RIGHT - 16);
    const leadY = clamp(target.y + target.vy * travelTime * 0.45, PITCH_TOP + 16, PITCH_BOTTOM - 16);

    const angle = Math.atan2(leadY - passer.y, leadX - passer.x);
    passer.facingAngle = angle;

    this.ball.ownerId = null;
    this.ball.kickCooldown = 0.14;
    this.ball.isShot = false;
    this.resetBallFlightEffects();
    this.ball.lastTouchTeam = passer.team;
    this.ball.lastTouchNumber = passer.number;
    this.ball.x = passer.x + Math.cos(angle) * (passer.radius + this.ball.radius + 3);
    this.ball.y = passer.y + Math.sin(angle) * (passer.radius + this.ball.radius + 3);
    this.ball.vx = Math.cos(angle) * passSpeed;
    this.ball.vy = Math.sin(angle) * passSpeed;

    if (passer.team === 'home') {
      this.stats.homePasses += 1;
      if (!this.isDemoMode) {
        this.activePlayerId = target.id;
        this.emitHud(true);
      }
    } else {
      this.stats.awayPasses += 1;
    }

    this.spawnParticles(this.ball.x, this.ball.y, 5, '#e2e8f0', 90);
    soundEngine.playPass();
  }

  private executePassInDirection(passer: PlayerEntity, angle: number): void {
    const speed = 520;
    passer.facingAngle = angle;
    this.ball.ownerId = null;
    this.ball.kickCooldown = 0.14;
    this.ball.isShot = false;
    this.resetBallFlightEffects();
    this.ball.lastTouchTeam = passer.team;
    this.ball.lastTouchNumber = passer.number;
    this.ball.x = passer.x + Math.cos(angle) * (passer.radius + this.ball.radius + 3);
    this.ball.y = passer.y + Math.sin(angle) * (passer.radius + this.ball.radius + 3);
    this.ball.vx = Math.cos(angle) * speed;
    this.ball.vy = Math.sin(angle) * speed;

    if (passer.team === 'home' && !this.isDemoMode) {
      const receiver = this.findBestPassTarget(passer, angle);
      if (receiver) {
        this.activePlayerId = receiver.id;
        this.emitHud(true);
      }
    }
    soundEngine.playPass();
  }

  private computeHumanShotAngle(shooter: PlayerEntity): number {
    const held = this.getHeldVector();
    const goalCenterX = shooter.team === 'home' ? PITCH_RIGHT : PITCH_LEFT;
    const aimTargetY = clamp(PITCH_CENTER_Y + held.y * 66, GOAL_TOP + 12, GOAL_BOTTOM - 12);
    let shotAngle = Math.atan2(aimTargetY - shooter.y, goalCenterX - shooter.x);

    const isBackward = shooter.team === 'home' ? held.x < -0.5 : held.x > 0.5;
    if (isBackward) {
      shotAngle = Math.atan2(held.y, held.x);
    } else if (Math.hypot(held.x, held.y) > 0.25) {
      const manualAngle = Math.atan2(held.y, held.x);
      const goalAngle = Math.atan2(aimTargetY - shooter.y, goalCenterX - shooter.x);
      const diff = Math.atan2(Math.sin(manualAngle - goalAngle), Math.cos(manualAngle - goalAngle));
      shotAngle = goalAngle + clamp(diff, -0.42, 0.42);
    }
    return shotAngle;
  }

  private releaseShot(): void {
    const active = this.getActivePlayer();
    this.isChargingShot = false;
    if (!active || this.ball.ownerId !== active.id) {
      this.shotChargeTime = 0;
      this.preparedShotType = 'normal';
      return;
    }

    let powerRatio = clamp(0.38 + (this.shotChargeTime / this.maxShotCharge) * 0.62, 0.38, 1);
    this.shotChargeTime = 0;

    const shotAngle = this.computeHumanShotAngle(active);

    let shotType = this.preparedShotType;
    if (shotType === 'normal' && this.heldKeys.has('Space')) {
      shotType = 'finesse';
    }
    // Give fast special combo taps strong baseline power so quick combos never feel weak
    if (shotType === 'power') powerRatio = Math.max(powerRatio, 0.86);
    else if (shotType === 'knuckle') powerRatio = Math.max(powerRatio, 0.8);
    else if (shotType === 'finesse') powerRatio = Math.max(powerRatio, 0.78);
    else if (shotType === 'chip') powerRatio = Math.max(powerRatio, 0.72);

    this.preparedShotType = 'normal';
    this.recentInputBuffer.length = 0;
    this.comboGraceTimer = 0;

    if (shotType !== 'normal') {
      this.beginComboShotWindup(active, shotType, powerRatio);
    } else {
      this.executeShot(active, shotAngle, powerRatio, 'normal');
    }
  }

  private beginComboShotWindup(shooter: PlayerEntity, shotType: ShotType, powerRatio: number): void {
    shooter.comboAuraTimer = 0.28;
    shooter.pendingComboShot = { type: shotType, power: powerRatio };
    this.stealGraceTimer = Math.max(this.stealGraceTimer, 0.35);
    this.comboGraceTimer = 0;
    this.spawnParticles(shooter.x, shooter.y, 16, '#38bdf8', 175);
    this.spawnParticles(shooter.x, shooter.y, 8, '#e0f2fe', 120);
    soundEngine.playComboCharge();
  }

  /**
   * Resolves special shots on KeyX press (WASD + Space only; Arrow keys do not affect combos):
   * - W -> A -> D -> X -> 'power' (Cañonazo)
   * - S -> W -> X -> 'chip' (Vaselina)
   * - A -> D -> X or D -> A -> X -> 'knuckle' (Latigazo)
   * - Espacio + X -> 'finesse' (Tiro con Rosca)
   * - Plain X -> 'normal'
   */
  private resolvePreparedShotType(): ShotType {
    const now = performance.now();
    const cutoff = now - 950;
    this.recentInputBuffer = this.recentInputBuffer.filter((item) => item.time >= cutoff);

    // Extract directional WASD sequence first so intentional rapid combos win over Space
    const dirs: Array<'U' | 'D' | 'L' | 'R'> = [];
    for (const item of this.recentInputBuffer) {
      if (item.dir !== 'SPACE') {
        dirs.push(item.dir);
      }
    }

    const len = dirs.length;
    // 1. Longest suffix first: W -> A -> D -> X (Cañonazo)
    if (len >= 3 && dirs[len - 3] === 'U' && dirs[len - 2] === 'L' && dirs[len - 1] === 'R') {
      return 'power';
    }
    // 2. S -> W -> X (Vaselina / Globo)
    if (len >= 2 && dirs[len - 2] === 'D' && dirs[len - 1] === 'U') {
      return 'chip';
    }
    // 3. A -> D -> X or D -> A -> X (Latigazo / Swerve)
    if (
      len >= 2 &&
      ((dirs[len - 2] === 'L' && dirs[len - 1] === 'R') ||
        (dirs[len - 2] === 'R' && dirs[len - 1] === 'L'))
    ) {
      return 'knuckle';
    }

    // 4. Simultaneous / recent Espacio + X -> Rosca
    const recentSpace = this.recentInputBuffer.some(
      (item) => item.dir === 'SPACE' && now - item.time <= 300
    );
    if (this.heldKeys.has('Space') || recentSpace) {
      return 'finesse';
    }

    return 'normal';
  }

  private executeShot(
    shooter: PlayerEntity,
    angle: number,
    powerRatio: number,
    shotType: ShotType = 'normal'
  ): void {
    const speedMult =
      shotType === 'power'
        ? 1.4
        : shotType === 'knuckle'
        ? 1.24
        : shotType === 'finesse'
        ? 1.08
        : shotType === 'chip'
        ? 0.72
        : 1;
    const shotSpeed = (660 + powerRatio * 340) * speedMult;
    let launchAngle = angle;

    this.resetBallFlightEffects();
    this.ball.shotType = shotType;

    const oppGoalX = shooter.team === 'home' ? PITCH_RIGHT : PITCH_LEFT;
    const oppGk = this.players.find((pl) => pl.team !== shooter.team && pl.role === 'GK');

    if (shotType === 'finesse') {
      // Curve around keeper toward far post: bend inward toward goal center or away from GK
      let desiredScreenYSign = 1;
      if (shooter.y < PITCH_CENTER_Y - 22) {
        desiredScreenYSign = 1;
      } else if (shooter.y > PITCH_CENTER_Y + 22) {
        desiredScreenYSign = -1;
      } else if (oppGk) {
        desiredScreenYSign = oppGk.y >= shooter.y ? -1 : 1;
      }
      const perpYBase = Math.cos(launchAngle);
      const curveSign = perpYBase * desiredScreenYSign >= 0 ? 1 : -1;
      // Start slightly outward so the curve bends right inside the goalpost
      launchAngle -= curveSign * 0.16;
      const perpX = -Math.sin(launchAngle);
      const perpY = Math.cos(launchAngle);
      const curveForce = 460 * (0.72 + 0.28 * powerRatio);
      this.ball.curveAx = perpX * curveSign * curveForce;
      this.ball.curveAy = perpY * curveSign * curveForce;
    } else if (shotType === 'chip') {
      const distToGoal = dist(shooter.x, shooter.y, oppGoalX, PITCH_CENTER_Y);
      this.ball.loftDuration = clamp(distToGoal / Math.max(320, shotSpeed * 0.92), 0.44, 0.88);
      this.ball.loftProgress = 0.01;
    } else if (shotType === 'knuckle') {
      this.ball.knucklePhase = Math.random() * Math.PI * 2;
    }

    shooter.facingAngle = launchAngle;

    this.ball.ownerId = null;
    this.ball.kickCooldown = 0.16;
    this.ball.isShot = true;
    this.ball.lastTouchTeam = shooter.team;
    this.ball.lastTouchNumber = shooter.number;
    this.ball.x = shooter.x + Math.cos(launchAngle) * (shooter.radius + this.ball.radius + 4);
    this.ball.y = shooter.y + Math.sin(launchAngle) * (shooter.radius + this.ball.radius + 4);
    this.ball.vx = Math.cos(launchAngle) * shotSpeed;
    this.ball.vy = Math.sin(launchAngle) * shotSpeed;

    if (shooter.team === 'home') {
      this.stats.homeShots += 1;
    } else {
      this.stats.awayShots += 1;
    }

    if (shotType === 'power') {
      this.hitstopTimer = 0.025;
      this.shakeTimer = 0.16;
      this.shakeIntensity = 5.5;
      this.spawnParticles(this.ball.x, this.ball.y, 18, '#fb923c', 220);
      this.spawnParticles(this.ball.x, this.ball.y, 10, '#fef08a', 170);
    } else if (shotType === 'finesse') {
      this.spawnParticles(this.ball.x, this.ball.y, 14, '#34d399', 165);
    } else if (shotType === 'chip') {
      this.spawnParticles(this.ball.x, this.ball.y, 12, '#38bdf8', 130);
    } else if (shotType === 'knuckle') {
      this.shakeTimer = 0.09;
      this.shakeIntensity = 3;
      this.spawnParticles(this.ball.x, this.ball.y, 14, '#c084fc', 190);
    } else {
      this.spawnParticles(this.ball.x, this.ball.y, 10, '#facc15', 160);
    }

    if (!this.isDemoMode && shotType !== 'normal') {
      const calloutMap: Record<Exclude<ShotType, 'normal'>, { text: string; color: string }> = {
        power: { text: '¡CAÑONAZO!', color: '#fb923c' },
        finesse: { text: '¡ROSCA!', color: '#34d399' },
        chip: { text: '¡VASELINA!', color: '#38bdf8' },
        knuckle: { text: '¡LATIGAZO!', color: '#c084fc' },
      };
      const badge = calloutMap[shotType];
      this.shotCallout = {
        text: badge.text,
        color: badge.color,
        x: shooter.x,
        y: Math.max(PITCH_TOP + 24, shooter.y - 28),
        timer: 0.9,
      };
    }

    soundEngine.playShot(powerRatio, shotType);
  }

  private triggerTackle(tackleType: TackleType = 'normal', actor?: PlayerEntity): void {
    const player = actor ?? this.getActivePlayer();
    if (!player || player.tackleCooldown > 0 || player.lungeTimer > 0 || player.stunTimer > 0) return;

    const isAggressive = tackleType === 'aggressive';
    let angle = player.facingAngle;

    if (!actor) {
      const held = this.getHeldVector();
      const distToBall = dist(player.x, player.y, this.ball.x, this.ball.y);
      // Assist aim toward ball when tackling within natural range so user doesn't have to pixel-align
      if (distToBall < (isAggressive ? 210 : 155) && Math.hypot(held.x, held.y) <= 0.2) {
        angle = Math.atan2(this.ball.y - player.y, this.ball.x - player.x);
      } else if (Math.hypot(held.x, held.y) > 0.2) {
        // Blend held direction slightly toward ball if ball is right nearby
        const manualAngle = Math.atan2(held.y, held.x);
        if (distToBall < 130) {
          const ballAngle = Math.atan2(this.ball.y - player.y, this.ball.x - player.x);
          const diff = Math.atan2(Math.sin(ballAngle - manualAngle), Math.cos(ballAngle - manualAngle));
          angle = Math.abs(diff) < 0.75 ? manualAngle + diff * 0.5 : manualAngle;
        } else {
          angle = manualAngle;
        }
      }
    } else {
      angle = Math.atan2(this.ball.y - player.y, this.ball.x - player.x);
    }

    player.facingAngle = angle;
    player.lungeType = tackleType;
    player.lungeTimer = isAggressive ? 0.25 : 0.20;
    player.tackleCooldown = isAggressive ? 1.1 : 0.48;
    const lungeSpeed = isAggressive ? 570 : 460;
    player.lungeVx = Math.cos(angle) * lungeSpeed;
    player.lungeVy = Math.sin(angle) * lungeSpeed;

    this.spawnParticles(
      player.x,
      player.y,
      isAggressive ? 12 : 6,
      isAggressive ? '#fb923c' : '#86efac',
      isAggressive ? 140 : 80
    );
    soundEngine.playTackle(isAggressive);
  }

  public update(rawDt: number): void {
    const dt = Math.min(rawDt, 0.05);

    if (this.gameState !== 'PLAYING' && !this.isDemoMode) {
      return;
    }

    if (this.stealGraceTimer > 0) {
      this.stealGraceTimer = Math.max(0, this.stealGraceTimer - dt);
    }
    if (this.comboGraceTimer > 0) {
      this.comboGraceTimer = Math.max(0, this.comboGraceTimer - dt);
    }

    // Decay visual effects
    if (this.shakeTimer > 0) {
      this.shakeTimer = Math.max(0, this.shakeTimer - dt);
    }
    if (this.netRippleLeft > 0) this.netRippleLeft = Math.max(0, this.netRippleLeft - dt * 2.5);
    if (this.netRippleRight > 0) this.netRippleRight = Math.max(0, this.netRippleRight - dt * 2.5);
    if (this.stats.goalBannerTimer > 0) {
      this.stats.goalBannerTimer = Math.max(0, this.stats.goalBannerTimer - dt);
    }
    if (this.restartBannerTimer > 0) {
      this.restartBannerTimer = Math.max(0, this.restartBannerTimer - dt);
    }
    if (this.shotCallout) {
      this.shotCallout.timer -= dt;
      if (this.shotCallout.timer <= 0) {
        this.shotCallout = null;
      }
    }

    this.updateParticles(dt);

    // Hitstop freeze on dramatic moments (goals / post hits)
    if (this.hitstopTimer > 0) {
      this.hitstopTimer = Math.max(0, this.hitstopTimer - dt);
      return;
    }

    // Active set-piece restart (throw-in, corner kick, goal kick)
    if (this.activeRestart) {
      this.updateActiveRestart(dt);
      return;
    }

    // Goal kickoff reset pause (keep ball inside the net box so fast shots don't clip through back net)
    if (this.kickoffResetTimer > 0) {
      this.kickoffResetTimer -= dt;
      this.ball.x += this.ball.vx * dt;
      this.ball.y += this.ball.vy * dt;
      this.ball.vx *= Math.pow(0.08, dt);
      this.ball.vy *= Math.pow(0.08, dt);
      const r = this.ball.radius;
      this.ball.y = clamp(this.ball.y, GOAL_TOP + r, GOAL_BOTTOM - r);
      if (this.ball.x < PITCH_LEFT) {
        this.ball.x = clamp(this.ball.x, PITCH_LEFT - GOAL_DEPTH + r, PITCH_LEFT);
      } else if (this.ball.x > PITCH_RIGHT) {
        this.ball.x = clamp(this.ball.x, PITCH_RIGHT, PITCH_RIGHT + GOAL_DEPTH - r);
      }
      if (this.kickoffResetTimer <= 0) {
        this.resetForKickoff(this.kickoffTeam);
      }
      return;
    }

    // Clock & possession tracking (active competitive match only; training is endless)
    if (!this.isDemoMode) {
      if (this.ball.ownerId) {
        const owner = this.players.find((p) => p.id === this.ball.ownerId);
        if (owner?.team === 'home') this.stats.homePossessionSec += dt;
        else if (owner?.team === 'away') this.stats.awayPossessionSec += dt;
      }
      if (!this.isTrainingMode) {
        this.stats.timeRemainingSec = Math.max(0, this.stats.timeRemainingSec - dt);
        if (this.stats.timeRemainingSec <= 0) {
          this.gameState = 'GAME_OVER';
          this.clearInputs();
          soundEngine.playWhistle();
          const finalSnap = this.getHudSnapshot();
          this.onHudUpdate?.(finalSnap);
          this.onMatchOver?.(finalSnap);
          return;
        }
      }
    }

    // Charge shot if holding shot button
    if (this.isChargingShot) {
      const active = this.getActivePlayer();
      if (!active || this.ball.ownerId !== active.id) {
        this.isChargingShot = false;
        this.shotChargeTime = 0;
      } else {
        this.shotChargeTime = Math.min(this.maxShotCharge, this.shotChargeTime + dt);
      }
    }

    // Update players
    this.updatePlayers(dt);
    this.resolvePlayerCollisions();

    // Update ball
    this.updateBall(dt);

    // Update pass target indicator for human player
    const active = this.getActivePlayer();
    if (!this.isDemoMode && active && this.ball.ownerId === active.id) {
      const held = this.getHeldVector();
      const angle = Math.hypot(held.x, held.y) > 0.2 ? Math.atan2(held.y, held.x) : active.facingAngle;
      this.passTargetId = this.findBestPassTarget(active, angle)?.id ?? null;
    } else {
      this.passTargetId = null;
    }

    // Throttle React HUD updates to ~10Hz so Canvas stays isolated at 60fps
    this.hudEmitAccum += dt;
    if (!this.isDemoMode && this.hudEmitAccum >= 0.1) {
      this.hudEmitAccum = 0;
      this.emitHud(false);
    }
  }

  private getDifficultyParams(diff: Difficulty) {
    if (diff === 'facil') {
      return {
        speedMult: 0.68,
        reactInterval: 0.35,
        shotAccuracy: 0.55,
        specialShotChance: 0.06,
        aiTackleCd: 2.4,
        jockeyDist: 72,
        tackleChance: 0.22,
        gkPosSpeed: 105,
        gkDiveSpeed: 125,
        gkAccel: 6.5,
        gkPredictWeight: 0.25,
        gkCatchBonus: 1,
        gkStepOut: 22,
      };
    }
    if (diff === 'dificil') {
      return {
        speedMult: 0.98,
        reactInterval: 0.1,
        shotAccuracy: 0.88,
        specialShotChance: 0.72,
        aiTackleCd: 0.95,
        jockeyDist: 44,
        tackleChance: 0.75,
        gkPosSpeed: 175,
        gkDiveSpeed: 225,
        gkAccel: 13.5,
        gkPredictWeight: 0.85,
        gkCatchBonus: 4.5,
        gkStepOut: 34,
      };
    }
    return {
      speedMult: 0.82,
      reactInterval: 0.22,
      shotAccuracy: 0.72,
      specialShotChance: 0.32,
      aiTackleCd: 1.75,
      jockeyDist: 60,
      tackleChance: 0.42,
      gkPosSpeed: 135,
      gkDiveSpeed: 168,
      gkAccel: 9.0,
      gkPredictWeight: 0.52,
      gkCatchBonus: 2.5,
      gkStepOut: 28,
    };
  }

  private updatePlayers(dt: number): void {
    const diffParams = this.getDifficultyParams(this.config.difficulty);
    const ballOwner = this.ball.ownerId ? this.players.find((p) => p.id === this.ball.ownerId) : null;

    // Precompute single closest non-GK presser for each team so CPUs don't swarm blindly
    const closestHomeId = this.findClosestOutfieldId('home', this.activePlayerId);
    const closestAwayId = this.findClosestOutfieldId('away', '');

    for (const p of this.players) {
      if (p.tackleCooldown > 0) p.tackleCooldown = Math.max(0, p.tackleCooldown - dt);
      if (p.aiTackleCooldown > 0) p.aiTackleCooldown = Math.max(0, p.aiTackleCooldown - dt);
      if (p.flashTimer > 0) p.flashTimer = Math.max(0, p.flashTimer - dt);
      if (p.injuryHitCooldown > 0) p.injuryHitCooldown = Math.max(0, p.injuryHitCooldown - dt);

      // Injured CPU cannot move or act until recovery timer expires
      if (p.injuryTimer > 0) {
        if (this.ball.ownerId === p.id) {
          this.ball.ownerId = null;
        }
        p.injuryTimer = Math.max(0, p.injuryTimer - dt);
        p.vx *= Math.pow(0.03, dt);
        p.vy *= Math.pow(0.03, dt);
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        this.clampPlayerToPitch(p);
        continue;
      }

      // Active combo blue-fire windup -> spawns blue flames around player, then unleashes shot!
      if (p.comboAuraTimer > 0) {
        p.comboAuraTimer = Math.max(0, p.comboAuraTimer - dt);
        this.stealGraceTimer = Math.max(this.stealGraceTimer, 0.12);
        this.spawnParticles(
          p.x + (Math.random() - 0.5) * p.radius * 1.9,
          p.y + (Math.random() - 0.5) * p.radius * 1.9,
          2,
          Math.random() < 0.65 ? '#38bdf8' : '#93c5fd',
          115
        );
        if (p.comboAuraTimer <= 0 && p.pendingComboShot) {
          const pending = p.pendingComboShot;
          p.pendingComboShot = undefined;
          if (this.ball.ownerId === p.id) {
            const shotAngle = this.computeHumanShotAngle(p);
            this.executeShot(p, shotAngle, pending.power, pending.type);
          }
        }
      }

      if (p.stunTimer > 0) {
        p.stunTimer = Math.max(0, p.stunTimer - dt);
        p.vx *= Math.pow(0.06, dt);
        p.vy *= Math.pow(0.06, dt);
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        this.clampPlayerToPitch(p);
        continue;
      }

      if (p.lungeTimer > 0) {
        p.lungeTimer = Math.max(0, p.lungeTimer - dt);
        const decay = p.lungeType === 'aggressive' ? 0.94 : 0.92;
        p.lungeVx *= decay;
        p.lungeVy *= decay;
        p.vx = p.lungeVx;
        p.vy = p.lungeVy;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.lungeTimer <= 0) {
          p.lungeType = null;
        }
        this.clampPlayerToPitch(p);
        continue;
      }

      const isHumanControlled = !this.isDemoMode && p.id === this.activePlayerId;

      if (isHumanControlled) {
        this.updateHumanPlayer(p, dt);
      } else if (p.role === 'GK') {
        this.updateGoalkeeperAI(p, dt, diffParams);
      } else {
        const isPresser =
          (p.team === 'home' && p.id === closestHomeId) ||
          (p.team === 'away' && p.id === closestAwayId);
        this.updateOutfieldAI(p, dt, ballOwner, isPresser, diffParams);
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      this.clampPlayerToPitch(p);
    }
  }

  private updateHumanPlayer(p: PlayerEntity, dt: number): void {
    const held = this.getHeldVector();
    const hasBall = this.ball.ownerId === p.id;

    // If GK holds ball via user control, allow movement in box & auto-distribute if held > 1.6s
    if (p.role === 'GK' && hasBall) {
      p.gkHoldTimer += dt;
      if (p.gkHoldTimer >= 1.6) {
        const tm = this.findBestPassTarget(p, p.team === 'home' ? 0 : Math.PI);
        if (tm) this.executePass(p, tm);
        p.gkHoldTimer = 0;
      }
    }

    const baseSpeed = held.sprint ? 315 : 235;
    const maxSpeed = hasBall ? baseSpeed * 0.93 : baseSpeed;
    const targetVx = held.x * maxSpeed;
    const targetVy = held.y * maxSpeed;

    const accel = 16;
    p.vx += (targetVx - p.vx) * Math.min(1, accel * dt);
    p.vy += (targetVy - p.vy) * Math.min(1, accel * dt);

    if (Math.hypot(held.x, held.y) > 0.15) {
      p.facingAngle = Math.atan2(held.y, held.x);
    }
  }

  private updateGoalkeeperAI(
    gk: PlayerEntity,
    dt: number,
    diffParams: ReturnType<typeof this.getDifficultyParams>
  ): void {
    const isHome = gk.team === 'home';
    const goalLineX = isHome ? PITCH_LEFT : PITCH_RIGHT;
    const homeGuardX = isHome ? PITCH_LEFT + 22 : PITCH_RIGHT - 22;

    if (this.ball.ownerId === gk.id) {
      gk.vx *= 0.85;
      gk.vy *= 0.85;
      gk.facingAngle = isHome ? 0 : Math.PI;
      gk.gkHoldTimer += dt;
      if (gk.gkHoldTimer >= 0.75) {
        gk.gkHoldTimer = 0;
        if (this.isTrainingMode && !isHome && this.trainingConfig.defenders === 0) {
          this.resetTrainingBall();
          return;
        }
        const openTeammate = this.findSafeGkPassTarget(gk);
        if (openTeammate) {
          this.executePass(gk, openTeammate);
        } else {
          this.executePassInDirection(gk, isHome ? 0 : Math.PI);
        }
      }
      return;
    }

    // Track ball Y with difficulty-scaled prediction & realistic inertia
    const ballMovingTowardGoal = isHome ? this.ball.vx < -140 : this.ball.vx > 140;
    const ballNearBox = isHome ? this.ball.x < PITCH_LEFT + 240 : this.ball.x > PITCH_RIGHT - 240;

    let targetX = homeGuardX;
    let targetY = clamp(
      PITCH_CENTER_Y + (this.ball.y - PITCH_CENTER_Y) * 0.55,
      GOAL_TOP + 12,
      GOAL_BOTTOM - 12
    );

    if (ballNearBox && ballMovingTowardGoal && Math.abs(this.ball.vx) > 60) {
      // Blend current ball Y with predicted intercept Y according to difficulty
      const timeToLine = Math.abs((homeGuardX - this.ball.x) / this.ball.vx);
      const predictedY = this.ball.y + this.ball.vy * clamp(timeToLine, 0, 0.65);
      const blendedY = this.ball.y + (predictedY - this.ball.y) * diffParams.gkPredictWeight;
      targetY = clamp(blendedY, GOAL_TOP + 10, GOAL_BOTTOM - 10);
    } else if (ballNearBox && !this.ball.ownerId) {
      // Rush out for loose ball only if very close (and less aggressively on easier levels)
      const distToBall = dist(gk.x, gk.y, this.ball.x, this.ball.y);
      if (distToBall < 115) {
        targetX = clamp(this.ball.x, PITCH_LEFT + 14, PITCH_RIGHT - 14);
        targetY = this.ball.y;
      }
    } else if (ballNearBox) {
      // Narrow angle slightly toward ball
      const stepOut = isHome ? diffParams.gkStepOut : -diffParams.gkStepOut;
      targetX = goalLineX + stepOut;
      const ratio = 0.68;
      targetY = clamp(PITCH_CENTER_Y + (this.ball.y - PITCH_CENTER_Y) * ratio, GOAL_TOP + 12, GOAL_BOTTOM - 12);
    }

    const dx = targetX - gk.x;
    const dy = targetY - gk.y;
    const d = Math.hypot(dx, dy);
    const gkSpeed = ballMovingTowardGoal ? diffParams.gkDiveSpeed : diffParams.gkPosSpeed;

    if (d > 3) {
      const desiredVx = (dx / d) * Math.min(gkSpeed, d * 5);
      const desiredVy = (dy / d) * Math.min(gkSpeed, d * 5);
      gk.vx += (desiredVx - gk.vx) * Math.min(1, diffParams.gkAccel * dt);
      gk.vy += (desiredVy - gk.vy) * Math.min(1, diffParams.gkAccel * dt);
      gk.facingAngle = Math.atan2(this.ball.y - gk.y, this.ball.x - gk.x);
    } else {
      gk.vx *= Math.pow(0.05, dt);
      gk.vy *= Math.pow(0.05, dt);
    }
  }

  private findSafeGkPassTarget(gk: PlayerEntity): PlayerEntity | null {
    let best: PlayerEntity | null = null;
    let bestScore = -Infinity;
    for (const tm of this.players) {
      if (tm.team !== gk.team || tm.id === gk.id) continue;
      const d = dist(gk.x, gk.y, tm.x, tm.y);
      // Closest opponent to teammate
      let nearestOpp = Infinity;
      for (const opp of this.players) {
        if (opp.team !== gk.team) {
          nearestOpp = Math.min(nearestOpp, dist(tm.x, tm.y, opp.x, opp.y));
        }
      }
      const forwardBonus = gk.team === 'home' ? tm.x * 0.002 : (LOGICAL_WIDTH - tm.x) * 0.002;
      const score = nearestOpp * 0.025 - d * 0.003 + forwardBonus;
      if (score > bestScore) {
        bestScore = score;
        best = tm;
      }
    }
    return best;
  }

  private updateOutfieldAI(
    p: PlayerEntity,
    dt: number,
    ballOwner: PlayerEntity | null | undefined,
    isPresser: boolean,
    diffParams: ReturnType<typeof this.getDifficultyParams>
  ): void {
    const isHome = p.team === 'home';
    const attackDir = isHome ? 1 : -1;
    const oppGoalX = isHome ? PITCH_RIGHT : PITCH_LEFT;
    const hasBall = this.ball.ownerId === p.id;

    if (hasBall) {
      // Handle shot windup telegraph
      if (p.aiShootWindup > 0) {
        p.aiShootWindup -= dt;
        p.vx *= 0.85;
        p.vy *= 0.85;
        const aimY = PITCH_CENTER_Y + (Math.random() - 0.5) * (1 - diffParams.shotAccuracy) * 140;
        const angle = Math.atan2(aimY - p.y, oppGoalX - p.x);
        p.facingAngle = angle;
        if (p.aiShootWindup <= 0) {
          const chosenShot = p.aiPendingShotType ?? 'normal';
          p.aiPendingShotType = undefined;
          this.executeShot(p, angle, 0.75 + Math.random() * 0.25, chosenShot);
        }
        return;
      }

      p.aiThinkTimer -= dt;
      if (p.aiThinkTimer <= 0) {
        p.aiThinkTimer = diffParams.reactInterval;

        const distToGoal = dist(p.x, p.y, oppGoalX, PITCH_CENTER_Y);
        const inShootingRange = distToGoal < 330 && (isHome ? p.x > PITCH_CENTER_X + 120 : p.x < PITCH_CENTER_X - 120);

        if (inShootingRange && Math.random() < 0.55) {
          p.aiShootWindup = 0.24;
          p.aiPendingShotType = this.pickAiShotType(p, oppGoalX, distToGoal, diffParams.specialShotChance);
          return;
        }

        // Check pressure from nearest opponent
        let nearestOppDist = Infinity;
        for (const opp of this.players) {
          if (opp.team !== p.team) {
            nearestOppDist = Math.min(nearestOppDist, dist(p.x, p.y, opp.x, opp.y));
          }
        }

        // Look for open forward teammate
        const forwardPass = this.findBestForwardAiPass(p);
        if (forwardPass && (nearestOppDist < 82 || Math.random() < 0.22)) {
          this.executePass(p, forwardPass);
          return;
        }
      }

      // Dribble toward opponent goal with slight weave away from center pressure
      const targetX = oppGoalX - attackDir * 95;
      const targetY = PITCH_CENTER_Y + Math.sin(p.x * 0.012 + p.number) * 65;
      const dx = targetX - p.x;
      const dy = targetY - p.y;
      const d = Math.hypot(dx, dy) || 1;
      const dribbleSpeed = 215 * diffParams.speedMult;
      p.vx += ((dx / d) * dribbleSpeed - p.vx) * Math.min(1, 10 * dt);
      p.vy += ((dy / d) * dribbleSpeed - p.vy) * Math.min(1, 10 * dt);
      p.facingAngle = Math.atan2(p.vy, p.vx);
      return;
    }

    // Off-ball movement: smarter zonal spacing & realistic jockeying instead of robotic swarming
    let targetX = p.homeX;
    let targetY = p.homeY;

    const teamHasBall = ballOwner?.team === p.team;
    const ballOffsetFromCenter = this.ball.x - PITCH_CENTER_X;
    const shiftX = ballOffsetFromCenter * 0.36 + (teamHasBall ? attackDir * 78 : -attackDir * 44);
    const shiftY = (this.ball.y - PITCH_CENTER_Y) * 0.24;

    if (!this.ball.ownerId && isPresser) {
      // Chase loose ball
      targetX = this.ball.x;
      targetY = this.ball.y;
    } else if (ballOwner && ballOwner.team !== p.team && isPresser) {
      // Jockey / contain between ball carrier and own goal; give breathing room during human combo input
      const humanComboProtection =
        ballOwner.id === this.activePlayerId &&
        (this.comboGraceTimer > 0 || ballOwner.comboAuraTimer > 0);
      const effectiveJockeyDist = humanComboProtection
        ? diffParams.jockeyDist * 1.48
        : diffParams.jockeyDist;

      const ownGoalX = isHome ? PITCH_LEFT : PITCH_RIGHT;
      const toGoalX = ownGoalX - ballOwner.x;
      const toGoalY = PITCH_CENTER_Y - ballOwner.y;
      const toGoalLen = Math.hypot(toGoalX, toGoalY) || 1;
      targetX = clamp(
        ballOwner.x + (toGoalX / toGoalLen) * effectiveJockeyDist,
        PITCH_LEFT + 34,
        PITCH_RIGHT - 34
      );
      targetY = clamp(
        ballOwner.y + (toGoalY / toGoalLen) * effectiveJockeyDist,
        PITCH_TOP + 24,
        PITCH_BOTTOM - 24
      );

      // Timed AI tackle attempt only when carrier is within close range, grace expired, and not mid-combo
      const distToBall = dist(p.x, p.y, this.ball.x, this.ball.y);
      if (
        !humanComboProtection &&
        distToBall < 54 &&
        p.aiTackleCooldown <= 0 &&
        this.stealGraceTimer <= 0 &&
        p.aiThinkTimer <= 0
      ) {
        p.aiThinkTimer = diffParams.reactInterval;
        p.aiTackleCooldown = diffParams.aiTackleCd;
        if (Math.random() < diffParams.tackleChance) {
          this.triggerTackle('normal', p);
          return;
        }
      } else {
        p.aiThinkTimer = Math.max(0, p.aiThinkTimer - dt);
      }
    } else {
      targetX = clamp(p.homeX + shiftX, PITCH_LEFT + 60, PITCH_RIGHT - 60);
      targetY = clamp(p.homeY + shiftY, PITCH_TOP + 34, PITCH_BOTTOM - 34);

      // Teammates with possession spread into open passing lanes instead of bunching on the ball carrier
      if (teamHasBall && ballOwner) {
        const dCarrier = dist(targetX, targetY, ballOwner.x, ballOwner.y);
        if (dCarrier < 95) {
          const pushDirY = targetY >= ballOwner.y ? 1 : -1;
          targetY = clamp(ballOwner.y + pushDirY * 110, PITCH_TOP + 34, PITCH_BOTTOM - 34);
          targetX = clamp(targetX + attackDir * 55, PITCH_LEFT + 70, PITCH_RIGHT - 70);
        }
      }
    }

    const dx = targetX - p.x;
    const dy = targetY - p.y;
    const d = Math.hypot(dx, dy);
    const moveSpeed = (isPresser ? 218 : 192) * diffParams.speedMult;

    if (d > 6) {
      const desiredVx = (dx / d) * Math.min(moveSpeed, d * 4.5);
      const desiredVy = (dy / d) * Math.min(moveSpeed, d * 4.5);
      p.vx += (desiredVx - p.vx) * Math.min(1, 9 * dt);
      p.vy += (desiredVy - p.vy) * Math.min(1, 9 * dt);
      p.facingAngle = Math.atan2(p.vy, p.vx);
    } else {
      p.vx *= 0.85;
      p.vy *= 0.85;
      p.facingAngle = Math.atan2(this.ball.y - p.y, this.ball.x - p.x);
    }
  }

  private pickAiShotType(
    shooter: PlayerEntity,
    oppGoalX: number,
    distToGoal: number,
    specialChance: number
  ): ShotType {
    if (Math.random() >= specialChance) {
      return 'normal';
    }
    const oppGk = this.players.find((pl) => pl.team !== shooter.team && pl.role === 'GK');
    if (oppGk && Math.abs(oppGk.x - oppGoalX) > 33 && distToGoal < 255 && Math.random() < 0.65) {
      return 'chip';
    }
    if (Math.abs(shooter.y - PITCH_CENTER_Y) > 74 && Math.random() < 0.7) {
      return 'finesse';
    }
    const r = Math.random();
    if (r < 0.42) return 'power';
    if (r < 0.74) return 'knuckle';
    return 'finesse';
  }

  private findBestForwardAiPass(passer: PlayerEntity): PlayerEntity | null {
    const isHome = passer.team === 'home';
    const attackDir = isHome ? 1 : -1;
    let best: PlayerEntity | null = null;
    let bestScore = -Infinity;

    for (const tm of this.players) {
      if (tm.team !== passer.team || tm.id === passer.id || tm.role === 'GK') continue;
      const d = dist(passer.x, passer.y, tm.x, tm.y);
      if (d < 55 || d > 420) continue;

      const forwardGain = (tm.x - passer.x) * attackDir;
      if (forwardGain < -40) continue;

      let minOppDist = Infinity;
      for (const opp of this.players) {
        if (opp.team !== passer.team) {
          minOppDist = Math.min(minOppDist, dist(tm.x, tm.y, opp.x, opp.y));
        }
      }

      const score = forwardGain * 0.015 + minOppDist * 0.02 - d * 0.002;
      if (score > bestScore) {
        bestScore = score;
        best = tm;
      }
    }
    return bestScore > 0.3 ? best : null;
  }

  private findClosestOutfieldId(team: TeamSide, excludeId: string): string | null {
    let bestId: string | null = null;
    let bestDist = Infinity;
    for (const p of this.players) {
      if (p.team !== team || p.role === 'GK' || p.id === excludeId || p.injuryTimer > 0) continue;
      const d = dist(p.x, p.y, this.ball.x, this.ball.y);
      if (d < bestDist) {
        bestDist = d;
        bestId = p.id;
      }
    }
    return bestId;
  }

  private clampPlayerToPitch(p: PlayerEntity): void {
    const margin = p.radius + 2;
    p.x = clamp(p.x, PITCH_LEFT - 10, PITCH_RIGHT + 10);
    p.y = clamp(p.y, PITCH_TOP + margin - 6, PITCH_BOTTOM - margin + 6);
  }

  private resolvePlayerCollisions(): void {
    const n = this.players.length;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = this.players[i];
        const b = this.players[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        const minDist = a.radius + b.radius + 1;

        // Extra tackle reach when performing an active tackle (especially aggressive)
        const aReach = a.lungeTimer > 0 ? (a.lungeType === 'aggressive' ? 12 : 4) : 0;
        const bReach = b.lungeTimer > 0 ? (b.lungeType === 'aggressive' ? 12 : 4) : 0;

        // ~25% injury roll on aggressive tackle contact with an opposing CPU
        if (a.team !== b.team) {
          if (a.lungeTimer > 0 && a.lungeType === 'aggressive' && d < minDist + aReach && b.injuryHitCooldown <= 0) {
            this.tryAggressiveInjury(a, b);
          }
          if (b.lungeTimer > 0 && b.lungeType === 'aggressive' && d < minDist + bReach && a.injuryHitCooldown <= 0) {
            this.tryAggressiveInjury(b, a);
          }
        }

        if (a.team !== b.team && this.ball.kickCooldown <= 0 && this.stealGraceTimer <= 0) {
          if (this.ball.ownerId === a.id && b.lungeTimer > 0 && d < minDist + bReach) {
            this.stealBall(b, a, b.lungeType ?? 'normal');
          } else if (this.ball.ownerId === b.id && a.lungeTimer > 0 && d < minDist + aReach) {
            this.stealBall(a, b, a.lungeType ?? 'normal');
          }
        }

        if (d > 0 && d < minDist) {
          const overlap = (minDist - d) * 0.5;
          const nx = dx / d;
          const ny = dy / d;
          a.x -= nx * overlap;
          a.y -= ny * overlap;
          b.x += nx * overlap;
          b.y += ny * overlap;
        }
      }
    }
  }

  private tryAggressiveInjury(tackler: PlayerEntity, victim: PlayerEntity): void {
    victim.injuryHitCooldown = 0.55;
    // Only injure opposing outfield CPUs (never permanently immobilize GKs or active human)
    const isHuman = !this.isDemoMode && victim.id === this.activePlayerId;
    if (isHuman || victim.role === 'GK' || victim.injuryTimer > 0) return;

    if (Math.random() < 0.25) {
      victim.injuryTimer = 4.2;
      victim.stunTimer = Math.max(victim.stunTimer, 0.7);
      victim.aiShootWindup = 0;
      victim.aiPendingShotType = undefined;
      const knockAngle = Math.atan2(victim.y - tackler.y, victim.x - tackler.x);
      victim.vx = Math.cos(knockAngle) * 240;
      victim.vy = Math.sin(knockAngle) * 240;
      this.shakeTimer = 0.16;
      this.shakeIntensity = 5;
      this.spawnParticles(victim.x, victim.y, 16, '#ef4444', 180);
      this.spawnParticles(victim.x, victim.y, 8, '#fb923c', 140);
      if (!this.isDemoMode) {
        this.shotCallout = {
          text: '¡LESIONADO!',
          color: '#f87171',
          x: victim.x,
          y: Math.max(PITCH_TOP + 24, victim.y - 26),
          timer: 1.0,
        };
        soundEngine.playTackle(true);
      }
    }
  }

  private stealBall(stealer: PlayerEntity, victim: PlayerEntity, tackleType: TackleType = 'normal'): void {
    const isAggressive = tackleType === 'aggressive';
    victim.aiShootWindup = 0;
    victim.aiPendingShotType = undefined;
    if (victim.id === this.activePlayerId) {
      this.isChargingShot = false;
      this.shotChargeTime = 0;
      this.preparedShotType = 'normal';
    }
    this.queuedShot = null;
    this.ball.ownerId = stealer.id;
    this.ball.kickCooldown = 0.24;
    this.stealGraceTimer = 0.38;
    this.ball.isShot = false;
    this.resetBallFlightEffects();
    this.ball.lastTouchTeam = stealer.team;
    this.ball.lastTouchNumber = stealer.number;
    stealer.flashTimer = 0.2;

    if (isAggressive) {
      // Aggressive tackle knocks opponent off balance and recovers faster on hit
      victim.stunTimer = 0.65;
      const knockAngle = Math.atan2(victim.y - stealer.y, victim.x - stealer.x);
      victim.vx = Math.cos(knockAngle) * 260;
      victim.vy = Math.sin(knockAngle) * 260;
      stealer.tackleCooldown = 0.6;
      this.hitstopTimer = 0.03;
      this.shakeTimer = 0.14;
      this.shakeIntensity = 4.5;
      this.spawnParticles(this.ball.x, this.ball.y, 14, '#fb923c', 170);
    } else {
      this.spawnParticles(this.ball.x, this.ball.y, 7, '#f8fafc', 110);
    }

    if (stealer.team === 'home' && !this.isDemoMode) {
      this.activePlayerId = stealer.id;
    }
    soundEngine.playTackle(isAggressive);
  }

  private updateBall(dt: number): void {
    if (this.ball.kickCooldown > 0) {
      this.ball.kickCooldown = Math.max(0, this.ball.kickCooldown - dt);
    }

    // Update trail
    for (let i = this.ball.trail.length - 1; i >= 0; i--) {
      this.ball.trail[i].alpha -= dt * 4.5;
      if (this.ball.trail[i].alpha <= 0) {
        this.ball.trail.splice(i, 1);
      }
    }

    if (this.ball.ownerId) {
      const owner = this.players.find((p) => p.id === this.ball.ownerId);
      if (owner) {
        const dribbleDist = owner.radius + this.ball.radius + 3;
        this.ball.x = owner.x + Math.cos(owner.facingAngle) * dribbleDist;
        this.ball.y = owner.y + Math.sin(owner.facingAngle) * dribbleDist;
        this.ball.vx = owner.vx;
        this.ball.vy = owner.vy;
        this.ball.spinAngle += Math.hypot(owner.vx, owner.vy) * dt * 0.04;

        // If ball carrier dribbles over the boundary line, trigger appropriate restart
        const inMouthY = this.ball.y > GOAL_TOP + 2 && this.ball.y < GOAL_BOTTOM - 2;
        if (inMouthY && this.ball.x < PITCH_LEFT - this.ball.radius * 0.35) {
          this.scoreGoal('away');
          return;
        }
        if (inMouthY && this.ball.x > PITCH_RIGHT + this.ball.radius * 0.35) {
          this.scoreGoal('home');
          return;
        }
        this.checkOutOfBounds(inMouthY, 3.5);
        return;
      } else {
        this.ball.ownerId = null;
      }
    }

    // Special shot mid-flight aerodynamics (curve / knuckle swerve / chip loft)
    let speed = Math.hypot(this.ball.vx, this.ball.vy);
    if (this.ball.isShot && speed > 180) {
      if (this.ball.curveAx !== 0 || this.ball.curveAy !== 0) {
        this.ball.vx += this.ball.curveAx * dt;
        this.ball.vy += this.ball.curveAy * dt;
        const curveDecay = Math.pow(0.45, dt);
        this.ball.curveAx *= curveDecay;
        this.ball.curveAy *= curveDecay;
      }
      if (this.ball.shotType === 'knuckle') {
        this.ball.knucklePhase += dt * 19;
        const invS = 1 / (speed || 1);
        const perpX = -this.ball.vy * invS;
        const perpY = this.ball.vx * invS;
        const swerve = Math.sin(this.ball.knucklePhase) * 440 * dt;
        this.ball.vx += perpX * swerve;
        this.ball.vy += perpY * swerve;
      }
    }

    if (this.ball.loftDuration > 0 && this.ball.loftProgress < 1) {
      this.ball.loftProgress = Math.min(1, this.ball.loftProgress + dt / this.ball.loftDuration);
    }

    speed = Math.hypot(this.ball.vx, this.ball.vy);
    if (speed > 260 || (this.ball.loftDuration > 0 && this.ball.loftProgress < 1)) {
      if (this.ball.trail.length >= 16) {
        this.ball.trail.shift();
      }
      this.ball.trail.push({ x: this.ball.x, y: this.ball.y, alpha: this.ball.isShot ? 0.72 : 0.3 });
    }

    this.ball.x += this.ball.vx * dt;
    this.ball.y += this.ball.vy * dt;
    this.ball.spinAngle += speed * dt * 0.035;

    // Lighter drag while chipped ball is airborne; normal turf friction on ground
    const isAirborne = this.ball.loftDuration > 0 && this.ball.loftProgress < 1;
    const friction = isAirborne ? Math.pow(0.76, dt) : Math.pow(0.28, dt);
    this.ball.vx *= friction;
    this.ball.vy *= friction;
    if (speed < 12) {
      this.ball.vx = 0;
      this.ball.vy = 0;
      this.ball.isShot = false;
      this.resetBallFlightEffects();
    }

    // Check Goalpost circular collisions
    const posts = [
      { x: PITCH_LEFT, y: GOAL_TOP },
      { x: PITCH_LEFT, y: GOAL_BOTTOM },
      { x: PITCH_RIGHT, y: GOAL_TOP },
      { x: PITCH_RIGHT, y: GOAL_BOTTOM },
    ];
    for (const post of posts) {
      const dx = this.ball.x - post.x;
      const dy = this.ball.y - post.y;
      const d = Math.hypot(dx, dy);
      const minD = this.ball.radius + 5;
      if (d > 0 && d < minD) {
        const nx = dx / d;
        const ny = dy / d;
        this.ball.x = post.x + nx * minD;
        this.ball.y = post.y + ny * minD;
        const dot = this.ball.vx * nx + this.ball.vy * ny;
        if (dot < 0) {
          this.ball.vx = (this.ball.vx - 2 * dot * nx) * 0.8;
          this.ball.vy = (this.ball.vy - 2 * dot * ny) * 0.8;
          this.resetBallFlightEffects();
          this.shakeTimer = 0.16;
          this.shakeIntensity = 6;
          this.spawnParticles(post.x, post.y, 10, '#fde047', 170);
          soundEngine.playPost();
        }
      }
    }

    // Check Goal Scoring!
    const inGoalMouthY = this.ball.y > GOAL_TOP + 2 && this.ball.y < GOAL_BOTTOM - 2;
    if (inGoalMouthY && this.ball.x < PITCH_LEFT - this.ball.radius * 0.35) {
      if (this.isTrainingMode) {
        this.resetTrainingBall();
      } else {
        this.scoreGoal('away');
      }
      return;
    }
    if (inGoalMouthY && this.ball.x > PITCH_RIGHT + this.ball.radius * 0.35) {
      this.scoreGoal('home');
      return;
    }

    // Check Out of Bounds -> Throw-in, Corner Kick, or Goal Kick
    if (this.checkOutOfBounds(inGoalMouthY, this.ball.radius * 0.65)) {
      return;
    }

    // Ball collection / Goalkeeper save (airborne chip shots fly over players mid-arc)
    const loftHeight =
      this.ball.loftDuration > 0 && this.ball.loftProgress < 1
        ? Math.sin(this.ball.loftProgress * Math.PI)
        : 0;
    if (this.ball.kickCooldown <= 0 && loftHeight <= 0.34) {
      const diffParams = this.getDifficultyParams(this.config.difficulty);
      for (const p of this.players) {
        const catchDist =
          p.role === 'GK'
            ? p.radius + this.ball.radius + diffParams.gkCatchBonus
            : p.radius + this.ball.radius + 3;
        if (dist(p.x, p.y, this.ball.x, this.ball.y) <= catchDist) {
          if (p.role === 'GK' && this.ball.isShot && this.ball.lastTouchTeam !== p.team) {
            if (p.team === 'home') this.stats.homeSaves += 1;
            else this.stats.awaySaves += 1;
            p.flashTimer = 0.25;
            this.spawnParticles(this.ball.x, this.ball.y, 12, '#38bdf8', 150);
            soundEngine.playSave();
          }

          this.ball.ownerId = p.id;
          this.ball.isShot = false;
          this.resetBallFlightEffects();
          this.ball.lastTouchTeam = p.team;
          this.ball.lastTouchNumber = p.number;
          this.stealGraceTimer = 0.35;
          p.gkHoldTimer = 0;

          if (p.team === 'home' && !this.isDemoMode) {
            this.activePlayerId = p.id;
            // Execute buffered first-time combo shot immediately if user tapped X right before arrival
            if (this.queuedShot && performance.now() <= this.queuedShot.expiresAt) {
              const queuedType = this.queuedShot.shotType;
              this.queuedShot = null;
              const power =
                queuedType === 'power'
                  ? 0.9
                  : queuedType === 'knuckle' || queuedType === 'finesse'
                  ? 0.84
                  : 0.78;
              if (queuedType !== 'normal') {
                this.beginComboShotWindup(p, queuedType, power);
              } else {
                const angle = this.computeHumanShotAngle(p);
                this.executeShot(p, angle, power, 'normal');
              }
            } else {
              this.queuedShot = null;
            }
          }
          break;
        }
      }
    }
  }

  private checkOutOfBounds(inGoalMouthY: boolean, margin: number): boolean {
    if (this.isTrainingMode) {
      if (
        this.ball.y < PITCH_TOP - margin ||
        this.ball.y > PITCH_BOTTOM + margin ||
        (!inGoalMouthY && (this.ball.x < PITCH_LEFT - margin || this.ball.x > PITCH_RIGHT + margin))
      ) {
        const lastTeam = this.ball.lastTouchTeam ?? 'home';
        if (
          !inGoalMouthY &&
          this.ball.x > PITCH_RIGHT + margin &&
          lastTeam === 'away' &&
          this.trainingConfig.teammates > 0
        ) {
          const cornerY = this.ball.y < PITCH_CENTER_Y ? PITCH_TOP + 8 : PITCH_BOTTOM - 8;
          this.triggerRestart('corner', 'home', PITCH_RIGHT - 8, cornerY);
        } else {
          this.resetTrainingBall();
        }
        return true;
      }
      return false;
    }

    const lastTeam = this.ball.lastTouchTeam ?? 'home';
    const oppositeTeam: TeamSide = lastTeam === 'home' ? 'away' : 'home';

    // Top or Bottom Touchline -> Saque de banda (Throw-in)
    if (this.ball.y < PITCH_TOP - margin) {
      const spotX = clamp(this.ball.x, PITCH_LEFT + 28, PITCH_RIGHT - 28);
      this.triggerRestart('throw_in', oppositeTeam, spotX, PITCH_TOP + 2);
      return true;
    }
    if (this.ball.y > PITCH_BOTTOM + margin) {
      const spotX = clamp(this.ball.x, PITCH_LEFT + 28, PITCH_RIGHT - 28);
      this.triggerRestart('throw_in', oppositeTeam, spotX, PITCH_BOTTOM - 2);
      return true;
    }

    // Left or Right Goal-line (outside goalmouth, ignoring tiny post-graze zone)
    const grazingPost =
      Math.abs(this.ball.y - GOAL_TOP) < 5 || Math.abs(this.ball.y - GOAL_BOTTOM) < 5;
    if (!inGoalMouthY && !grazingPost) {
      if (this.ball.x < PITCH_LEFT - margin) {
        if (lastTeam === 'home') {
          const cornerY = this.ball.y < PITCH_CENTER_Y ? PITCH_TOP + 8 : PITCH_BOTTOM - 8;
          this.triggerRestart('corner', 'away', PITCH_LEFT + 8, cornerY);
        } else {
          this.triggerRestart('goal_kick', 'home', PITCH_LEFT + 44, PITCH_CENTER_Y);
        }
        return true;
      }
      if (this.ball.x > PITCH_RIGHT + margin) {
        if (lastTeam === 'away') {
          const cornerY = this.ball.y < PITCH_CENTER_Y ? PITCH_TOP + 8 : PITCH_BOTTOM - 8;
          this.triggerRestart('corner', 'home', PITCH_RIGHT - 8, cornerY);
        } else {
          this.triggerRestart('goal_kick', 'away', PITCH_RIGHT - 44, PITCH_CENTER_Y);
        }
        return true;
      }
    }

    return false;
  }

  private triggerRestart(type: RestartType, team: TeamSide, x: number, y: number): void {
    this.isChargingShot = false;
    this.shotChargeTime = 0;
    this.preparedShotType = 'normal';
    this.queuedShot = null;
    this.comboGraceTimer = 0;
    this.ball.ownerId = null;
    this.ball.isShot = false;
    this.resetBallFlightEffects();
    this.ball.vx *= 0.25;
    this.ball.vy *= 0.25;
    this.ball.trail = [];

    const taker = this.selectRestartTaker(type, team, x, y);
    if (!taker) return;

    this.activeRestart = {
      type,
      team,
      x,
      y,
      takerId: taker.id,
      ready: false,
      prepTimer: 0.32,
      aiExecuteTimer: 0.65,
    };
    this.restartBannerTimer = 2.0;

    if (!this.isDemoMode) {
      soundEngine.playPass();
    }
  }

  private selectRestartTaker(type: RestartType, team: TeamSide, x: number, y: number): PlayerEntity | undefined {
    if (type === 'goal_kick') {
      return (
        this.players.find((p) => p.team === team && p.role === 'GK') ??
        this.players.find((p) => p.team === team)
      );
    }

    let best: PlayerEntity | undefined;
    let bestDist = Infinity;
    for (const p of this.players) {
      if (p.team !== team || p.role === 'GK') continue;
      const d = dist(p.x, p.y, x, y);
      if (d < bestDist) {
        bestDist = d;
        best = p;
      }
    }
    return best ?? this.players.find((p) => p.team === team);
  }

  private positionPlayersForRestart(restart: ActiveRestart): void {
    const taker = this.players.find((p) => p.id === restart.takerId);
    if (!taker) return;

    for (const p of this.players) {
      p.vx = 0;
      p.vy = 0;
      p.lungeTimer = 0;
      p.lungeType = null;
      p.stunTimer = 0;
      p.injuryTimer = 0;
      p.injuryHitCooldown = 0;
      p.comboAuraTimer = 0;
      p.pendingComboShot = undefined;
      p.aiShootWindup = 0;
      p.aiPendingShotType = undefined;
    }

    // Place taker at the restart spot with the ball
    taker.x = restart.x;
    taker.y = restart.y;
    taker.facingAngle = Math.atan2(PITCH_CENTER_Y - restart.y, PITCH_CENTER_X - restart.x);
    if (restart.type === 'goal_kick') {
      taker.facingAngle = restart.team === 'home' ? 0 : Math.PI;
    }

    this.ball.ownerId = taker.id;
    this.ball.x = taker.x + Math.cos(taker.facingAngle) * (taker.radius + this.ball.radius + 3);
    this.ball.y = taker.y + Math.sin(taker.facingAngle) * (taker.radius + this.ball.radius + 3);
    this.ball.vx = 0;
    this.ball.vy = 0;
    this.stealGraceTimer = 0.5;

    if (restart.team === 'home' && !this.isDemoMode) {
      this.activePlayerId = taker.id;
    }

    // Position teammates and opponents naturally for each restart type
    if (restart.type === 'corner') {
      const oppGoalX = restart.team === 'home' ? PITCH_RIGHT : PITCH_LEFT;
      const attackDir = restart.team === 'home' ? 1 : -1;
      const boxCenterX = oppGoalX - attackDir * 115;

      let attIdx = 0;
      let defIdx = 0;
      for (const p of this.players) {
        if (p.id === taker.id) continue;
        if (p.role === 'GK') {
          p.x = p.team === 'home' ? PITCH_LEFT + 20 : PITCH_RIGHT - 20;
          p.y = PITCH_CENTER_Y;
          continue;
        }
        if (p.team === restart.team) {
          if (p.role === 'FW' || p.role === 'MF') {
            const offsetsY = [-75, 0, 75, -125, 125];
            const offsetY = offsetsY[attIdx % offsetsY.length];
            const offsetX = (attIdx % 2 === 0 ? -15 : 28) * attackDir;
            p.x = clamp(boxCenterX + offsetX, PITCH_LEFT + 60, PITCH_RIGHT - 60);
            p.y = clamp(PITCH_CENTER_Y + offsetY, PITCH_TOP + 45, PITCH_BOTTOM - 45);
            attIdx++;
          } else {
            p.x = PITCH_CENTER_X + attackDir * 60;
          }
        } else {
          const defOffsetsY = [-60, 0, 60, -110, 110];
          p.x = clamp(oppGoalX - attackDir * (65 + (defIdx % 2) * 45), PITCH_LEFT + 45, PITCH_RIGHT - 45);
          p.y = clamp(PITCH_CENTER_Y + defOffsetsY[defIdx % defOffsetsY.length], PITCH_TOP + 45, PITCH_BOTTOM - 45);
          defIdx++;
        }
      }
    } else if (restart.type === 'goal_kick') {
      const ownGoalX = restart.team === 'home' ? PITCH_LEFT : PITCH_RIGHT;
      const dir = restart.team === 'home' ? 1 : -1;
      for (const p of this.players) {
        if (p.id === taker.id) continue;
        p.x = p.homeX;
        p.y = p.homeY;
        if (p.team === restart.team && p.role === 'DF') {
          p.x = ownGoalX + dir * 165;
          p.y = p.homeY < PITCH_CENTER_Y ? PITCH_TOP + 120 : PITCH_BOTTOM - 120;
        } else if (p.team !== restart.team) {
          // Opponents must stay outside the penalty area on goal kicks
          const minX = restart.team === 'home' ? PITCH_LEFT + 215 : PITCH_RIGHT - 215;
          p.x = restart.team === 'home' ? Math.max(p.x, minX) : Math.min(p.x, minX);
        }
      }
    } else {
      // Throw-in: bring 2 teammates into comfortable passing range & keep opponents 120px away
      let supportCount = 0;
      for (const p of this.players) {
        if (p.id === taker.id || p.role === 'GK') continue;
        if (p.team === restart.team && supportCount < 2 && dist(p.x, p.y, restart.x, restart.y) > 220) {
          const inwardY = restart.y < PITCH_CENTER_Y ? 115 + supportCount * 65 : -115 - supportCount * 65;
          const shiftX = supportCount === 0 ? 85 : -85;
          p.x = clamp(restart.x + shiftX, PITCH_LEFT + 60, PITCH_RIGHT - 60);
          p.y = clamp(restart.y + inwardY, PITCH_TOP + 45, PITCH_BOTTOM - 45);
          supportCount++;
        }
      }
    }

    // Ensure every opponent maintains respectful distance from the set-piece spot
    for (const p of this.players) {
      if (p.team !== restart.team && p.role !== 'GK') {
        const d = dist(p.x, p.y, restart.x, restart.y);
        if (d < 125) {
          const pushAngle = Math.atan2(p.y - restart.y, p.x - restart.x);
          p.x = clamp(restart.x + Math.cos(pushAngle) * 125, PITCH_LEFT + 30, PITCH_RIGHT - 30);
          p.y = clamp(restart.y + Math.sin(pushAngle) * 125, PITCH_TOP + 30, PITCH_BOTTOM - 30);
        }
      }
    }
  }

  private updateActiveRestart(dt: number): void {
    const restart = this.activeRestart;
    if (!restart) return;

    if (!restart.ready) {
      restart.prepTimer -= dt;
      this.ball.x += this.ball.vx * dt;
      this.ball.y += this.ball.vy * dt;
      this.ball.vx *= Math.pow(0.06, dt);
      this.ball.vy *= Math.pow(0.06, dt);
      if (restart.prepTimer <= 0) {
        restart.ready = true;
        this.positionPlayersForRestart(restart);
      }
      return;
    }

    const taker = this.players.find((p) => p.id === restart.takerId);
    if (!taker) {
      this.activeRestart = null;
      return;
    }

    // Keep taker pinned at the restart spot with the ball while aiming
    taker.x = restart.x;
    taker.y = restart.y;
    taker.vx = 0;
    taker.vy = 0;
    this.ball.ownerId = taker.id;
    this.stealGraceTimer = 0.45;

    if (restart.team === 'home' && !this.isDemoMode) {
      const held = this.getHeldVector();
      if (Math.hypot(held.x, held.y) > 0.2) {
        taker.facingAngle = Math.atan2(held.y, held.x);
      }
      this.passTargetId = this.findBestPassTarget(taker, taker.facingAngle)?.id ?? null;
    } else {
      this.passTargetId = null;
      restart.aiExecuteTimer -= dt;
      if (restart.aiExecuteTimer <= 0) {
        this.executeRestartKick(false);
      }
    }

    const dribbleDist = taker.radius + this.ball.radius + 3;
    this.ball.x = taker.x + Math.cos(taker.facingAngle) * dribbleDist;
    this.ball.y = taker.y + Math.sin(taker.facingAngle) * dribbleDist;
    this.ball.vx = 0;
    this.ball.vy = 0;

    this.hudEmitAccum += dt;
    if (!this.isDemoMode && this.hudEmitAccum >= 0.1) {
      this.hudEmitAccum = 0;
      this.emitHud(false);
    }
  }

  private executeRestartKick(isLongKick: boolean, explicitTarget?: PlayerEntity): void {
    const restart = this.activeRestart;
    if (!restart) return;

    const taker = this.players.find((p) => p.id === restart.takerId);
    this.activeRestart = null;
    this.restartBannerTimer = 0;
    this.passTargetId = null;
    this.stealGraceTimer = 0.45;

    if (!taker) return;

    if (isLongKick && restart.type !== 'throw_in') {
      const targetX =
        restart.type === 'corner'
          ? (restart.team === 'home' ? PITCH_RIGHT - 105 : PITCH_LEFT + 105)
          : (restart.team === 'home' ? PITCH_CENTER_X + 120 : PITCH_CENTER_X - 120);
      const held = this.getHeldVector();
      const targetY =
        Math.hypot(held.x, held.y) > 0.2
          ? clamp(PITCH_CENTER_Y + held.y * 150, PITCH_TOP + 50, PITCH_BOTTOM - 50)
          : PITCH_CENTER_Y;
      const angle = Math.atan2(targetY - taker.y, targetX - taker.x);
      this.executeShot(taker, angle, 0.72, 'normal');
      return;
    }

    const target =
      explicitTarget ??
      (restart.type === 'goal_kick' && (restart.team === 'away' || this.isDemoMode)
        ? this.findSafeGkPassTarget(taker)
        : this.findBestPassTarget(taker, taker.facingAngle));

    if (target) {
      this.executePass(taker, target);
    } else {
      const inwardAngle = Math.atan2(PITCH_CENTER_Y - taker.y, PITCH_CENTER_X - taker.x);
      this.executePassInDirection(taker, inwardAngle);
    }
  }

  private scoreGoal(scoringTeam: TeamSide): void {
    if (scoringTeam === 'home') {
      if (!this.isDemoMode) this.stats.homeScore += 1;
      this.netRippleRight = 1;
      this.kickoffTeam = 'away';
    } else {
      if (!this.isDemoMode) this.stats.awayScore += 1;
      this.netRippleLeft = 1;
      this.kickoffTeam = 'home';
    }

    if (!this.isDemoMode) {
      this.stats.lastGoalTeam = scoringTeam;
      this.stats.lastGoalNumber = this.ball.lastTouchNumber;
      this.stats.goalBannerTimer = 1.8;
    }

    this.ball.ownerId = null;
    this.ball.isShot = false;
    this.resetBallFlightEffects();
    this.ball.vx *= 0.25;
    this.ball.vy *= 0.25;

    this.hitstopTimer = 0.055;
    this.shakeTimer = 0.35;
    this.shakeIntensity = 10;
    this.kickoffResetTimer = 1.45;

    const burstColor = scoringTeam === 'home' ? '#60a5fa' : '#f87171';
    this.spawnParticles(this.ball.x, this.ball.y, 28, burstColor, 260);
    this.spawnParticles(this.ball.x, this.ball.y, 16, '#facc15', 220);

    if (!this.isDemoMode) {
      soundEngine.playGoal(scoringTeam === 'home');
      this.emitHud(true);
    }
  }

  private spawnParticles(x: number, y: number, count: number, color: string, maxSpeed: number): void {
    let spawned = 0;
    for (const pt of this.particles) {
      if (!pt.active) {
        const angle = Math.random() * Math.PI * 2;
        const speed = (0.3 + Math.random() * 0.7) * maxSpeed;
        pt.active = true;
        pt.x = x;
        pt.y = y;
        pt.vx = Math.cos(angle) * speed;
        pt.vy = Math.sin(angle) * speed;
        pt.maxLife = 0.25 + Math.random() * 0.35;
        pt.life = pt.maxLife;
        pt.size = 2 + Math.random() * 3;
        pt.color = color;
        spawned++;
        if (spawned >= count) break;
      }
    }
  }

  private updateParticles(dt: number): void {
    for (const pt of this.particles) {
      if (!pt.active) continue;
      pt.life -= dt;
      if (pt.life <= 0) {
        pt.active = false;
        continue;
      }
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= Math.pow(0.15, dt);
      pt.vy *= Math.pow(0.15, dt);
    }
  }

  public getHudSnapshot(): HudSnapshot {
    const totalPoss = this.stats.homePossessionSec + this.stats.awayPossessionSec;
    const possessionHomePct = totalPoss > 0.5 ? Math.round((this.stats.homePossessionSec / totalPoss) * 100) : 50;
    const active = this.getActivePlayer();

    return {
      homeScore: this.stats.homeScore,
      awayScore: this.stats.awayScore,
      timeRemainingSec: Math.ceil(this.stats.timeRemainingSec),
      homeShots: this.stats.homeShots,
      awayShots: this.stats.awayShots,
      homePasses: this.stats.homePasses,
      awayPasses: this.stats.awayPasses,
      homeSaves: this.stats.homeSaves,
      awaySaves: this.stats.awaySaves,
      possessionHomePct,
      activePlayerNumber: active?.number ?? 9,
      hasBall: Boolean(active && this.ball.ownerId === active.id),
    };
  }

  private emitHud(force: boolean): void {
    if (!this.onHudUpdate && !force) return;
    this.onHudUpdate?.(this.getHudSnapshot());
  }
}

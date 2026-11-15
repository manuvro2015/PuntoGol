import {
  GOAL_BOTTOM,
  GOAL_DEPTH,
  GOAL_TOP,
  LOGICAL_HEIGHT,
  LOGICAL_WIDTH,
  PITCH_BOTTOM,
  PITCH_CENTER_X,
  PITCH_CENTER_Y,
  PITCH_HEIGHT,
  PITCH_LEFT,
  PITCH_RIGHT,
  PITCH_TOP,
  PITCH_WIDTH,
  type FootballEngine,
} from './engine';
import type { PlayerEntity } from './types';

export function renderFootballCanvas(
  ctx: CanvasRenderingContext2D,
  engine: FootballEngine,
  canvasWidth: number,
  canvasHeight: number
): void {
  ctx.save();

  // Fill deep stadium surround
  ctx.fillStyle = '#081510';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Compute uniform scale to fit 1200x760 logical pitch inside viewport
  const scale = Math.min(canvasWidth / LOGICAL_WIDTH, canvasHeight / LOGICAL_HEIGHT);
  const offsetX = (canvasWidth - LOGICAL_WIDTH * scale) * 0.5;
  const offsetY = (canvasHeight - LOGICAL_HEIGHT * scale) * 0.5;

  // Apply camera shake if active
  let shakeX = 0;
  let shakeY = 0;
  if (engine.shakeTimer > 0) {
    const decay = engine.shakeTimer / 0.35;
    const mag = engine.shakeIntensity * decay;
    shakeX = (Math.random() - 0.5) * 2 * mag;
    shakeY = (Math.random() - 0.5) * 2 * mag;
  }

  ctx.translate(offsetX + shakeX * scale, offsetY + shakeY * scale);
  ctx.scale(scale, scale);

  drawPitch(ctx, engine.netRippleLeft, engine.netRippleRight);
  drawRestartSpot(ctx, engine);
  drawPassGuide(ctx, engine);
  drawPlayers(ctx, engine);
  drawBall(ctx, engine);
  drawParticles(ctx, engine);
  drawShotCallout(ctx, engine);

  if (engine.stats.goalBannerTimer > 0 && !engine.isDemoMode) {
    drawGoalBanner(ctx, engine);
  } else if (engine.activeRestart && !engine.isDemoMode) {
    drawRestartBanner(ctx, engine);
  }

  ctx.restore();
}

let cachedPitchCanvas: HTMLCanvasElement | null = null;
const PITCH_CACHE_SCALE = 2;

function getCachedPitchCanvas(): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  if (cachedPitchCanvas) return cachedPitchCanvas;

  const offscreen = document.createElement('canvas');
  offscreen.width = LOGICAL_WIDTH * PITCH_CACHE_SCALE;
  offscreen.height = LOGICAL_HEIGHT * PITCH_CACHE_SCALE;
  const octx = offscreen.getContext('2d');
  if (!octx) return null;

  octx.scale(PITCH_CACHE_SCALE, PITCH_CACHE_SCALE);

  // Pitch apron
  octx.fillStyle = '#0B3A23';
  octx.beginPath();
  octx.roundRect(PITCH_LEFT - 24, PITCH_TOP - 22, PITCH_WIDTH + 48, PITCH_HEIGHT + 44, 14);
  octx.fill();

  // Mowed turf stripes (12 vertical bands)
  const stripeCount = 12;
  const stripeW = PITCH_WIDTH / stripeCount;
  for (let i = 0; i < stripeCount; i++) {
    octx.fillStyle = i % 2 === 0 ? '#0F5B35' : '#12653B';
    octx.fillRect(PITCH_LEFT + i * stripeW, PITCH_TOP, stripeW + 0.5, PITCH_HEIGHT);
  }

  // Subtle turf border
  octx.strokeStyle = 'rgba(248, 250, 252, 0.85)';
  octx.lineWidth = 2.5;
  octx.strokeRect(PITCH_LEFT, PITCH_TOP, PITCH_WIDTH, PITCH_HEIGHT);

  // Halfway line & center circle
  octx.beginPath();
  octx.moveTo(PITCH_CENTER_X, PITCH_TOP);
  octx.lineTo(PITCH_CENTER_X, PITCH_BOTTOM);
  octx.stroke();

  octx.beginPath();
  octx.arc(PITCH_CENTER_X, PITCH_CENTER_Y, 82, 0, Math.PI * 2);
  octx.stroke();

  octx.fillStyle = 'rgba(248, 250, 252, 0.9)';
  octx.beginPath();
  octx.arc(PITCH_CENTER_X, PITCH_CENTER_Y, 4.5, 0, Math.PI * 2);
  octx.fill();

  // Left Penalty Area & 6-yard Box
  const penW = 152;
  const penH = 340;
  const sixW = 54;
  const sixH = 180;

  octx.strokeRect(PITCH_LEFT, PITCH_CENTER_Y - penH / 2, penW, penH);
  octx.strokeRect(PITCH_LEFT, PITCH_CENTER_Y - sixH / 2, sixW, sixH);
  octx.beginPath();
  octx.arc(PITCH_LEFT + 106, PITCH_CENTER_Y, 3.5, 0, Math.PI * 2);
  octx.fill();
  octx.beginPath();
  octx.arc(PITCH_LEFT + 106, PITCH_CENTER_Y, 68, -0.68, 0.68);
  octx.stroke();

  // Right Penalty Area & 6-yard Box
  octx.strokeRect(PITCH_RIGHT - penW, PITCH_CENTER_Y - penH / 2, penW, penH);
  octx.strokeRect(PITCH_RIGHT - sixW, PITCH_CENTER_Y - sixH / 2, sixW, sixH);
  octx.beginPath();
  octx.arc(PITCH_RIGHT - 106, PITCH_CENTER_Y, 3.5, 0, Math.PI * 2);
  octx.fill();
  octx.beginPath();
  octx.arc(PITCH_RIGHT - 106, PITCH_CENTER_Y, 68, Math.PI - 0.68, Math.PI + 0.68);
  octx.stroke();

  // Corner arcs
  const cornerR = 16;
  octx.beginPath();
  octx.arc(PITCH_LEFT, PITCH_TOP, cornerR, 0, Math.PI * 0.5);
  octx.stroke();
  octx.beginPath();
  octx.arc(PITCH_RIGHT, PITCH_TOP, cornerR, Math.PI * 0.5, Math.PI);
  octx.stroke();
  octx.beginPath();
  octx.arc(PITCH_RIGHT, PITCH_BOTTOM, cornerR, Math.PI, Math.PI * 1.5);
  octx.stroke();
  octx.beginPath();
  octx.arc(PITCH_LEFT, PITCH_BOTTOM, cornerR, Math.PI * 1.5, Math.PI * 2);
  octx.stroke();

  cachedPitchCanvas = offscreen;
  return cachedPitchCanvas;
}

function drawPitch(ctx: CanvasRenderingContext2D, rippleLeft: number, rippleRight: number): void {
  const pitchImg = getCachedPitchCanvas();
  if (pitchImg) {
    ctx.drawImage(pitchImg, 0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
  }

  // Dynamic Goal Nets (drawn live for net ripple animation)
  drawGoalNet(ctx, 'left', rippleLeft);
  drawGoalNet(ctx, 'right', rippleRight);
}

function drawGoalNet(ctx: CanvasRenderingContext2D, side: 'left' | 'right', ripple: number): void {
  const isLeft = side === 'left';
  const netPulse = ripple > 0 ? Math.sin(ripple * Math.PI * 5) * ripple * 6 : 0;
  const xStart = isLeft ? PITCH_LEFT - GOAL_DEPTH - Math.abs(netPulse) : PITCH_RIGHT;
  const width = GOAL_DEPTH + Math.abs(netPulse);

  ctx.save();
  ctx.fillStyle = 'rgba(15, 23, 42, 0.42)';
  ctx.fillRect(xStart, GOAL_TOP, width, GOAL_BOTTOM - GOAL_TOP);

  // Net mesh lines
  ctx.strokeStyle = 'rgba(226, 232, 240, 0.25)';
  ctx.lineWidth = 1;
  for (let y = GOAL_TOP + 12; y < GOAL_BOTTOM; y += 12) {
    ctx.beginPath();
    ctx.moveTo(xStart, y);
    ctx.lineTo(xStart + width, y);
    ctx.stroke();
  }
  for (let x = xStart + 8; x < xStart + width; x += 8) {
    ctx.beginPath();
    ctx.moveTo(x, GOAL_TOP);
    ctx.lineTo(x, GOAL_BOTTOM);
    ctx.stroke();
  }

  // Goal frame & posts
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  if (isLeft) {
    ctx.moveTo(PITCH_LEFT, GOAL_TOP);
    ctx.lineTo(xStart, GOAL_TOP);
    ctx.lineTo(xStart, GOAL_BOTTOM);
    ctx.lineTo(PITCH_LEFT, GOAL_BOTTOM);
  } else {
    ctx.moveTo(PITCH_RIGHT, GOAL_TOP);
    ctx.lineTo(xStart + width, GOAL_TOP);
    ctx.lineTo(xStart + width, GOAL_BOTTOM);
    ctx.lineTo(PITCH_RIGHT, GOAL_BOTTOM);
  }
  ctx.stroke();

  // Posts
  ctx.fillStyle = '#ffffff';
  const postX = isLeft ? PITCH_LEFT : PITCH_RIGHT;
  ctx.beginPath();
  ctx.arc(postX, GOAL_TOP, 5, 0, Math.PI * 2);
  ctx.arc(postX, GOAL_BOTTOM, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPassGuide(ctx: CanvasRenderingContext2D, engine: FootballEngine): void {
  if (engine.isDemoMode || !engine.passTargetId) return;
  const passer = engine.getActivePlayer();
  const target = engine.players.find((p) => p.id === engine.passTargetId);
  if (!passer || !target) return;

  ctx.save();
  ctx.setLineDash([6, 6]);
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(passer.x, passer.y);
  ctx.lineTo(target.x, target.y);
  ctx.stroke();

  // Target receiver ring
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(target.x, target.y, target.radius + 7, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawPlayers(ctx: CanvasRenderingContext2D, engine: FootballEngine): void {
  for (const p of engine.players) {
    const isActive = !engine.isDemoMode && p.id === engine.activePlayerId;
    drawPlayerDot(ctx, p, isActive, engine);
  }
}

function drawPlayerDot(
  ctx: CanvasRenderingContext2D,
  p: PlayerEntity,
  isActive: boolean,
  engine: FootballEngine
): void {
  ctx.save();

  // Drop shadow on turf
  ctx.fillStyle = 'rgba(0, 0, 0, 0.34)';
  ctx.beginPath();
  ctx.ellipse(p.x + 1.5, p.y + 4, p.radius * 0.98, p.radius * 0.85, 0, 0, Math.PI * 2);
  ctx.fill();

  // Active player selection ring + facing chevron
  if (isActive) {
    // Subtle blue spark ring while entering a WASD combo with the ball
    if (engine.comboGraceTimer > 0 && engine.ball.ownerId === p.id && p.comboAuraTimer <= 0) {
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.72)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius + 9.5, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.strokeStyle = p.comboAuraTimer > 0 ? '#38bdf8' : '#34d399';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius + 5.5, 0, Math.PI * 2);
    ctx.stroke();

    // Directional indicator triangle
    const tipDist = p.radius + 11.5;
    const tipX = p.x + Math.cos(p.facingAngle) * tipDist;
    const tipY = p.y + Math.sin(p.facingAngle) * tipDist;
    const leftX = p.x + Math.cos(p.facingAngle - 0.28) * (p.radius + 6);
    const leftY = p.y + Math.sin(p.facingAngle - 0.28) * (p.radius + 6);
    const rightX = p.x + Math.cos(p.facingAngle + 0.28) * (p.radius + 6);
    const rightY = p.y + Math.sin(p.facingAngle + 0.28) * (p.radius + 6);

    ctx.fillStyle = p.comboAuraTimer > 0 ? '#38bdf8' : '#34d399';
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(leftX, leftY);
    ctx.lineTo(rightX, rightY);
    ctx.closePath();
    ctx.fill();

    // Shot charge radial arc
    if (engine.isChargingShot && engine.ball.ownerId === p.id) {
      const ratio = Math.min(1, engine.shotChargeTime / engine.maxShotCharge);
      const activeType = engine.preparedShotType;
      const chargeColor =
        activeType === 'power'
          ? '#fb923c'
          : activeType === 'finesse'
          ? '#34d399'
          : activeType === 'chip'
          ? '#38bdf8'
          : activeType === 'knuckle'
          ? '#c084fc'
          : ratio > 0.7
          ? '#facc15'
          : '#fb923c';
      ctx.strokeStyle = chargeColor;
      ctx.lineWidth = activeType !== 'normal' ? 4.5 : 4;
      ctx.beginPath();
      ctx.arc(
        p.x,
        p.y,
        p.radius + 9,
        -Math.PI * 0.5,
        -Math.PI * 0.5 + Math.PI * 2 * ratio
      );
      ctx.stroke();
    }
  }

  // Animated blue fire ring surrounding player when executing a special combo shot
  if (p.comboAuraTimer > 0) {
    drawBlueFireAura(ctx, p.x, p.y, p.radius, p.comboAuraTimer);
  }

  // AI shot windup telegraph ring
  if (p.aiShootWindup > 0) {
    const aiShot = p.aiPendingShotType ?? 'normal';
    ctx.strokeStyle =
      aiShot === 'power'
        ? '#fb923c'
        : aiShot === 'finesse'
        ? '#34d399'
        : aiShot === 'chip'
        ? '#38bdf8'
        : aiShot === 'knuckle'
        ? '#c084fc'
        : '#facc15';
    ctx.lineWidth = aiShot !== 'normal' ? 3 : 2.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius + 5.5, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Active tackle lunge aura (normal = mint, aggressive = orange-red)
  if (p.lungeTimer > 0) {
    const isAgg = p.lungeType === 'aggressive';
    ctx.strokeStyle = isAgg ? '#fb923c' : '#86efac';
    ctx.lineWidth = isAgg ? 3.5 : 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius + (isAgg ? 7.5 : 4), 0, Math.PI * 2);
    ctx.stroke();
  }

  // Stunned / injured indicator ring after aggressive tackle
  if (p.injuryTimer > 0) {
    const pulse = 0.55 + Math.sin(p.injuryTimer * 10) * 0.35;
    ctx.strokeStyle = `rgba(239, 68, 68, ${pulse})`;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius + 5.5, 0, Math.PI * 2);
    ctx.stroke();
  } else if (p.stunTimer > 0) {
    ctx.save();
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = 'rgba(248, 113, 113, 0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius + 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Main Dot Fill
  let fillColor = p.team === 'home' ? '#2563eb' : '#dc2626';
  if (p.role === 'GK') {
    fillColor = p.team === 'home' ? '#f59e0b' : '#0891b2';
  }
  if (p.flashTimer > 0) {
    fillColor = '#ffffff';
  }
  if (p.injuryTimer > 0) {
    ctx.globalAlpha = 0.62;
  } else if (p.stunTimer > 0) {
    ctx.globalAlpha = 0.72;
  }

  ctx.fillStyle = fillColor;
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
  ctx.fill();

  // Crisp outer rim (FIFA tactical dot look)
  ctx.strokeStyle = p.role === 'GK' ? '#fef3c7' : '#f8fafc';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Subtle top sheen
  ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.beginPath();
  ctx.arc(p.x, p.y - p.radius * 0.25, p.radius * 0.65, Math.PI, 0);
  ctx.fill();

  // Jersey Dorsal Number
  ctx.fillStyle = p.flashTimer > 0 ? '#0f172a' : p.role === 'GK' && p.team === 'home' ? '#0f172a' : '#ffffff';
  ctx.font = `800 ${Math.round(p.radius * 0.92)}px "Barlow Condensed", "Plus Jakarta Sans", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(p.number), p.x, p.y + 0.8);

  // Injury medical cross badge when immobilized
  if (p.injuryTimer > 0) {
    ctx.globalAlpha = 1;
    const bx = p.x + p.radius * 0.72;
    const by = p.y - p.radius * 0.72;
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(bx, by, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(bx - 2.6, by);
    ctx.lineTo(bx + 2.6, by);
    ctx.moveTo(bx, by - 2.6);
    ctx.lineTo(bx, by + 2.6);
    ctx.stroke();
  }

  ctx.restore();
}

function drawBlueFireAura(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  timer: number
): void {
  const phase = (0.28 - timer) * 32;
  const lobes = 10;

  // Outer blue flame glow ring
  ctx.fillStyle = 'rgba(37, 99, 235, 0.35)';
  ctx.beginPath();
  ctx.arc(x, y, radius + 14, 0, Math.PI * 2);
  ctx.fill();

  // Outer & inner swirling blue fire tongues
  for (let i = 0; i < lobes; i++) {
    const angle = (i * Math.PI * 2) / lobes + phase * 0.35;
    const flicker = Math.sin(phase * 1.9 + i * 2.1) * 4.5;
    const distOut = radius + 9 + flicker;
    const fx = x + Math.cos(angle) * distOut;
    const fy = y + Math.sin(angle) * distOut - 2;

    ctx.fillStyle = i % 2 === 0 ? 'rgba(56, 189, 248, 0.88)' : 'rgba(59, 130, 246, 0.88)';
    ctx.beginPath();
    ctx.arc(fx, fy, 5.2 + flicker * 0.25, 0, Math.PI * 2);
    ctx.fill();

    // Bright cyan-white inner core
    ctx.fillStyle = 'rgba(224, 242, 254, 0.9)';
    ctx.beginPath();
    ctx.arc(
      x + Math.cos(angle) * (radius + 5.5 + flicker * 0.4),
      y + Math.sin(angle) * (radius + 5.5 + flicker * 0.4),
      2.4,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
}

function drawBall(ctx: CanvasRenderingContext2D, engine: FootballEngine): void {
  const { ball } = engine;

  const loftHeight =
    ball.loftDuration > 0 && ball.loftProgress < 1
      ? Math.sin(ball.loftProgress * Math.PI)
      : 0;

  // Motion trail colored by shot type
  const trailRgb =
    ball.shotType === 'power'
      ? '251, 146, 60'
      : ball.shotType === 'finesse'
      ? '52, 211, 153'
      : ball.shotType === 'chip'
      ? '56, 189, 248'
      : ball.shotType === 'knuckle'
      ? '192, 132, 252'
      : ball.isShot
      ? '250, 204, 21'
      : '248, 250, 252';

  for (const pt of ball.trail) {
    const alphaMult = ball.isShot ? (ball.shotType !== 'normal' ? 0.68 : 0.55) : 0.35;
    ctx.fillStyle = `rgba(${trailRgb}, ${pt.alpha * alphaMult})`;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y - loftHeight * 14, ball.radius * (ball.shotType === 'power' ? 0.92 : 0.75), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.save();
  // Ground shadow (separates when lobbed on a chip shot)
  ctx.fillStyle = `rgba(0, 0, 0, ${0.38 - loftHeight * 0.16})`;
  ctx.beginPath();
  ctx.ellipse(
    ball.x + 2 + loftHeight * 4,
    ball.y + 3.5 + loftHeight * 8,
    ball.radius * (1 - loftHeight * 0.2),
    ball.radius * 0.85 * (1 - loftHeight * 0.2),
    0,
    0,
    Math.PI * 2
  );
  ctx.fill();

  // White ball body (lifted & scaled when lofted)
  const renderRadius = ball.radius * (1 + loftHeight * 0.45);
  ctx.translate(ball.x, ball.y - loftHeight * 20);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, 0, renderRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle =
    ball.isShot && ball.shotType !== 'normal'
      ? `rgb(${trailRgb})`
      : '#0f172a';
  ctx.lineWidth = ball.isShot && ball.shotType !== 'normal' ? 2 : 1.4;
  ctx.stroke();

  // Rotating pentagon detail
  ctx.rotate(ball.spinAngle);
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = (i * Math.PI * 2) / 5;
    const px = Math.cos(a) * (renderRadius * 0.38);
    const py = Math.sin(a) * (renderRadius * 0.38);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawShotCallout(ctx: CanvasRenderingContext2D, engine: FootballEngine): void {
  const callout = engine.shotCallout;
  if (!callout || engine.isDemoMode) return;

  const alpha = Math.min(1, callout.timer * 2.2);
  const floatOffset = (0.9 - callout.timer) * 18;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = '800 17px "Barlow Condensed", "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.strokeText(callout.text, callout.x, callout.y - floatOffset);
  ctx.fillStyle = callout.color;
  ctx.fillText(callout.text, callout.x, callout.y - floatOffset);
  ctx.restore();
}

function drawParticles(ctx: CanvasRenderingContext2D, engine: FootballEngine): void {
  for (const pt of engine.particles) {
    if (!pt.active) continue;
    const alpha = Math.max(0, pt.life / pt.maxLife);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawGoalBanner(ctx: CanvasRenderingContext2D, engine: FootballEngine): void {
  const isHome = engine.stats.lastGoalTeam === 'home';
  const scorerNum = engine.stats.lastGoalNumber;
  const alpha = Math.min(1, engine.stats.goalBannerTimer * 2);

  ctx.save();
  ctx.globalAlpha = alpha;

  const boxW = 360;
  const boxH = 88;
  const x = PITCH_CENTER_X - boxW / 2;
  const y = PITCH_CENTER_Y - boxH / 2;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
  ctx.beginPath();
  ctx.roundRect(x, y, boxW, boxH, 12);
  ctx.fill();

  ctx.strokeStyle = isHome ? '#3b82f6' : '#ef4444';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.fillStyle = '#facc15';
  ctx.font = '800 40px "Barlow Condensed", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('¡GOL!', PITCH_CENTER_X, y + 36);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = '600 15px "Plus Jakarta Sans", sans-serif';
  const teamName = isHome ? 'LOCAL' : 'VISITANTE';
  const subText = scorerNum ? `${teamName} · Dorsal #${scorerNum}` : teamName;
  ctx.fillText(subText, PITCH_CENTER_X, y + 67);

  ctx.restore();
}

function drawRestartSpot(ctx: CanvasRenderingContext2D, engine: FootballEngine): void {
  const restart = engine.activeRestart;
  if (!restart) return;

  ctx.save();
  ctx.setLineDash([5, 5]);
  ctx.strokeStyle = restart.team === 'home' ? '#60a5fa' : '#f87171';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(restart.x, restart.y, 26, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawRestartBanner(ctx: CanvasRenderingContext2D, engine: FootballEngine): void {
  const restart = engine.activeRestart;
  if (!restart) return;

  const title =
    restart.type === 'throw_in'
      ? 'SAQUE DE BANDA'
      : restart.type === 'corner'
      ? 'CÓRNER'
      : 'SAQUE DE PUERTA';

  const isHome = restart.team === 'home';
  const teamLabel = isHome ? 'LOCAL' : 'RIVAL';
  const hint =
    isHome && restart.ready
      ? restart.type === 'throw_in'
        ? ' · Apunta y pulsa Z para sacar'
        : ' · Z Pasar · X Despeje / Centro'
      : '';

  ctx.save();
  const boxW = hint ? 430 : 280;
  const boxH = 44;
  const x = PITCH_CENTER_X - boxW / 2;
  const y = PITCH_TOP + 16;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
  ctx.beginPath();
  ctx.roundRect(x, y, boxW, boxH, 10);
  ctx.fill();

  ctx.strokeStyle = isHome ? '#3b82f6' : '#ef4444';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f8fafc';
  ctx.font = '700 15px "Barlow Condensed", "Plus Jakarta Sans", sans-serif';
  ctx.fillText(`${title} — ${teamLabel}${hint}`, PITCH_CENTER_X, y + boxH / 2 + 0.5);

  ctx.restore();
}

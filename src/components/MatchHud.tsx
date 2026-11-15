import { BookOpen, Minus, Pause, Plus, RotateCcw, Volume2, VolumeX, Gamepad2 } from 'lucide-react';
import type { Difficulty, HudSnapshot, TrainingConfig } from '../game/types';

interface MatchHudProps {
  hud: HudSnapshot;
  muted: boolean;
  showTouchControls: boolean;
  isTrainingMode?: boolean;
  trainingConfig?: TrainingConfig;
  trainingDifficulty?: Difficulty;
  onChangeTrainingConfig?: (next: TrainingConfig) => void;
  onChangeTrainingDifficulty?: (diff: Difficulty) => void;
  onResetTrainingBall?: () => void;
  onToggleMute: () => void;
  onToggleTouchControls: () => void;
  onPause: () => void;
  onOpenTutorial: () => void;
  onVirtualMove: (x: number, y: number, sprint?: boolean) => void;
  onTouchPass: () => void;
  onTouchShoot: () => void;
  onTouchAggressiveTackle: () => void;
  onTouchSwitch: () => void;
}

function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function MatchHud({
  hud,
  muted,
  showTouchControls,
  isTrainingMode = false,
  trainingConfig = { teammates: 0, defenders: 0 },
  trainingDifficulty = 'normal',
  onChangeTrainingConfig,
  onChangeTrainingDifficulty,
  onResetTrainingBall,
  onToggleMute,
  onToggleTouchControls,
  onPause,
  onOpenTutorial,
  onVirtualMove,
  onTouchPass,
  onTouchShoot,
  onTouchAggressiveTackle,
  onTouchSwitch,
}: MatchHudProps) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-3 sm:p-4">
      {/* Top Perimeter HUD Bar */}
      <div className="flex items-start justify-between gap-3">
        {/* Left active player indicator */}
        <div className="hidden sm:flex items-center gap-2 bg-slate-950/90 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-300">
          <span className="text-slate-400">Controlando</span>
          <span className="font-[family-name:var(--font-mono)] font-bold text-emerald-400 tabular-nums">
            #{hud.activePlayerNumber}
          </span>
        </div>

        {/* Center Compact Broadcast Scoreboard or Training Banner */}
        {isTrainingMode ? (
          <div className="mx-auto flex items-center gap-3 bg-slate-950/95 border border-sky-800/70 rounded-lg px-3.5 py-1.5 shadow-lg">
            <span className="font-[family-name:var(--font-display)] text-sm sm:text-base font-bold tracking-wide text-sky-300">
              ENTRENAMIENTO
            </span>
            <div className="flex items-center gap-2 px-2.5 py-0.5 bg-slate-900 rounded font-[family-name:var(--font-mono)] text-sm sm:text-base font-bold text-white tabular-nums">
              <span className="text-xs font-sans text-slate-400">Goles</span>
              <span className="text-emerald-400">{hud.homeScore}</span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400">
              <span>Portero</span>
              <span className="font-[family-name:var(--font-mono)] font-bold text-amber-300 tabular-nums">
                {hud.awaySaves} par.
              </span>
            </div>
          </div>
        ) : (
          <div className="mx-auto flex items-center bg-slate-950/95 border border-slate-800 rounded-lg px-3.5 py-1.5 shadow-lg">
            <div className="flex items-center gap-2 pr-3">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 border border-white/80 shrink-0" aria-hidden="true" />
              <span className="font-[family-name:var(--font-display)] text-sm sm:text-base font-bold tracking-wide text-slate-100">
                LOCAL
              </span>
            </div>

            <div className="flex items-center gap-2 px-3 py-0.5 bg-slate-900 rounded font-[family-name:var(--font-mono)] text-lg sm:text-xl font-bold text-white tabular-nums">
              <span>{hud.homeScore}</span>
              <span className="text-slate-500 text-sm">-</span>
              <span>{hud.awayScore}</span>
            </div>

            <div className="flex items-center gap-2 pl-3 pr-3 border-r border-slate-800">
              <span className="font-[family-name:var(--font-display)] text-sm sm:text-base font-bold tracking-wide text-slate-100">
                RIVAL
              </span>
              <span className="w-2.5 h-2.5 rounded-full bg-red-600 border border-white/80 shrink-0" aria-hidden="true" />
            </div>

            <div className="pl-3 font-[family-name:var(--font-mono)] text-sm sm:text-base font-bold text-emerald-400 tabular-nums">
              {formatClock(hud.timeRemainingSec)}
            </div>
          </div>
        )}

        {/* Right Action Buttons */}
        <div className="pointer-events-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={onToggleTouchControls}
            title="Controles en pantalla"
            aria-label="Controles en pantalla"
            className={`p-2 rounded-lg border transition-colors cursor-pointer ${
              showTouchControls
                ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                : 'bg-slate-950/90 text-slate-200 border-slate-800 hover:bg-slate-900'
            }`}
          >
            <Gamepad2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onOpenTutorial}
            title="Tutorial"
            aria-label="Abrir Tutorial"
            className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-slate-950/90 hover:bg-slate-900 border border-slate-800 text-slate-100 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <BookOpen className="w-4 h-4 text-emerald-400" />
            <span className="hidden md:inline">Tutorial</span>
          </button>
          <button
            type="button"
            onClick={onToggleMute}
            title={muted ? 'Activar sonido' : 'Silenciar'}
            aria-label={muted ? 'Activar sonido' : 'Silenciar'}
            className="p-2 rounded-lg bg-slate-950/90 hover:bg-slate-900 border border-slate-800 text-slate-200 transition-colors cursor-pointer"
          >
            {muted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={onPause}
            title="Pausa (Esc)"
            aria-label="Pausar partido"
            className="p-2 rounded-lg bg-slate-950/90 hover:bg-slate-900 border border-slate-800 text-slate-200 transition-colors cursor-pointer"
          >
            <Pause className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Left Vertical Training Sidebar */}
      {isTrainingMode && (
        <aside className="pointer-events-auto absolute left-2.5 sm:left-3.5 top-14 sm:top-16 w-[138px] sm:w-[148px] flex flex-col gap-2.5 bg-slate-950/92 border border-slate-800 rounded-xl p-2.5 shadow-xl text-xs">
          {/* Teammates Counter */}
          <div className="space-y-1 pb-2 border-b border-slate-800/90">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" aria-hidden="true" />
              <span className="text-slate-300 font-semibold">Compañeros</span>
            </div>
            <div className="flex items-center justify-between gap-1 bg-slate-900/90 rounded-lg p-1">
              <button
                type="button"
                onClick={() =>
                  onChangeTrainingConfig?.({
                    ...trainingConfig,
                    teammates: Math.max(0, trainingConfig.teammates - 1),
                  })
                }
                disabled={trainingConfig.teammates <= 0}
                aria-label="Quitar compañero"
                className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 disabled:opacity-35 text-slate-100 cursor-pointer disabled:cursor-default"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="font-[family-name:var(--font-mono)] text-sm font-bold text-blue-300 tabular-nums">
                {trainingConfig.teammates}
              </span>
              <button
                type="button"
                onClick={() =>
                  onChangeTrainingConfig?.({
                    ...trainingConfig,
                    teammates: Math.min(4, trainingConfig.teammates + 1),
                  })
                }
                disabled={trainingConfig.teammates >= 4}
                aria-label="Añadir compañero"
                className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 disabled:opacity-35 text-slate-100 cursor-pointer disabled:cursor-default"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Defenders Counter */}
          <div className="space-y-1 pb-2 border-b border-slate-800/90">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" aria-hidden="true" />
              <span className="text-slate-300 font-semibold">Defensas</span>
            </div>
            <div className="flex items-center justify-between gap-1 bg-slate-900/90 rounded-lg p-1">
              <button
                type="button"
                onClick={() =>
                  onChangeTrainingConfig?.({
                    ...trainingConfig,
                    defenders: Math.max(0, trainingConfig.defenders - 1),
                  })
                }
                disabled={trainingConfig.defenders <= 0}
                aria-label="Quitar defensa"
                className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 disabled:opacity-35 text-slate-100 cursor-pointer disabled:cursor-default"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="font-[family-name:var(--font-mono)] text-sm font-bold text-red-300 tabular-nums">
                {trainingConfig.defenders}
              </span>
              <button
                type="button"
                onClick={() =>
                  onChangeTrainingConfig?.({
                    ...trainingConfig,
                    defenders: Math.min(4, trainingConfig.defenders + 1),
                  })
                }
                disabled={trainingConfig.defenders >= 4}
                aria-label="Añadir defensa"
                className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 disabled:opacity-35 text-slate-100 cursor-pointer disabled:cursor-default"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Goalkeeper / AI Difficulty */}
          <div className="space-y-1 pb-2 border-b border-slate-800/90">
            <span className="block text-[11px] font-semibold text-slate-400">Nivel rival</span>
            <div className="flex flex-col gap-1">
              {(['facil', 'normal', 'dificil'] as Difficulty[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => onChangeTrainingDifficulty?.(d)}
                  className={`w-full py-1 px-2 rounded-md text-left font-semibold transition-colors cursor-pointer ${
                    trainingDifficulty === d
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {d === 'facil' ? 'Fácil' : d === 'dificil' ? 'Difícil' : 'Normal'}
                </button>
              ))}
            </div>
          </div>

          {/* Reset Ball */}
          <button
            type="button"
            onClick={onResetTrainingBall}
            title="Reiniciar balón (R)"
            className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/50 text-sky-300 font-semibold transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 shrink-0" />
            <span>Reiniciar (R)</span>
          </button>
        </aside>
      )}

      {/* Bottom Controls: Touch Pad (if enabled) or Quiet Keyboard Hint */}
      {showTouchControls ? (
        <div className="pointer-events-auto flex items-end justify-between px-2 pb-1 select-none">
          {/* Directional Pad */}
          <div className="grid grid-cols-3 gap-1.5 bg-slate-950/80 border border-slate-800 p-2 rounded-xl">
            <div />
            <button
              type="button"
              onPointerDown={() => onVirtualMove(0, -1)}
              onPointerUp={() => onVirtualMove(0, 0)}
              onPointerLeave={() => onVirtualMove(0, 0)}
              className="w-11 h-11 rounded-lg bg-slate-800 active:bg-emerald-500 active:text-slate-950 text-white font-bold text-sm"
            >
              ↑
            </button>
            <div />
            <button
              type="button"
              onPointerDown={() => onVirtualMove(-1, 0)}
              onPointerUp={() => onVirtualMove(0, 0)}
              onPointerLeave={() => onVirtualMove(0, 0)}
              className="w-11 h-11 rounded-lg bg-slate-800 active:bg-emerald-500 active:text-slate-950 text-white font-bold text-sm"
            >
              ←
            </button>
            <button
              type="button"
              onPointerDown={() => onVirtualMove(0, 1)}
              onPointerUp={() => onVirtualMove(0, 0)}
              onPointerLeave={() => onVirtualMove(0, 0)}
              className="w-11 h-11 rounded-lg bg-slate-800 active:bg-emerald-500 active:text-slate-950 text-white font-bold text-sm"
            >
              ↓
            </button>
            <button
              type="button"
              onPointerDown={() => onVirtualMove(1, 0)}
              onPointerUp={() => onVirtualMove(0, 0)}
              onPointerLeave={() => onVirtualMove(0, 0)}
              className="w-11 h-11 rounded-lg bg-slate-800 active:bg-emerald-500 active:text-slate-950 text-white font-bold text-sm"
            >
              →
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5">
            {!hud.hasBall && (
              <>
                <button
                  type="button"
                  onClick={onTouchSwitch}
                  className="w-14 h-14 rounded-full bg-slate-900/95 border border-slate-600 text-slate-100 font-bold text-xs active:scale-95"
                >
                  Cambiar
                </button>
                <button
                  type="button"
                  onClick={onTouchAggressiveTackle}
                  className="w-15 h-15 rounded-full bg-orange-600 border-2 border-orange-300 text-white font-bold text-[11px] active:scale-95"
                >
                  Agresiva
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onTouchPass}
              className="w-16 h-16 rounded-full bg-blue-600 border-2 border-blue-300 text-white font-bold text-xs active:scale-95"
            >
              {hud.hasBall ? 'Pasar' : 'Cambiar'}
            </button>
            <button
              type="button"
              onClick={onTouchShoot}
              className="w-16 h-16 rounded-full bg-emerald-500 border-2 border-emerald-200 text-slate-950 font-bold text-xs active:scale-95"
            >
              {hud.hasBall ? 'Chutar' : 'Normal'}
            </button>
          </div>
        </div>
      ) : (
        <div className="mx-auto hidden sm:flex items-center gap-2 bg-slate-950/80 border border-slate-800/80 rounded-lg px-3.5 py-1 text-[11px] font-medium text-slate-300">
          <span>Flechas: Mover</span>
          <span className="text-slate-600" aria-hidden="true">·</span>
          <span>Z: {hud.hasBall ? 'Pasar' : 'Cambiar'}</span>
          <span className="text-slate-600" aria-hidden="true">·</span>
          <span>X: {hud.hasBall ? 'Chutar' : 'Entrada normal'}</span>
          {hud.hasBall ? (
            <>
              <span className="text-slate-600" aria-hidden="true">·</span>
              <span className="text-emerald-300">Combos (solo WASD): W·A·D+X / S·W+X / A·D+X / Espacio+X</span>
            </>
          ) : (
            <>
              <span className="text-slate-600" aria-hidden="true">·</span>
              <span className="text-orange-300">V: Entrada agresiva</span>
              <span className="text-slate-600" aria-hidden="true">·</span>
              <span>C: Cambiar</span>
            </>
          )}
          <span className="text-slate-600" aria-hidden="true">·</span>
          <span>Shift: Sprint</span>
        </div>
      )}
    </div>
  );
}

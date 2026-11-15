import { ArrowLeft, Play } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { MatchHud } from './components/MatchHud';
import { MatchOverModal } from './components/MatchOverModal';
import { PauseModal } from './components/PauseModal';
import { TitleScreen } from './components/TitleScreen';
import { TutorialModal } from './components/TutorialModal';
import {
  FootballEngine,
  LOGICAL_HEIGHT,
  LOGICAL_WIDTH,
} from './game/engine';
import { renderFootballCanvas } from './game/renderer';
import { soundEngine } from './game/sound';
import type { Difficulty, GameState, HudSnapshot, MatchConfig, TrainingConfig } from './game/types';

const INITIAL_HUD: HudSnapshot = {
  homeScore: 0,
  awayScore: 0,
  timeRemainingSec: 180,
  homeShots: 0,
  awayShots: 0,
  homePasses: 0,
  awayPasses: 0,
  homeSaves: 0,
  awaySaves: 0,
  possessionHomePct: 50,
  activePlayerNumber: 9,
  hasBall: false,
};

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<FootballEngine | null>(null);

  const [gameState, setGameState] = useState<GameState>('TITLE_MENU');
  const [config, setConfig] = useState<MatchConfig>({
    format: '7v7',
    difficulty: 'normal',
    durationSec: 180,
  });
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [muted, setMuted] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [spectatingDemo, setSpectatingDemo] = useState(false);
  const [isTrainingMode, setIsTrainingMode] = useState(false);
  const [trainingConfig, setTrainingConfig] = useState<TrainingConfig>({
    teammates: 0,
    defenders: 0,
  });
  const [showTouchControls, setShowTouchControls] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia?.('(pointer: coarse)').matches ?? false;
  });

  // Initialize isolated engine + 60fps requestAnimationFrame loop
  useEffect(() => {
    const engine = new FootballEngine({
      onHudUpdate: (snap) => setHud(snap),
      onMatchOver: (snap) => {
        setHud(snap);
        setGameState('GAME_OVER');
      },
    });
    engine.startDemoLoop();
    engineRef.current = engine;

    let rafId = 0;
    let lastTime = performance.now();
    let cachedCtx: CanvasRenderingContext2D | null = canvasRef.current?.getContext('2d', { alpha: false }) ?? null;

    const resizeCanvas = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = container.clientWidth;
      const h = container.clientHeight;
      const targetW = Math.floor(w * dpr);
      const targetH = Math.floor(h * dpr);
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
        cachedCtx = canvas.getContext('2d', { alpha: false });
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const loop = (now: number) => {
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;

      engine.update(rawDt);

      const canvas = canvasRef.current;
      if (canvas && cachedCtx) {
        renderFootballCanvas(cachedCtx, engine, canvas.width, canvas.height);
      }
      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  const startMatch = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    setTutorialOpen(false);
    setSpectatingDemo(false);
    setIsTrainingMode(false);
    engine.startNewMatch(config);
    setGameState('PLAYING');
  }, [config]);

  const startTraining = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    setTutorialOpen(false);
    setSpectatingDemo(false);
    setIsTrainingMode(true);
    engine.startTraining(config, trainingConfig);
    setGameState('PLAYING');
  }, [config, trainingConfig]);

  const handleTrainingConfigChange = useCallback((next: TrainingConfig) => {
    setTrainingConfig(next);
    engineRef.current?.setTrainingCounts(next.teammates, next.defenders);
  }, []);

  const handleTrainingDifficultyChange = useCallback((diff: Difficulty) => {
    setConfig((prev) => {
      const next = { ...prev, difficulty: diff };
      if (engineRef.current) {
        engineRef.current.config = { ...next };
      }
      return next;
    });
  }, []);

  const resetTrainingBall = useCallback(() => {
    engineRef.current?.resetTrainingBall();
  }, []);

  const pauseMatch = useCallback(() => {
    const engine = engineRef.current;
    if (!engine || engine.gameState !== 'PLAYING') return;
    engine.gameState = 'PAUSED';
    engine.clearInputs();
    setGameState('PAUSED');
  }, []);

  const resumeMatch = useCallback(() => {
    const engine = engineRef.current;
    if (!engine || engine.gameState !== 'PAUSED') return;
    engine.gameState = 'PLAYING';
    setGameState('PLAYING');
  }, []);

  const quitToMenu = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    setTutorialOpen(false);
    setSpectatingDemo(false);
    setIsTrainingMode(false);
    engine.config = { ...config };
    engine.startDemoLoop();
    setGameState('TITLE_MENU');
  }, [config]);

  const handleOpenTutorial = useCallback(() => {
    const engine = engineRef.current;
    if (engine && engine.gameState === 'PLAYING') {
      engine.gameState = 'PAUSED';
      engine.clearInputs();
      setGameState('PAUSED');
    }
    setTutorialOpen(true);
  }, []);

  const handleToggleMute = useCallback(() => {
    const next = !muted;
    soundEngine.setMuted(next);
    setMuted(next);
  }, [muted]);

  const handleConfigChange = useCallback((next: MatchConfig) => {
    setConfig(next);
    const engine = engineRef.current;
    if (engine && engine.isDemoMode) {
      engine.config = { ...next };
      engine.setupTeams();
    }
  }, []);

  // Keyboard bindings & window blur protection
  useEffect(() => {
    const isTypingInInput = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingInInput(e.target)) return;

      if (
        gameState === 'PLAYING' &&
        ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)
      ) {
        e.preventDefault();
      }

      if (e.repeat) return;

      if (e.code === 'Escape') {
        if (tutorialOpen) {
          setTutorialOpen(false);
          return;
        }
        if (gameState === 'TITLE_MENU' && spectatingDemo) {
          setSpectatingDemo(false);
          return;
        }
        if (gameState === 'PLAYING') {
          pauseMatch();
        } else if (gameState === 'PAUSED') {
          resumeMatch();
        }
        return;
      }

      if (
        gameState === 'TITLE_MENU' &&
        !tutorialOpen &&
        !spectatingDemo &&
        (e.code === 'Enter' || e.code === 'Space')
      ) {
        e.preventDefault();
        startMatch();
        return;
      }

      if (gameState === 'PLAYING' && isTrainingMode && e.code === 'KeyR') {
        e.preventDefault();
        resetTrainingBall();
        return;
      }

      engineRef.current?.handleKeyDown(e.code);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      engineRef.current?.handleKeyUp(e.code);
    };

    const onBlur = () => {
      engineRef.current?.clearInputs();
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        engineRef.current?.clearInputs();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [gameState, isTrainingMode, pauseMatch, resetTrainingBall, resumeMatch, spectatingDemo, startMatch, tutorialOpen]);

  // Convert canvas click to logical pitch coordinates
  const handleCanvasClick = useCallback((e: MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const engine = engineRef.current;
    if (!canvas || !engine || engine.gameState !== 'PLAYING') return;

    const rect = canvas.getBoundingClientRect();
    const dpr = canvas.width / rect.width;
    const cx = (e.clientX - rect.left) * dpr;
    const cy = (e.clientY - rect.top) * dpr;

    const scale = Math.min(canvas.width / LOGICAL_WIDTH, canvas.height / LOGICAL_HEIGHT);
    const offsetX = (canvas.width - LOGICAL_WIDTH * scale) * 0.5;
    const offsetY = (canvas.height - LOGICAL_HEIGHT * scale) * 0.5;

    const logicalX = (cx - offsetX) / scale;
    const logicalY = (cy - offsetY) / scale;
    engine.handlePitchClick(logicalX, logicalY);
  }, []);

  return (
    <main
      ref={containerRef}
      className="relative h-screen w-screen overflow-hidden bg-[#081510] select-none"
    >
      {/* Isolated 60fps Canvas */}
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        className="block h-full w-full cursor-crosshair"
      />

      {/* Title Screen */}
      {gameState === 'TITLE_MENU' && !spectatingDemo && (
        <TitleScreen
          config={config}
          onChangeConfig={handleConfigChange}
          onStartMatch={startMatch}
          onStartTraining={startTraining}
          onWatchDemo={() => setSpectatingDemo(true)}
          onOpenTutorial={handleOpenTutorial}
        />
      )}

      {/* Demo Spectator Controls */}
      {gameState === 'TITLE_MENU' && spectatingDemo && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-3 p-3 sm:p-4">
          <button
            type="button"
            onClick={() => setSpectatingDemo(false)}
            className="pointer-events-auto flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-950/95 hover:bg-slate-900 border border-slate-700 text-slate-100 text-xs sm:text-sm font-semibold shadow-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-emerald-400" />
            <span>Volver al menú</span>
          </button>

          <div className="hidden sm:flex items-center gap-2 bg-slate-950/90 border border-slate-800 rounded-lg px-3.5 py-2 text-xs font-medium text-slate-200 shadow-lg">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true" />
            <span>
              Viendo partido · {config.format.replace('v', ' vs ')} ·{' '}
              {config.difficulty === 'facil'
                ? 'Fácil'
                : config.difficulty === 'dificil'
                  ? 'Difícil'
                  : 'Normal'}
            </span>
          </div>

          <button
            type="button"
            onClick={startMatch}
            className="pointer-events-auto flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs sm:text-sm font-bold shadow-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Jugar Partido</span>
          </button>
        </div>
      )}

      {/* Active Playing HUD */}
      {(gameState === 'PLAYING' || gameState === 'PAUSED') && (
        <MatchHud
          hud={hud}
          muted={muted}
          showTouchControls={showTouchControls}
          isTrainingMode={isTrainingMode}
          trainingConfig={trainingConfig}
          trainingDifficulty={config.difficulty}
          onChangeTrainingConfig={handleTrainingConfigChange}
          onChangeTrainingDifficulty={handleTrainingDifficultyChange}
          onResetTrainingBall={resetTrainingBall}
          onToggleMute={handleToggleMute}
          onToggleTouchControls={() => setShowTouchControls((prev) => !prev)}
          onPause={pauseMatch}
          onOpenTutorial={handleOpenTutorial}
          onVirtualMove={(x, y, sprint) => engineRef.current?.setVirtualMove(x, y, sprint)}
          onTouchPass={() => engineRef.current?.triggerTouchPass()}
          onTouchShoot={() => engineRef.current?.triggerTouchShootOrTackle()}
          onTouchAggressiveTackle={() => engineRef.current?.triggerTouchAggressiveTackle()}
          onTouchSwitch={() => engineRef.current?.triggerTouchSwitch()}
        />
      )}

      {/* Pause Modal */}
      {gameState === 'PAUSED' && !tutorialOpen && (
        <PauseModal
          isTrainingMode={isTrainingMode}
          onResume={resumeMatch}
          onRestart={isTrainingMode ? startTraining : startMatch}
          onOpenTutorial={handleOpenTutorial}
          onQuitToMenu={quitToMenu}
        />
      )}

      {/* Full-Time Match Over Modal */}
      {gameState === 'GAME_OVER' && !tutorialOpen && (
        <MatchOverModal
          hud={hud}
          onPlayAgain={startMatch}
          onOpenTutorial={handleOpenTutorial}
          onBackToMenu={quitToMenu}
        />
      )}

      {/* Interactive Controls & Mechanics Tutorial Modal */}
      <TutorialModal
        open={tutorialOpen}
        onClose={() => setTutorialOpen(false)}
      />
    </main>
  );
}

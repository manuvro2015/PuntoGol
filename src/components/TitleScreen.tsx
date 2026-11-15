import { BookOpen, Eye, Target } from 'lucide-react';
import type { Difficulty, MatchConfig, MatchFormat } from '../game/types';

interface TitleScreenProps {
  config: MatchConfig;
  onChangeConfig: (next: MatchConfig) => void;
  onStartMatch: () => void;
  onStartTraining: () => void;
  onWatchDemo: () => void;
  onOpenTutorial: () => void;
}

export function TitleScreen({
  config,
  onChangeConfig,
  onStartMatch,
  onStartTraining,
  onWatchDemo,
  onOpenTutorial,
}: TitleScreenProps) {
  const formats: { id: MatchFormat; label: string }[] = [
    { id: '5v5', label: '5 vs 5' },
    { id: '7v7', label: '7 vs 7' },
    { id: '11v11', label: '11 vs 11' },
  ];

  const difficulties: { id: Difficulty; label: string }[] = [
    { id: 'facil', label: 'Fácil' },
    { id: 'normal', label: 'Normal' },
    { id: 'dificil', label: 'Difícil' },
  ];

  const durations = [
    { sec: 120, label: '2 min' },
    { sec: 180, label: '3 min' },
    { sec: 300, label: '5 min' },
  ];

  return (
    <div className="absolute inset-0 z-20 flex flex-col justify-between bg-gradient-to-r from-[#06120d]/95 via-[#06120d]/80 to-[#06120d]/35 p-6 sm:p-10 lg:p-14">
      <div className="my-auto max-w-lg space-y-8">
        {/* Bespoke inline SVG Title Lockup */}
        <div className="space-y-3">
          <div className="flex items-center gap-3.5">
            <svg
              width="48"
              height="48"
              viewBox="0 0 48 48"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
              className="shrink-0"
            >
              <rect width="48" height="48" rx="12" fill="#0F5B35" stroke="#34D399" strokeWidth="2" />
              <line x1="24" y1="4" x2="24" y2="44" stroke="#F8FAFC" strokeOpacity="0.45" strokeWidth="1.5" />
              <circle cx="24" cy="24" r="9" stroke="#F8FAFC" strokeOpacity="0.45" strokeWidth="1.5" />
              <circle cx="15" cy="18" r="5.5" fill="#2563EB" stroke="#F8FAFC" strokeWidth="1.5" />
              <circle cx="33" cy="30" r="5.5" fill="#DC2626" stroke="#F8FAFC" strokeWidth="1.5" />
              <circle cx="24" cy="24" r="3.2" fill="#FFFFFF" stroke="#0F172A" strokeWidth="1.2" />
            </svg>
            <div>
              <h1 className="font-[family-name:var(--font-display)] text-5xl font-extrabold tracking-tight text-white sm:text-6xl leading-none">
                PuntoGol
              </h1>
              <p className="mt-1 text-sm font-medium text-emerald-300/90">
                Simulador táctico 2D · Pases, dorsales y porteros
              </p>
            </div>
          </div>
          <p className="text-sm leading-relaxed text-slate-300 max-w-md">
            Controla a tu equipo de puntitos numerados al estilo pizarra FIFA: muévete con precisión, triangula pases al toque, chuta a puerta y vence al portero rival. Sin árbitro ni interrupciones.
          </p>
        </div>

        {/* Match Setup Controls */}
        <div className="space-y-4 bg-[#0b1913]/90 border border-emerald-900/60 rounded-xl p-5">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300">Formato del partido</label>
            <div className="grid grid-cols-3 gap-1.5 bg-[#06100c] p-1 rounded-lg">
              {formats.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => onChangeConfig({ ...config, format: f.id })}
                  className={`py-2 px-3 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    config.format === f.id
                      ? 'bg-emerald-500 text-slate-950'
                      : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">Dificultad rival</label>
              <div className="grid grid-cols-3 gap-1 bg-[#06100c] p-1 rounded-lg">
                {difficulties.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => onChangeConfig({ ...config, difficulty: d.id })}
                    className={`py-2 px-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      config.difficulty === d.id
                        ? 'bg-slate-100 text-slate-950'
                        : 'text-slate-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">Duración</label>
              <div className="grid grid-cols-3 gap-1 bg-[#06100c] p-1 rounded-lg">
                {durations.map((dur) => (
                  <button
                    key={dur.sec}
                    type="button"
                    onClick={() => onChangeConfig({ ...config, durationSec: dur.sec })}
                    className={`py-2 px-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer tabular-nums ${
                      config.durationSec === dur.sec
                        ? 'bg-slate-100 text-slate-950'
                        : 'text-slate-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {dur.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onStartMatch}
            className="px-7 py-3.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-slate-950 font-bold text-base transition-all whitespace-nowrap shrink-0 cursor-pointer shadow-lg shadow-emerald-950/50"
          >
            Jugar Partido
          </button>
          <button
            type="button"
            onClick={onStartTraining}
            className="flex items-center gap-2 px-5 py-3.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/60 text-sky-300 font-semibold text-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Target className="w-4 h-4" />
            <span>Entrenar</span>
          </button>
          <button
            type="button"
            onClick={onWatchDemo}
            className="flex items-center gap-2 px-5 py-3.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-emerald-700/70 text-emerald-300 font-semibold text-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Eye className="w-4 h-4" />
            <span>Ver partido</span>
          </button>
          <button
            type="button"
            onClick={onOpenTutorial}
            className="flex items-center gap-2 px-5 py-3.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-slate-100 font-semibold text-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <BookOpen className="w-4 h-4 text-emerald-400" />
            <span>Tutorial</span>
          </button>
        </div>
      </div>

      {/* Single flat control-hint line */}
      <div className="pt-4 text-xs font-medium text-slate-300/90">
        <span>Flechas Mover</span>
        <span className="mx-2 text-slate-500" aria-hidden="true">·</span>
        <span>Z Pasar</span>
        <span className="mx-2 text-slate-500" aria-hidden="true">·</span>
        <span>X Chutar / Entrada Normal</span>
        <span className="mx-2 text-slate-500" aria-hidden="true">·</span>
        <span>WASD+X / Espacio+X Tiros Especiales</span>
        <span className="mx-2 text-slate-500" aria-hidden="true">·</span>
        <span>V Entrada Agresiva</span>
        <span className="mx-2 text-slate-500" aria-hidden="true">·</span>
        <span>C Cambiar</span>
        <span className="mx-2 text-slate-500" aria-hidden="true">·</span>
        <span>Shift Sprint</span>
      </div>
    </div>
  );
}

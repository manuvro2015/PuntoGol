import type { HudSnapshot } from '../game/types';

interface MatchOverModalProps {
  hud: HudSnapshot;
  onPlayAgain: () => void;
  onOpenTutorial: () => void;
  onBackToMenu: () => void;
}

export function MatchOverModal({
  hud,
  onPlayAgain,
  onOpenTutorial,
  onBackToMenu,
}: MatchOverModalProps) {
  const isWin = hud.homeScore > hud.awayScore;
  const isDraw = hud.homeScore === hud.awayScore;
  const headline = isWin ? '¡Victoria Local!' : isDraw ? 'Empate Final' : 'Victoria Visitante';

  const statRows = [
    { label: 'Tiros', home: hud.homeShots, away: hud.awayShots },
    { label: 'Pases completados', home: hud.homePasses, away: hud.awayPasses },
    { label: 'Paradas del portero', home: hud.homeSaves, away: hud.awaySaves },
    { label: 'Posesión', home: `${hud.possessionHomePct}%`, away: `${100 - hud.possessionHomePct}%` },
  ];

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/80 p-4">
      <div className="w-full max-w-md rounded-xl bg-slate-900 border border-slate-700 p-6 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <p className="text-xs font-semibold text-emerald-400">Final del Partido</p>
          <h2 className="font-[family-name:var(--font-display)] text-4xl font-extrabold text-white">
            {headline}
          </h2>
          <div className="mt-3 inline-flex items-center gap-4 bg-slate-950 border border-slate-800 rounded-lg px-5 py-2.5">
            <span className="font-[family-name:var(--font-display)] text-base font-bold text-blue-400">
              LOCAL
            </span>
            <span className="font-[family-name:var(--font-mono)] text-3xl font-bold text-white tabular-nums">
              {hud.homeScore} — {hud.awayScore}
            </span>
            <span className="font-[family-name:var(--font-display)] text-base font-bold text-red-400">
              RIVAL
            </span>
          </div>
        </div>

        {/* Clean Match Stats */}
        <div className="divide-y divide-slate-800 border-y border-slate-800">
          {statRows.map((row) => (
            <div key={row.label} className="grid grid-cols-3 items-center py-2.5 text-sm">
              <span className="font-[family-name:var(--font-mono)] font-bold text-blue-400 tabular-nums">
                {row.home}
              </span>
              <span className="text-center text-xs font-medium text-slate-300">{row.label}</span>
              <span className="text-right font-[family-name:var(--font-mono)] font-bold text-red-400 tabular-nums">
                {row.away}
              </span>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onPlayAgain}
            className="w-full py-3 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-colors cursor-pointer"
          >
            Jugar de Nuevo
          </button>
          <button
            type="button"
            onClick={onOpenTutorial}
            className="w-full py-2.5 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-sm transition-colors cursor-pointer"
          >
            Ver Tutorial y Combos
          </button>
          <button
            type="button"
            onClick={onBackToMenu}
            className="w-full py-2.5 px-4 rounded-lg bg-transparent hover:bg-slate-800 border border-slate-700 text-slate-300 font-semibold text-sm transition-colors cursor-pointer"
          >
            Menú Principal
          </button>
        </div>
      </div>
    </div>
  );
}

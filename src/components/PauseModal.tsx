interface PauseModalProps {
  isTrainingMode?: boolean;
  onResume: () => void;
  onRestart: () => void;
  onOpenTutorial: () => void;
  onQuitToMenu: () => void;
}

export function PauseModal({
  isTrainingMode = false,
  onResume,
  onRestart,
  onOpenTutorial,
  onQuitToMenu,
}: PauseModalProps) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/75 p-4">
      <div className="w-full max-w-sm rounded-xl bg-slate-900 border border-slate-700 p-6 shadow-2xl space-y-5">
        <div className="space-y-1 text-center">
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-bold text-white tracking-tight">
            {isTrainingMode ? 'Entrenamiento en Pausa' : 'Partido en Pausa'}
          </h2>
          <p className="text-xs text-slate-400">Pulsa Esc o Reanudar para volver al césped</p>
        </div>

        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onResume}
            className="w-full py-2.5 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-colors cursor-pointer"
          >
            {isTrainingMode ? 'Seguir Entrenando' : 'Reanudar Partido'}
          </button>
          <button
            type="button"
            onClick={onOpenTutorial}
            className="w-full py-2.5 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-sm transition-colors cursor-pointer"
          >
            Tutorial y Controles
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="w-full py-2.5 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-sm transition-colors cursor-pointer"
          >
            {isTrainingMode ? 'Reiniciar Entrenamiento' : 'Reiniciar Partido'}
          </button>
          <button
            type="button"
            onClick={onQuitToMenu}
            className="w-full py-2.5 px-4 rounded-lg bg-transparent hover:bg-slate-800 border border-slate-700 text-slate-300 font-semibold text-sm transition-colors cursor-pointer"
          >
            Salir al Menú
          </button>
        </div>
      </div>
    </div>
  );
}

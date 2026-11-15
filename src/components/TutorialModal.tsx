import { BookOpen, Flame, Shield, Sparkles, Trophy, X } from 'lucide-react';
import { useState } from 'react';

interface TutorialModalProps {
  open: boolean;
  onClose: () => void;
}

type TutorialTab = 'controles' | 'combos' | 'defensa' | 'reglas';

function KeyCap({ children, tone = 'slate' }: { children: string; tone?: 'slate' | 'emerald' | 'blue' | 'orange' | 'purple' | 'sky' }) {
  const toneClasses: Record<typeof tone, string> = {
    slate: 'bg-slate-800 border-slate-600 text-slate-100',
    emerald: 'bg-emerald-950/90 border-emerald-500/60 text-emerald-300',
    blue: 'bg-blue-950/90 border-blue-500/60 text-blue-300',
    orange: 'bg-orange-950/90 border-orange-500/60 text-orange-300',
    purple: 'bg-purple-950/90 border-purple-500/60 text-purple-300',
    sky: 'bg-sky-950/90 border-sky-500/60 text-sky-300',
  };

  return (
    <kbd
      className={`inline-flex items-center justify-center min-w-[26px] px-2 py-0.5 rounded-md border font-[family-name:var(--font-mono)] text-xs font-bold shadow-sm ${toneClasses[tone]}`}
    >
      {children}
    </kbd>
  );
}

export function TutorialModal({ open, onClose }: TutorialModalProps) {
  const [tab, setTab] = useState<TutorialTab>('controles');

  if (!open) return null;

  const tabs: { id: TutorialTab; label: string; icon: typeof BookOpen }[] = [
    { id: 'controles', label: 'Controles', icon: BookOpen },
    { id: 'combos', label: 'Combos y Tiros', icon: Flame },
    { id: 'defensa', label: 'Defensa y Entradas', icon: Shield },
    { id: 'reglas', label: 'Saques y Niveles', icon: Trophy },
  ];

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/80 p-3 sm:p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30">
              <BookOpen className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h2 className="font-[family-name:var(--font-display)] text-xl font-bold text-white leading-tight">
                Tutorial de PuntoGol
              </h2>
              <p className="text-xs text-slate-400">
                Aprende todos los controles, combos de fuego azul, entradas y reglas
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar tutorial"
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-3 bg-slate-950/40 border-b border-slate-800">
          {tabs.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-sm text-slate-200">
          {tab === 'controles' && (
            <div className="space-y-4">
              <div className="rounded-lg bg-slate-950/70 border border-slate-800 p-4 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  Movimiento y Pases
                </h3>
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-white">Mover al jugador</p>
                      <p className="text-xs text-slate-400">
                        Solo las flechas mueven al jugador. Así nunca se mezclan con los combos de WASD.
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <KeyCap>←</KeyCap>
                      <KeyCap>↑</KeyCap>
                      <KeyCap>↓</KeyCap>
                      <KeyCap>→</KeyCap>
                    </div>
                  </div>

                  <div className="border-t border-slate-800/80 pt-2.5 flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-white">Sprint (correr rápido)</p>
                      <p className="text-xs text-slate-400">
                        Mantén pulsado mientras te mueves para ganar velocidad en carrera.
                      </p>
                    </div>
                    <KeyCap>Shift</KeyCap>
                  </div>

                  <div className="border-t border-slate-800/80 pt-2.5 flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-white">Pasar el balón</p>
                      <p className="text-xs text-slate-400">
                        Pasa al compañero marcado. Al dar el pase, pasarás a controlar automáticamente al receptor.
                      </p>
                    </div>
                    <KeyCap tone="blue">Z</KeyCap>
                  </div>

                  <div className="border-t border-slate-800/80 pt-2.5 flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-white">Cambiar de jugador (sin balón)</p>
                      <p className="text-xs text-slate-400">
                        Cambia al compañero más cercano al balón. Cuando tienes la posesión no puedes cambiar manualmente.
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <KeyCap>C</KeyCap>
                      <span className="text-xs text-slate-500">o</span>
                      <KeyCap>Z</KeyCap>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-emerald-950/30 border border-emerald-800/50 p-3.5 text-xs text-emerald-200 leading-relaxed">
                <strong className="text-emerald-300">Tip de comodidad:</strong> Si juegas en móvil o prefieres botones en pantalla, pulsa el icono de mando arriba a la derecha durante el partido. También puedes pausar en cualquier momento con <KeyCap>Esc</KeyCap>.
              </div>
            </div>
          )}

          {tab === 'combos' && (
            <div className="space-y-4">
              <div className="rounded-lg bg-blue-950/30 border border-blue-700/50 p-3.5 flex items-start gap-2.5 text-xs text-blue-100 leading-relaxed">
                <Sparkles className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-blue-200">Cómo funcionan los Tiros Especiales (Fuego Azul)</p>
                  <p className="mt-1 text-slate-300">
                    Todos los combos se hacen pulsando <strong className="text-white">W A S D</strong> o <strong className="text-white">Espacio</strong> y terminando siempre con <KeyCap tone="emerald">X</KeyCap>. Hazlo rápido para sacar más potencia: los rivales te dan un respiro breve durante la secuencia, tu jugador se rodeará de <strong className="text-sky-300">fuego azul</strong> y soltará el disparo.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-lg bg-slate-950/70 border border-slate-800 p-3.5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-white text-sm">Tiro Normal</span>
                    <KeyCap tone="emerald">X</KeyCap>
                  </div>
                  <p className="text-xs text-slate-400">
                    Pulsa y suelta (o mantén un instante para cargar más fuerza) en la dirección que apuntas.
                  </p>
                </div>

                <div className="rounded-lg bg-slate-950/70 border border-orange-800/60 p-3.5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-orange-300 text-sm">¡Cañonazo!</span>
                    <div className="flex items-center gap-1">
                      <KeyCap tone="orange">W</KeyCap>
                      <KeyCap tone="orange">A</KeyCap>
                      <KeyCap tone="orange">D</KeyCap>
                      <KeyCap tone="emerald">X</KeyCap>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400">
                    Disparo brutal de máxima velocidad. Muy difícil de detener si entras frontal al área.
                  </p>
                </div>

                <div className="rounded-lg bg-slate-950/70 border border-sky-800/60 p-3.5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-sky-300 text-sm">¡Vaselina!</span>
                    <div className="flex items-center gap-1">
                      <KeyCap tone="sky">S</KeyCap>
                      <KeyCap tone="sky">W</KeyCap>
                      <KeyCap tone="emerald">X</KeyCap>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400">
                    Eleva el balón por encima de defensas y del portero cuando salga a achicar espacio.
                  </p>
                </div>

                <div className="rounded-lg bg-slate-950/70 border border-purple-800/60 p-3.5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-purple-300 text-sm">¡Latigazo!</span>
                    <div className="flex items-center gap-1">
                      <KeyCap tone="purple">A</KeyCap>
                      <KeyCap tone="purple">D</KeyCap>
                      <KeyCap tone="emerald">X</KeyCap>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400">
                    También funciona <KeyCap tone="purple">D</KeyCap> <KeyCap tone="purple">A</KeyCap> <KeyCap tone="emerald">X</KeyCap>. Efecto zig-zag impredecible que engaña al portero.
                  </p>
                </div>

                <div className="sm:col-span-2 rounded-lg bg-slate-950/70 border border-emerald-800/60 p-3.5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-emerald-300 text-sm">¡Tiro con Rosca!</span>
                    <div className="flex items-center gap-1">
                      <KeyCap tone="emerald">Espacio</KeyCap>
                      <span className="text-slate-500 text-xs">+</span>
                      <KeyCap tone="emerald">X</KeyCap>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400">
                    Pulsa Espacio y X a la vez para colocar el balón con efecto curvado hacia la escuadra.
                  </p>
                </div>
              </div>
            </div>
          )}

          {tab === 'defensa' && (
            <div className="space-y-4">
              <div className="rounded-lg bg-slate-950/70 border border-slate-800 p-4 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  Dos tipos de entrada (cuando no tienes el balón)
                </h3>

                <div className="flex items-start justify-between gap-4 pb-3 border-b border-slate-800">
                  <div>
                    <p className="font-semibold text-white">Entrada Normal</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Entrada limpia y equilibrada hacia el balón. Buen alcance sin perder tanta posición si fallas.
                    </p>
                  </div>
                  <KeyCap tone="emerald">X</KeyCap>
                </div>

                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-orange-300">Entrada Agresiva (con riesgo de lesión)</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Lanzamiento rápido y de mayor alcance para cortar ataques peligrosos. Al impactar contra un rival CPU tiene aproximadamente un <strong className="text-orange-200">25% de probabilidad de lesionarlo</strong> y dejarlo inmóvil durante unos segundos (el portero es inmune).
                    </p>
                  </div>
                  <KeyCap tone="orange">V</KeyCap>
                </div>
              </div>

              <div className="rounded-lg bg-slate-950/70 border border-slate-800 p-4 space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Consejo defensivo
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Si el balón está lejos, pulsa <KeyCap>C</KeyCap> para cambiar al compañero más cercano a la jugada y usa <KeyCap tone="emerald">X</KeyCap> para interceptar pases o <KeyCap tone="orange">V</KeyCap> para frenar un contraataque.
                </p>
              </div>
            </div>
          )}

          {tab === 'reglas' && (
            <div className="space-y-4">
              <div className="rounded-lg bg-slate-950/70 border border-slate-800 p-4 space-y-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  Saques reales sin árbitro
                </h3>
                <ul className="space-y-2 text-xs text-slate-300 leading-relaxed">
                  <li>
                    <strong className="text-white">Saque de banda:</strong> Si el balón cruza la línea superior o inferior, saca el equipo contrario al último que lo tocó.
                  </li>
                  <li>
                    <strong className="text-white">Córner:</strong> Si sale por la línea de fondo tras tocar a un defensor o portero rival.
                  </li>
                  <li>
                    <strong className="text-white">Saque de puerta:</strong> Si sale por la línea de fondo tras tocar a un atacante; el portero reinicia desde su área.
                  </li>
                  <li className="text-slate-400">
                    Cuando te toque sacar, pulsa <KeyCap tone="blue">Z</KeyCap> o <KeyCap tone="emerald">X</KeyCap> (o muévete con las flechas) para poner el balón en juego.
                  </li>
                </ul>
              </div>

              <div className="rounded-lg bg-slate-950/70 border border-slate-800 p-4 space-y-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  Niveles de dificultad y Porteros
                </h3>
                <ul className="space-y-2 text-xs text-slate-300 leading-relaxed">
                  <li>
                    <strong className="text-emerald-300">Fácil:</strong> Ritmo lento y cómodo, rivales con menos presión, portero más accesible y casi sin tiros especiales.
                  </li>
                  <li>
                    <strong className="text-white">Normal:</strong> Fútbol táctico equilibrado, porteros competitivos y algún tiro especial ocasional.
                  </li>
                  <li>
                    <strong className="text-rose-300">Difícil:</strong> Rivales rápidos, presión intensa, porteros de alto nivel y CPUs capaces de ejecutar combos especiales igual que tú.
                  </li>
                </ul>
              </div>

              <div className="rounded-lg bg-sky-950/30 border border-sky-800/50 p-3.5 text-xs text-sky-200 leading-relaxed">
                <strong className="text-sky-300">Modo Entrenamiento:</strong> Pulsa <strong>Entrenar</strong> en el menú para practicar solo contra el portero rival. Desde la barra superior puedes añadir o quitar hasta 4 compañeros y 4 defensas en directo, cambiar el nivel del portero y pulsar <KeyCap>R</KeyCap> para reiniciar el balón al instante.
              </div>

              <div className="rounded-lg bg-emerald-950/30 border border-emerald-800/50 p-3.5 text-xs text-emerald-200 leading-relaxed">
                <strong className="text-emerald-300">Modo Espectador:</strong> En el menú inicial puedes elegir el formato (5v5, 7v7 u 11v11) y dificultad, y pulsar <strong>Ver partido</strong> para observar cómo juega la máquina. Pulsa <strong>Volver al menú</strong> o <KeyCap>Esc</KeyCap> cuando quieras regresar.
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-3.5 border-t border-slate-800 bg-slate-950/70">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-colors cursor-pointer"
          >
            ¡Entendido!
          </button>
        </div>
      </div>
    </div>
  );
}

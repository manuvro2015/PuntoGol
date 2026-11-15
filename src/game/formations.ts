import type { MatchFormat, PlayerRole } from './types';

export interface FormationSlot {
  number: number;
  role: PlayerRole;
  /** Normalized X on home half (0 = own goal line, 0.5 = halfway line, 1 = opponent goal line) */
  nx: number;
  /** Normalized Y (0 = top touchline, 0.5 = center, 1 = bottom touchline) */
  ny: number;
}

export const FORMATIONS: Record<MatchFormat, FormationSlot[]> = {
  '5v5': [
    { number: 1, role: 'GK', nx: 0.045, ny: 0.5 },
    { number: 4, role: 'DF', nx: 0.2, ny: 0.3 },
    { number: 5, role: 'DF', nx: 0.2, ny: 0.7 },
    { number: 8, role: 'MF', nx: 0.35, ny: 0.5 },
    { number: 9, role: 'FW', nx: 0.455, ny: 0.5 },
  ],
  '7v7': [
    { number: 1, role: 'GK', nx: 0.04, ny: 0.5 },
    { number: 2, role: 'DF', nx: 0.18, ny: 0.27 },
    { number: 4, role: 'DF', nx: 0.18, ny: 0.73 },
    { number: 6, role: 'MF', nx: 0.31, ny: 0.5 },
    { number: 8, role: 'MF', nx: 0.36, ny: 0.22 },
    { number: 10, role: 'MF', nx: 0.36, ny: 0.78 },
    { number: 9, role: 'FW', nx: 0.46, ny: 0.5 },
  ],
  '11v11': [
    { number: 1, role: 'GK', nx: 0.035, ny: 0.5 },
    { number: 2, role: 'DF', nx: 0.15, ny: 0.16 },
    { number: 4, role: 'DF', nx: 0.14, ny: 0.39 },
    { number: 5, role: 'DF', nx: 0.14, ny: 0.61 },
    { number: 3, role: 'DF', nx: 0.15, ny: 0.84 },
    { number: 6, role: 'MF', nx: 0.28, ny: 0.5 },
    { number: 8, role: 'MF', nx: 0.33, ny: 0.3 },
    { number: 10, role: 'MF', nx: 0.33, ny: 0.7 },
    { number: 7, role: 'FW', nx: 0.44, ny: 0.2 },
    { number: 9, role: 'FW', nx: 0.465, ny: 0.5 },
    { number: 11, role: 'FW', nx: 0.44, ny: 0.8 },
  ],
};

export function getPlayerRadius(format: MatchFormat): number {
  if (format === '5v5') return 17;
  if (format === '7v7') return 15;
  return 13;
}

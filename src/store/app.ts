import { create } from 'zustand';
import type { Dominance, Level } from '../data/types';

export type Mode = 'explore' | 'ecg' | 'arrhythmia' | 'coronary' | 'hemo' | 'equations' | 'cases';
export type Theme = 'system' | 'light' | 'dark';

interface AppState {
  mode: Mode;
  level: Level;
  teach: boolean;
  theme: Theme;
  dominance: Dominance;
  /** Selections shared between modes (e.g. "open in ECG lab"). */
  conditionId: string;
  stageId: string | null;
  rhythmId: string;
  presetId: string;
  setMode: (m: Mode) => void;
  setLevel: (l: Level) => void;
  setTeach: (t: boolean) => void;
  setTheme: (t: Theme) => void;
  setDominance: (d: Dominance) => void;
  openCondition: (id: string, stage?: string | null) => void;
  openRhythm: (id: string) => void;
  openPreset: (id: string) => void;
}

const MODES: Mode[] = ['explore', 'ecg', 'arrhythmia', 'coronary', 'hemo', 'equations', 'cases'];

function readHash(): Partial<AppState> {
  try {
    const h = window.location.hash.replace(/^#\/?/, '');
    const [mode] = h.split('/');
    if (MODES.includes(mode as Mode)) return { mode: mode as Mode };
  } catch {
    /* ignore */
  }
  return {};
}

function readPref<T>(key: string, fallback: T): T {
  try {
    const v = window.localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
export function writePref(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable (private mode) – ignore */
  }
}

export const useApp = create<AppState>((set) => ({
  mode: 'explore',
  level: readPref<Level>('cardiosim.level', 'student'),
  teach: false,
  theme: readPref<Theme>('cardiosim.theme', 'system'),
  dominance: 'right',
  conditionId: 'normal',
  stageId: null,
  rhythmId: 'sinus',
  presetId: 'normal-hemo',
  ...readHash(),
  setMode: (mode) => {
    try { window.location.hash = `/${mode}`; } catch { /* ignore */ }
    set({ mode });
  },
  setLevel: (level) => { writePref('cardiosim.level', level); set({ level }); },
  setTeach: (teach) => set({ teach }),
  setTheme: (theme) => { writePref('cardiosim.theme', theme); set({ theme }); },
  setDominance: (dominance) => set({ dominance }),
  openCondition: (conditionId, stageId = null) => { try { window.location.hash = '/ecg'; } catch { /* */ } set({ conditionId, stageId, mode: 'ecg' }); },
  openRhythm: (rhythmId) => { try { window.location.hash = '/arrhythmia'; } catch { /* */ } set({ rhythmId, mode: 'arrhythmia' }); },
  openPreset: (presetId) => { try { window.location.hash = '/hemo'; } catch { /* */ } set({ presetId, mode: 'hemo' }); },
}));

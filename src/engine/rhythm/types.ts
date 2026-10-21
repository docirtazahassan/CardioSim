import type { VentricularPattern } from '../electrical/activation';

/** Where an atrial depolarisation starts – determines P-wave axis/morphology. */
export type AtrialOrigin =
  | { kind: 'sinus' }
  | { kind: 'ectopic'; axisDeg: number; horizontalDeg?: number; id: string }
  | { kind: 'retrograde' }
  /** Flutter / fibrillation impulses: no discrete P wave (continuous atrial activity instead). */
  | { kind: 'flutter' }
  | { kind: 'fibrillation' };

export interface AtrialEvent {
  t: number; // onset of atrial depolarisation (ms)
  origin: AtrialOrigin;
  /** Whether the impulse reached the ventricles. */
  conducted: boolean;
  /** Mechanical contraction occurs (false in AF/standstill). */
  mechanical: boolean;
}

export type VentricularSource = 'conducted' | 'junctional' | 'ventricular' | 'reentry' | 'escape' | 'preexcited' | 'fusion';

export interface VentricularEvent {
  t: number; // QRS onset (ms)
  pattern: VentricularPattern;
  source: VentricularSource;
  /** Preceding RR interval (ms), used for rate-dependent QT. */
  rr: number;
  /** Amplitude scale and rotation for polymorphic rhythms. */
  scale?: number;
  rotateDeg?: number;
  /** Mechanical effectiveness 0..1 (0 = PEA). */
  mechanical: number;
  /** Related atrial event index (for PR), if conducted. */
  fromAtrial?: number;
}

export interface LadderEntry {
  /** Atrial activation time (ms). */
  a?: number;
  /** Time impulse enters / leaves the AV junction. */
  avIn?: number;
  avOut?: number;
  /** Ventricular activation time. */
  v?: number;
  blocked?: 'av' | 'his';
  retrograde?: boolean;
  pathway?: 'slow' | 'fast' | 'accessory' | 'av';
  label?: string;
}

export interface ContinuousActivity {
  kind: 'flutter' | 'fibrillation' | 'vf' | 'torsades';
  start: number;
  end: number;
  rate: number; // per minute
  seed: number;
}

export interface RhythmOutput {
  duration: number;
  atrial: AtrialEvent[];
  ventricular: VentricularEvent[];
  continuous: ContinuousActivity[];
  ladder: LadderEntry[];
  notes: string[];
  /** Rhythm-level ECG effects (e.g. PR change). */
  meanPrMs?: number;
}

/**
 * High-level ECG API: condition model → resolved physiology → rhythm → synthesised leads.
 */
import type { Dominance, EcgModel, LeadId } from '../../data/types';
import type { V3 } from '../math';
import { resolveEcgModel, type ResolvedEcg } from './model';
import { synthesize, type EcgOutput } from './synth';
import { measureBeat, representativeBeat, type BeatMeasure } from './measure';
import { rhythmForEcg } from '../rhythm/engine';

export interface GenerateOptions {
  durationMs?: number;
  leads?: LeadId[];
  dominance?: Dominance;
  electrodes?: Partial<Record<string, V3>>;
  seed?: number;
  /** Override the rhythm id from the model. */
  rhythm?: string;
  heartRate?: number;
}

export interface GeneratedEcg {
  resolved: ResolvedEcg;
  ecg: EcgOutput;
  measure: BeatMeasure | null;
  beatIndex: number;
}

export function generateEcg(model: EcgModel = {}, opts: GenerateOptions = {}): GeneratedEcg {
  const resolved = resolveEcgModel(model, opts.dominance ?? 'right');
  if (opts.heartRate) resolved.hr = opts.heartRate;
  const rhythmId = opts.rhythm ?? resolved.rhythm;
  const rhythm = rhythmForEcg(rhythmId, resolved, opts.durationMs ?? 10000, opts.seed ?? 1);
  const ecg = synthesize(resolved, rhythm, { leads: opts.leads, electrodes: opts.electrodes });
  const beatIndex = ecg.beats.length ? representativeBeat(ecg) : -1;
  const measure = beatIndex >= 0 ? measureBeat(ecg, beatIndex) : null;
  return { resolved, ecg, measure, beatIndex };
}

export { resolveEcgModel, synthesize, measureBeat };

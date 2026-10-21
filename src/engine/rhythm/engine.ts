import type { ResolvedEcg } from '../electrical/model';
import type { RhythmOutput } from './types';
import { sinusRhythm } from './sinus';

/** Temporary: sinus-only rhythm provider (replaced by the full conduction-system engine). */
export function rhythmForEcg(id: string, R: ResolvedEcg, durationMs: number, _seed: number): RhythmOutput {
  const pr = 160 + R.mods.prDeltaMs;
  if (id === 'wpw-sinus' || R.accessoryPathway) {
    return sinusRhythm(R.hr, durationMs, 108, { kind: 'preexcited', pathway: R.accessoryPathway ?? 'left-lateral', leadMs: 48 });
  }
  return sinusRhythm(R.hr, durationMs, pr);
}

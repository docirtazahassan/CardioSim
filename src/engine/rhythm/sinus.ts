import type { VentricularPattern } from '../electrical/activation';
import type { RhythmOutput } from './types';

/** Regular sinus rhythm with fixed PR – used for the condition library and as a building block. */
export function sinusRhythm(hr: number, durationMs: number, prMs = 160, pattern: VentricularPattern = { kind: 'normal' }, startMs = 300): RhythmOutput {
  const rr = 60000 / hr;
  const out: RhythmOutput = { duration: durationMs, atrial: [], ventricular: [], continuous: [], ladder: [], notes: [] };
  for (let t = startMs; t + prMs < durationMs - 50; t += rr) {
    const ai = out.atrial.length;
    out.atrial.push({ t, origin: { kind: 'sinus' }, conducted: true, mechanical: true });
    out.ventricular.push({ t: t + prMs, pattern, source: 'conducted', rr, mechanical: 1, fromAtrial: ai });
    out.ladder.push({ a: t, avIn: t + 40, avOut: t + prMs - 45, v: t + prMs, pathway: 'av' });
  }
  out.meanPrMs = prMs;
  return out;
}

/**
 * Standard ECG criteria computed from measurements (mV, ms).
 * 1 mm = 0.1 mV at standard calibration.
 */
import type { BeatMeasure } from './measure';

export function sokolowLyon(m: BeatMeasure) {
  const s = m.leads.V1?.s ?? 0;
  const r = Math.max(m.leads.V5?.r ?? 0, m.leads.V6?.r ?? 0);
  return { value: s + r, positive: s + r >= 3.5 };
}

export function cornell(m: BeatMeasure, sex: 'male' | 'female' = 'male') {
  const v = (m.leads.aVL?.r ?? 0) + (m.leads.V3?.s ?? 0);
  return { value: v, positive: v > (sex === 'male' ? 2.8 : 2.0) };
}

/** Sgarbossa (original) score for acute MI in LBBB, plus the Smith-modified ST/S ratio. */
export function sgarbossa(m: BeatMeasure) {
  let score = 0;
  const reasons: string[] = [];
  const leadNames = Object.keys(m.leads);
  for (const l of leadNames) {
    const x = m.leads[l];
    if (l.endsWith('R') && l !== 'aVR') continue; // ignore right-sided leads
    if (['V7', 'V8', 'V9'].includes(l)) continue;
    const qrsPositive = x.qrsNet > 0;
    if (qrsPositive && x.stJ >= 0.1) {
      score = Math.max(score, 5);
      reasons.push(`Concordant ST elevation ≥ 1 mm in ${l} (QRS positive)`);
    }
  }
  for (const l of ['V1', 'V2', 'V3']) {
    const x = m.leads[l];
    if (x && x.stJ <= -0.1) {
      score += reasons.some((r) => r.startsWith('Concordant ST depression')) ? 0 : 3;
      reasons.push(`Concordant ST depression ≥ 1 mm in ${l}`);
    }
  }
  let smith = 0;
  for (const l of leadNames) {
    const x = m.leads[l];
    if (x.qrsNet < 0 && x.stJ >= 0.5) {
      score += reasons.some((r) => r.startsWith('Excessively')) ? 0 : 2;
      reasons.push(`Excessively discordant ST elevation ≥ 5 mm in ${l}`);
    }
    if (x.qrsNet < 0 && x.s + x.q > 0.3 && x.stJ > 0) {
      const ratio = x.stJ / -(Math.min(x.qrsMin, 0));
      smith = Math.max(smith, ratio);
    }
  }
  return { score, reasons, smithRatio: smith, smithPositive: smith >= 0.25, positive: score >= 3 || smith >= 0.25 };
}

/** Low voltage: QRS peak-to-peak < 5 mm in all limb leads. */
export function lowVoltageLimb(m: BeatMeasure) {
  return ['I', 'II', 'III', 'aVR', 'aVL', 'aVF'].every((l) => (m.leads[l]?.qrsPeakToPeak ?? 1) < 0.5);
}

export function axisCategory(axis: number): 'normal' | 'left' | 'right' | 'extreme' {
  if (axis >= -30 && axis <= 90) return 'normal';
  if (axis < -30 && axis >= -90) return 'left';
  if (axis > 90 && axis <= 180) return 'right';
  return 'extreme';
}

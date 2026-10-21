/**
 * Phenomenological action-potential models with named ionic currents.
 *
 * These are teaching models (not full Hodgkin–Huxley/Luo–Rudy): each phase is shaped by the
 * conductance scale factors of the current that dominates it, so a drug or electrolyte that
 * changes a current visibly changes the matching phase – and, through modifiers.ts, the ECG.
 *
 *  Ventricular myocyte: phase 0 INa, phase 1 Ito, phase 2 ICa-L vs IKs, phase 3 IKr + IK1,
 *  phase 4 IK1 (resting potential ≈ EK).
 *  Pacemaker (SA node): phase 4 If + ICa-T (diastolic depolarisation), phase 0 ICa-L,
 *  phase 3 IK. ACh/adenosine open IK-ACh (hyperpolarise, flatten phase 4).
 */
import { clamp } from '../math';
import { ecgModifiersFrom, ionicStateFrom, type ModifierInput } from './modifiers';

export interface ApTrace {
  dt: number; // ms per sample
  t: Float32Array;
  vm: Float32Array;
  currents: Record<string, Float32Array>;
  /** Summary values. */
  rest: number; // mV (ventricular) or maximum diastolic potential (pacemaker)
  vmax: number; // max upstroke velocity (V/s)
  apd90: number; // ms
  peak: number; // mV
  rate?: number; // pacemaker firing rate (bpm)
  ead: boolean;
  phases: Array<{ phase: string; start: number; end: number }>;
}

const sig = (x: number) => 1 / (1 + Math.exp(-x));

export function ventricularAP(input: ModifierInput = {}, durationMs = 600): ApTrace {
  const s = ionicStateFrom(input);
  const m = ecgModifiersFrom(input);
  const dt = 0.5;
  const n = Math.round(durationMs / dt);
  const t = new Float32Array(n), vm = new Float32Array(n);
  const names = ['INa', 'Ito', 'ICaL', 'IKs', 'IKr', 'IK1'];
  const cur: Record<string, Float32Array> = Object.fromEntries(names.map((k) => [k, new Float32Array(n)]));

  const rest = -86 + s.restShift;
  const na = clamp(s.gNa * s.naAvailability, 0.03, 1.2);
  const vmax = 260 * na; // V/s
  const peak = rest + (115 * (0.55 + 0.45 * Math.min(1, na)));
  const upstroke = Math.max(1, (peak - rest) / vmax); // ms
  const notch = 14 * s.gTo;
  const plateau = 12 * (0.6 + 0.4 * s.gCaL) - 4 * (s.gKs - 1);
  const apd90 = clamp(270 + m.qtDeltaMs * 0.85, 120, 600);
  const repolDur = clamp(85 / Math.pow((s.gKr * 0.7 + s.gK1 * 0.3), 0.8), 30, 220);
  const plateauEnd = apd90 - repolDur * 0.75;
  const start = 20;
  const ead = s.eadRisk > 0.45;

  for (let i = 0; i < n; i++) {
    const ti = i * dt;
    t[i] = ti;
    const x = ti - start;
    let v: number;
    if (x < 0) v = rest;
    else if (x < upstroke) v = rest + (peak - rest) * (x / upstroke);
    else if (x < upstroke + 10) {
      // phase 1 (Ito notch)
      const y = (x - upstroke) / 10;
      v = peak - (peak - (plateau + 8)) * Math.min(1, y * 1.4) - notch * Math.sin(Math.PI * y) * 0.4;
    } else if (x < plateauEnd) {
      // phase 2 plateau (slowly declining)
      const y = (x - upstroke - 10) / Math.max(1, plateauEnd - upstroke - 10);
      v = plateau + 8 - 14 * Math.pow(y, 1.6);
    } else {
      // phase 3 – sigmoid repolarisation with slope set by IKr/IK1
      const y = (x - plateauEnd) / repolDur;
      const startV = plateau - 6;
      v = rest + (startV - rest) * (1 - sig((y - 0.55) * 7)) / (1 - sig(-0.55 * 7));
      v = Math.max(rest, Math.min(startV, v));
      if (ead && y > 0.2 && y < 0.8) v += 22 * s.eadRisk * Math.sin(Math.PI * (y - 0.2) / 0.6);
    }
    vm[i] = v;
  }
  // currents (normalised, outward positive), consistent with phase timing
  for (let i = 1; i < n; i++) {
    const x = t[i] - start;
    const v = vm[i];
    cur.INa[i] = x >= 0 && x < upstroke + 2 ? -100 * na * Math.sin(Math.PI * Math.min(1, x / (upstroke + 2))) : 0;
    cur.Ito[i] = x > upstroke && x < upstroke + 25 ? 6 * s.gTo * Math.sin(Math.PI * (x - upstroke) / 25) : 0;
    const inAP = x > upstroke && v > rest + 5;
    cur.ICaL[i] = inAP ? -4.5 * s.gCaL * Math.exp(-(x - upstroke) / (90 * s.plateauScale)) * sig((v + 20) / 6) : 0;
    cur.IKs[i] = inAP ? 1.6 * s.gKs * (1 - Math.exp(-(x - upstroke) / 120)) * sig((v + 10) / 8) : 0;
    const repolPhase = x > plateauEnd - 60;
    cur.IKr[i] = inAP && repolPhase ? 2.8 * s.gKr * sig((v + 30) / 6) * (1 - sig((v - 5) / 6) * 0.6) : 0;
    cur.IK1[i] = 2.2 * s.gK1 * Math.max(0, sig(-(v + 60) / 8)) * (v > rest + 0.5 ? 1 : 0.12);
  }
  return {
    dt, t, vm, currents: cur, rest, vmax, apd90, peak, ead,
    phases: [
      { phase: '0', start, end: start + upstroke },
      { phase: '1', start: start + upstroke, end: start + upstroke + 10 },
      { phase: '2', start: start + upstroke + 10, end: start + plateauEnd },
      { phase: '3', start: start + plateauEnd, end: start + apd90 + repolDur * 0.3 },
      { phase: '4', start: start + apd90 + repolDur * 0.3, end: durationMs },
    ],
  };
}

export function pacemakerAP(input: ModifierInput = {}, durationMs = 2500): ApTrace {
  const s = ionicStateFrom(input);
  const dt = 0.5;
  const n = Math.round(durationMs / dt);
  const t = new Float32Array(n), vm = new Float32Array(n);
  const names = ['If', 'ICaT', 'ICaL', 'IK', 'IKACh'];
  const cur: Record<string, Float32Array> = Object.fromEntries(names.map((k) => [k, new Float32Array(n)]));

  // Maximum diastolic potential: more negative with vagal/adenosine K⁺ channels (IK-ACh) and low K⁺
  const mdp = -62 - 10 * s.nodalBrake - 6 * s.gKAdo + s.restShift * 0.4;
  const threshold = -42 + (1 - s.gCaL) * 6;
  // phase 4 slope (mV/ms): If and ICa-T, ↑ by sympathetic tone, ↓ by vagal tone/β-block/Ca-block
  const slope = Math.max(0.012, 0.042 * s.gf * s.sympathetic * (1 - 0.55 * s.nodalBrake) * (0.75 + 0.25 * s.gCaT));
  const upV = clamp(9 * s.gCaL, 2, 15); // V/s – slow Ca²⁺-dependent upstroke
  const peak = 8 * s.gCaL - 4;
  const apd = 150;
  let v = mdp;
  let phase: 4 | 0 | 3 = 4;
  let phaseStart = 0;
  let firings = 0;
  let firstFire = -1, lastFire = -1;
  for (let i = 0; i < n; i++) {
    const ti = i * dt;
    t[i] = ti;
    if (phase === 4) {
      // diastolic depolarisation accelerates slightly towards threshold (ICa-T joins If)
      const frac = clamp((v - mdp) / (threshold - mdp), 0, 1);
      v += dt * slope * (0.8 + 0.6 * frac);
      cur.If[i] = -1.2 * s.gf * s.sympathetic * (1 - frac * 0.7);
      cur.ICaT[i] = -0.8 * s.gCaT * frac * frac;
      cur.IKACh[i] = 0.6 * (s.nodalBrake + s.gKAdo);
      if (v >= threshold) { phase = 0; phaseStart = ti; firings++; if (firstFire < 0) firstFire = ti; lastFire = ti; }
    } else if (phase === 0) {
      v += dt * upV;
      cur.ICaL[i] = -3 * s.gCaL;
      if (v >= peak) { phase = 3; phaseStart = ti; }
    } else {
      const y = (ti - phaseStart) / apd;
      v = peak + (mdp - peak) * Math.min(1, Math.sin((Math.PI / 2) * Math.min(1, y)) ** 1.3);
      cur.IK[i] = 2.2 * Math.sin(Math.PI * Math.min(1, y));
      cur.ICaL[i] = -1.5 * s.gCaL * Math.max(0, 1 - y * 2);
      if (y >= 1) { phase = 4; phaseStart = ti; v = mdp; }
    }
    vm[i] = v;
  }
  const cycle = firings > 1 ? (lastFire - firstFire) / (firings - 1) : (threshold - mdp) / slope + 200;
  return {
    dt, t, vm, currents: cur, rest: mdp, vmax: upV, apd90: apd, peak, ead: false,
    rate: 60000 / cycle,
    phases: [{ phase: '4', start: 0, end: firstFire > 0 ? firstFire : durationMs }],
  };
}

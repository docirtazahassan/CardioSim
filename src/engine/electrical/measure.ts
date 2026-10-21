/**
 * Measurements on the synthesised ECG – what a reader would measure with calipers.
 * Amplitudes in mV, times in ms. Used by tests, the interpretation engine and the UI.
 */
import { deg, wrapDeg } from '../math';
import type { BeatInfo, EcgOutput } from './synth';

export interface Lobe {
  sign: 1 | -1;
  peak: number; // signed mV
  start: number; // ms
  end: number;
  peakAt: number;
  notched: boolean;
}

export interface LeadBeatMeasure {
  lead: string;
  baseline: number;
  lobes: Lobe[];
  morphology: string; // e.g. "qR", "rS", "rSR'", "QS"
  q: number; // depth of initial negative deflection (positive number, mV), 0 if none
  qDur: number;
  r: number; // tallest positive deflection (mV)
  s: number; // deepest negative deflection after the first R (positive number)
  rPrime: number;
  qrsNet: number; // net area (mV·ms)
  qrsMax: number; // max positive
  qrsMin: number; // min (negative) value
  qrsPeakToPeak: number;
  notchedR: boolean;
  stJ: number; // ST deviation at J+10 ms
  st40: number;
  st60: number;
  stSlope: number; // mV per 40 ms after J (upsloping > 0)
  t: number; // dominant T amplitude (signed)
  tMax: number;
  tMin: number;
  tBiphasic: 'pos-neg' | 'neg-pos' | null;
  tPeakAt: number;
  p: number; // dominant P amplitude (signed)
  pMax: number;
  pMin: number;
  pTerminalNegArea: number; // mV·ms of negative P in last half (V1 LAE)
  prSegment: number; // PR segment deviation from TP baseline
  u: number; // max deflection in U window
}

export interface BeatMeasure {
  beat: BeatInfo;
  pr: number | null;
  qrs: number;
  qt: number;
  rr: number | null;
  qtcBazett: number | null;
  qtcFridericia: number | null;
  axis: number; // frontal QRS axis (deg)
  pAxis: number | null;
  tAxis: number;
  horizontalAxis: number; // horizontal plane QRS axis (0 = left, +90 = anterior)
  timeTo50: number; // ms from QRS onset to 50% of peak spatial magnitude (slurred onset = delta wave)
  leads: Record<string, LeadBeatMeasure>;
}

const at = (x: Float32Array, t: number) => x[Math.max(0, Math.min(x.length - 1, Math.round(t)))] ?? 0;

function mean(x: Float32Array, a: number, b: number) {
  a = Math.max(0, Math.round(a));
  b = Math.min(x.length - 1, Math.round(b));
  if (b < a) return 0;
  let s = 0;
  for (let i = a; i <= b; i++) s += x[i];
  return s / (b - a + 1);
}

function findLobes(x: Float32Array, base: number, on: number, off: number): Lobe[] {
  const raw: Lobe[] = [];
  let cur: Lobe | null = null;
  const thr = 0.012;
  for (let t = Math.round(on); t <= Math.round(off); t++) {
    const v = at(x, t) - base;
    const sgn: 1 | -1 | 0 = v > thr ? 1 : v < -thr ? -1 : 0;
    if (sgn === 0) continue;
    if (!cur || cur.sign !== sgn) {
      if (cur) raw.push(cur);
      cur = { sign: sgn, peak: v, start: t, end: t, peakAt: t, notched: false };
    } else {
      cur.end = t;
      if (Math.abs(v) > Math.abs(cur.peak)) { cur.peak = v; cur.peakAt = t; }
    }
  }
  if (cur) raw.push(cur);
  const maxAbs = Math.max(0.0001, ...raw.map((l) => Math.abs(l.peak)));
  // discard tiny lobes then merge same-sign neighbours
  const kept = raw.filter((l) => Math.abs(l.peak) >= Math.max(0.035, 0.05 * maxAbs));
  const merged: Lobe[] = [];
  for (const l of kept) {
    const last = merged[merged.length - 1];
    if (last && last.sign === l.sign) {
      last.end = l.end;
      if (Math.abs(l.peak) > Math.abs(last.peak)) { last.peak = l.peak; last.peakAt = l.peakAt; }
      last.notched = true;
    } else merged.push({ ...l });
  }
  // notch detection inside lobes (local minimum with ≥0.05 mV dip between two maxima)
  for (const l of merged) {
    if (l.end - l.start < 20) continue;
    let peaks = 0;
    let lastMax = 0, lastMin = Infinity;
    let rising = true;
    for (let t = l.start; t <= l.end; t++) {
      const v = (at(x, t) - base) * l.sign;
      if (rising) {
        if (v > lastMax) lastMax = v;
        else if (lastMax - v > 0.05) { peaks++; rising = false; lastMin = v; }
      } else {
        if (v < lastMin) lastMin = v;
        else if (v - lastMin > 0.05) { rising = true; lastMax = v; }
      }
    }
    if (peaks >= 2 || (peaks >= 1 && rising && lastMax > lastMin + 0.05)) l.notched = true;
  }
  return merged;
}

function morphologyOf(lobes: Lobe[]): { m: string; q: number; qDur: number; r: number; s: number; rPrime: number } {
  let m = '';
  let q = 0, qDur = 0, r = 0, s = 0, rPrime = 0;
  let seenR = 0;
  const big = (v: number) => Math.abs(v) >= 0.5;
  if (lobes.length === 1 && lobes[0].sign < 0) {
    return { m: 'QS', q: -lobes[0].peak, qDur: lobes[0].end - lobes[0].start, r: 0, s: 0, rPrime: 0 };
  }
  for (const l of lobes) {
    if (l.sign < 0) {
      if (seenR === 0) {
        m += big(l.peak) ? 'Q' : 'q';
        q = -l.peak;
        qDur = l.end - l.start;
      } else {
        m += big(l.peak) ? 'S' : 's';
        s = Math.max(s, -l.peak);
      }
    } else {
      seenR++;
      if (seenR === 1) { m += big(l.peak) ? 'R' : 'r'; r = l.peak; }
      else { m += big(l.peak) ? "R'" : "r'"; rPrime = Math.max(rPrime, l.peak); }
    }
  }
  return { m, q, qDur, r, s, rPrime };
}

export function measureLeadBeat(lead: string, x: Float32Array, beat: BeatInfo, prevBeat: BeatInfo | undefined): LeadBeatMeasure {
  // Baseline: TP segment just before the P wave (or before QRS if no P)
  let baseline = 0;
  const preStart = beat.pOn ?? beat.qrsOn;
  const tpStart = Math.max(preStart - 40, prevBeat ? prevBeat.tEnd + 20 : 0);
  if (preStart - tpStart >= 8) baseline = mean(x, tpStart, preStart - 4);
  const lobes = findLobes(x, baseline, beat.qrsOn - 3, beat.qrsOff + 3);
  const mo = morphologyOf(lobes);
  let net = 0, qmax = -Infinity, qmin = Infinity;
  for (let t = Math.round(beat.qrsOn); t <= Math.round(beat.qrsOff); t++) {
    const v = at(x, t) - baseline;
    net += v;
    qmax = Math.max(qmax, v);
    qmin = Math.min(qmin, v);
  }
  const J = beat.qrsOff;
  const stJ = at(x, J + 10) - baseline;
  const st40 = at(x, J + 40) - baseline;
  const st60 = at(x, J + 60) - baseline;
  const stSlope = at(x, J + 50) - at(x, J + 10);
  // T window
  let tMax = -Infinity, tMin = Infinity, tMaxAt = 0, tMinAt = 0;
  const tStart = J + 50;
  for (let t = Math.round(tStart); t <= Math.round(beat.tEnd); t++) {
    const v = at(x, t) - baseline;
    if (v > tMax) { tMax = v; tMaxAt = t; }
    if (v < tMin) { tMin = v; tMinAt = t; }
  }
  const tDom = Math.abs(tMax) >= Math.abs(tMin) ? tMax : tMin;
  let tBiphasic: LeadBeatMeasure['tBiphasic'] = null;
  if (tMax > 0.05 && tMin < -0.05 && Math.min(tMax, -tMin) > 0.25 * Math.max(tMax, -tMin)) {
    tBiphasic = tMaxAt < tMinAt ? 'pos-neg' : 'neg-pos';
  }
  // P
  let pMax = 0, pMin = 0, pTerm = 0, prSeg = 0;
  if (beat.pOn !== undefined && beat.pOff !== undefined) {
    const mid = (beat.pOn + beat.pOff) / 2;
    for (let t = Math.round(beat.pOn); t <= Math.round(beat.pOff); t++) {
      const v = at(x, t) - baseline;
      pMax = Math.max(pMax, v);
      pMin = Math.min(pMin, v);
      if (t >= mid && v < 0) pTerm += -v;
    }
    if (beat.qrsOn - beat.pOff > 25) prSeg = mean(x, beat.pOff + 10, beat.qrsOn - 8) - baseline;
  }
  // U: window after T end
  let u = 0;
  for (let t = Math.round(beat.tEnd); t <= Math.round(beat.tEnd + 160); t++) {
    const v = at(x, t) - baseline;
    if (Math.abs(v) > Math.abs(u)) u = v;
  }
  return {
    lead, baseline, lobes, morphology: mo.m, q: mo.q, qDur: mo.qDur, r: mo.r, s: mo.s, rPrime: mo.rPrime,
    qrsNet: net, qrsMax: qmax, qrsMin: qmin, qrsPeakToPeak: qmax - qmin,
    notchedR: lobes.some((l) => l.sign > 0 && l.notched),
    stJ, st40, st60, stSlope,
    t: tDom, tMax, tMin, tBiphasic, tPeakAt: Math.abs(tMax) >= Math.abs(tMin) ? tMaxAt : tMinAt,
    p: Math.abs(pMax) >= Math.abs(pMin) ? pMax : pMin, pMax, pMin, pTerminalNegArea: pTerm, prSegment: prSeg, u,
  };
}

function areaAngle(vx: Float32Array, vy: Float32Array, a: number, b: number) {
  let sx = 0, sy = 0;
  for (let t = Math.round(a); t <= Math.round(b); t++) { sx += at(vx, t); sy += at(vy, t); }
  return wrapDeg(deg(Math.atan2(sy, sx)));
}

export function measureBeat(ecg: EcgOutput, beatIndex: number): BeatMeasure {
  const beat = ecg.beats[beatIndex];
  const prev = beatIndex > 0 ? ecg.beats[beatIndex - 1] : undefined;
  const leads: Record<string, LeadBeatMeasure> = {};
  for (const [l, x] of Object.entries(ecg.leads)) leads[l] = measureLeadBeat(l, x, beat, prev);
  const rr = prev ? beat.qrsOn - prev.qrsOn : null;
  const qt = beat.tEnd - beat.qrsOn;
  const [vx, vy, vz] = ecg.vcg;
  // time to 50% of peak spatial magnitude (delta wave → slow initial rise)
  let peak = 0;
  for (let t = Math.round(beat.qrsOn); t <= Math.round(beat.qrsOff); t++) peak = Math.max(peak, Math.hypot(at(vx, t), at(vy, t), at(vz, t)));
  let t50 = 0;
  for (let t = Math.round(beat.qrsOn); t <= Math.round(beat.qrsOff); t++) {
    if (Math.hypot(at(vx, t), at(vy, t), at(vz, t)) >= 0.5 * peak) { t50 = t - beat.qrsOn; break; }
  }
  return {
    beat,
    pr: beat.pOn !== undefined ? beat.qrsOn - beat.pOn : null,
    qrs: beat.qrsOff - beat.qrsOn,
    qt,
    rr,
    qtcBazett: rr ? qt / Math.sqrt(rr / 1000) : null,
    qtcFridericia: rr ? qt / Math.cbrt(rr / 1000) : null,
    axis: areaAngle(vx, vy, beat.qrsOn, beat.qrsOff),
    pAxis: beat.pOn !== undefined && beat.pOff !== undefined ? areaAngle(vx, vy, beat.pOn, beat.pOff) : null,
    tAxis: areaAngle(vx, vy, beat.qrsOff + 40, beat.tEnd),
    horizontalAxis: (() => {
      let sx = 0, sz = 0;
      for (let t = Math.round(beat.qrsOn); t <= Math.round(beat.qrsOff); t++) { sx += at(vx, t); sz += at(vz, t); }
      return wrapDeg(deg(Math.atan2(sz, sx)));
    })(),
    timeTo50: t50,
    leads,
  };
}

/** Pick a representative beat (the median-RR conducted beat after the first second). */
export function representativeBeat(ecg: EcgOutput): number {
  const idx = ecg.beats.map((b, i) => ({ b, i })).filter(({ b, i }) => i > 0 && b.qrsOn > 900 && b.tEnd < ecg.duration - 50);
  if (!idx.length) return Math.max(0, Math.min(ecg.beats.length - 1, 1));
  return idx[Math.floor(idx.length / 2)].i;
}

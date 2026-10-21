/**
 * ECG synthesis from regional dipoles.
 *
 * For each ventricular beat type we build a set of dipole SOURCES, each with a position, a
 * direction×amplitude vector and a time course:
 *   • QRS  – each region's depolarisation dipole while its wavefront crosses the wall.
 *   • ST   – injury current of injured regions during the plateau (transmural: +n, subendo: −n).
 *   • T    – repolarisation, from Wilson's ventricular gradient:
 *              T-area(region) = primary gradient (ischemia, drugs, electrolytes)
 *                               − [QRS-area(actual) − QRS-area(normal activation)]
 *            so abnormal activation (BBB, PVC, WPW, pacing) automatically gives secondary,
 *            discordant ST–T changes, while primary changes (ischemia, K⁺) alter the gradient.
 *   • U, J (Osborn) and P/Ta sources.
 * The cardiac vector (VCG) is the plain sum of all source vectors. Each lead is the projection of
 * every source onto that lead's lead vector (limb leads: far field; chest leads: near field).
 */
import type { LeadId } from '../../data/types';
import { add, dot, len as len3, norm, rng, rotFrontal, rotHorizontal, scale, type V3 } from '../math';
import { computeActivation, NORMAL_CONDUCTION, type ActivationResult, type VentricularPattern } from './activation';
import { ATRIAL_REGIONS, HEART_CENTRE, REGION_INDEX, VENTRICULAR_REGIONS } from './geometry';
import { ALL_LEADS, leadVector } from './leads';
import type { ResolvedEcg } from './model';
import type { AtrialOrigin, ContinuousActivity, RhythmOutput } from '../rhythm/types';

export const FS = 1000; // samples per second (1 sample = 1 ms)

// Calibration constants (see CONTENT_NOTES "morphology calibration layer").
const K_QRS = 0.62; // mV per unit mass (far-field) during depolarisation
const K_T = 0.06; // primary repolarisation gradient (area units per unit mass)
const K_INJ = 0.11; // injury current per unit mass
const K_P = 0.16; // atrial dipole scale
const T_REGION_MS = 125; // duration of a region's phase-3 repolarisation
/** Fraction of an abnormal QRS-area change that reappears, reversed, in the T wave (Wilson gradient). */
const K_SECONDARY = 1.0;

interface Source {
  pos: V3;
  vec: V3;
  t0: number; // ms relative to template zero
  wave: Float32Array;
}

export interface Template {
  /** Sample index in arrays corresponding to the event time. */
  zero: number;
  length: number;
  leads: Map<LeadId, Float32Array>;
  vcg: [Float32Array, Float32Array, Float32Array];
  /** Fiducials relative to event time (ms). */
  qrsDur: number;
  tEnd: number;
  tPeak: number;
}

// ------------------------------------------------------------------ wave shapes
function halfSine(dur: number): Float32Array {
  const n = Math.max(2, Math.round(dur));
  const w = new Float32Array(n);
  for (let i = 0; i < n; i++) w[i] = Math.sin((Math.PI * (i + 0.5)) / n);
  return w;
}

/** Skewed bump (slow rise, faster fall) with unit area – the T wave of one region. */
function tShape(dur: number): Float32Array {
  const n = Math.max(4, Math.round(dur));
  const w = new Float32Array(n);
  let s = 0;
  for (let i = 0; i < n; i++) {
    const x = (i + 0.5) / n;
    const v = Math.pow(x, 2.2) * Math.pow(1 - x, 1.1);
    w[i] = v;
    s += v;
  }
  for (let i = 0; i < n; i++) w[i] /= s;
  return w;
}

/** Plateau-phase injury time course from J point (index 0) to end of repolarisation. */
function stShape(shape: string, len: number, tStart: number): Float32Array {
  const n = Math.max(4, Math.round(len));
  const w = new Float32Array(n);
  const rise = 12;
  for (let i = 0; i < n; i++) {
    const x = i / n;
    const onset = Math.min(1, (i + 1) / rise);
    // decay over the repolarisation window
    const dec = i < tStart ? 1 : 0.5 * (1 + Math.cos((Math.PI * (i - tStart)) / Math.max(1, n - tStart)));
    let v: number;
    switch (shape) {
      case 'concave': v = (0.45 + 0.55 * Math.min(1, x / 0.55) ** 1.8) * dec; break;
      case 'coved': v = Math.max(0, 1 - x * 1.05) ** 1.2; break;
      case 'scooped': v = Math.sin(Math.PI * Math.min(1, x * 1.1)) ** 0.7; break;
      case 'upsloping': v = Math.exp(-i / 45); break;
      case 'convex': v = (0.85 + 0.15 * Math.sin(Math.PI * Math.min(1, x / 0.6))) * dec; break;
      default: v = dec;
    }
    w[i] = v * onset;
  }
  return w;
}

// ------------------------------------------------------------------ helpers
function transformDir(R: ResolvedEcg, d: V3, extraRot = 0): V3 {
  let v = d;
  if (R.frontalRot || extraRot) v = rotFrontal(v, R.frontalRot + extraRot);
  if (R.horizontalRot) v = rotHorizontal(v, R.horizontalRot);
  if (R.dextrocardia) v = [-v[0], v[1], v[2]];
  return v;
}
function transformPos(R: ResolvedEcg, p: V3): V3 {
  return R.dextrocardia ? [-p[0] + 2 * HEART_CENTRE[0] - 2.4, p[1], p[2]] : p;
}

let normalActivationCache: ActivationResult | null = null;
function normalActivation() {
  if (!normalActivationCache) normalActivationCache = computeActivation({ kind: 'normal' }, NORMAL_CONDUCTION);
  return normalActivationCache;
}

/** Rate-dependent QT (Fridericia-like restitution): QT = QTc·(RR/1000)^(1/3). */
export function qtForRR(R: ResolvedEcg, rr: number) {
  const rrc = Math.min(2200, Math.max(280, rr));
  const qtc = 405 + R.mods.qtDeltaMs + R.qtExtraMs;
  return Math.max(180, qtc * Math.cbrt(rrc / 1000));
}

// ------------------------------------------------------------------ ventricular template
export function ventricularSources(R: ResolvedEcg, pattern: VentricularPattern, rr: number, rotateDeg = 0) {
  const act = computeActivation(pattern, R.conduction);
  const nAct = normalActivation();
  const qt = qtForRR(R, rr);
  const rrScale = Math.cbrt(Math.min(2200, Math.max(280, rr)) / 1000);
  const tRegion = T_REGION_MS * R.mods.tWidth * (0.6 + 0.4 * rrScale);
  const sources: Source[] = [];
  let tEnd = 0;
  let tGradSum: V3 = [0, 0, 0];

  // Sine-wave hyperkalemia: extremely slow conduction makes QRS and T merge.
  const sine = R.mods.sineWave;
  let qrsEnd = act.qrsDuration;

  VENTRICULAR_REGIONS.forEach((r, i) => {
    const m = R.regions[i];
    const a = act.regions[i];
    const an = nAct.regions[i];
    const viable = 1 - m.necrosis;
    const mass = r.mass * m.massScale;
    const pos = transformPos(R, r.pos);
    const nDir = transformDir(R, r.n, rotateDeg);

    // --- QRS (depolarisation)
    const amp = K_QRS * mass * viable;
    // dipole time course: area (∝ activation gradient) spread over the region's activation time
    let areaActual: V3 = [0, 0, 0];
    let areaNormal: V3 = [0, 0, 0];
    const parts = a.halves ?? [{ t: a.t, transit: a.transit, area: a.area }];
    // thicker (hypertrophied) walls take longer to activate transmurally
    const thick = Math.min(r.chamber === 'RV' ? 2.4 : 1.6, 1 + 0.12 * (m.massScale - 1));
    for (const h of parts) {
      const areaVec = transformDir(R, h.area, rotateDeg);
      const dur = h.transit * thick;
      if (amp > 0) sources.push({ pos, vec: scale(areaVec, (amp * r.transit) / dur), t0: h.t, wave: halfSine(dur) });
      qrsEnd = Math.max(qrsEnd, h.t + dur);
      areaActual = add(areaActual, scale(areaVec, amp * (2 / Math.PI) * r.transit));
    }
    for (const h of an.halves ?? [{ t: an.t, transit: an.transit, area: an.area }]) {
      areaNormal = add(areaNormal, scale(transformDir(R, h.area, rotateDeg), amp * (2 / Math.PI) * r.transit));
    }

    // --- repolarisation timing
    const jRel = a.t + a.transit; // end of this region's depolarisation
    // regional APD: later-activated regions repolarise relatively earlier (basal/epicardial shorter APD)
    const apd = (qt - 45) * r.apdFactor + m.tDelay;
    const end = a.t + apd;
    tEnd = Math.max(tEnd, end);

    // --- T (ventricular gradient)
    // Tissue activated by slow cell-to-cell spread loses the normal endo→epi activation order,
    // and with it part of its primary transmural repolarisation gradient.
    const orderFactor = a.viaPurkinje || a.halves ? 1 : 0.45;
    const primary = scale(nDir, K_T * r.gradient * m.tGradient * r.mass * m.gradientMassScale * viable * 100 * R.mods.tAmp * orderFactor);
    // secondary component: abnormal activation changes QRS area → opposite T area
    // (fascicular blocks, activated via the Purkinje network, cause only minor secondary ST–T change)
    const secondary = scale(add(areaActual, scale(areaNormal, -1)), -K_SECONDARY * (a.viaPurkinje ? 0.3 : 1));
    tGradSum = add(tGradSum, primary);
    const tDur = sine ? Math.max(tRegion, a.transit * 2.2) : tRegion;
    const tStart = end - tDur;
    // Secondary repolarisation change: part of it already appears during the ST segment
    // (discordant ST deviation of bundle branch block / pacing / WPW), the rest in the T wave.
    const ST_FRACTION = 0.3;
    sources.push({ pos, vec: add(primary, scale(secondary, 1 - ST_FRACTION)), t0: tStart, wave: tShape(tDur) });
    if (len3(secondary) > 1e-3) {
      const plateauLen = Math.max(20, end - jRel);
      const w = stShape('straight', plateauLen, plateauLen * 0.55);
      let sum = 0;
      for (let k = 0; k < w.length; k++) sum += w[k];
      for (let k = 0; k < w.length; k++) w[k] /= sum;
      sources.push({ pos, vec: scale(secondary, ST_FRACTION), t0: jRel, wave: w });
    }

    // --- ST injury current
    let inj = m.injury;
    let shape = m.stShape;
    if (R.pericarditis > 0) {
      inj += R.pericarditis * 0.8;
      if (!m.injury) shape = 'concave';
    }
    if (R.mods.stScoop > 0 && r.chamber === 'LV' && !m.injury) {
      inj -= 0.28 * R.mods.stScoop;
      shape = 'scooped';
    }
    if (inj !== 0) {
      const len = end - jRel + 10;
      const decayStart = Math.max(10, len - tDur * 0.9);
      sources.push({ pos, vec: scale(nDir, K_INJ * mass * inj), t0: jRel - 8, wave: stShape(shape, len, decayStart) });
    }
  });

  // --- J (Osborn) wave: epicardial Ito notch at the end of the QRS (hypothermia)
  if (R.mods.osborn > 0) {
    let dir: V3 = [0, 0, 0];
    VENTRICULAR_REGIONS.forEach((r) => { if (r.chamber === 'LV') dir = add(dir, scale(r.n, r.mass)); });
    sources.push({ pos: transformPos(R, VENTRICULAR_REGIONS[REGION_INDEX.seg12].pos), vec: scale(transformDir(R, norm(dir)), 0.42 * R.mods.osborn), t0: act.qrsDuration - 14, wave: halfSine(50) });
  }

  // --- Brugada: RVOT epicardial Ito-mediated transmural gradient. Its dipole points anteriorly
  // (out of the RVOT epicardium), so it is seen almost only by the leads over the RVOT (V1–V2):
  // coved ST elevation descending into a negative T wave.
  if (R.brugada > 0) {
    const rv = VENTRICULAR_REGIONS[REGION_INDEX.rvot];
    const pos = transformPos(R, add(rv.pos, [0, 0.6, 0.8]));
    const dir = transformDir(R, norm([-0.12, 0.0, 1]));
    const jt = act.qrsDuration - 12;
    const len = (tEnd - jt) * 0.75;
    sources.push({ pos, vec: scale(dir, 0.3 * R.brugada), t0: jt, wave: stShape('coved', len, len) });
    sources.push({ pos, vec: scale(dir, -26 * R.brugada), t0: tEnd - 190, wave: tShape(170) });
  }

  // --- U wave (late repolarisation of Purkinje/M cells), oriented like the normal T
  if (R.uWave > 0 && !sine) {
    const uDir = norm(tGradSum);
    const uPos = transformPos(R, VENTRICULAR_REGIONS[REGION_INDEX.seg8].pos);
    const uAmp = 0.022 * Math.min(R.uWave, 9);
    sources.push({ pos: uPos, vec: scale(uDir, uAmp), t0: tEnd - 25, wave: halfSine(170) });
  }

  // --- calibration sources from the data file
  for (const x of R.extraSources) {
    const pos = transformPos(R, x.position ?? HEART_CENTRE);
    const dirX = transformDir(R, norm(x.direction));
    const wave = x.shape === 'plateau' ? stShape('straight', x.duration, x.duration * 0.6) : halfSine(x.duration);
    sources.push({ pos, vec: scale(dirX, x.amplitude), t0: x.start, wave });
  }

  return { sources, qrsDur: qrsEnd, tEnd, activation: act };
}

// ------------------------------------------------------------------ atrial template
const SINUS_P_AXIS = 55;

export function atrialSources(R: ResolvedEcg, origin: AtrialOrigin) {
  const sources: Source[] = [];
  const pAmp = R.mods.pAmp;
  const pW = R.mods.pWidth;
  let meanP: V3 = [0, 0, 0];
  let pEnd = 0;
  for (const a of ATRIAL_REGIONS) {
    const isLA = a.chamber === 'LA';
    let dir: V3 = a.dir;
    let t = a.t;
    let dur = a.dur;
    if (origin.kind === 'retrograde') {
      // retrograde (junctional/low atrial): activation spreads upward → inverted P in II, III, aVF
      dir = norm([dir[0] * 0.6, -Math.abs(dir[1]), dir[2] * 0.3]);
      t = isLA ? a.t * 0.4 : a.t * 0.4;
    } else if (origin.kind === 'ectopic') {
      dir = rotFrontal(dir, origin.axisDeg - SINUS_P_AXIS);
      if (origin.horizontalDeg) dir = rotHorizontal(dir, origin.horizontalDeg);
    }
    const sc = isLA ? R.atria.laScale : R.atria.raScale;
    if (isLA) {
      t += R.atria.laDelay;
      dur *= R.atria.laDurScale;
    } else {
      dur *= 1 + (R.atria.raScale - 1) * 0.1;
    }
    t *= pW;
    dur *= pW;
    const v = scale(transformDir({ ...R, frontalRot: 0, horizontalRot: 0 }, dir), K_P * a.mass * sc * pAmp);
    meanP = add(meanP, scale(v, dur));
    pEnd = Math.max(pEnd, t + dur);
    sources.push({ pos: transformPos(R, a.pos), vec: v, t0: t, wave: halfSine(dur) });
  }
  // Ta wave: atrial repolarisation, opposite in direction to P, low and long (mostly hidden in PR/QRS).
  const taDir = scale(norm(meanP), -1);
  const taAmp = 0.022 * pAmp * (R.atria.raScale + R.atria.laScale) / 2;
  sources.push({ pos: transformPos(R, [-1.5, -3.2, -1]), vec: scale(taDir, taAmp), t0: pEnd - 10, wave: halfSine(260) });
  // Atrial injury (pericarditis): current of injury during atrial plateau → PR depression (PR elevation in aVR).
  if (R.atria.injury > 0) {
    sources.push({ pos: transformPos(R, [-1.5, -3.2, -1]), vec: scale(taDir, 0.075 * R.atria.injury), t0: pEnd - 5, wave: stShape('straight', 150, 110) });
  }
  return { sources, pDur: pEnd };
}

// ------------------------------------------------------------------ projection
function renderTemplate(sources: Source[], leads: LeadId[], electrodes?: Partial<Record<string, V3>>, padPre = 20): Template {
  let minT = Infinity, maxT = -Infinity;
  for (const s of sources) {
    minT = Math.min(minT, s.t0);
    maxT = Math.max(maxT, s.t0 + s.wave.length);
  }
  if (!isFinite(minT)) { minT = 0; maxT = 1; }
  const zero = Math.ceil(-Math.min(minT, 0)) + padPre;
  const length = zero + Math.ceil(maxT) + 5;
  const map = new Map<LeadId, Float32Array>();
  for (const l of leads) map.set(l, new Float32Array(length));
  const vcg: [Float32Array, Float32Array, Float32Array] = [new Float32Array(length), new Float32Array(length), new Float32Array(length)];
  for (const s of sources) {
    const start = zero + Math.round(s.t0);
    const coefs = leads.map((l) => dot(s.vec, leadVector(l, s.pos, electrodes)));
    const w = s.wave;
    for (let li = 0; li < leads.length; li++) {
      const arr = map.get(leads[li])!;
      const c = coefs[li];
      if (c === 0) continue;
      for (let k = 0; k < w.length; k++) {
        const idx = start + k;
        if (idx >= 0 && idx < length) arr[idx] += c * w[k];
      }
    }
    for (let k = 0; k < w.length; k++) {
      const idx = start + k;
      if (idx < 0 || idx >= length) continue;
      vcg[0][idx] += s.vec[0] * w[k];
      vcg[1][idx] += s.vec[1] * w[k];
      vcg[2][idx] += s.vec[2] * w[k];
    }
  }
  return { zero, length, leads: map, vcg, qrsDur: 0, tEnd: 0, tPeak: 0 };
}

export function ventricularTemplate(R: ResolvedEcg, pattern: VentricularPattern, rr: number, leads: LeadId[], electrodes?: Partial<Record<string, V3>>, rotateDeg = 0): Template {
  const { sources, qrsDur, tEnd } = ventricularSources(R, pattern, rr, rotateDeg);
  const t = renderTemplate(sources, leads, electrodes);
  t.qrsDur = qrsDur;
  t.tEnd = tEnd;
  return t;
}

export function atrialTemplate(R: ResolvedEcg, origin: AtrialOrigin, leads: LeadId[], electrodes?: Partial<Record<string, V3>>): Template & { pDur: number } {
  const { sources, pDur } = atrialSources(R, origin);
  const t = renderTemplate(sources, leads, electrodes, 5);
  return { ...t, qrsDur: 0, tEnd: 0, tPeak: 0, pDur };
}

// ------------------------------------------------------------------ continuous activity
function continuousVector(act: ContinuousActivity, t: number, rand: () => number, state: { phases: number[]; dirs: V3[] }): V3 {
  const tt = (t - act.start) / 1000;
  switch (act.kind) {
    case 'flutter': {
      // Typical (counter-clockwise, cavotricuspid-isthmus dependent) flutter: wavefront ascends the
      // septum (superior vector → negative sawtooth in II, III, aVF) and descends the lateral RA.
      const cl = 60 / act.rate;
      const ph = (tt % cl) / cl;
      const g = (p: number) => { const q = ((p % 1) + 1) % 1; return q < 0.68 ? 1 - (2 * q) / 0.68 : -1 + (2 * (q - 0.68)) / 0.32; };
      const y = 0.17 * g(ph);
      return [0.03 * g(ph + 0.3), y, -0.12 * g(ph)];
    }
    case 'fibrillation': {
      let v: V3 = [0, 0, 0];
      for (let k = 0; k < state.phases.length; k++) {
        const f = 5 + k * 0.9 + 0.6 * Math.sin(tt * (0.7 + k * 0.3));
        state.phases[k] += (2 * Math.PI * f) / FS;
        const amp = 0.035 * (0.6 + 0.4 * Math.sin(tt * (1.3 + k)));
        v = add(v, scale(state.dirs[k], amp * Math.sin(state.phases[k])));
      }
      if (rand() < 0.0005) state.dirs[Math.floor(rand() * state.dirs.length)] = norm([rand() - 0.3, rand() - 0.5, rand() - 0.2]);
      return v;
    }
    case 'vf': {
      let v: V3 = [0, 0, 0];
      for (let k = 0; k < state.phases.length; k++) {
        const f = 4.2 + k * 0.7 + 0.8 * Math.sin(tt * (0.5 + 0.4 * k));
        state.phases[k] += (2 * Math.PI * f) / FS;
        const amp = 0.38 * (0.55 + 0.45 * Math.sin(tt * (0.9 + 0.5 * k) + k));
        v = add(v, scale(state.dirs[k], amp * Math.sin(state.phases[k])));
      }
      return v;
    }
    case 'torsades': {
      // Twisting of the points: QRS axis rotates progressively, amplitude waxes and wanes.
      const f = act.rate / 60;
      const twist = 2.2; // seconds per full twist
      const th = (Math.PI * tt) / twist * 2;
      const osc = Math.sin(2 * Math.PI * f * tt);
      const env = 0.45 + 0.75 * Math.abs(Math.sin(th / 2));
      return scale([Math.cos(th / 2) * 1.2, Math.sin(th / 2) * 0.4 + 0.25, 0.6 * Math.cos(th / 2)], osc * env);
    }
  }
}

// ------------------------------------------------------------------ full synthesis
export interface BeatInfo {
  qrsOn: number;
  qrsOff: number;
  tEnd: number;
  pOn?: number;
  pOff?: number;
  pattern: VentricularPattern;
  source: string;
  scale: number;
}

export interface EcgOutput {
  fs: number;
  duration: number;
  leads: Record<string, Float32Array>;
  vcg: [Float32Array, Float32Array, Float32Array];
  beats: BeatInfo[];
  pWaves: Array<{ on: number; off: number; origin: AtrialOrigin }>;
  rhythm: RhythmOutput;
}

export interface SynthOptions {
  leads?: LeadId[];
  electrodes?: Partial<Record<string, V3>>;
  seed?: number;
}

const LIMB_SWAP_LA_RA: Record<string, { from: string; sign: number }> = {
  I: { from: 'I', sign: -1 }, II: { from: 'III', sign: 1 }, III: { from: 'II', sign: 1 },
  aVR: { from: 'aVL', sign: 1 }, aVL: { from: 'aVR', sign: 1 }, aVF: { from: 'aVF', sign: 1 },
};

function patternKey(p: VentricularPattern) {
  return JSON.stringify(p);
}

export function synthesize(R: ResolvedEcg, rhythm: RhythmOutput, opts: SynthOptions = {}): EcgOutput {
  const leads = opts.leads ?? ALL_LEADS;
  // limb leads always computed in full (needed for limb-reversal artefact)
  const calcLeads = Array.from(new Set<LeadId>([...leads, 'I', 'II', 'III', 'aVR', 'aVL', 'aVF']));
  const n = Math.ceil(rhythm.duration);
  const out: Record<string, Float32Array> = {};
  for (const l of calcLeads) out[l] = new Float32Array(n);
  const vcg: [Float32Array, Float32Array, Float32Array] = [new Float32Array(n), new Float32Array(n), new Float32Array(n)];

  const add2 = (tpl: Template, t: number, s: number) => {
    const start = Math.round(t) - tpl.zero;
    for (const l of calcLeads) {
      const src = tpl.leads.get(l)!;
      const dst = out[l];
      for (let k = 0; k < src.length; k++) {
        const idx = start + k;
        if (idx >= 0 && idx < n) dst[idx] += s * src[k];
      }
    }
    for (let c = 0; c < 3; c++) {
      const src = tpl.vcg[c];
      const dst = vcg[c];
      for (let k = 0; k < src.length; k++) {
        const idx = start + k;
        if (idx >= 0 && idx < n) dst[idx] += s * src[k];
      }
    }
  };

  // atrial
  const aCache = new Map<string, Template & { pDur: number }>();
  const pWaves: EcgOutput['pWaves'] = [];
  for (const ev of rhythm.atrial) {
    if (R.mods.atrialStandstill) break;
    const key = JSON.stringify(ev.origin);
    let tpl = aCache.get(key);
    if (!tpl) { tpl = atrialTemplate(R, ev.origin, calcLeads, opts.electrodes); aCache.set(key, tpl); }
    add2(tpl, ev.t, R.voltageScale);
    pWaves.push({ on: ev.t, off: ev.t + tpl.pDur, origin: ev.origin });
  }

  // ventricular
  const vCache = new Map<string, Template>();
  const beats: BeatInfo[] = [];
  rhythm.ventricular.forEach((ev, idx) => {
    const rrBucket = Math.round(Math.min(2200, Math.max(280, ev.rr)) / 20) * 20;
    const rot = ev.rotateDeg ?? 0;
    const key = `${patternKey(ev.pattern)}|${rrBucket}|${Math.round(rot)}`;
    let tpl = vCache.get(key);
    if (!tpl) { tpl = ventricularTemplate(R, ev.pattern, rrBucket, calcLeads, opts.electrodes, rot); vCache.set(key, tpl); }
    const alt = R.alternans > 0 && idx % 2 === 1 ? 1 - R.alternans : 1;
    const s = (ev.scale ?? 1) * R.voltageScale * alt;
    add2(tpl, ev.t, s);
    const fromA = ev.fromAtrial !== undefined ? rhythm.atrial[ev.fromAtrial] : undefined;
    const pw = fromA ? pWaves.find((p) => p.on === fromA.t) : undefined;
    beats.push({ qrsOn: ev.t, qrsOff: ev.t + tpl.qrsDur, tEnd: ev.t + tpl.tEnd, pOn: pw?.on, pOff: pw?.off, pattern: ev.pattern, source: ev.source, scale: s });
  });

  // continuous activity (flutter, AF, VF, torsades)
  rhythm.continuous.forEach((act, ci) => {
    const rand = rng(act.seed + ci * 17);
    const state = { phases: [0, 1.3, 2.1, 0.7, 2.9], dirs: [0, 1, 2, 3, 4].map(() => norm([rand() - 0.3, rand() - 0.4, rand() - 0.3]) as V3) };
    const isAtrial = act.kind === 'flutter' || act.kind === 'fibrillation';
    const pos: V3 = isAtrial ? [-2.2, -3.4, -0.6] : HEART_CENTRE;
    const coefs = calcLeads.map((l) => leadVector(l, transformPos(R, pos), opts.electrodes));
    const amp = R.voltageScale * (isAtrial ? R.mods.pAmp + 0.0001 : 1);
    for (let t = Math.max(0, Math.floor(act.start)); t < Math.min(n, act.end); t++) {
      const v = transformDir({ ...R, frontalRot: 0, horizontalRot: 0 }, continuousVector(act, t, rand, state));
      calcLeads.forEach((l, li) => { out[l][t] += amp * dot(v, coefs[li]); });
      vcg[0][t] += amp * v[0]; vcg[1][t] += amp * v[1]; vcg[2][t] += amp * v[2];
    }
  });

  // limb-lead reversal artefact (LA ↔ RA)
  if (R.limbReversal === 'LA-RA') {
    const orig: Record<string, Float32Array> = {};
    for (const l of ['I', 'II', 'III', 'aVR', 'aVL', 'aVF']) orig[l] = out[l].slice();
    for (const [l, m] of Object.entries(LIMB_SWAP_LA_RA)) {
      const src = orig[m.from];
      const dst = out[l];
      for (let i = 0; i < n; i++) dst[i] = m.sign * src[i];
    }
  }

  const final: Record<string, Float32Array> = {};
  for (const l of leads) final[l] = out[l];
  return { fs: FS, duration: n, leads: final, vcg, beats, pWaves, rhythm };
}

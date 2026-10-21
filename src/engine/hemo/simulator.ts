/**
 * Hemodynamic simulator: drives the Circulation with contraction timing from the rhythm engine,
 * applies an optional baroreflex, records waveforms and summarises every beat.
 */
import type { HemoParams } from '../../data/types';
import { clamp } from '../math';
import { Circulation, DT, type Instant, type MechEvent } from './model';
import { rhythmById } from '../../data/rhythms';
import { resolveEcgModel } from '../electrical/model';
import { simulateRhythm } from '../rhythm/engine';

export interface Murmurs {
  as: number; ar: number; mr: number; ms: number; tr: number; pr: number; ps: number;
  vsd: number; pda: number; hocm: number; pulmFlow: number; tvFlow: number; mvFlow: number;
}

export interface BeatSummary {
  index: number;
  tStart: number; tEnd: number;
  insp: number; // respiratory phase at beat start (0 exp … 1 insp)
  hr: number;
  edv: number; esv: number; sv: number; ef: number; svNet: number;
  rvEdv: number; rvEsv: number;
  co: number; // forward systemic output L/min
  qp: number; qs: number; qpqs: number;
  sbp: number; dbp: number; map: number; pp: number;
  lvSys: number; lvEdp: number; lvMin: number;
  rvSys: number; rvEdp: number;
  paSys: number; paDia: number; paMean: number;
  pcwp: number; laMean: number; laV: number; laA: number;
  cvp: number; raA: number; raV: number; raMin: number;
  /** Mean jugular/great-vein pressure (what the JVP reflects). */
  jvp: number; jvA: number; jvV: number; jvMin: number;
  svr: number; pvr: number; // dyn·s·cm⁻⁵
  avGradPeak: number; avGradMean: number; mvGradMean: number; lvotPeak: number;
  arFraction: number; mrFraction: number; trFraction: number;
  svo2: number;
  dpdtMax: number;
  upstrokeMs: number; // aortic valve opening → peak aortic pressure
  ivcVolumeChange: number; // LV volume change during "isovolumetric" contraction (mL)
  ivrVolumeChange: number; // during "isovolumetric" relaxation
  pPeriMean: number;
  /** Event times relative to beat onset (ms). */
  sounds: { s1: number | null; a2: number | null; p2: number | null; split: number | null; mvOpen: number | null; os: number | null; click: number | null; s3: number; s4: number; knock: number };
  /** Murmur loudness: acoustic energy of each turbulent jet over the beat (arbitrary units; ~10 = grade 3). */
  murmurs: Murmurs;
  /** Peak instantaneous murmur intensity. */
  murmurPeak: Murmurs;
  /** Murmur timing: time (ms from beat start) of peak intensity and systolic duration. */
  murmurPeakMs: Partial<Record<keyof Murmurs, number>>;
  murmurDurationMs: Partial<Record<keyof Murmurs, number>>;
  ejectionStartMs: number | null; ejectionEndMs: number | null;
}

export interface Sample {
  t: number;
  pLV: number; pAo: number; pLA: number; pRA: number; pRV: number; pPA: number; pPCW: number; pTh: number; pPeri: number; pJV: number;
  vLV: number; vRV: number; vLA: number;
  qMV: number; qAV: number; qTV: number; qPV: number; qVSD: number; qASD: number; qPDA: number;
  eLV: number; eLA: number;
  m: Murmurs; // instantaneous murmur intensities
}

export interface SimOptions {
  /** Record a sample every N integration steps (default 4 → 2 ms). */
  sampleEvery?: number;
  maxSamples?: number;
  seed?: number;
}

const zeroMurmurs = (): Murmurs => ({ as: 0, ar: 0, mr: 0, ms: 0, tr: 0, pr: 0, ps: 0, vsd: 0, pda: 0, hocm: 0, pulmFlow: 0, tvFlow: 0, mvFlow: 0 });

/**
 * Murmur intensity ≈ turbulent power of a jet: flow × the part of the pressure drop above the
 * level at which flow stays laminar (critical velocity ≈ √(ΔPc/4) m/s). Arbitrary units;
 * a grade-3 murmur is roughly 10–20 units.
 */
const jet = (q: number, dp: number, dpc: number) => (Math.max(0, q) * Math.max(0, dp - dpc)) / 1000;
const DPC_SEMILUNAR = 18; // ≈ 2.1 m/s
const DPC_AV = 12; // ≈ 1.7 m/s
const DPC_JET = 4; // regurgitant/shunt jets

export function instantMurmurs(s: Instant, p: HemoParams): Murmurs {
  const m = zeroMurmurs();
  if (s.qAV > 0) {
    const g = s.pLV - s.pAo;
    if (p.hocm > 0) m.hocm = jet(s.qAV, g, DPC_SEMILUNAR);
    else m.as = jet(s.qAV, g, DPC_SEMILUNAR);
  } else m.ar = jet(-s.qAV, s.pAo - s.pLV, DPC_JET);
  // AV valves: turbulence depends on jet velocity (convective, Bernoulli) – not on the inertial
  // pressure needed to accelerate blood
  const bern = (q: number, a: number) => (q * q) / (2500 * a * a);
  if (s.qMV < 0) m.mr = jet(-s.qMV, s.pLV - s.pLA, DPC_JET);
  else m.ms = jet(s.qMV, bern(s.qMV, p.mvArea), DPC_AV);
  m.mvFlow = jet(s.qMV, bern(s.qMV, p.mvArea), 2);
  if (s.qTV < 0) m.tr = jet(-s.qTV, s.pRV - s.pRA, DPC_JET);
  m.tvFlow = jet(s.qTV, bern(s.qTV, p.tvArea), 2);
  if (s.qPV > 0) { m.ps = jet(s.qPV, s.pRV - s.pPA, DPC_SEMILUNAR); m.pulmFlow = jet(s.qPV, s.pRV - s.pPA, 6); }
  else m.pr = jet(-s.qPV, s.pPA - s.pRV, DPC_JET);
  m.vsd = jet(Math.abs(s.qVSD), Math.abs(s.pLV - s.pRV), DPC_JET);
  m.pda = jet(Math.abs(s.qPDA), Math.abs(s.pAo - s.pPA), DPC_JET);
  return m;
}

/** Contraction schedule: sinus generated internally (rate follows baroreflex), others from the rhythm engine. */
class BeatSource {
  private next = 0.3;
  private chunkEnd = 0;
  private chunkIndex = 0;
  constructor(private rhythmId: string, private seed: number) {}

  isSinus() {
    return !this.rhythmId || this.rhythmId === 'sinus';
  }

  /** Push events up to time tUntil (s) into the circulation. */
  fill(c: Circulation, tUntil: number, hr: number) {
    if (this.isSinus()) {
      while (this.next < tUntil) {
        const rr = 60 / hr;
        c.addEvent({ t: this.next, kind: 'atrial', strength: 1, rr });
        c.addEvent({ t: this.next + 0.16, kind: 'ventricular', strength: 1, rr });
        this.next += rr;
      }
      return;
    }
    while (this.chunkEnd < tUntil) {
      const r = rhythmById(this.rhythmId);
      const R = resolveEcgModel({ ...(r?.ecg ?? {}), heartRate: hr });
      const model = r ? { ...r.model } : {};
      const chunk = 20000;
      const out = simulateRhythm(model, R, { durationMs: chunk, seed: this.seed + this.chunkIndex });
      const off = this.chunkEnd;
      const evs: MechEvent[] = [];
      for (const a of out.atrial) if (a.mechanical) evs.push({ t: off + a.t / 1000, kind: 'atrial', strength: 1, rr: 0.8 });
      for (const v of out.ventricular) evs.push({ t: off + (v.t + 20) / 1000, kind: 'ventricular', strength: v.mechanical, rr: v.rr / 1000 });
      evs.sort((a, b) => a.t - b.t);
      for (const e of evs) c.addEvent(e);
      this.chunkEnd += chunk / 1000;
      this.chunkIndex++;
    }
  }
}

export class HemoSimulator {
  base: HemoParams;
  eff: HemoParams;
  circ: Circulation;
  beats: BeatSummary[] = [];
  samples: Sample[] = [];
  private src: BeatSource;
  private opts: Required<SimOptions>;
  private stepCount = 0;
  // baroreflex state
  baro = { hr: 1, svr: 1, ees: 1, ven: 1 };
  private acc: BeatAccumulator;

  constructor(params: HemoParams, opts: SimOptions = {}) {
    this.opts = { sampleEvery: opts.sampleEvery ?? 4, maxSamples: opts.maxSamples ?? 20000, seed: opts.seed ?? 1 };
    this.base = params;
    this.eff = { ...params };
    this.circ = new Circulation(this.effective());
    this.src = new BeatSource(params.rhythm, this.opts.seed);
    this.acc = new BeatAccumulator(0, 0);
  }

  /** Change parameters while running (maneuvers, interventions, presets). */
  setParams(p: HemoParams) {
    const rhythmChanged = p.rhythm !== this.base.rhythm;
    this.base = p;
    this.circ.setParams(this.effective());
    if (rhythmChanged) {
      this.circ.events = this.circ.events.filter((e) => e.t <= this.circ.t);
      this.src = new BeatSource(p.rhythm, this.opts.seed + 101);
      (this.src as unknown as { next: number; chunkEnd: number }).next = this.circ.t + 0.05;
      (this.src as unknown as { next: number; chunkEnd: number }).chunkEnd = this.circ.t;
    }
  }

  private effective(): HemoParams {
    const p = this.base;
    const b = p.baroreflex ? this.baro : { hr: 1, svr: 1, ees: 1, ven: 1 };
    this.eff = {
      ...p,
      hr: p.hr * b.hr,
      sysR: p.sysR * b.svr,
      lvEes: p.lvEes * b.ees,
      rvEes: p.rvEes * b.ees,
      unstressedFraction: p.unstressedFraction * b.ven,
    };
    return this.eff;
  }

  get t() {
    return this.circ.t;
  }

  /** Advance the simulation by `seconds`. */
  advance(seconds: number) {
    const end = this.circ.t + seconds;
    while (this.circ.t < end) {
      this.src.fill(this.circ, this.circ.t + 2, this.eff.hr);
      const s = this.circ.step();
      this.stepCount++;
      const newBeat = this.acc.feed(s, this.circ, this.eff);
      if (newBeat) {
        const summary = this.acc.finish(this.beats.length, this.eff);
        if (summary) {
          this.beats.push(summary);
          if (this.beats.length > 400) this.beats.shift();
          if (this.base.baroreflex) this.updateBaroreflex(summary);
        }
        this.acc = new BeatAccumulator(s.t, this.circ.inspiration(s.t));
        this.acc.feed(s, this.circ, this.eff);
      }
      if (this.stepCount % this.opts.sampleEvery === 0) {
        this.samples.push(toSample(s, this.eff));
        if (this.samples.length > this.opts.maxSamples) this.samples.splice(0, this.samples.length - this.opts.maxSamples);
      }
    }
  }

  /** Run until roughly periodic (or n beats) and return the mean of the last k beat summaries. */
  steady(seconds = 25, lastBeats = 8): BeatSummary {
    this.advance(seconds);
    return averageBeats(this.beats.slice(-lastBeats));
  }

  private updateBaroreflex(b: BeatSummary) {
    // carotid/aortic baroreceptors: ↓ MAP → ↑ sympathetic (HR, SVR, contractility, venous tone)
    const err = clamp(93 - b.map, -40, 60);
    const a = 0.12; // ~10–20 s time course
    const target = {
      hr: clamp(1 + 0.012 * err, 0.65, 1.9),
      svr: clamp(1 + 0.011 * err, 0.55, 1.8),
      ees: clamp(1 + 0.006 * err, 0.75, 1.4),
      ven: clamp(1 - 0.0022 * err, 0.88, 1.06),
    };
    this.baro.hr += a * (target.hr - this.baro.hr);
    this.baro.svr += a * (target.svr - this.baro.svr);
    this.baro.ees += a * (target.ees - this.baro.ees);
    this.baro.ven += a * (target.ven - this.baro.ven);
    this.circ.setParams(this.effective());
  }
}

function toSample(s: Instant, p: HemoParams): Sample {
  return {
    t: s.t, pLV: s.pLV, pAo: s.pAo, pLA: s.pLA, pRA: s.pRA, pRV: s.pRV, pPA: s.pPA, pPCW: s.pPV, pTh: s.pTh, pPeri: s.pPeri, pJV: s.pJV,
    vLV: s.vLV, vRV: s.vRV, vLA: s.vLA, vRA: s.vRA,
    qMV: s.qMV, qAV: s.qAV, qTV: s.qTV, qPV: s.qPV, qVSD: s.qVSD, qASD: s.qASD, qPDA: s.qPDA,
    eLV: s.eLV, eLA: s.eLA,
    m: instantMurmurs(s, p),
  };
}

/** Collects one beat (ventricular onset to next onset). */
class BeatAccumulator {
  n = 0;
  t0: number;
  insp: number;
  prevE = 0;
  vMax = 0; vMin = 1e9; rvMax = 0; rvMin = 1e9;
  aoMax = -1e9; aoMin = 1e9; aoSum = 0;
  lvMax = -1e9; lvMin = 1e9; lvEdp = 0;
  rvSysP = -1e9; rvEdp = 0;
  paMax = -1e9; paMin = 1e9; paSum = 0;
  pvSum = 0; laSum = 0; laV = -1e9; laA = -1e9;
  raSum = 0; raA = -1e9; raV = -1e9; raMin = 1e9;
  jvSum = 0; jvA = -1e9; jvV = -1e9; jvMin = 1e9;
  periSum = 0;
  fwdAo = 0; backAo = 0; fwdMv = 0; backMv = 0; fwdTv = 0; backTv = 0; fwdPv = 0;
  qPeriph = 0; qPulm = 0;
  avGradPeak = 0; avGradSum = 0; avGradN = 0; mvGradSum = 0; mvGradN = 0; lvotPeak = 0;
  dpdtMax = 0; prevPLV = 0;
  aoOpen: number | null = null; aoClose: number | null = null; peakAoT = 0;
  mvClose: number | null = null; mvOpen: number | null = null; pvClose: number | null = null;
  click: number | null = null;
  ivcStartV = 0; ivcEndV = 0; ivrStartV = 0; ivrEndV = 0;
  prevQAV = 0; prevQMV = 1; prevQPV = 0; prevMvp = false;
  murPeak = zeroMurmurs();
  murEnergy = zeroMurmurs();
  murPeakT: Partial<Record<keyof Murmurs, number>> = {};
  murOn: Partial<Record<keyof Murmurs, number>> = {};
  murDur: Partial<Record<keyof Murmurs, number>> = {};
  earlyDecel = 0; prevQmvForDecel = 0; earlyPeak = 0;
  atrialLvRise = 0; lvPreA = 0;
  started = false;

  constructor(t0: number, insp: number) {
    this.t0 = t0;
    this.insp = insp;
  }

  /** Returns true when a new ventricular onset is detected (start of next beat). */
  feed(s: Instant, c: Circulation, p: HemoParams): boolean {
    const onset = s.eLV > 0.003 && this.prevE <= 0.003;
    if (onset && this.started && s.t - this.t0 > 0.15) return true;
    if (onset && !this.started) { this.started = true; this.lvEdp = s.pLV; this.rvEdp = s.pRV; }
    this.prevE = s.eLV;
    if (!this.started) return false;
    const rel = (s.t - this.t0) * 1000;
    this.n++;
    this.vMax = Math.max(this.vMax, s.vLV); this.vMin = Math.min(this.vMin, s.vLV);
    this.rvMax = Math.max(this.rvMax, s.vRV); this.rvMin = Math.min(this.rvMin, s.vRV);
    this.aoMax = Math.max(this.aoMax, s.pAo); this.aoMin = Math.min(this.aoMin, s.pAo); this.aoSum += s.pAo;
    if (s.pAo >= this.aoMax) this.peakAoT = rel;
    this.lvMax = Math.max(this.lvMax, s.pLV); this.lvMin = Math.min(this.lvMin, s.pLV);
    this.rvSysP = Math.max(this.rvSysP, s.pRV);
    this.paMax = Math.max(this.paMax, s.pPA); this.paMin = Math.min(this.paMin, s.pPA); this.paSum += s.pPA;
    this.pvSum += s.pPV; this.laSum += s.pLA; this.raSum += s.pRA; this.periSum += s.pPeri;
    this.raMin = Math.min(this.raMin, s.pRA);
    this.jvSum += s.pJV; this.jvMin = Math.min(this.jvMin, s.pJV);
    if (s.eLV > 0.05) { this.laV = Math.max(this.laV, s.pLA); this.raV = Math.max(this.raV, s.pRA); this.jvV = Math.max(this.jvV, s.pJV); }
    if (s.eLA > 0.3) { this.laA = Math.max(this.laA, s.pLA); this.raA = Math.max(this.raA, s.pRA); this.jvA = Math.max(this.jvA, s.pJV); }
    const dt = DT;
    if (s.qAV > 0) this.fwdAo += s.qAV * dt; else this.backAo -= s.qAV * dt;
    if (s.qMV > 0) this.fwdMv += s.qMV * dt; else this.backMv -= s.qMV * dt;
    if (s.qTV > 0) this.fwdTv += s.qTV * dt; else this.backTv -= s.qTV * dt;
    if (s.qPV > 0) this.fwdPv += s.qPV * dt;
    this.qPeriph += s.qPeriph * dt;
    this.qPulm += s.qPulm * dt;
    if (s.qAV > 1) {
      const g = s.pLV - s.pAo;
      this.avGradPeak = Math.max(this.avGradPeak, g); this.avGradSum += g; this.avGradN++;
      this.lvotPeak = Math.max(this.lvotPeak, s.lvotGrad);
    }
    if (s.qMV > 1) { this.mvGradSum += s.pLA - s.pLV; this.mvGradN++; }
    const dpdt = (s.pLV - this.prevPLV) / dt;
    if (this.n > 1 && s.eLV > 0) this.dpdtMax = Math.max(this.dpdtMax, dpdt);
    this.prevPLV = s.pLV;
    // valve events
    if (this.mvClose === null && this.prevQMV > 0 && s.qMV <= 0 && s.eLV > 0) { this.mvClose = rel; this.ivcStartV = s.vLV; }
    if (this.mvClose === null && s.eLV > 0.1 && s.qMV <= 0) { this.mvClose = rel; this.ivcStartV = s.vLV; }
    if (this.aoOpen === null && this.prevQAV <= 1 && s.qAV > 1) { this.aoOpen = rel; this.ivcEndV = s.vLV; }
    if (this.aoOpen !== null && this.aoClose === null && this.prevQAV > 0 && s.qAV <= 0) { this.aoClose = rel; this.ivrStartV = s.vLV; }
    if (this.aoClose !== null && this.mvOpen === null && s.qMV > 1) { this.mvOpen = rel; this.ivrEndV = s.vLV; this.earlyPeak = 0; }
    if (this.pvClose === null && this.prevQPV > 0 && s.qPV <= 0 && rel > 80) this.pvClose = rel;
    if (s.mvp && !this.prevMvp) this.click = rel;
    // early diastolic filling: peak E flow and its abrupt deceleration (S3 / pericardial knock)
    if (this.mvOpen !== null && rel < this.mvOpen + 200) {
      this.earlyPeak = Math.max(this.earlyPeak, s.qMV);
      const decel = (this.prevQmvForDecel - s.qMV) / dt;
      if (s.qMV < this.earlyPeak) this.earlyDecel = Math.max(this.earlyDecel, decel);
    }
    this.prevQmvForDecel = s.qMV;
    // S4: LV pressure rise produced by atrial contraction into a stiff ventricle
    if (s.eLA > 0.05 && s.eLV === 0) {
      if (this.lvPreA === 0) this.lvPreA = s.pLV;
      this.atrialLvRise = Math.max(this.atrialLvRise, s.pLV - this.lvPreA);
    } else if (s.eLA === 0) this.lvPreA = 0;
    this.prevQAV = s.qAV; this.prevQMV = s.qMV; this.prevQPV = s.qPV; this.prevMvp = s.mvp;
    // murmurs
    const m = instantMurmurs(s, p);
    for (const k of Object.keys(m) as Array<keyof Murmurs>) {
      if (m[k] > this.murPeak[k]) { this.murPeak[k] = m[k]; this.murPeakT[k] = rel; }
      this.murEnergy[k] += m[k] * DT * 10; // per 100 ms
      if (m[k] > 0.3) {
        if (this.murOn[k] === undefined) this.murOn[k] = rel;
        this.murDur[k] = rel - (this.murOn[k] ?? rel);
      }
    }
    void c;
    return false;
  }

  finish(index: number, p: HemoParams): BeatSummary | null {
    if (!this.started || this.n < 50) return null;
    const dur = this.n * DT;
    const hr = 60 / dur;
    const co = (this.qPeriph / dur) * 60 / 1000; // L/min systemic flow
    const qp = (this.qPulm / dur) * 60 / 1000;
    const map = this.aoSum / this.n;
    const cvp = this.raSum / this.n;
    const pcwp = this.pvSum / this.n;
    const paMean = this.paSum / this.n;
    const edv = this.vMax, esv = this.vMin;
    const sv = this.fwdAo;
    const svNet = sv - this.backAo;
    // Fick: SvO2 = SaO2 − VO2 / (CO · Hb · 1.34 · 10)
    const vo2 = p.vo2 * (1 - p.extractionDefect);
    const svo2 = clamp(p.sao2 - vo2 / (Math.max(0.3, co) * p.hb * 13.4), 0.05, 0.95);
    const s1 = this.mvClose;
    const a2 = this.aoClose;
    const p2 = this.pvClose;
    const decelNorm = this.earlyDecel / 1000; // mL/s per ms
    return {
      index, tStart: this.t0, tEnd: this.t0 + dur, insp: this.insp, hr,
      edv, esv, sv, svNet, ef: (edv - esv) / Math.max(1, edv),
      rvEdv: this.rvMax, rvEsv: this.rvMin,
      co, qp, qs: co, qpqs: qp / Math.max(0.05, co),
      sbp: this.aoMax, dbp: this.aoMin, map, pp: this.aoMax - this.aoMin,
      lvSys: this.lvMax, lvEdp: this.lvEdp, lvMin: this.lvMin,
      rvSys: this.rvSysP, rvEdp: this.rvEdp,
      paSys: this.paMax, paDia: this.paMin, paMean,
      pcwp, laMean: this.laSum / this.n, laV: this.laV, laA: this.laA,
      cvp, raA: this.raA, raV: this.raV, raMin: this.raMin,
      jvp: this.jvSum / this.n, jvA: this.jvA, jvV: this.jvV, jvMin: this.jvMin,
      svr: (80 * (map - cvp)) / Math.max(0.1, co),
      pvr: (80 * (paMean - pcwp)) / Math.max(0.1, qp),
      avGradPeak: this.avGradPeak, avGradMean: this.avGradN ? this.avGradSum / this.avGradN : 0,
      mvGradMean: this.mvGradN ? this.mvGradSum / this.mvGradN : 0,
      lvotPeak: this.lvotPeak,
      arFraction: this.backAo / Math.max(1, this.fwdAo),
      mrFraction: this.backMv / Math.max(1, this.backMv + this.fwdAo),
      trFraction: this.backTv / Math.max(1, this.backTv + this.fwdPv),
      svo2,
      dpdtMax: this.dpdtMax,
      upstrokeMs: this.aoOpen !== null ? this.peakAoT - this.aoOpen : 0,
      ivcVolumeChange: this.aoOpen !== null ? this.ivcEndV - this.ivcStartV : 0,
      ivrVolumeChange: this.mvOpen !== null ? this.ivrEndV - this.ivrStartV : 0,
      pPeriMean: this.periSum / this.n,
      sounds: {
        s1, a2, p2, split: a2 !== null && p2 !== null ? p2 - a2 : null,
        mvOpen: this.mvOpen, os: this.mvOpen !== null && a2 !== null ? this.mvOpen - a2 : null,
        click: this.click !== null && s1 !== null ? this.click - s1 : null,
        s3: decelNorm,
        s4: p.atrialKick > 0 ? this.atrialLvRise : 0,
        knock: p.pericardialStiffness > 1.5 ? decelNorm : 0,
      },
      murmurs: this.murEnergy,
      murmurPeak: this.murPeak,
      murmurPeakMs: this.murPeakT,
      murmurDurationMs: this.murDur,
      ejectionStartMs: this.aoOpen, ejectionEndMs: this.aoClose,
    };
  }
}

export function averageBeats(beats: BeatSummary[]): BeatSummary {
  if (!beats.length) throw new Error('no beats');
  const out = JSON.parse(JSON.stringify(beats[beats.length - 1])) as BeatSummary;
  const numKeys = Object.keys(out).filter((k) => typeof (out as unknown as Record<string, unknown>)[k] === 'number') as Array<keyof BeatSummary>;
  for (const k of numKeys) {
    if (k === 'index') continue;
    (out as unknown as Record<string, number>)[k] = beats.reduce((a, b) => a + (b[k] as number), 0) / beats.length;
  }
  for (const k of Object.keys(out.murmurs) as Array<keyof Murmurs>) {
    out.murmurs[k] = beats.reduce((a, b) => a + b.murmurs[k], 0) / beats.length;
    out.murmurPeak[k] = beats.reduce((a, b) => a + b.murmurPeak[k], 0) / beats.length;
  }
  return out;
}

/** Convenience: steady-state summary for a parameter set. */
export function steadyState(p: HemoParams, seconds = 30, lastBeats = 8, seed = 1) {
  const sim = new HemoSimulator(p, { sampleEvery: 8, maxSamples: 4000, seed });
  const summary = sim.steady(seconds, lastBeats);
  return { sim, summary };
}

/**
 * Lumped-parameter model of the circulation.
 *
 *   systemic veins ─R─▶ RA ─TV─▶ RV ─PV─▶ PA (Windkessel) ─PVR─▶ pulmonary veins ─R─▶ LA ─MV─▶ LV ─AV─▶ aorta (Windkessel) ─SVR─▶ systemic veins
 *
 * • Chambers use TIME-VARYING ELASTANCE: P = e(t)·Ees·(V − V0) + (1 − e(t))·A·(e^{B(V−V0)} − 1)
 *   e(t) rises 0→1 during systole (end-systolic pressure–volume relation, ESPVR = contractility) and
 *   falls back in diastole, where the exponential end-diastolic relation (EDPVR = stiffness) applies.
 * • Valves are orifices: Bernoulli ΔP = 4v² (v = Q/A) plus a small linear resistance. Forward flow uses
 *   the valve area, backward flow the regurgitant orifice area (0 for a competent valve).
 * • All cardiac chambers sit in the pericardium: P_peri = K(e^{(Vheart + Veffusion − V0)/Vp} − 1),
 *   which couples the ventricles (interdependence) and produces tamponade/constriction physiology.
 * • Intrathoracic pressure swings with respiration and is added to every intrathoracic compartment.
 * • Shunts (ASD, VSD, PDA) are bidirectional orifices; dynamic LVOT obstruction (HOCM) narrows the
 *   outflow as the LV cavity empties.
 * Integration: fixed-step RK4 (0.5 ms). Contraction timing comes from the rhythm engine.
 */
import type { HemoParams } from '../../data/types';
import { clamp } from '../math';
import { UNSTRESSED } from './params';

export const DT = 0.0005; // s

// state indices
export const LA = 0, LV = 1, RA = 2, RV = 3, SA = 4, SV = 5, PA = 6, PV = 7;
/** Venous return flow (mL/s) – a flow state because blood in the great veins has inertia. */
export const QVR = 8;
/** Intrathoracic great veins (SVC/IVC) – outside the pericardium, exposed to intrathoracic pressure. */
export const TV = 9;
/** Forward (inertial) mitral and tricuspid flows (mL/s). */
export const QM = 10, QT = 11;
/** (reserved state slot) */
export const QC = 12;
export const NSTATE = 13;
/** Inertance of the AV-valve inflow tracts (mmHg·s²/mL). */
const L_AV_VALVE = 0.00025;
const TV_UNSTRESSED = 140;
const TV_COMPLIANCE = 6;
const R_CAVAL = 0.006;
/** Inertance of the great veins (mmHg·s²/mL). */
const L_VENOUS = 0.008;

export interface MechEvent {
  t: number; // s
  kind: 'atrial' | 'ventricular';
  /** Contraction strength 0..1 (0 = PEA / no mechanical activity). */
  strength: number;
  /** Preceding RR (s) – sets systolic duration. */
  rr: number;
  /** End-diastolic volumes captured at onset (load-dependent ejection time). */
  edvL?: number;
  edvR?: number;
  inspAtOnset?: number;
}

export interface Instant {
  t: number;
  pLA: number; pLV: number; pRA: number; pRV: number;
  pAo: number; pSA: number; pPA: number; pPV: number; pSV: number;
  pPeri: number; pTh: number; pJV: number;
  vLA: number; vLV: number; vRA: number; vRV: number;
  qMV: number; qAV: number; qTV: number; qPV: number; // + forward, − regurgitant
  qPeriph: number; qPulm: number; qVenRet: number;
  qASD: number; qVSD: number; qPDA: number; // + left→right
  lvotGrad: number; // LV − aortic root pressure (only when ejecting)
  eLV: number; eLA: number;
  mvp: boolean;
  iabp: number;
}

/** Resistance to venous return (Guyton ≈ 1.4 mmHg per L/min). */
export const R_VENOUS_RETURN = 0.08;
const BERNOULLI_K = 1 / 2500; // ΔP(mmHg) = Q²/(2500·A²) with Q in mL/s, A in cm²
const R_VALVE = 0.0025;

/** Flow through an orifice for pressure drop dp (positive forward). */
export function orificeFlow(dp: number, aFwd: number, aBack: number, rLin = R_VALVE): number {
  const a = dp >= 0 ? aFwd : aBack;
  if (a <= 1e-4) return 0;
  const k = BERNOULLI_K / (a * a);
  const adp = Math.abs(dp);
  const q = (-rLin + Math.sqrt(rLin * rLin + 4 * k * adp)) / (2 * k);
  return dp >= 0 ? q : -q;
}

/**
 * Atrioventricular valve with inertial forward flow. Forward: L·dQ/dt = ΔP − Bernoulli(Q) − R·Q.
 * When forward flow has stopped and the pressure gradient is reversed the valve is closed; any
 * regurgitation then follows the (algebraic) orifice equation of the regurgitant area.
 */
function inflowValve(qState: number, dp: number, aFwd: number, aBack: number) {
  if (qState > 0 || dp > 0) {
    const k = BERNOULLI_K / (aFwd * aFwd);
    const dq = (dp - k * qState * qState - R_VALVE * qState) / L_AV_VALVE;
    return { q: Math.max(0, qState), dq: qState <= 0 && dq < 0 ? 0 : dq };
  }
  return { q: orificeFlow(dp, 0, aBack), dq: 0 };
}

/** Ventricular activation (0..1) τ seconds after onset for a beat with systolic duration ts. */
function ventricularActivation(tau: number, ts: number) {
  if (tau < 0) return 0;
  const t1 = 0.68 * ts; // time to peak (≈ end-ejection)
  if (tau < t1) return 0.5 * (1 - Math.cos((Math.PI * tau) / t1));
  const t2 = ts;
  if (tau < t2) return 0.5 * (1 + Math.cos((Math.PI * (tau - t1)) / (t2 - t1)));
  return 0;
}
function atrialActivation(tau: number) {
  const ta = 0.12;
  if (tau < 0 || tau > ta) return 0;
  return Math.sin((Math.PI * tau) / ta) ** 2;
}

export class Circulation {
  p: HemoParams;
  y = new Float64Array(NSTATE);
  t = 0;
  events: MechEvent[] = [];
  /** Last onsets (for activation). */
  private lastV: MechEvent[] = [];
  private lastA: MechEvent[] = [];
  private beatCounter = 0;
  /** MVP: prolapse latched within the current systole. */
  private mvpLatched = false;
  /** IABP: inflation state based on valve events. */
  private iabpPhase = 0;
  private aoClosedAt = -1;
  /** Running pulmonary/systemic flow ratio (for pulmonary vascular reserve). */
  qpQsEma = 1;
  private qpEma = 85;
  private qsEma = 85;

  constructor(p: HemoParams) {
    this.p = p;
    this.initVolumes();
  }

  setParams(p: HemoParams) {
    // keep volumes; rescale total volume if it changed (fluids/diuretics)
    const dv = p.totalVolume - this.p.totalVolume;
    this.p = p;
    if (Math.abs(dv) > 1) {
      // distribute the change mostly into the systemic veins
      this.y[SV] += dv * 0.83;
      this.y[TV] += dv * 0.02;
      this.y[PV] += dv * 0.08;
      this.y[SA] += dv * 0.07;
    }
  }

  unstressed() {
    const f = this.p.unstressedFraction;
    return { sa: UNSTRESSED.sa, sv: UNSTRESSED.sv * f, pa: UNSTRESSED.pa, pv: UNSTRESSED.pv };
  }

  initVolumes() {
    const u = this.unstressed();
    const y = this.y;
    y[LA] = 55; y[LV] = 120; y[RA] = 60; y[RV] = 130;
    y[SA] = u.sa + 95 * this.p.sysC;
    y[PA] = u.pa + 15 * this.p.pulC;
    y[PV] = u.pv + 8 * this.p.pulVenC;
    const used = y[LA] + y[LV] + y[RA] + y[RV] + y[SA] + y[PA] + y[PV];
    y[TV] = TV_UNSTRESSED + 4 * TV_COMPLIANCE;
    y[SV] = this.p.totalVolume - used - y[TV];
    y[QVR] = 85;
    y[QC] = 85;
  }

  /** Total volume currently in the model (conserved). */
  volume() {
    let s = 0;
    for (let i = 0; i < QM; i++) if (i !== QVR) s += this.y[i];
    return s;
  }

  addEvent(e: MechEvent) {
    this.events.push(e);
  }

  intrathoracic(t: number) {
    const p = this.p;
    const T = 60 / Math.max(1, p.respRate);
    // inspiration: intrathoracic pressure falls from −3 to −3−depth
    const insp = 0.5 * (1 - Math.cos((2 * Math.PI * t) / T));
    return { pTh: -3 - p.respDepth * insp + p.intrathoracicBias, insp, pAbd: p.abdominalPressure + 5.5 * insp * (p.respDepth / 4) };
  }

  /** Respiratory phase 0..1 (1 = peak inspiration). */
  inspiration(t: number) {
    return this.intrathoracic(t).insp;
  }

  private activations(t: number) {
    let eL = 0, eR = 0, eA = 0;
    const p = this.p;
    for (const v of this.lastV) {
      const ts = clamp(0.33 * Math.sqrt(clamp(v.rr, 0.25, 2)), 0.2, 0.45);
      const delayL = p.vvDelay < 0 ? -p.vvDelay / 1000 : 0;
      const delayR = p.vvDelay > 0 ? p.vvDelay / 1000 : 0;
      const k = v.strength;
      // ejection lasts longer when the ventricle starts larger (load-dependent ejection time):
      // the basis of physiological S2 splitting (inspiration: RV bigger → P2 later; LV smaller → A2 earlier)
      const fL = clamp(Math.pow((v.edvL ?? 120) / 120, 0.45), 0.8, 1.25);
      // pulmonary "hang-out": on inspiration the expanded pulmonary bed lowers RV afterload and
      // prolongs RV ejection. The effect disappears when the bed is already maximally recruited
      // (high pulmonary flow, e.g. a large ASD) – one reason the ASD split is fixed.
      const reserve = clamp(1.7 - this.qpQsEma, 0, 1);
      const hang = 1 + 0.11 * (v.inspAtOnset ?? 0) * reserve;
      const fR = clamp(Math.pow((v.edvR ?? 130) / 130, 0.5) * hang, 0.8, 1.4);
      eL = Math.max(eL, k * ventricularActivation(t - v.t - delayL, ts * fL));
      eR = Math.max(eR, k * ventricularActivation(t - v.t - delayR, ts * fR));
    }
    for (const a of this.lastA) eA = Math.max(eA, a.strength * atrialActivation(t - a.t));
    return { eL, eR, eA: eA * p.atrialKick };
  }

  /** Pressures and flows for state y at time t. */
  evaluate(y: Float64Array, t: number): Instant {
    const p = this.p;
    const { eL, eR, eA } = this.activations(t);
    const { pTh, pAbd, insp } = this.intrathoracic(t);
    const u = this.unstressed();
    // inspiration expands the pulmonary vascular bed: ↓ impedance → RV ejection lasts longer (P2 later)
    const pulFactor = 1 - 0.35 * insp * Math.min(1, p.respDepth / 4);

    // pericardium
    const constr = Math.max(0, p.pericardialStiffness - 1);
    const vHeart = y[LA] + y[LV] + y[RA] + y[RV];
    const v0p = 470 - 30 * Math.min(constr, 3);
    const vp = 48 / Math.max(1, 1 + constr * 1.4);
    const pPeri = 0.6 * (Math.exp(clamp((vHeart + p.effusion - v0p) / vp, -20, 12)) - 1);
    // a rigid (constrictive) pericardium shields the heart from intrathoracic swings
    const thToHeart = pTh * (1 / (1 + constr * 10));
    const ext = pPeri + thToHeart;

    const chamber = (v: number, e: number, ees: number, v0: number, a: number, b: number) =>
      e * ees * (v - v0) + (1 - e) * a * (Math.exp(clamp(b * (v - v0), -10, 12)) - 1);

    const pLV = chamber(y[LV], eL, p.lvEes, p.lvV0, p.lvEdA, p.lvEdB) + ext;
    const pRV = chamber(y[RV], eR, p.rvEes, p.rvV0, p.rvEdA, p.rvEdB) + ext;
    const pLA = chamber(y[LA], eA, p.laEes, p.laV0, p.laEdA, p.laEdB) + ext;
    const pRA = chamber(y[RA], eA, p.raEes, p.raV0, p.raEdA, p.raEdB) + ext;

    // IABP volume (inflates in diastole)
    const iabpV = p.iabp ? 40 * this.iabpPhase : 0;
    const pSA = (y[SA] + iabpV - u.sa) / p.sysC;
    const pPA = (y[PA] - u.pa) / (p.pulC / pulFactor) + pTh;
    const pPV = (y[PV] - u.pv) / p.pulVenC + pTh;
    const pSV = (y[SV] - u.sv) / p.sysVenC + pAbd;

    // valves
    // mitral: inertial forward flow; regurgitant jets are resistance-dominated (algebraic)
    const mrA = p.mrArea + (this.mvpLatched ? 0.09 * p.mvp : 0);
    const mv = inflowValve(y[QM], pLA - pLV, p.mvArea, mrA);
    const qMV = mv.q;
    // dynamic LVOT obstruction (HOCM): systolic anterior motion grows as the cavity empties
    let avEff = p.avArea;
    if (p.hocm > 0) {
      // outflow area shrinks smoothly as the cavity gets smaller (septum–mitral leaflet contact)
      const open = 1 / (1 + Math.exp(-(y[LV] - 68) / 7));
      const obstructed = 0.15 + (p.avArea - 0.15) * open;
      const active = Math.min(1, eL * 2);
      avEff = p.avArea + (obstructed - p.avArea) * p.hocm * active;
    }
    const qAVraw = orificeFlow(pLV - pSA, avEff, p.arArea, R_VALVE + p.aoZ);
    const pAo = pSA + p.aoZ * qAVraw;
    const tv = inflowValve(y[QT], pRA - pRV, p.tvArea, p.trArea);
    const qTV = tv.q;
    const qPV = orificeFlow(pRV - pPA, p.pvArea, p.prArea, R_VALVE + p.paZ * pulFactor);
    const qPeriph = (pSA - (pSV - pAbd + pAbd)) / p.sysR; // to systemic veins
    const qPulm = (pPA - pPV) / (p.pulR * pulFactor);
    // great veins: systemic veins → (inertial flow) → intrathoracic cavae → RA
    const pTV = (y[TV] - TV_UNSTRESSED) / TV_COMPLIANCE + pTh;
    const qVenRet = y[QVR];
    const dQvr = (pSV - pTV - R_VENOUS_RETURN * y[QVR]) / L_VENOUS;
    const qCaval = (pTV - pRA) / R_CAVAL;
    const dQc = 0;
    const qPvLa = (pPV - pLA) / 0.006;
    // shunts (positive = left → right)
    const qASD = orificeFlow(pLA - pRA, p.asdArea, p.asdArea, 0.004);
    const qVSD = orificeFlow(pLV - pRV, p.vsdArea, p.vsdArea, 0.004);
    const qPDA = orificeFlow(pAo - pPA, p.pdaArea, p.pdaArea, 0.02);

    return {
      t, pLA, pLV, pRA, pRV, pAo, pSA, pPA, pPV, pSV, pPeri, pTh, pJV: pTV,
      vLA: y[LA], vLV: y[LV], vRA: y[RA], vRV: y[RV],
      qMV, qAV: qAVraw, qTV, qPV, qPeriph, qPulm, qVenRet,
      qASD, qVSD, qPDA,
      lvotGrad: qAVraw > 0 ? pLV - pAo : 0,
      eLV: eL, eLA: eA,
      mvp: this.mvpLatched,
      iabp: iabpV,
      // internal
      ...({ qPvLa, dQvr, qCaval, dQc, dQm: mv.dq, dQt: tv.dq } as object),
    } as Instant & { qPvLa: number; dQvr: number; qCaval: number; dQc: number; dQm: number; dQt: number };
  }

  private deriv(y: Float64Array, t: number, out: Float64Array) {
    const s = this.evaluate(y, t) as Instant & { qPvLa: number; dQvr: number; qCaval: number; dQc: number; dQm: number; dQt: number };
    out[LA] = s.qPvLa - s.qMV - s.qASD;
    out[LV] = s.qMV - s.qAV - s.qVSD;
    out[RA] = s.qCaval - s.qTV + s.qASD;
    out[TV] = s.qVenRet - s.qCaval;
    out[QM] = s.dQm;
    out[QT] = s.dQt;
    out[QC] = s.dQc;
    out[RV] = s.qTV - s.qPV + s.qVSD;
    out[SA] = s.qAV - s.qPeriph - s.qPDA;
    out[SV] = s.qPeriph - s.qVenRet;
    out[PA] = s.qPV - s.qPulm + s.qPDA;
    out[PV] = s.qPulm - s.qPvLa;
    out[QVR] = s.dQvr;
  }

  private k1 = new Float64Array(NSTATE);
  private k2 = new Float64Array(NSTATE);
  private k3 = new Float64Array(NSTATE);
  private k4 = new Float64Array(NSTATE);
  private tmp = new Float64Array(NSTATE);

  /** Advance one RK4 step; returns the instantaneous state at the start of the step. */
  step(): Instant {
    const t = this.t;
    // bring due mechanical events into the active lists
    while (this.events.length && this.events[0].t <= t) {
      const e = this.events.shift()!;
      if (e.kind === 'ventricular') {
        e.edvL = this.y[LV];
        e.edvR = this.y[RV];
        e.inspAtOnset = this.intrathoracic(t).insp * Math.min(1, this.p.respDepth / 4);
        this.lastV.push(e);
        if (this.lastV.length > 2) this.lastV.shift();
        this.beatCounter++;
        // pulsus alternans: alternate beats weaker
        if (this.p.pulsusAlternans > 0 && this.beatCounter % 2 === 0) e.strength *= 1 - this.p.pulsusAlternans;
        this.mvpLatched = false;
        if (this.p.iabp) this.iabpPhase = 0;
      } else {
        this.lastA.push(e);
        if (this.lastA.length > 2) this.lastA.shift();
      }
    }
    const y = this.y;
    const s0 = this.evaluate(y, t);
    // MVP: once the LV has emptied below the prolapse volume during systole, the leaflet buckles (click)
    if (this.p.mvp > 0 && s0.eLV > 0.3 && y[LV] < 105 && !this.mvpLatched) this.mvpLatched = true;
    // IABP timing: inflate at aortic valve closure (dicrotic notch), deflate before systole
    if (this.p.iabp) {
      if (s0.qAV <= 0 && s0.eLV < 0.6 && s0.eLV > 0 && this.aoClosedAt < 0) this.aoClosedAt = t;
      if (s0.eLV === 0 || this.aoClosedAt > 0) this.iabpPhase = Math.min(1, this.iabpPhase + DT / 0.06);
      if (s0.eLV > 0.02 && s0.qAV > 0) { this.iabpPhase = Math.max(0, this.iabpPhase - DT / 0.03); this.aoClosedAt = -1; }
    }
    this.qpEma += (s0.qPulm - this.qpEma) * 0.0005;
    this.qsEma += (s0.qPeriph - this.qsEma) * 0.0005;
    this.qpQsEma = this.qpEma / Math.max(1, this.qsEma);
    const h = DT;
    this.deriv(y, t, this.k1);
    for (let i = 0; i < NSTATE; i++) this.tmp[i] = y[i] + 0.5 * h * this.k1[i];
    this.deriv(this.tmp, t + 0.5 * h, this.k2);
    for (let i = 0; i < NSTATE; i++) this.tmp[i] = y[i] + 0.5 * h * this.k2[i];
    this.deriv(this.tmp, t + 0.5 * h, this.k3);
    for (let i = 0; i < NSTATE; i++) this.tmp[i] = y[i] + h * this.k3[i];
    this.deriv(this.tmp, t + h, this.k4);
    for (let i = 0; i < NSTATE; i++) y[i] += (h / 6) * (this.k1[i] + 2 * this.k2[i] + 2 * this.k3[i] + this.k4[i]);
    for (let i = 0; i < QM; i++) if (i !== QVR && y[i] < 1) y[i] = 1;
    if (y[QM] < 0) y[QM] = 0;
    if (y[QT] < 0) y[QT] = 0;
    this.t = t + h;
    return s0;
  }
}

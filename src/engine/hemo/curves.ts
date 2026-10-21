/**
 * Analytic curves drawn alongside the simulation (also used by the Equations lab).
 *
 *  ESPVR  P = Ees·(V − V0)                         end-systolic pressure–volume relation
 *  EDPVR  P = A·(e^{B·(V − V0)} − 1)                end-diastolic (passive) relation
 *  Ea     = R_sys / T  (T = 60/HR)                  effective arterial elastance (Sunagawa)
 *  SV     = Ees·(EDV − V0) / (Ees + Ea)             ventricular–arterial coupling
 *  VR     = (Pmsf − Pra) / Rvr                       Guyton venous return (plateau when Pra < 0)
 */
import type { HemoParams } from '../../data/types';
import { R_VENOUS_RETURN } from './model';

export const espvr = (v: number, p: HemoParams) => p.lvEes * (v - p.lvV0);
export const edpvr = (v: number, p: HemoParams) => p.lvEdA * (Math.exp(p.lvEdB * (v - p.lvV0)) - 1);
/** Volume at which the passive LV reaches pressure `edp`. */
export const edvFromEdp = (edp: number, p: HemoParams) => p.lvV0 + Math.log(Math.max(1e-6, edp / p.lvEdA + 1)) / p.lvEdB;
export const arterialElastance = (p: HemoParams) => p.sysR / (60 / p.hr);
export const strokeVolumeCoupled = (edv: number, p: HemoParams) => (p.lvEes * Math.max(0, edv - p.lvV0)) / (p.lvEes + arterialElastance(p));

/** Frank–Starling curve: stroke volume (mL) vs LV end-diastolic pressure (mmHg). */
export function starlingCurve(p: HemoParams, edpMax = 35, n = 60) {
  const x: number[] = [], y: number[] = [];
  for (let i = 0; i <= n; i++) {
    const edp = 0.2 + (edpMax * i) / n;
    x.push(edp);
    y.push(strokeVolumeCoupled(edvFromEdp(edp, p), p));
  }
  return { x, y };
}

/** Venous-return resistance in mmHg per L/min. */
export const RVR_MIN = (R_VENOUS_RETURN * 1000) / 60;

/**
 * Guyton diagram anchored on the simulated operating point (CVP, CO):
 *  - venous return line through the point with slope −1/Rvr, flat below Pra = 0;
 *  - cardiac function curve from the coupling formula with LVEDP = Pra + (current LVEDP − CVP),
 *    scaled to pass through the simulated point.
 */
export function guytonCurves(p: HemoParams, cvp: number, co: number, lvEdp: number) {
  const pmsf = cvp + co * RVR_MIN;
  const offset = lvEdp - cvp;
  const raw = (pra: number) => (p.hr * strokeVolumeCoupled(edvFromEdp(Math.max(0.2, pra + offset), p), p)) / 1000;
  const k = co / Math.max(0.1, raw(cvp));
  const xs: number[] = [];
  for (let pra = -4; pra <= 20; pra += 0.25) xs.push(pra);
  return {
    pmsf,
    venous: { x: xs.filter((x) => x <= pmsf), y: xs.filter((x) => x <= pmsf).map((x) => (pmsf - Math.max(0, x)) / RVR_MIN) },
    cardiac: { x: xs, y: xs.map((x) => Math.max(0, raw(x) * k)) },
  };
}

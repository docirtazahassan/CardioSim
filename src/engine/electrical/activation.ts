/**
 * Ventricular activation sequence.
 *
 * The heart is a graph of regions. Activation starts at the Purkinje entry points of intact
 * fascicles (fast, endocardium → epicardium, dipole along the outward normal) or at an ectopic /
 * pre-excitation site. Regions not reached by the Purkinje system are activated by slow
 * cell-to-cell spread from neighbours (Dijkstra shortest arrival time). Slow spread produces
 * longer-lasting dipoles oriented along the direction of propagation → wide, slurred QRS.
 */
import type { VentricularRegionId } from '../../data/types';
import { add, dist, dot, norm, scale, sub, type V3 } from '../math';
import { NEIGHBOURS, REGION_INDEX, VENTRICULAR_REGIONS, type Fascicle } from './geometry';

const VENTRICLE_CENTRE: V3 = (() => {
  let c: V3 = [0, 0, 0];
  for (const r of VENTRICULAR_REGIONS) c = add(c, scale(r.pos, 1 / VENTRICULAR_REGIONS.length));
  return c;
})();

export type VentricularPattern =
  | { kind: 'normal' }
  | { kind: 'ectopic'; origin: VentricularRegionId }
  | { kind: 'preexcited'; pathway: 'left-lateral' | 'posteroseptal' | 'right-free-wall'; leadMs: number }
  | { kind: 'aberrant'; block: 'rbbb' | 'lbbb' };

export interface ConductionState {
  rbbb: boolean;
  lbbb: boolean;
  lafb: boolean;
  lpfb: boolean;
  /** 1 = normal; >1 slows both Purkinje and muscle conduction (hyperkalemia, class Ic, ischemia). */
  slowing: number;
}

export const NORMAL_CONDUCTION: ConductionState = { rbbb: false, lbbb: false, lafb: false, lpfb: false, slowing: 1 };

export interface RegionActivation {
  t: number; // activation onset (ms from QRS onset)
  transit: number; // duration of the region's depolarisation dipole (ms)
  dir: V3; // unit direction of the depolarisation dipole
  /**
   * Time-integral (area) of the region's dipole, normalised so a normally (Purkinje) activated
   * region = its outward normal. Physically the QRS area is ∝ ∫∇t_act dV (activation-time
   * gradient): a transmural part (endo → epi) plus a tangential part from early to late tissue.
   */
  area: V3;
  viaPurkinje: boolean;
  side: 1 | -1;
  /**
   * Septal segments are modelled as two halves (LV side and RV side). Normally both are entered
   * by Purkinje fibres almost together (LV side first) so their opposite forces largely cancel,
   * leaving the small initial left→right septal vector. With a bundle branch block, one half is
   * reached late by slow trans-septal conduction → large, late, unopposed forces.
   */
  halves?: Array<{ t: number; transit: number; area: V3 }>; // for septal regions: +1 activated from LV side, -1 from RV side
}

export interface ActivationResult {
  regions: RegionActivation[];
  qrsDuration: number;
  /** For pre-excitation: time (ms) by which ventricular activation precedes the normal sequence. */
  preexcitationMs: number;
}

/** Cell-to-cell conduction velocity in working myocardium (cm/ms). ≈0.5–0.6 m/s */
const V_MUSCLE = 0.055;
/** Velocity of spread through the (intact) Purkinje network around a blocked fascicle. */
const V_PURKINJE_NET = 0.09;

const PATHWAY_INSERTION: Record<string, VentricularRegionId> = {
  'left-lateral': 'seg5',
  posteroseptal: 'seg3',
  'right-free-wall': 'rvLat',
};

function fascicleIntact(f: Fascicle, c: ConductionState): boolean {
  switch (f) {
    case 'septal': return !c.lbbb;
    case 'laf': return !c.lbbb && !c.lafb;
    case 'lpf': return !c.lbbb && !c.lpfb;
    case 'apex': return !c.lbbb && !(c.lafb && c.lpfb);
    case 'rbb': return !c.rbbb;
  }
}

export function computeActivation(pattern: VentricularPattern, cond: ConductionState): ActivationResult {
  const regs = VENTRICULAR_REGIONS;
  const n = regs.length;
  const s = Math.max(0.5, cond.slowing);
  const c: ConductionState = { ...cond };
  if (pattern.kind === 'aberrant') {
    if (pattern.block === 'rbbb') c.rbbb = true;
    else c.lbbb = true;
  }
  const act: RegionActivation[] = regs.map((r) => ({ t: Infinity, transit: r.transit * s, dir: r.n, area: r.n, viaPurkinje: false, side: 1 }));

  const usePurkinje = pattern.kind !== 'ectopic';
  /** Regions whose own fascicle delivers the impulse (their timing must not be pre-empted by network spread). */
  const ownEntry = new Array(n).fill(false);
  if (usePurkinje) {
    regs.forEach((r, i) => {
      if (r.chamber === 'LV') {
        const ok = r.fascicles.filter((f) => f !== 'rbb').some((f) => fascicleIntact(f, c));
        if (ok) {
          act[i] = { t: r.purkinjeTime * s, transit: r.transit * s, dir: r.n, area: r.n, viaPurkinje: true, side: 1 };
          ownEntry[i] = true;
        }
        // septum can also be entered from the RV side by the right bundle
        if (r.isSeptal && !c.rbbb) {
          const tR = (r.purkinjeTime + 8) * s;
          if (tR < act[i].t) act[i] = { t: tR, transit: r.transit * s, dir: scale(r.n, -1), area: r.n, viaPurkinje: true, side: -1 };
        }
      } else if (fascicleIntact('rbb', c)) {
        act[i] = { t: r.purkinjeTime * s, transit: r.transit * s, dir: r.n, area: r.n, viaPurkinje: true, side: 1 };
        ownEntry[i] = true;
      }
    });
    // In LBBB the septum is entered from the right side a little later than normal septal activation.
    if (c.lbbb && !c.rbbb) {
      regs.forEach((r, i) => {
        if (r.isSeptal) act[i].t = (r.purkinjeTime * 0.5 + 10) * s;
      });
    }
    // septal halves
    regs.forEach((r, i) => {
      if (!r.isSeptal) return;
      const lvIntact = r.fascicles.filter((f) => f !== 'rbb').some((f) => fascicleIntact(f, c));
      // LV side: own fascicle, or (fascicular block) late via the Purkinje network, or not at all (LBBB)
      const tL = lvIntact ? r.purkinjeTime * s : !c.lbbb ? (r.purkinjeTime + 26) * s : Infinity;
      const tR = !c.rbbb ? (c.lbbb ? r.purkinjeTime * 0.5 + 10 : r.purkinjeTime + 8) * s : Infinity;
      const tr = r.transit * s;
      const slow = 46 * s;
      const half = (k: number) => scale(r.n, 0.42 * k);
      if (isFinite(tL) && isFinite(tR)) {
        act[i].t = Math.min(tL, tR);
        act[i].halves = [{ t: tL, transit: tr, area: half(1) }, { t: tR, transit: tr, area: half(-1) }];
      } else if (isFinite(tL)) {
        act[i].halves = [{ t: tL, transit: tr, area: half(0.8) }, { t: tL + tr * 0.8, transit: slow, area: half(2.2) }];
      } else if (isFinite(tR)) {
        act[i].halves = [{ t: tR, transit: tr, area: half(-1) }, { t: tR + tr * 0.7, transit: slow, area: half(-1.8) }];
      }
    });
  }

  let preMs = 0;
  let originIdx = -1;
  if (pattern.kind === 'ectopic') {
    originIdx = REGION_INDEX[pattern.origin];
    const i = REGION_INDEX[pattern.origin];
    act[i] = { t: 0, transit: regs[i].transit * 1.6 * s, dir: regs[i].n, area: regs[i].n, viaPurkinje: false, side: 1 };
  }
  if (pattern.kind === 'preexcited') {
    const i = REGION_INDEX[PATHWAY_INSERTION[pattern.pathway]];
    originIdx = i;
    preMs = pattern.leadMs;
    act[i] = { t: -pattern.leadMs, transit: regs[i].transit * 1.8 * s, dir: regs[i].n, area: regs[i].n, viaPurkinje: false, side: 1 };
  }

  // Dijkstra over the region graph.
  const done = new Array(n).fill(false);
  const parent: number[] = new Array(n).fill(-1);
  for (let iter = 0; iter < n; iter++) {
    let u = -1;
    let best = Infinity;
    for (let i = 0; i < n; i++) if (!done[i] && act[i].t < best) { best = act[i].t; u = i; }
    if (u < 0) break;
    done[u] = true;
    for (const v of NEIGHBOURS[u]) {
      if (done[v]) continue;
      const ru = regs[u], rv = regs[v];
      const d = dist(ru.pos, rv.pos);
      // Purkinje network can bridge a blocked fascicle within an LV whose main bundle is intact.
      const purkNet = ru.chamber === 'LV' && rv.chamber === 'LV' && !c.lbbb && pattern.kind !== 'ectopic' && act[u].viaPurkinje;
      if (purkNet && ownEntry[v]) continue;
      const vel = (purkNet ? V_PURKINJE_NET : V_MUSCLE) / s;
      let tArr = act[u].t + d / vel;
      // A region whose fascicle is blocked is always reached later than its normal time.
      // (the posterior fascicle is short and broad, so its territory is reached sooner).
      if (purkNet) tArr = Math.max(tArr, (rv.purkinjeTime + (c.lafb && rv.fascicles.includes('laf') ? 26 : 12)) * s);
      if (tArr < act[v].t) {
        parent[v] = u;
        if (purkNet) {
          act[v] = { t: tArr, transit: rv.transit * s, dir: rv.n, area: rv.n, viaPurkinje: true, side: 1 };
        } else {
          // side for septal targets
          let side: 1 | -1 = 1;
          if (rv.isSeptal) side = ru.chamber === 'RV' ? -1 : ru.isSeptal ? act[u].side : 1;
          const prop = norm(sub(rv.pos, ru.pos));
          const dir = norm(add(scale(rv.n, 0.7 * side), prop));
          const muscleTransit = Math.max(rv.transit * 1.6, 44) * s;
          act[v] = { t: tArr, transit: muscleTransit, dir, area: rv.n, viaPurkinje: false, side };
        }
      }
    }
  }

  // Shift so the earliest activation is t = 0.
  let t0 = Infinity;
  for (const a of act) {
    t0 = Math.min(t0, a.t);
    for (const h of a.halves ?? []) t0 = Math.min(t0, h.t);
  }
  let end = 0;
  for (const a of act) {
    a.t -= t0;
    end = Math.max(end, a.t + a.transit);
    for (const h of a.halves ?? []) {
      h.t -= t0;
      end = Math.max(end, h.t + h.transit);
    }
  }
  // Dipole areas from the activation-time gradient (QRS area ∝ ∫∇t dV).
  //  • Own Purkinje entry: endocardium is activated almost at once → purely transmural (normal n).
  //  • Reached late through the Purkinje network (fascicular block) or by cell-to-cell spread:
  //    add a tangential component along the direction of spread, ∝ local slowness (ms/cm).
  // Fascicular block: the blocked territory is activated late, from the intact fascicle's
  // territory towards the blocked one (textbook mechanism of LAFB / LPFB axis shift).
  let fascDir: V3 | null = null;
  {
    let bc: V3 = [0, 0, 0], ic: V3 = [0, 0, 0], nb = 0, ni = 0;
    for (let i = 0; i < n; i++) {
      if (regs[i].chamber !== 'LV' || regs[i].isSeptal) continue;
      if (act[i].viaPurkinje && !ownEntry[i]) { bc = add(bc, regs[i].pos); nb++; }
      else if (ownEntry[i]) { ic = add(ic, regs[i].pos); ni++; }
    }
    if (nb > 0 && ni > 0) fascDir = norm(sub(scale(bc, 1 / nb), scale(ic, 1 / ni)));
  }
  for (let i = 0; i < n; i++) {
    const r = regs[i];
    const a = act[i];
    if (i === originIdx) {
      // Ectopic focus / accessory-pathway insertion: the wave spreads away from the site,
      // towards the bulk of the ventricles.
      a.area = scale(norm(sub(VENTRICLE_CENTRE, r.pos)), 1.2);
      a.dir = norm(a.area);
      continue;
    }
    if (ownEntry[i] || parent[i] < 0) {
      a.area = scale(r.n, a.side);
      a.dir = norm(a.area);
      continue;
    }
    const p = regs[parent[i]];
    const d = sub(r.pos, p.pos);
    const dl = Math.max(0.5, Math.hypot(d[0], d[1], d[2]));
    const prop = a.viaPurkinje && fascDir ? fascDir : scale(d, 1 / dl);
    const tang = norm(sub(prop, scale(r.n, dot(prop, r.n))));
    const slowness = Math.min(40, Math.max(0, (a.t - act[parent[i]].t) / dl)); // ms per cm
    const tm = a.viaPurkinje ? r.transit : r.transit * 0.6;
    const k = a.viaPurkinje ? K_TAN_NETWORK : K_TANGENTIAL;
    a.area = scale(add(scale(r.n, a.side * tm), scale(tang, k * slowness)), 1 / r.transit);
    a.dir = norm(a.area);
  }
  return { regions: act, qrsDuration: end, preexcitationMs: preMs };
}

/** Weight of tangential (early → late) activation forces for cell-to-cell spread. */
const K_TANGENTIAL = 1.5;
/** Tangential weight for tissue reached through the Purkinje network around a blocked fascicle. */
const K_TAN_NETWORK = 6;

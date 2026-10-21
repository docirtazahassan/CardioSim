/**
 * Simplified anatomical model of the heart for the dipole ECG engine.
 *
 * Body frame (cm): x = patient's LEFT, y = INFERIOR, z = ANTERIOR. Origin ≈ centre of the heart.
 *
 * The LV is a truncated prolate spheroid whose long axis points from the base (valve plane)
 * towards the apex (left, inferior, anterior). The 17 AHA segments are patches on it.
 * The RV wraps around the septum anteriorly/rightward. Each region has:
 *  - position (centroid, used for propagation distances and for near-field chest leads)
 *  - outward normal n (endocardium → epicardium of its own cavity). For septal segments
 *    "outward" from the LV points INTO the RV, i.e. rightward.
 *  - mass (relative), normal Purkinje entry time and transmural transit time
 *  - which fascicle normally activates it.
 */
import type { VentricularRegionId } from '../../data/types';
import { add, cross, dist, norm, orthoNorm, scale, type V3 } from '../math';

export type Fascicle = 'septal' | 'laf' | 'lpf' | 'apex' | 'rbb';

export interface VentricularRegion {
  id: VentricularRegionId;
  label: string;
  chamber: 'LV' | 'RV';
  segment?: number;
  isSeptal: boolean;
  pos: V3;
  n: V3;
  mass: number;
  /** Normal activation onset after QRS onset (ms) via the Purkinje system. */
  purkinjeTime: number;
  /** Normal transmural (endo → epi) activation time (ms). */
  transit: number;
  fascicles: Fascicle[];
  /** Relative action potential duration factor (apex–base and transmural heterogeneity). */
  apdFactor: number;
  /** Primary repolarisation gradient weight (ventricular gradient). */
  gradient: number;
}

// ---- LV frame
export const LV_BASE: V3 = [0.2, -1.6, -1.8];
export const LV_AXIS: V3 = norm([0.592, 0.547, 0.592]);
export const LV_LENGTH = 7.6;
export const LV_RADIUS = 2.9;
/** Direction from LV centre towards the septum/RV (rightward, anterior). */
export const U_SEP: V3 = orthoNorm([-0.777, 0.193, 0.599], LV_AXIS);
/** Direction of the anterior LV wall (superior, anterior, slightly left). */
export const U_ANT: V3 = norm(cross(LV_AXIS, U_SEP));

/** Circumferential direction at short-axis angle phi (deg): 0 anterior, 60 anteroseptal, 120 inferoseptal, 180 inferior, 240 inferolateral, 300 anterolateral. */
export function circ(phiDeg: number): V3 {
  const r = (phiDeg * Math.PI) / 180;
  return norm(add(scale(U_ANT, Math.cos(r)), scale(U_SEP, Math.sin(r))));
}

/** Point and outward normal on the LV spheroid at axial fraction s (0 base → 1 apex) and angle phi. */
export function lvSurface(s: number, phiDeg: number): { pos: V3; n: V3 } {
  const c = circ(phiDeg);
  const rr = LV_RADIUS * Math.sqrt(Math.max(0, 1 - s * s));
  const pos = add(add(LV_BASE, scale(LV_AXIS, LV_LENGTH * s)), scale(c, rr));
  // gradient of x²/R² + z²/L² = 1
  const n = norm(add(scale(c, Math.sqrt(Math.max(0, 1 - s * s)) / LV_RADIUS), scale(LV_AXIS, s / LV_LENGTH)));
  return { pos, n };
}

const WALL_ANGLE: Record<string, number> = {
  anterior: 0, anteroseptal: 60, inferoseptal: 120, inferior: 180, inferolateral: 240, anterolateral: 300,
};

interface SegDef {
  seg: number; label: string; level: 'basal' | 'mid' | 'apical' | 'apex'; phi: number;
  t: number; tr: number; mass: number; fasc: Fascicle[]; apd: number; grad: number;
}

/**
 * Normal activation sequence (after Durrer et al., simplified): mid-septum from the left first,
 * then apical/paraseptal walls, free walls, and posterobasal LV + basal septum last.
 */
const SEG_DEFS: SegDef[] = [
  { seg: 1, label: 'Basal anterior', level: 'basal', phi: WALL_ANGLE.anterior, t: 44, tr: 32, mass: 0.85, fasc: ['laf'], apd: 0.97, grad: 1.0 },
  { seg: 2, label: 'Basal anteroseptal', level: 'basal', phi: WALL_ANGLE.anteroseptal, t: 49, tr: 30, mass: 1.0, fasc: ['septal'], apd: 0.98, grad: 0.7 },
  { seg: 3, label: 'Basal inferoseptal', level: 'basal', phi: WALL_ANGLE.inferoseptal, t: 55, tr: 30, mass: 1.0, fasc: ['lpf'], apd: 0.98, grad: 0.6 },
  { seg: 4, label: 'Basal inferior', level: 'basal', phi: WALL_ANGLE.inferior, t: 49, tr: 32, mass: 1.35, fasc: ['lpf'], apd: 0.97, grad: 0.8 },
  { seg: 5, label: 'Basal inferolateral', level: 'basal', phi: WALL_ANGLE.inferolateral, t: 64, tr: 34, mass: 1.2, fasc: ['lpf'], apd: 0.94, grad: 0.6 },
  { seg: 6, label: 'Basal anterolateral', level: 'basal', phi: WALL_ANGLE.anterolateral, t: 52, tr: 34, mass: 0.9, fasc: ['laf'], apd: 0.95, grad: 0.9 },
  { seg: 7, label: 'Mid anterior', level: 'mid', phi: WALL_ANGLE.anterior, t: 20, tr: 32, mass: 0.9, fasc: ['laf'], apd: 1.0, grad: 1.3 },
  { seg: 8, label: 'Mid anteroseptal', level: 'mid', phi: WALL_ANGLE.anteroseptal, t: 0, tr: 32, mass: 1.0, fasc: ['septal'], apd: 1.0, grad: 1.0 },
  { seg: 9, label: 'Mid inferoseptal', level: 'mid', phi: WALL_ANGLE.inferoseptal, t: 3, tr: 32, mass: 1.0, fasc: ['lpf'], apd: 1.0, grad: 0.9 },
  { seg: 10, label: 'Mid inferior', level: 'mid', phi: WALL_ANGLE.inferior, t: 20, tr: 32, mass: 1.3, fasc: ['lpf'], apd: 1.0, grad: 1.1 },
  { seg: 11, label: 'Mid inferolateral', level: 'mid', phi: WALL_ANGLE.inferolateral, t: 32, tr: 34, mass: 1.1, fasc: ['lpf'], apd: 0.97, grad: 0.9 },
  { seg: 12, label: 'Mid anterolateral', level: 'mid', phi: WALL_ANGLE.anterolateral, t: 26, tr: 34, mass: 0.95, fasc: ['laf'], apd: 0.97, grad: 1.2 },
  { seg: 13, label: 'Apical anterior', level: 'apical', phi: 0, t: 14, tr: 28, mass: 0.8, fasc: ['laf', 'apex'], apd: 1.02, grad: 1.5 },
  { seg: 14, label: 'Apical septal', level: 'apical', phi: 90, t: 12, tr: 28, mass: 0.8, fasc: ['septal', 'apex'], apd: 1.02, grad: 1.3 },
  { seg: 15, label: 'Apical inferior', level: 'apical', phi: 180, t: 14, tr: 28, mass: 1.0, fasc: ['lpf', 'apex'], apd: 1.02, grad: 1.3 },
  { seg: 16, label: 'Apical lateral', level: 'apical', phi: 270, t: 17, tr: 28, mass: 0.8, fasc: ['laf', 'apex'], apd: 1.01, grad: 1.5 },
  { seg: 17, label: 'Apex', level: 'apex', phi: 0, t: 20, tr: 24, mass: 0.8, fasc: ['apex'], apd: 1.03, grad: 1.5 },
];

const LEVEL_S: Record<string, number> = { basal: 0.12, mid: 0.48, apical: 0.8, apex: 0.97 };

/**
 * Anatomical outward normals of the six LV walls (mid-ventricle), in the body frame.
 * The LV is not a perfect spheroid: these are specified directly from anatomy
 * (anterior wall faces anteriorly/superiorly, inferior wall rests on the diaphragm,
 * lateral wall faces left/posteriorly, septum faces the RV: right and anterior).
 */
const WALL_NORMAL: Record<number, V3> = {
  0: norm([0.15, -0.45, 0.88]), // anterior
  60: norm([-0.55, -0.42, 0.72]), // anteroseptal
  120: norm([-0.65, 0.6, 0.45]), // inferoseptal
  180: norm([0.05, 0.92, -0.38]), // inferior
  240: norm([0.55, 0.35, -0.76]), // inferolateral
  300: norm([0.88, -0.42, -0.25]), // anterolateral
};
const APICAL_NORMAL: Record<number, V3> = {
  0: norm(add(WALL_NORMAL[0], scale(LV_AXIS, 0.9))),
  90: norm(add(add(WALL_NORMAL[60], WALL_NORMAL[120]), scale(LV_AXIS, 1.6))),
  180: norm(add(WALL_NORMAL[180], scale(LV_AXIS, 0.9))),
  270: norm(add(add(WALL_NORMAL[240], WALL_NORMAL[300]), scale(LV_AXIS, 1.6))),
};

function buildLv(): VentricularRegion[] {
  return SEG_DEFS.map((d) => {
    const { pos } = lvSurface(LEVEL_S[d.level], d.phi);
    const n = d.level === 'apex' ? LV_AXIS : d.level === 'apical' ? APICAL_NORMAL[d.phi] : WALL_NORMAL[d.phi];
    const isSeptal = [2, 3, 8, 9, 14].includes(d.seg);
    return {
      id: `seg${d.seg}` as VentricularRegionId,
      label: d.label,
      chamber: 'LV',
      segment: d.seg,
      isSeptal,
      pos,
      n,
      mass: d.mass,
      purkinjeTime: d.t,
      transit: d.tr,
      fascicles: d.fasc,
      apdFactor: d.apd,
      gradient: d.grad,
    };
  });
}

function rvRegion(id: VentricularRegionId, label: string, s: number, phi: number, offset: number, nDir: V3, t: number, tr: number, mass: number, grad: number): VentricularRegion {
  const base = lvSurface(s, phi);
  const pos = add(base.pos, scale(U_SEP, offset));
  return { id, label, chamber: 'RV', isSeptal: false, pos, n: norm(nDir), mass, purkinjeTime: t, transit: tr, fascicles: ['rbb'], apdFactor: 1.0, gradient: grad };
}

function buildRv(): VentricularRegion[] {
  const up: V3 = [0, -1, 0];
  return [
    rvRegion('rvApex', 'RV apex', 0.78, 90, 2.0, [-0.5, 0.45, 0.74], 12, 18, 0.16, 1.0),
    rvRegion('rvAnt', 'RV anterior wall', 0.42, 40, 2.6, [-0.72, -0.28, 0.63], 18, 18, 0.16, 1.0),
    rvRegion('rvLat', 'RV free wall (acute margin)', 0.4, 95, 3.4, [-0.95, 0.12, 0.28], 21, 18, 0.16, 1.0),
    rvRegion('rvInf', 'RV inferior (diaphragmatic) wall', 0.38, 140, 2.6, [-0.82, 0.55, 0.12], 21, 18, 0.16, 1.0),
    rvRegion('rvot', 'RV outflow tract', 0.05, 30, 2.4, add(add(scale(U_SEP, 0.5), U_ANT), scale(up, 0.4)), 66, 22, 0.22, 0.8),
  ];
}

export const VENTRICULAR_REGIONS: VentricularRegion[] = [...buildLv(), ...buildRv()];
export const REGION_INDEX: Record<string, number> = Object.fromEntries(VENTRICULAR_REGIONS.map((r, i) => [r.id, i]));

/** Neighbour graph used for cell-to-cell (muscle) propagation. */
export const NEIGHBOURS: number[][] = (() => {
  const regs = VENTRICULAR_REGIONS;
  const out: number[][] = regs.map(() => []);
  for (let i = 0; i < regs.length; i++) {
    for (let j = i + 1; j < regs.length; j++) {
      const d = dist(regs[i].pos, regs[j].pos);
      const rvSeptLink = (regs[i].chamber !== regs[j].chamber) && (regs[i].isSeptal || regs[j].isSeptal) && d < 5.2;
      if (d < 3.9 || rvSeptLink) {
        out[i].push(j);
        out[j].push(i);
      }
    }
  }
  return out;
})();

// ---- atria (P wave). Dipoles follow the direction of propagation (thin walls).
export interface AtrialRegion {
  id: string;
  label: string;
  pos: V3;
  dir: V3; // propagation direction for sinus rhythm
  t: number; // onset after P onset (ms)
  dur: number;
  mass: number;
  chamber: 'RA' | 'LA';
}

export const SA_NODE_POS: V3 = [-3.0, -5.0, 0.6];
export const AV_NODE_POS: V3 = [-1.0, -2.2, -0.6];

export const ATRIAL_REGIONS: AtrialRegion[] = [
  { id: 'raHigh', label: 'High RA', pos: [-3.4, -4.4, 0.8], dir: norm([0.25, 0.85, 0.45]), t: 0, dur: 45, mass: 0.55, chamber: 'RA' },
  { id: 'raLow', label: 'Low/lateral RA', pos: [-3.8, -2.2, 0.4], dir: norm([0.45, 0.85, 0.15]), t: 22, dur: 45, mass: 0.55, chamber: 'RA' },
  { id: 'laRoof', label: 'LA roof (Bachmann)', pos: [0.0, -4.2, -2.4], dir: norm([0.9, 0.25, -0.45]), t: 32, dur: 45, mass: 0.5, chamber: 'LA' },
  { id: 'laPost', label: 'Posterior/inferior LA', pos: [0.6, -2.8, -3.6], dir: norm([0.45, 0.55, -0.7]), t: 52, dur: 45, mass: 0.5, chamber: 'LA' },
];

/** Heart centre used for the far-field (vectorcardiogram) reference. */
export const HEART_CENTRE: V3 = [0.8, 0.2, 0.0];

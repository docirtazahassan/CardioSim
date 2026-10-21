/**
 * Procedural cardiac anatomy in the ECG engine's body frame (cm; x = patient's left,
 * y = inferior, z = anterior). Everything is generated from simple parametric surfaces so the
 * 3D model, the ECG regions and the coronary territories share one coordinate system.
 * Three.js uses y-up, so `toThree` flips y.
 */
import type { ArteryId, Dominance, OcclusionSite, VentricularRegionId } from '../../data/types';
import { AV_NODE_POS, LV_AXIS, LV_BASE, LV_LENGTH, LV_RADIUS, SA_NODE_POS, U_SEP, circ } from '../../engine/electrical/geometry';
import { add, norm, scale, sub, type V3 } from '../../engine/math';

export const toThree = (p: V3): [number, number, number] => [p[0], -p[1], p[2]];

/** Wall thickness (cm) of LV and the size of the epicardial shell. */
export const LV_WALL = 0.95;
const EPI_R = LV_RADIUS + LV_WALL;
const EPI_L = LV_LENGTH + 0.75;

/**
 * Point on the LV. s: 0 = base → 1 = apex; phi: short-axis angle (0 anterior, 90 septal, 180 inferior, 270 lateral).
 * layer: 1 = epicardium, 0 = endocardium. radial/axial scale the cavity (contraction).
 */
export function lvPoint(s: number, phi: number, layer = 1, radial = 1, axial = 1, lift = 0): V3 {
  const R = (layer ? EPI_R : LV_RADIUS) * radial + lift;
  const L = (layer ? EPI_L : LV_LENGTH) * axial + lift;
  const rr = R * Math.sqrt(Math.max(0, 1 - s * s));
  return add(add(LV_BASE, scale(LV_AXIS, L * s)), scale(circ(phi), rr));
}

/** RV free wall: a crescent bulging off the septal side of the LV (phi 15–165). */
export const RV_PHI: [number, number] = [15, 165];
export function rvBulge(s: number, phi: number) {
  const a = Math.sin((Math.PI * (phi - RV_PHI[0])) / (RV_PHI[1] - RV_PHI[0]));
  const taper = Math.max(0, 1 - Math.max(0, s) / 0.86);
  return 2.5 * Math.pow(Math.max(0, a), 0.7) * Math.pow(taper, 0.8);
}
export function rvPoint(s: number, phi: number, rvScale = 1, lift = 0): V3 {
  return lvPoint(s, phi, 1, 1, 1, rvBulge(s, phi) * rvScale + lift);
}

/** AHA 17-segment id for a point on the LV (s, phi). */
export function lvSegmentAt(s: number, phi: number): VentricularRegionId {
  const p = ((phi % 360) + 360) % 360;
  if (s >= 0.9) return 'seg17';
  if (s >= 0.62) return `seg${13 + (Math.round(p / 90) % 4)}` as VentricularRegionId;
  const idx = Math.round(p / 60) % 6;
  return `seg${(s < 0.3 ? 1 : 7) + idx}` as VentricularRegionId;
}
export function rvRegionAt(s: number, phi: number): VentricularRegionId {
  if (s > 0.58) return 'rvApex';
  if (s < 0.12 && phi < 85) return 'rvot';
  if (phi < 65) return 'rvAnt';
  if (phi < 118) return 'rvLat';
  return 'rvInf';
}

// ---------------------------------------------------------------- other structures (body frame)
export const LA_CENTRE: V3 = [0.7, -3.7, -4.3];
export const RA_CENTRE: V3 = [-3.7, -3.0, -0.7];
export const ATRIAL_RADIUS = { la: 2.15, ra: 2.25 };

const baseCentre = (k: number, phi: number) => add(LV_BASE, scale(circ(phi), k));
export const VALVES: Record<'mitral' | 'aortic' | 'tricuspid' | 'pulmonic', { pos: V3; normal: V3; r: number }> = {
  mitral: { pos: add(baseCentre(1.0, 230), scale(LV_AXIS, -0.15)), normal: norm(add(LV_AXIS, [0, 0, 0.15])), r: 1.35 },
  aortic: { pos: add(baseCentre(1.25, 45), scale(LV_AXIS, -0.45)), normal: norm(add(scale(LV_AXIS, -1), [-0.3, -0.4, 0.1])), r: 1.05 },
  tricuspid: { pos: add(add(LV_BASE, scale(U_SEP, 3.4)), scale(LV_AXIS, 0.05)), normal: norm(add(U_SEP, scale(LV_AXIS, 1.4))), r: 1.45 },
  pulmonic: { pos: [-1.0, -4.3, 2.3], normal: norm([0.35, -0.85, -0.2]), r: 1.05 },
};

export const VESSELS: Record<'aorta' | 'pa' | 'lpa' | 'rpa' | 'svc' | 'ivc' | 'pvLeftSup' | 'pvLeftInf' | 'pvRightSup' | 'pvRightInf', { pts: V3[]; r: number }> = {
  aorta: { pts: [VALVES.aortic.pos, [-1.1, -5.4, 0.0], [-0.6, -8.6, -1.0], [1.4, -9.3, -3.0], [2.3, -6.6, -5.0], [2.4, -1.0, -5.4], [2.3, 5, -5.4]], r: 1.2 },
  pa: { pts: [VALVES.pulmonic.pos, [0.0, -5.9, 1.9], [1.3, -6.9, 0.2], [1.5, -7.0, -1.4]], r: 1.15 },
  lpa: { pts: [[1.5, -7.0, -1.4], [3.2, -7.1, -2.4], [5.2, -6.6, -3.0]], r: 0.75 },
  rpa: { pts: [[1.5, -7.0, -1.4], [-0.6, -7.4, -2.6], [-4.6, -6.9, -2.8]], r: 0.75 },
  svc: { pts: [[-3.6, -11.5, -0.6], [-3.6, -8.0, -0.6], [-3.6, -5.0, -0.6]], r: 0.95 },
  ivc: { pts: [[-3.1, -1.2, -1.5], [-2.9, 1.8, -2.0], [-2.6, 5.5, -2.4]], r: 1.05 },
  pvLeftSup: { pts: [[2.2, -4.6, -5.0], [4.2, -5.0, -5.4]], r: 0.5 },
  pvLeftInf: { pts: [[2.2, -2.8, -5.0], [4.2, -2.4, -5.6]], r: 0.5 },
  pvRightSup: { pts: [[-0.8, -4.6, -5.2], [-2.6, -5.0, -5.8]], r: 0.5 },
  pvRightInf: { pts: [[-0.8, -2.8, -5.2], [-2.6, -2.4, -5.9]], r: 0.5 },
};

// ---------------------------------------------------------------- conduction system
const endoSeptum = (s: number, phi = 90, inset = 0.25) => lvPoint(s, phi, 0, 1, 1, -inset);
const rvSeptalSide = (s: number) => add(lvPoint(s, 90, 1, 1, 1, 0.15), scale(U_SEP, 0.1));
export const CONDUCTION: Record<'internodal' | 'bachmann' | 'his' | 'lbb' | 'laf' | 'lpf' | 'rbb', V3[]> = {
  internodal: [SA_NODE_POS, [-4.4, -3.6, 0.6], [-3.4, -2.2, 0.0], AV_NODE_POS],
  bachmann: [SA_NODE_POS, [-1.8, -5.0, -1.2], [0.6, -5.2, -3.2], [2.0, -4.6, -4.2]],
  his: [AV_NODE_POS, [-0.6, -1.6, 0.1], endoSeptum(0.06)],
  lbb: [endoSeptum(0.06), endoSeptum(0.2), endoSeptum(0.34)],
  laf: [endoSeptum(0.34), lvPoint(0.42, 40, 0, 1, 1, -0.3), lvPoint(0.6, 0, 0, 1, 1, -0.3), lvPoint(0.72, 330, 0, 1, 1, -0.3)],
  lpf: [endoSeptum(0.34), lvPoint(0.42, 140, 0, 1, 1, -0.3), lvPoint(0.6, 180, 0, 1, 1, -0.3), lvPoint(0.72, 215, 0, 1, 1, -0.3)],
  rbb: [endoSeptum(0.06), rvSeptalSide(0.2), rvSeptalSide(0.45), rvSeptalSide(0.6), rvPoint(0.55, 95, 1, -0.4)],
};

// ---------------------------------------------------------------- coronary arteries
export interface ArterySegment { artery: ArteryId; site: OcclusionSite | null; pts: V3[]; r: number }

const epi = (s: number, phi: number) => lvPoint(s, phi, 1, 1, 1, 0.22);
const rvEpi = (s: number, phi: number) => rvPoint(s, phi, 1, 0.22);
const range = (n: number, f: (u: number) => V3) => Array.from({ length: n + 1 }, (_, i) => f(i / n));
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;

const AO_LEFT: V3 = add(VALVES.aortic.pos, [0.9, -0.5, -0.4]);
const AO_RIGHT: V3 = add(VALVES.aortic.pos, [-0.7, -0.5, 0.8]);

/** Coronary tree as tube segments; the dominant artery supplies the PDA. */
export function coronaryTree(dominance: Dominance): ArterySegment[] {
  const segs: ArterySegment[] = [];
  const lmEnd = epi(-0.04, 8);
  segs.push({ artery: 'LMCA', site: 'proximal', pts: [AO_LEFT, add(AO_LEFT, [0.6, 0.0, 0.6]), lmEnd], r: 0.26 });
  // LAD in the anterior interventricular groove (phi ≈ 15), wrapping the apex
  const lad = (a: number, b: number) => range(8, (u) => epi(lerp(a, b, u), 12));
  segs.push({ artery: 'LAD', site: 'proximal', pts: [lmEnd, ...lad(0.02, 0.24)], r: 0.2 });
  segs.push({ artery: 'LAD', site: 'mid', pts: lad(0.24, 0.58), r: 0.18 });
  segs.push({ artery: 'LAD', site: 'distal', pts: [...lad(0.58, 0.97), epi(0.99, 100), epi(0.93, 175)], r: 0.15 });
  segs.push({ artery: 'D1', site: 'proximal', pts: range(8, (u) => epi(lerp(0.2, 0.55, u), lerp(10, -48, u))), r: 0.12 });
  segs.push({ artery: 'D2', site: null, pts: range(8, (u) => epi(lerp(0.48, 0.78, u), lerp(10, -40, u))), r: 0.1 });
  // LCx in the left AV groove, round the lateral wall to the back
  const lcxEnd = dominance === 'left' ? 168 : dominance === 'codominant' ? 205 : 225;
  segs.push({ artery: 'LCX', site: 'proximal', pts: [lmEnd, ...range(8, (u) => epi(lerp(-0.04, 0.0, u), lerp(8, -60, u)))], r: 0.19 });
  segs.push({ artery: 'LCX', site: 'distal', pts: range(10, (u) => epi(0.0, lerp(-60, lcxEnd - 360, u))), r: 0.16 });
  segs.push({ artery: 'OM1', site: 'proximal', pts: range(8, (u) => epi(lerp(0.0, 0.6, u), lerp(-75, -85, u))), r: 0.12 });
  segs.push({ artery: 'OM2', site: null, pts: range(8, (u) => epi(lerp(0.0, 0.5, u), lerp(-115, -125, u))), r: 0.1 });
  // RCA in the right AV groove around the RV to the crux (phi ≈ 165)
  const rcaEnd = dominance === 'left' ? 120 : 165;
  const rca = (a: number, b: number) => range(8, (u) => rvEpi(-0.06, lerp(a, b, u)));
  segs.push({ artery: 'RCA', site: 'proximal', pts: [AO_RIGHT, add(AO_RIGHT, [-0.8, 0.2, 0.6]), ...rca(18, 55)], r: 0.21 });
  segs.push({ artery: 'RCA', site: 'mid', pts: rca(55, 105), r: 0.19 });
  segs.push({ artery: 'RCA', site: 'distal', pts: rca(105, rcaEnd), r: 0.17 });
  segs.push({ artery: 'AM', site: null, pts: range(8, (u) => rvEpi(lerp(-0.04, 0.55, u), 96)), r: 0.1 });
  segs.push({ artery: 'CONUS', site: null, pts: range(5, (u) => rvEpi(lerp(-0.06, 0.02, u), lerp(20, 34, u))), r: 0.08 });
  // PDA and posterolateral branch from the dominant artery
  const pdaFrom: ArteryId = dominance === 'left' ? 'LCX' : 'RCA';
  segs.push({ artery: 'PDA', site: 'proximal', pts: range(10, (u) => epi(lerp(0.0, 0.78, u), 166)), r: 0.13 });
  if (dominance !== 'left') segs.push({ artery: 'PLB', site: null, pts: range(8, (u) => epi(lerp(0.0, 0.25, u), lerp(170, 220, u))), r: 0.1 });
  void pdaFrom;
  return segs;
}

/** Which named vessel supplies the PDA for the chosen dominance. */
export const pdaSource = (d: Dominance): ArteryId => (d === 'left' ? 'LCX' : 'RCA');

/** Electrode positions for the torso view (limb electrodes at the shoulders and left hip). */
export const LIMB_ELECTRODES: Record<string, V3> = { RA: [-15, -13, -2], LA: [15, -13, -2], LL: [9, 15, -2], RL: [-9, 15, -2] };

export const dist3 = (a: V3, b: V3) => Math.hypot(...sub(a, b));

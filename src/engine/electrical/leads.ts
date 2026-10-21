/**
 * Lead definitions.
 *
 * LIMB LEADS (frontal plane) – ideal far-field projections (Einthoven triangle / hexaxial system).
 *   I = 0°, II = +60°, III = +120°. III is defined as II − I, and the augmented leads are derived
 *   from the bipolar leads exactly as the Goldberger leads are, so Einthoven's law (I + III = II)
 *   and aVR + aVL + aVF = 0 hold identically at every instant:
 *     aVR = −(I + II)/2  (−150°),  aVL = (I − III)/2  (−30°),  aVF = (II + III)/2  (+90°)
 *
 * CHEST LEADS (horizontal plane + right-sided + posterior) – unipolar leads referenced to
 *   Wilson's central terminal. Because chest electrodes sit close to the heart, each dipole is
 *   projected with a near-field lead vector  L = K·(e − r)/|e − r|³  (potential of a dipole in a
 *   homogeneous conductor). Nearby myocardium therefore dominates each chest lead, which is why
 *   anterior injury shows in V1–V4, lateral in V5–V6, RV in V4R and posterior in V7–V9.
 */
import type { LeadId } from '../../data/types';
import { add, dot, len, scale, sub, type V3 } from '../math';

export const LIMB_LEADS = ['I', 'II', 'III', 'aVR', 'aVL', 'aVF'] as const;
export const PRECORDIAL_LEADS = ['V1', 'V2', 'V3', 'V4', 'V5', 'V6'] as const;
export const RIGHT_LEADS = ['V1R', 'V2R', 'V3R', 'V4R', 'V5R', 'V6R'] as const;
export const POSTERIOR_LEADS = ['V7', 'V8', 'V9'] as const;
export const ALL_LEADS: LeadId[] = [...LIMB_LEADS, ...PRECORDIAL_LEADS, ...RIGHT_LEADS, ...POSTERIOR_LEADS];
export const TWELVE_LEADS: LeadId[] = [...LIMB_LEADS, ...PRECORDIAL_LEADS];

/** Limb lead gain (mV per unit dipole). */
export const LIMB_GAIN = 1.0;

const I_AX: V3 = [1, 0, 0];
const II_AX: V3 = [Math.cos(Math.PI / 3), Math.sin(Math.PI / 3), 0];
const III_AX: V3 = sub(II_AX, I_AX);

export const LIMB_AXES: Record<(typeof LIMB_LEADS)[number], V3> = {
  I: I_AX,
  II: II_AX,
  III: III_AX,
  aVR: scale(add(I_AX, II_AX), -0.5),
  aVL: scale(sub(I_AX, III_AX), 0.5),
  aVF: scale(add(II_AX, III_AX), 0.5),
};

/** Hexaxial angle (deg) of each limb lead's positive pole. */
export const LIMB_ANGLES: Record<string, number> = { I: 0, II: 60, III: 120, aVR: -150, aVL: -30, aVF: 90 };

/** Electrode positions (cm) in the body frame. */
export const ELECTRODES: Record<string, V3> = {
  V1: [-2.6, -0.6, 7.6],
  V2: [2.2, -0.6, 7.6],
  V3: [5.2, 0.9, 7.0],
  V4: [8.0, 2.4, 5.6],
  V5: [11.0, 2.4, 2.4],
  V6: [12.4, 2.4, -1.6],
  // Right-sided: V1R = V2 position, V2R = V1 position, V3R–V6R mirror V3–V6 across the sternum (x = -0.2)
  V1R: [2.2, -0.6, 7.6],
  V2R: [-2.6, -0.6, 7.6],
  V3R: [-5.6, 0.9, 7.0],
  V4R: [-8.4, 2.4, 5.6],
  V5R: [-11.4, 2.4, 2.4],
  V6R: [-12.8, 2.4, -1.6],
  // Posterior (same horizontal level as V6): posterior axillary, mid-scapular, paraspinal
  V7: [11.6, 2.4, -6.4],
  V8: [8.4, 2.4, -10.2],
  V9: [3.4, 2.4, -12.2],
};

/** Nominal horizontal-plane angle (deg) of each chest lead (0° = left, +90° = anterior); for diagrams. */
export const CHEST_ANGLES: Record<string, number> = {
  V1: 115, V2: 94, V3: 76, V4: 60, V5: 30, V6: 0,
  V1R: 94, V2R: 115, V3R: 120, V4R: 135, V5R: 155, V6R: 180,
  V7: -30, V8: -60, V9: -85,
};

/** Chest lead gain relative to limb leads (chest electrodes are closer → larger voltages). */
export const CHEST_GAIN = 1.1;
/** Fraction of the chest lead field that is near-field (position dependent). */
export const NEAR_FIELD = 0.55;
/** Reference point for the far-field part of chest leads. */
const CENTRE: V3 = [0.8, 0.2, 0.0];
const R_REF = 8.5;

export function isLimbLead(lead: string): lead is (typeof LIMB_LEADS)[number] {
  return (LIMB_LEADS as readonly string[]).includes(lead);
}

/** Lead vector for a dipole located at `pos`. Limb leads ignore position (far field). */
export function leadVector(lead: LeadId, pos: V3, electrodeOverride?: Partial<Record<string, V3>>): V3 {
  if (isLimbLead(lead)) return scale(LIMB_AXES[lead], LIMB_GAIN);
  const e = electrodeOverride?.[lead] ?? ELECTRODES[lead];
  // far field: unit vector from heart centre to electrode
  const dc = sub(e, CENTRE);
  const r0 = len(dc);
  const far = scale(dc, 1 / r0);
  // near field: dipole potential (e − r)/|e − r|³, normalised to equal the far field at the centre
  const d = sub(e, pos);
  const r = Math.max(len(d), 3.0);
  const near = scale(d, (r0 * r0) / (r * r * r));
  // overall potential falls off with distance of the electrode from the heart
  const falloff = (R_REF * R_REF) / (r0 * r0);
  return scale(add(scale(far, 1 - NEAR_FIELD), scale(near, NEAR_FIELD)), CHEST_GAIN * falloff);
}

/** Project a dipole `p` at `pos` onto a lead. */
export function project(lead: LeadId, p: V3, pos: V3, electrodeOverride?: Partial<Record<string, V3>>) {
  return dot(p, leadVector(lead, pos, electrodeOverride));
}

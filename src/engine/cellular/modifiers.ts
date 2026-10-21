/**
 * Drug and electrolyte effects.
 *
 * Step 1: map drugs/electrolytes/temperature to scale factors on named ionic currents
 *         (the "ionic state"). The action-potential model (ap.ts) uses these.
 * Step 2: map the ionic state to whole-heart ECG modifiers (QRS slowing, QT, T shape, U wave,
 *         P/PR changes, rate) used by the electrical and rhythm engines.
 * The mappings are phenomenological (direction and rough magnitude), see CONTENT_NOTES.
 */
import type { DrugId } from '../../data/types';
import { clamp } from '../math';

export interface IonicState {
  gNa: number; gCaL: number; gCaT: number; gKr: number; gKs: number; gK1: number; gTo: number; gf: number;
  /** Shift of resting membrane potential (mV, + = depolarised). */
  restShift: number;
  /** Fraction of Na channels available at rest (inactivation by depolarised rest). */
  naAvailability: number;
  /** Vagal-like nodal effect 0..1 (digoxin, adenosine). */
  nodalBrake: number;
  /** Sympathetic tone multiplier on If/ICa in nodal cells. */
  sympathetic: number;
  /** Early afterdepolarisation propensity (torsades risk), 0..1. */
  eadRisk: number;
  /** Plateau duration multiplier from Ca²⁺ (phase 2). */
  plateauScale: number;
  /** Extra adenosine K⁺ conductance (transient). */
  gKAdo: number;
}

export interface EcgModifiers {
  slowing: number; // QRS conduction slowing factor
  qtDeltaMs: number; // added to QT at 60 bpm
  stSegmentScale: number; // ST segment (plateau) length factor
  tAmp: number; // T amplitude multiplier
  tWidth: number; // T width multiplier (<1 = narrow, peaked)
  uWave: number; // U wave multiplier (1 = normal small U)
  stScoop: number; // digoxin sagging ST (mV-scale factor, 0 = none)
  pAmp: number; // P amplitude multiplier
  pWidth: number; // P duration multiplier
  prDeltaMs: number;
  hrFactor: number;
  osborn: number; // J (Osborn) wave amplitude scale
  sineWave: boolean;
  atrialStandstill: boolean;
  avNodalErpDelta: number;
  avNodalBlockTransient: boolean;
  notes: string[];
}

export interface ModifierInput {
  drugs?: DrugId[];
  k?: number; // mEq/L
  ca?: number; // mg/dL
  mg?: number; // mg/dL
  temperatureC?: number;
}

export const NORMAL_IONIC: IonicState = {
  gNa: 1, gCaL: 1, gCaT: 1, gKr: 1, gKs: 1, gK1: 1, gTo: 1, gf: 1,
  restShift: 0, naAvailability: 1, nodalBrake: 0, sympathetic: 1, eadRisk: 0, plateauScale: 1, gKAdo: 0,
};

export function ionicStateFrom(input: ModifierInput): IonicState {
  const s: IonicState = { ...NORMAL_IONIC };
  const k = input.k ?? 4.2;
  const ca = input.ca ?? 9.5;
  const mg = input.mg ?? 2.0;

  // Potassium: Nernst – rest ≈ EK. Hyperkalemia depolarises rest (~ +10 mV per doubling of K).
  s.restShift = 26.7 * Math.log(k / 4.2) * 0.9;
  // Na availability falls as rest depolarises (steady-state inactivation h∞).
  s.naAvailability = clamp(1 / (1 + Math.exp((s.restShift - 16) / 4.2)) / (1 / (1 + Math.exp(-16 / 4.2))), 0.05, 1);
  // IKr and IK1 conductance rise with extracellular K⁺ (faster repolarisation in hyperkalemia).
  const kFactor = Math.pow(k / 4.2, 0.9);
  s.gKr *= kFactor;
  s.gK1 *= kFactor;
  // Calcium: high Ca shortens the plateau (phase 2) via faster ICa inactivation; low Ca prolongs it.
  s.plateauScale = clamp(1 - (ca - 9.5) * 0.085, 0.55, 1.6);
  // Magnesium: low Mg → EAD propensity (triggered activity) and mild QT prolongation.
  if (mg < 1.6) s.eadRisk += clamp((1.6 - mg) * 0.6, 0, 0.5);
  if (k < 3.4) s.eadRisk += clamp((3.4 - k) * 0.25, 0, 0.4);

  for (const d of input.drugs ?? []) {
    switch (d) {
      case 'class1a': s.gNa *= 0.7; s.gKr *= 0.6; s.eadRisk += 0.25; break;
      case 'class1b': s.gNa *= 0.95; s.gKr *= 1.08; break;
      case 'class1c': s.gNa *= 0.45; break;
      case 'class2': s.sympathetic *= 0.7; s.gf *= 0.8; s.gCaL *= 0.95; break;
      case 'class3': s.gKr *= 0.45; s.eadRisk += 0.3; break;
      case 'class4': s.gCaL *= 0.65; s.gCaT *= 0.85; break;
      case 'digoxin': s.nodalBrake += 0.35; s.gKr *= 1.15; s.plateauScale *= 0.85; break;
      case 'adenosine': s.gKAdo = 1; s.nodalBrake += 0.9; break;
      case 'atropine': s.nodalBrake = Math.max(0, s.nodalBrake - 0.4); s.sympathetic *= 1.15; break;
      case 'magnesium': s.eadRisk *= 0.2; break;
    }
  }
  return s;
}

export function ecgModifiersFrom(input: ModifierInput): EcgModifiers {
  const s = ionicStateFrom(input);
  const k = input.k ?? 4.2;
  const ca = input.ca ?? 9.5;
  const mg = input.mg ?? 2.0;
  const temp = input.temperatureC ?? 37;
  const notes: string[] = [];

  // QRS: conduction velocity ∝ sqrt(available Na current).
  const naCurrent = s.gNa * s.naAvailability;
  let slowing = 1 / Math.sqrt(clamp(naCurrent, 0.04, 1));
  if (k >= 8.5) slowing = Math.max(slowing, 3.2);

  // QT: plateau (Ca) + repolarising K currents.
  const kRepol = (s.gKr * 0.6 + s.gKs * 0.2 + s.gK1 * 0.2);
  const qtFromK = 120 * (1 / kRepol - 1); // block → longer, ↑ conductance → shorter
  const qtFromCa = 150 * (s.plateauScale - 1) * 1.15;
  let qtDelta = clamp(qtFromK, -90, 220) + clamp(qtFromCa, -95, 120);
  if (mg < 1.6) qtDelta += (1.6 - mg) * 40;
  if (temp < 35) qtDelta += (35 - temp) * 12;

  // T wave: steeper phase 3 (↑ gK) → narrow, tall, peaked T. ↓ gK → flat broad T, prominent U.
  let tAmp = 1, tWidth = 1, uWave = 1;
  if (k > 5.2) {
    tAmp = 1 + clamp((k - 5.2) * 1.0, 0, 2.2);
    tWidth = clamp(1 - (k - 5.2) * 0.17, 0.5, 1);
    notes.push('Hyperkalemia: faster repolarisation (↑ IK) → tall, narrow, peaked T waves.');
  }
  if (k < 3.6) {
    tAmp = clamp(1 - (3.6 - k) * 0.55, 0.12, 1);
    uWave = 1 + (3.6 - k) * 3.2;
    tWidth = 1 + (3.6 - k) * 0.25;
    notes.push('Hypokalemia: slowed repolarisation (↓ IK) → flat T, prominent U waves, apparent QT (QU) prolongation.');
  }
  if (s.gKr < 0.8) {
    tAmp *= 0.85;
    tWidth *= 1.15;
  }

  // P wave and AV conduction.
  let pAmp = 1, pWidth = 1, prDelta = 0;
  let atrialStandstill = false;
  if (k > 6.4) {
    pAmp = clamp(1 - (k - 6.4) * 0.55, 0, 1);
    pWidth = 1 + clamp((k - 6.4) * 0.35, 0, 0.6);
    prDelta += clamp((k - 6.4) * 60, 0, 120);
    if (k >= 8.2) atrialStandstill = true;
    notes.push('Hyperkalemia: atrial myocytes are most sensitive → P flattens and widens, PR lengthens, then atrial standstill.');
  }
  if (k > 7.3) notes.push('Hyperkalemia: depolarised resting potential inactivates Na⁺ channels → slow conduction → wide QRS.');
  if (k >= 8.5) notes.push('Severe hyperkalemia: QRS merges with T → sine-wave pattern (pre-arrest).');

  let hrFactor = 1;
  let avErp = 0;
  const drugs = input.drugs ?? [];
  if (drugs.includes('class2')) { hrFactor *= 0.8; prDelta += 30; avErp += 60; }
  if (drugs.includes('class4')) { hrFactor *= 0.88; prDelta += 40; avErp += 80; }
  if (drugs.includes('digoxin')) { hrFactor *= 0.9; prDelta += 30; avErp += 60; notes.push('Digoxin: shortened ventricular AP → short QT and sagging ("scooped") ST; vagal effect slows AV conduction.'); }
  if (drugs.includes('atropine')) { hrFactor *= 1.3; prDelta -= 25; avErp -= 40; }
  if (drugs.includes('class3')) { hrFactor *= 0.92; avErp += 40; notes.push('Class III: IKr block → longer action potential → longer QT.'); }
  if (drugs.includes('class1a')) { notes.push('Class Ia: Na⁺ and K⁺ block → wider QRS and longer QT.'); }
  if (drugs.includes('class1c')) { notes.push('Class Ic: strong Na⁺ block → slower phase 0 → wider QRS.'); }
  if (temp < 35) { hrFactor *= clamp(1 - (35 - temp) * 0.07, 0.4, 1); prDelta += (35 - temp) * 10; }

  if (ca > 10.5) notes.push('Hypercalcemia: shortened plateau (phase 2) → short ST segment and short QT.');
  if (ca < 8.5) notes.push('Hypocalcemia: prolonged plateau (phase 2) → long ST segment and long QT with normal T.');
  if (mg < 1.6) notes.push('Hypomagnesemia: QT prolongation and triggered activity (torsades risk).');

  // ST segment length follows the plateau (Ca²⁺): long ST in hypocalcemia, short in hypercalcemia.
  const stSegmentScale = clamp(s.plateauScale, 0.4, 1.8);

  const osborn = temp < 35 ? clamp((35 - temp) / 7, 0, 1.4) : 0;
  if (osborn > 0) notes.push('Hypothermia: prominent epicardial Ito notch → J (Osborn) waves; bradycardia; long QT.');

  return {
    slowing,
    qtDeltaMs: qtDelta,
    stSegmentScale,
    tAmp,
    tWidth,
    uWave,
    stScoop: drugs.includes('digoxin') ? 1 : 0,
    pAmp,
    pWidth,
    prDeltaMs: prDelta,
    hrFactor,
    osborn,
    sineWave: k >= 8.5,
    atrialStandstill,
    avNodalErpDelta: avErp,
    avNodalBlockTransient: drugs.includes('adenosine'),
    notes,
  };
}

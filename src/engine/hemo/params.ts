/**
 * Default (healthy adult, ~70 kg) circulation parameters and the effect of maneuvers and
 * interventions. Units: volume mL, pressure mmHg, time s, resistance mmHg·s/mL,
 * compliance mL/mmHg, elastance mmHg/mL, valve area cm².
 */
import type { HemoParams, Intervention, Maneuver } from '../../data/types';

export const DEFAULT_HEMO: HemoParams = {
  hr: 72,
  rhythm: 'sinus',
  lvEes: 3.0, lvV0: 15, lvEdA: 0.3, lvEdB: 0.036,
  rvEes: 0.62, rvV0: 25, rvEdA: 0.24, rvEdB: 0.03,
  laEes: 0.2, laEdA: 0.3, laEdB: 0.05, laV0: 12,
  raEes: 0.22, raEdA: 0.25, raEdB: 0.05, raV0: 12,
  atrialKick: 1,
  sysR: 1.0, sysC: 1.6, aoZ: 0.035,
  pulR: 0.08, pulC: 4.0, paZ: 0.012,
  sysVenC: 100, pulVenC: 10,
  totalVolume: 5000,
  unstressedFraction: 1,
  avArea: 4.0, mvArea: 4.5, tvArea: 6.0, pvArea: 3.5,
  arArea: 0, mrArea: 0, trArea: 0, prArea: 0,
  asdArea: 0, vsdArea: 0, pdaArea: 0,
  effusion: 0, pericardialStiffness: 1,
  hocm: 0, mvp: 0,
  respRate: 14, respDepth: 4, intrathoracicBias: 0, abdominalPressure: 0,
  baroreflex: true,
  vo2: 250, hb: 14, sao2: 0.98, extractionDefect: 0,
  pulsusAlternans: 0,
  vvDelay: 0,
  pea: false,
  iabp: false,
};

/** Unstressed volumes (mL) of each compartment at unstressedFraction = 1. */
export const UNSTRESSED = { sa: 720, sv: 2120, pa: 100, pv: 200 };

export const MANEUVERS: Record<Maneuver, { label: string; description: string; apply: (p: HemoParams) => HemoParams }> = {
  none: { label: 'None', description: 'Resting, breathing normally.', apply: (p) => p },
  valsalva: {
    label: 'Valsalva (strain)', description: 'Forced expiration against a closed glottis → ↑ intrathoracic pressure → ↓ venous return (↓ preload).',
    apply: (p) => ({ ...p, intrathoracicBias: p.intrathoracicBias + 30, abdominalPressure: p.abdominalPressure + 20, respDepth: 0 }),
  },
  standing: {
    label: 'Standing (from supine)', description: 'Blood pools in the leg veins → ↓ venous return (↓ preload).',
    apply: (p) => ({ ...p, unstressedFraction: p.unstressedFraction * 1.3 }),
  },
  squatting: {
    label: 'Squatting', description: 'Leg veins compressed (↑ venous return, ↑ preload) and arteries kinked (↑ afterload/SVR).',
    apply: (p) => ({ ...p, unstressedFraction: p.unstressedFraction * 0.85, sysR: p.sysR * 1.3 }),
  },
  handgrip: {
    label: 'Sustained handgrip', description: 'Isometric exercise → ↑ SVR (afterload) and mildly ↑ HR.',
    apply: (p) => ({ ...p, sysR: p.sysR * 1.45, hr: p.hr * 1.08 }),
  },
  legRaise: {
    label: 'Passive leg raise', description: 'Venous blood from the legs returns to the chest → ↑ preload.',
    apply: (p) => ({ ...p, unstressedFraction: p.unstressedFraction * 0.75 }),
  },
  amylNitrite: {
    label: 'Amyl nitrite', description: 'Potent arteriolar (↓ afterload) and venous dilator (↓ preload) with reflex tachycardia.',
    apply: (p) => ({ ...p, sysR: p.sysR * 0.55, unstressedFraction: p.unstressedFraction * 1.05, hr: p.hr * 1.15 }),
  },
  inspiration: {
    label: 'Inspiration (held)', description: '↓ intrathoracic pressure → ↑ venous return to the RIGHT heart (right-sided murmurs louder).',
    apply: (p) => ({ ...p, intrathoracicBias: p.intrathoracicBias - 5, abdominalPressure: p.abdominalPressure + 3, respDepth: 0 }),
  },
  expiration: {
    label: 'Expiration (held)', description: '↑ return to the LEFT heart (left-sided murmurs louder).',
    apply: (p) => ({ ...p, intrathoracicBias: p.intrathoracicBias + 1.5, respDepth: 0 }),
  },
};

export const INTERVENTIONS: Record<Intervention, { label: string; mechanism: string; apply: (p: HemoParams, dose: number) => HemoParams }> = {
  fluids: { label: 'IV fluids', mechanism: '↑ circulating volume → ↑ venous return, preload and (on the ascending Starling limb) stroke volume.', apply: (p, d) => ({ ...p, totalVolume: p.totalVolume + 600 * d }) },
  diuretic: { label: 'Loop diuretic', mechanism: '↓ volume → ↓ preload and filling pressures (relieves congestion).', apply: (p, d) => ({ ...p, totalVolume: p.totalVolume - 600 * d }) },
  nitrate: { label: 'Nitrates', mechanism: 'Venodilation (↓ preload) ≫ arteriolar dilation (↓ afterload); ↓ myocardial O₂ demand.', apply: (p, d) => ({ ...p, unstressedFraction: p.unstressedFraction * (1 + 0.1 * d), sysR: p.sysR * (1 - 0.12 * d) }) },
  inotrope: { label: 'Inotrope (dobutamine)', mechanism: 'β1 agonism → ↑ contractility (ESPVR steeper) and HR; β2 → mild vasodilation.', apply: (p, d) => ({ ...p, lvEes: p.lvEes * (1 + 0.45 * d), rvEes: p.rvEes * (1 + 0.45 * d), hr: p.hr * (1 + 0.12 * d), sysR: p.sysR * (1 - 0.08 * d) }) },
  vasopressor: { label: 'Vasopressor (norepinephrine)', mechanism: 'α1 vasoconstriction → ↑ SVR and venous tone; β1 → modest ↑ contractility.', apply: (p, d) => ({ ...p, sysR: p.sysR * (1 + 0.8 * d), unstressedFraction: p.unstressedFraction * (1 - 0.05 * d), lvEes: p.lvEes * (1 + 0.1 * d) }) },
  betaBlocker: { label: 'β-blocker', mechanism: '↓ HR and contractility → ↓ O₂ demand, longer diastolic filling.', apply: (p, d) => ({ ...p, hr: p.hr * (1 - 0.22 * d), lvEes: p.lvEes * (1 - 0.15 * d), rvEes: p.rvEes * (1 - 0.15 * d) }) },
  afterloadReduction: { label: 'Afterload reduction (e.g. nitroprusside, ACE inhibitor)', mechanism: '↓ SVR → ↑ forward stroke volume in failing hearts, ↓ regurgitant fraction in MR/AR.', apply: (p, d) => ({ ...p, sysR: p.sysR * (1 - 0.4 * d) }) },
  iabp: { label: 'Intra-aortic balloon pump', mechanism: 'Inflates in diastole (↑ coronary perfusion pressure), deflates just before systole (↓ afterload).', apply: (p) => ({ ...p, iabp: true }) },
};

import { presetById } from '../../data/presets';
/** Healthy defaults merged with a preset, then a maneuver and interventions. */
export function paramsFor(presetId = 'normal-hemo', maneuver: Maneuver = 'none', interventions: Partial<Record<Intervention, number>> = {}): HemoParams {
  const pr = presetById(presetId);
  let p: HemoParams = { ...DEFAULT_HEMO, ...(pr?.params ?? {}) };
  p = MANEUVERS[maneuver].apply(p);
  for (const [k, d] of Object.entries(interventions)) if (d) p = INTERVENTIONS[k as Intervention].apply(p, d);
  return p;
}

/**
 * Resolves a declarative EcgModel (from src/data) into per-region electrical parameters.
 * Nothing here is lead-specific: lead changes emerge later from the dipole projection.
 */
import type { Dominance, EcgModel, ExtraSource, MiStage, RegionChange, StShape, VentricularRegionId } from '../../data/types';
import { territoryFor } from '../../data/coronaries';
import { ecgModifiersFrom, type EcgModifiers } from '../cellular/modifiers';
import { REGION_INDEX, VENTRICULAR_REGIONS } from './geometry';
import type { ConductionState } from './activation';

export interface RegionMod {
  /** Hypertrophy multiplier on mass. */
  massScale: number;
  /** Gradient mass multiplier (hypertrophy without proportional repolarisation gradient = strain). */
  gradientMassScale: number;
  /** 0..1 fraction of the region that is necrotic. */
  necrosis: number;
  /** Signed injury current: + transmural (ST vector towards region), − subendocardial (away). */
  injury: number;
  stShape: StShape;
  /** Multiplier on the region's primary repolarisation gradient. */
  tGradient: number;
  /** Extra repolarisation delay (ms). */
  tDelay: number;
}

export interface ResolvedEcg {
  hr: number;
  rhythm: string;
  conduction: ConductionState;
  accessoryPathway?: 'left-lateral' | 'posteroseptal' | 'right-free-wall';
  regions: RegionMod[];
  atria: { raScale: number; laScale: number; laDelay: number; laDurScale: number; injury: number };
  mods: EcgModifiers;
  frontalRot: number;
  horizontalRot: number;
  voltageScale: number;
  alternans: number;
  pericarditis: number;
  brugada: number;
  qtExtraMs: number;
  uWave: number;
  dextrocardia: boolean;
  limbReversal?: 'LA-RA';
  extraSources: ExtraSource[];
  dominance: Dominance;
}

/** How each MI stage maps to injury, necrosis and repolarisation changes (scaled by territory fraction). */
export const MI_STAGE_EFFECTS: Record<MiStage, { injury: number; necrosis: number; tGradient: number; label: string; time: string }> = {
  hyperacute: { injury: 0.35, necrosis: 0.0, tGradient: 3.2, label: 'Hyperacute T waves', time: 'minutes' },
  acute: { injury: 1.0, necrosis: 0.1, tGradient: 1.6, label: 'ST elevation (acute injury)', time: 'minutes – hours' },
  evolving: { injury: 0.55, necrosis: 0.92, tGradient: -0.4, label: 'Q waves developing, ST elevation resolving', time: 'hours – 1 day' },
  reperfused: { injury: 0.08, necrosis: 0.95, tGradient: -2.4, label: 'T-wave inversion', time: 'days' },
  old: { injury: 0.0, necrosis: 0.95, tGradient: 0.7, label: 'Persistent Q waves (old MI)', time: 'weeks – years' },
};

const defaultRegionMod = (): RegionMod => ({ massScale: 1, gradientMassScale: 1, necrosis: 0, injury: 0, stShape: 'convex', tGradient: 1, tDelay: 0 });

function regionTargets(ch: RegionChange): Array<[number, number]> {
  const w = ch.weight ?? 1;
  const out: Array<[number, number]> = [];
  const segs = ch.allLv ? Array.from({ length: 17 }, (_, i) => i + 1) : ch.segments ?? [];
  for (const s of segs) out.push([REGION_INDEX[`seg${s}`], w]);
  for (const r of ch.rv ?? []) out.push([REGION_INDEX[r], w]);
  return out;
}

function applyChange(mods: RegionMod[], idx: number, w: number, ch: RegionChange) {
  const m = mods[idx];
  if (ch.injury) {
    const mag = (ch.injuryMag ?? 1) * w;
    m.injury += ch.injury === 'transmural' ? mag : -mag;
    if (ch.stShape) m.stShape = ch.stShape;
  }
  if (ch.necrosis !== undefined) m.necrosis = Math.max(m.necrosis, Math.min(1, ch.necrosis * w));
  if (ch.tGradient !== undefined) m.tGradient = m.tGradient * (1 - w) + ch.tGradient * w;
  if (ch.tDelay !== undefined) m.tDelay = Math.max(m.tDelay, ch.tDelay * w);
  if (ch.stShape && !ch.injury) m.stShape = ch.stShape;
}

export function resolveEcgModel(model: EcgModel = {}, dominance: Dominance = 'right'): ResolvedEcg {
  const mods = ecgModifiersFrom({ drugs: model.drugs, k: model.electrolytes?.k, ca: model.electrolytes?.ca, mg: model.electrolytes?.mg, temperatureC: model.temperatureC });
  const regions = VENTRICULAR_REGIONS.map(defaultRegionMod);

  // Hypertrophy
  const hy = model.hypertrophy ?? {};
  VENTRICULAR_REGIONS.forEach((r, i) => {
    if (r.chamber === 'LV' && hy.lv) {
      regions[i].massScale = hy.lv;
      // With strain, repolarisation gradient does not grow with the extra mass (relative subendocardial ischemia).
      regions[i].gradientMassScale = hy.strain ? 1 : hy.lv;
    }
    if (r.chamber === 'RV' && hy.rv) {
      regions[i].massScale = hy.rv;
      regions[i].gradientMassScale = hy.strain ? 1 : hy.rv;
    }
  });
  if (hy.strain && hy.lv) {
    // Strain: subendocardial ischemia of the hypertrophied lateral/apical wall → STD + asymmetric TWI in I, aVL, V5–V6.
    for (const s of [5, 6, 11, 12, 16, 17, 13, 7, 1]) {
      const i = REGION_INDEX[`seg${s}`];
      regions[i].injury -= 0.22;
      regions[i].stShape = 'straight';
      regions[i].tGradient = -0.9;
    }
  }
  if (hy.strain && hy.rv) {
    for (const r of ['rvAnt', 'rvLat', 'rvInf', 'rvApex', 'rvot']) regions[REGION_INDEX[r]].tGradient = -1.2;
    for (const s of [2, 8, 14]) regions[REGION_INDEX[`seg${s}`]].tGradient = -0.6;
  }

  // Coronary occlusion → territory × stage
  const dom = model.occlusion?.dominance ?? dominance;
  if (model.occlusion) {
    const rule = territoryFor(model.occlusion.artery, model.occlusion.site, dom);
    const eff = MI_STAGE_EFFECTS[model.occlusion.stage];
    if (rule) {
      for (const [rid, frac] of Object.entries(rule.regions)) {
        const i = REGION_INDEX[rid as VentricularRegionId];
        if (i === undefined || !frac) continue;
        const m = regions[i];
        m.injury += eff.injury * frac;
        m.necrosis = Math.max(m.necrosis, eff.necrosis * frac);
        m.tGradient = m.tGradient * (1 - frac) + eff.tGradient * frac;
        m.stShape = 'convex';
      }
    }
  }

  for (const ch of model.regions ?? []) {
    for (const [i, w] of regionTargets(ch)) applyChange(regions, i, w, ch);
  }

  // Brugada: RVOT epicardial Ito-mediated gradient → coved ST elevation and negative T in V1–V2.
  const brugada = model.global?.brugada ?? 0;
  // (Brugada is rendered as a local RVOT source in synth.ts)

  const conduction: ConductionState = {
    rbbb: !!model.conduction?.rbbb,
    lbbb: !!model.conduction?.lbbb,
    lafb: !!model.conduction?.lafb,
    lpfb: !!model.conduction?.lpfb,
    slowing: (model.conduction?.slowing ?? 1) * mods.slowing,
  };

  const la = hy.la ?? 1;
  const ra = hy.ra ?? 1;
  return {
    hr: Math.round((model.heartRate ?? 72) * mods.hrFactor),
    rhythm: model.rhythm ?? 'sinus',
    conduction,
    accessoryPathway: model.conduction?.accessoryPathway,
    regions,
    atria: { raScale: ra, laScale: la, laDelay: (la - 1) * 22, laDurScale: 1 + (la - 1) * 0.45, injury: model.global?.pericarditis ?? 0 },
    mods,
    frontalRot: model.frontalRotationDeg ?? 0,
    horizontalRot: model.horizontalRotationDeg ?? 0,
    voltageScale: model.global?.voltageScale ?? 1,
    alternans: model.global?.alternans ?? 0,
    pericarditis: model.global?.pericarditis ?? 0,
    brugada,
    qtExtraMs: model.global?.qtExtraMs ?? 0,
    uWave: (model.global?.uWave ?? 1) * mods.uWave,
    dextrocardia: !!model.artefact?.dextrocardia,
    limbReversal: model.artefact?.limbReversal,
    extraSources: model.extraSources ?? [],
    dominance: dom,
  };
}

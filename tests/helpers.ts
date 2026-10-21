import { generateEcg } from '../src/engine/electrical';
import { conditionById } from '../src/data/conditions';
import type { EcgModel } from '../src/data/types';
import { ALL_LEADS } from '../src/engine/electrical/leads';

/** 1 mm on standard ECG paper = 0.1 mV. */
export const MM = 0.1;

export function ecgFor(id: string, stage?: string, extra: Partial<EcgModel> = {}) {
  const c = conditionById(id);
  if (!c) throw new Error(`unknown condition ${id}`);
  const model = stage ? c.stages!.find((s) => s.id === stage)!.model : c.model;
  return generateEcg({ ...model, ...extra }, { leads: ALL_LEADS, durationMs: 8000 });
}

export function measureOf(id: string, stage?: string) {
  const g = ecgFor(id, stage);
  if (!g.measure) throw new Error('no beat measured');
  return g.measure;
}

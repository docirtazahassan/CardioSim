import { resolveEcgModel } from '../src/engine/electrical/model';
import { synthesize } from '../src/engine/electrical/synth';
import { sinusRhythm } from '../src/engine/rhythm/sinus';
import { measureBeat, representativeBeat } from '../src/engine/electrical/measure';
import type { EcgModel, LeadId } from '../src/data/types';

const L: LeadId[] = ['I','II','III','aVR','aVL','aVF','V1','V2','V3','V4','V5','V6','V4R','V7','V8','V9'];
export function show(name: string, model: EcgModel, pr = 160) {
  const R = resolveEcgModel(model);
  const ecg = synthesize(R, sinusRhythm(R.hr, 4000, pr, model.conduction?.accessoryPathway ? { kind: 'preexcited', pathway: model.conduction.accessoryPathway, leadMs: 60 } : { kind: 'normal' }), { leads: L });
  const m = measureBeat(ecg, representativeBeat(ecg));
  console.log(`\n== ${name}: axis ${m.axis.toFixed(0)} hAxis ${m.horizontalAxis.toFixed(0)} QRS ${m.qrs.toFixed(0)} QT ${m.qt.toFixed(0)} PR ${m.pr} t50 ${m.timeTo50}  Taxis ${m.tAxis.toFixed(0)} Paxis ${m.pAxis?.toFixed(0)}`);
  for (const l of L) {
    const x = m.leads[l];
    console.log(`${l.padEnd(4)} ${x.morphology.padEnd(9)} q${x.q.toFixed(2)} R${x.r.toFixed(2)} S${x.s.toFixed(2)} R'${x.rPrime.toFixed(2)} net${(x.qrsNet/1).toFixed(0).padStart(5)} | stJ ${x.stJ.toFixed(2).padStart(5)} st60 ${x.st60.toFixed(2).padStart(5)} | T ${x.t.toFixed(2).padStart(5)} ${x.tBiphasic ?? ''} | P ${x.pMax.toFixed(2)}/${x.pMin.toFixed(2)} term ${x.pTerminalNegArea.toFixed(1)} PRseg ${x.prSegment.toFixed(2)} U ${x.u.toFixed(2)} ${x.notchedR ? 'notch' : ''}`);
  }
}
const which = process.argv[2] ?? 'normal';
const models: Record<string, EcgModel> = {
  normal: {},
  rbbb: { conduction: { rbbb: true } },
  lbbb: { conduction: { lbbb: true } },
  lafb: { conduction: { lafb: true } },
  lpfb: { conduction: { lpfb: true } },
  infRca: { occlusion: { artery: 'RCA', site: 'proximal', stage: 'acute' } },
  infLcx: { occlusion: { artery: 'LCX', site: 'proximal', stage: 'acute', dominance: 'left' } },
  antMid: { occlusion: { artery: 'LAD', site: 'mid', stage: 'acute' } },
  antProx: { occlusion: { artery: 'LAD', site: 'proximal', stage: 'acute' } },
  lat: { occlusion: { artery: 'OM1', site: 'proximal', stage: 'acute' } },
  post: { occlusion: { artery: 'LCX', site: 'distal', stage: 'evolving' } },
  lvh: { hypertrophy: { lv: 1.9, strain: true } },
  rvh: { hypertrophy: { rv: 4.5, strain: true, ra: 1.6 } },
  wpw: { conduction: { accessoryPathway: 'left-lateral' } },
  peri: { global: { pericarditis: 1 } },
};
for (const k of which.split(',')) show(k, models[k]);

import { generateEcg } from '../src/engine/electrical';
import { conditionById } from '../src/data/conditions';
import type { LeadId } from '../src/data/types';
const L: LeadId[] = ['I','II','III','aVR','aVL','aVF','V1','V2','V3','V4','V5','V6','V4R','V7','V8','V9'];
for (const arg of process.argv.slice(2)) {
  const [id, stage] = arg.split(':');
  const c = conditionById(id)!;
  const model = stage ? c.stages!.find(s => s.id === stage)!.model : c.model;
  const g = generateEcg(model, { leads: L, durationMs: 6000 });
  const m = g.measure!;
  console.log(`\n== ${arg}: hr ${g.resolved.hr} axis ${m.axis.toFixed(0)} h ${m.horizontalAxis.toFixed(0)} QRS ${m.qrs.toFixed(0)} QT ${m.qt.toFixed(0)} QTcB ${m.qtcBazett?.toFixed(0)} PR ${m.pr?.toFixed(0)} t50 ${m.timeTo50}`);
  for (const l of L) {
    const x = m.leads[l];
    console.log(`${l.padEnd(4)} ${x.morphology.padEnd(9)} q${x.q.toFixed(2)} R${x.r.toFixed(2)} S${x.s.toFixed(2)} R'${x.rPrime.toFixed(2)} | stJ ${x.stJ.toFixed(2).padStart(5)} st60 ${x.st60.toFixed(2).padStart(5)} sl ${x.stSlope.toFixed(2)} | T ${x.t.toFixed(2).padStart(5)} ${x.tBiphasic ?? ''} | P ${x.pMax.toFixed(2)}/${x.pMin.toFixed(2)} term ${x.pTerminalNegArea.toFixed(1)} PRseg ${x.prSegment.toFixed(2)} U ${x.u.toFixed(2)}`);
  }
}

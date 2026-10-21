import { generateEcg } from '../src/engine/electrical';
import { interpret } from '../src/engine/electrical/interpret';
import { conditionById } from '../src/data/conditions';
import { ALL_LEADS } from '../src/engine/electrical/leads';
for (const id of process.argv.slice(2)) {
  const g = generateEcg(conditionById(id)!.model, { leads: ALL_LEADS, durationMs: 8000 });
  console.log('==', id); for (const x of interpret(g.measure!, g.ecg, g.resolved.hr)) console.log('  -', x.label, '|', x.detail);
}

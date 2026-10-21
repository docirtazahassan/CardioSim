import { resolveEcgModel } from '../src/engine/electrical/model';
import { computeActivation, NORMAL_CONDUCTION } from '../src/engine/electrical/activation';
import { VENTRICULAR_REGIONS } from '../src/engine/electrical/geometry';
import { leadVector } from '../src/engine/electrical/leads';
import { dot } from '../src/engine/math';
const lead = (process.argv[2] ?? 'V1') as any;
const act = computeActivation({ kind: 'normal' }, NORMAL_CONDUCTION);
VENTRICULAR_REGIONS.forEach((r, i) => {
  const a = act.regions[i];
  const c = dot(a.dir, leadVector(lead, r.pos)) * r.mass * (r.isSeptal ? 0.3 : 1) * 0.62;
  console.log(r.id.padEnd(7), 't', a.t.toFixed(0).padStart(3), '-', (a.t + a.transit).toFixed(0).padStart(3), 'contrib', c.toFixed(2));
});

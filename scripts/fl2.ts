import { resolveEcgModel } from '../src/engine/electrical/model';
import { synthesize } from '../src/engine/electrical/synth';
const R = resolveEcgModel({});
const e = synthesize(R, { duration: 1000, atrial: [], ventricular: [], ladder: [], notes: [], continuous: [{ kind: 'flutter', start: 0, end: 1000, rate: 300, seed: 3 }] }, { leads: ['II'] });
let s = ''; for (let t = 0; t < 400; t += 20) s += e.leads.II[t].toFixed(2) + ' '; console.log(s);

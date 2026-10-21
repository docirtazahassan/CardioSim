import { paramsFor } from '../src/engine/hemo/params';
import { HemoSimulator } from '../src/engine/hemo/simulator';
const sim = new HemoSimulator(paramsFor('chb-hemo'), { sampleEvery: 2, maxSamples: 20000 }); sim.advance(30);
const smp = sim.samples.slice(-14000);
const sys: number[] = [], dia: number[] = [];
for (let i = 1; i < smp.length; i++) if (smp[i].eLA > 0 && smp[i-1].eLA === 0) {
  let mx = -99, j = i; while (j < smp.length && smp[j].eLA > 0) { mx = Math.max(mx, smp[j].pRA); j++; }
  (smp[i].eLV > 0.2 ? sys : dia).push(+mx.toFixed(1));
}
console.log('systolic a rises', sys.join(' '), '| diastolic', dia.join(' '));
const n = new HemoSimulator(paramsFor('normal-hemo'), { sampleEvery: 2 }); n.advance(10);
const s2 = n.samples.slice(-3000); const r: number[] = [];
for (let i = 1; i < s2.length; i++) if (s2[i].eLA > 0 && s2[i-1].eLA === 0) { let mx = s2[i].pJV, j = i; while (j < s2.length && s2[j].eLA > 0) { mx = Math.max(mx, s2[j].pJV); j++; } r.push(+(mx - s2[i].pJV).toFixed(1)); }
console.log('normal a rises', r.join(' '));

import { paramsFor } from '../src/engine/hemo/params';
import { HemoSimulator } from '../src/engine/hemo/simulator';
for (const id of ['constrictive','normal-hemo','tamponade']) {
  const sim = new HemoSimulator(paramsFor(id), { sampleEvery: 2, maxSamples: 12000 }); sim.advance(20);
  const smp = sim.samples.slice(-3000);
  const idx = smp.findIndex((x, i) => i > 0 && smp[i - 1].eLV > 0 && x.eLV === 0);
  const s = smp.slice(idx - 30, idx + 250);
  console.log(id, s.filter((_, i) => i % 10 === 0).map(x => x.pRV.toFixed(1)).join(' '));
  console.log('   qTV', s.filter((_, i) => i % 10 === 0).map(x => x.qTV.toFixed(0)).join(' '));
}

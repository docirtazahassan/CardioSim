import { paramsFor } from '../src/engine/hemo/params';
import { HemoSimulator } from '../src/engine/hemo/simulator';
for (const id of ['normal-hemo','constrictive']) {
  const sim = new HemoSimulator(paramsFor(id)); sim.advance(30);
  const smp = sim.samples.slice(-6000);
  const I = smp.filter(x => x.pTh < -6.3), E = smp.filter(x => x.pTh > -3.4);
  const avg = (a: any[], k: string) => (a.reduce((s, x) => s + x[k], 0) / a.length).toFixed(2);
  console.log(id, 'pTh', avg(I,'pTh'), avg(E,'pTh'), 'RA', avg(I,'pRA'), avg(E,'pRA'), 'JV', avg(I,'pJV'), avg(E,'pJV'), 'peri', avg(I,'pPeri'), avg(E,'pPeri'));
}

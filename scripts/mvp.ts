import { paramsFor } from '../src/engine/hemo/params';
import { HemoSimulator } from '../src/engine/hemo/simulator';
for (const m of ['none','standing']) {
  const sim = new HemoSimulator(paramsFor('mvp'), { sampleEvery: 1, maxSamples: 4000 }); sim.advance(24); if (m!=='none') sim.setParams(paramsFor('mvp', m as any)); sim.advance(12);
  const b = sim.beats[sim.beats.length-1];
  const smp = sim.samples.filter(x => x.t >= b.tStart && x.t < b.tEnd);
  const on = smp.find(x => x.m.mr > 0.3), offIdx = smp.map(x=>x.m.mr>0.3).lastIndexOf(true);
  console.log(m, 'click', b.sounds.click, 'mr on', on ? ((on.t-b.tStart)*1000).toFixed(1) : null, 'off', ((smp[offIdx].t-b.tStart)*1000).toFixed(1), 'dur', b.murmurDurationMs.mr, 'peak', b.murmurPeak.mr.toFixed(2));
}

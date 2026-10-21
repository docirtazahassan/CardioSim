import { paramsFor } from '../src/engine/hemo/params';
import { HemoSimulator, averageBeats } from '../src/engine/hemo/simulator';
for (const m of ['none','standing']) {
  const sim = new HemoSimulator(paramsFor('mvp')); sim.advance(24); if (m!=='none') sim.setParams(paramsFor('mvp', m as any)); sim.advance(12);
  const b = sim.beats[sim.beats.length-1];
  console.log(m, 'click', b.sounds.click, 's1', b.sounds.s1, 'mrPeakT', b.murmurPeakMs.mr, 'mrDur', b.murmurDurationMs.mr, 'ejEnd', b.ejectionEndMs);
}
const sim = new HemoSimulator(paramsFor('chb-hemo'), { sampleEvery: 2, maxSamples: 20000 }); sim.advance(30);
const smp = sim.samples.slice(-14000);
for (let i = 1; i < smp.length; i++) if (smp[i].eLA > 0 && smp[i-1].eLA === 0) {
  let mx = smp[i].pJV, mr = smp[i].pRA, j = i; while (j < smp.length && smp[j].eLA > 0) { mx = Math.max(mx, smp[j].pJV); mr = Math.max(mr, smp[j].pRA); j++; }
  console.log('a at', smp[i].t.toFixed(2), 'vRA', smp[i].vRA.toFixed(0), 'pRA0', smp[i].pRA.toFixed(1), 'pRV', smp[i].pRV.toFixed(1), 'eLV', smp[i].eLV.toFixed(2), 'JV rise', (mx - smp[i].pJV).toFixed(1), 'RA rise', (mr - smp[i].pRA).toFixed(1), 'qTV', smp[i].qTV.toFixed(0));
}

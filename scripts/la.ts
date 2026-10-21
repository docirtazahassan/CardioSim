import { paramsFor } from '../src/engine/hemo/params';
import { HemoSimulator, averageBeats } from '../src/engine/hemo/simulator';
for (const id of ['normal-hemo','mitral-stenosis']) {
  const sim = new HemoSimulator(paramsFor(id)); sim.advance(32);
  const s = averageBeats(sim.beats.slice(-8));
  const smp = sim.samples.slice(-2000);
  const mLA = smp.reduce((a,x)=>a+x.pLA,0)/smp.length, mPV = smp.reduce((a,x)=>a+x.pPCW,0)/smp.length, mRA = smp.reduce((a,x)=>a+x.pRA,0)/smp.length;
  console.log(id, 'laMean', s.laMean.toFixed(1), 'pcwp', s.pcwp.toFixed(1), 'samples LA', mLA.toFixed(1), 'PV', mPV.toFixed(1), 'RA', mRA.toFixed(1), 'cvp', s.cvp.toFixed(1));
  const b = sim.beats.slice(-24); console.log(' cvp insp', b.filter(x=>x.insp>0.6).map(x=>x.cvp.toFixed(1)).join(' '), '| exp', b.filter(x=>x.insp<0.3).map(x=>x.cvp.toFixed(1)).join(' '));
}

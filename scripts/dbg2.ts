import { paramsFor } from '../src/engine/hemo/params';
import { HemoSimulator, averageBeats } from '../src/engine/hemo/simulator';
for (const m of ['none','valsalva','standing','squatting','handgrip']) {
  const sim = new HemoSimulator(paramsFor('hocm', m as any)); sim.advance(30);
  const s = averageBeats(sim.beats.slice(-8));
  console.log('hocm', m, 'EDV', s.edv.toFixed(0), 'ESV', s.esv.toFixed(0), 'SV', s.sv.toFixed(0), 'LVOT', s.lvotPeak.toFixed(1), 'LVsys', s.lvSys.toFixed(0), 'SBP', s.sbp.toFixed(0), 'HR', s.hr.toFixed(0));
}
{
  const sim = new HemoSimulator(paramsFor('normal-hemo')); sim.advance(20);
  const smp = sim.samples.slice(-3000);
  const insp = smp.filter(x => x.pTh < -6.5), exp = smp.filter(x => x.pTh > -3.5);
  const avg = (a: any[], k: string) => (a.reduce((s, x) => s + x[k], 0) / a.length).toFixed(2);
  console.log('normal RA insp', avg(insp,'pRA'), 'exp', avg(exp,'pRA'), 'pTh', avg(insp,'pTh'), avg(exp,'pTh'));
}
{
  const sim = new HemoSimulator(paramsFor('chb-hemo')); sim.advance(30);
  const smp = sim.samples.slice(-6000);
  console.log('chb RA max systole', Math.max(...smp.filter(x=>x.eLV>0.3).map(x=>x.pRA)).toFixed(1), 'max diastole', Math.max(...smp.filter(x=>x.eLV===0).map(x=>x.pRA)).toFixed(1), 'beats', sim.beats.length);
}

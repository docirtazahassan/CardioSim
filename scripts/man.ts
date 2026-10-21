import { paramsFor } from '../src/engine/hemo/params';
import { HemoSimulator, averageBeats } from '../src/engine/hemo/simulator';
const preset = process.argv[2] ?? 'aortic-stenosis';
for (const m of ['none', 'legRaise', 'standing', 'valsalva', 'handgrip', 'squatting']) {
  const sim = new HemoSimulator(paramsFor(preset)); sim.advance(24);
  if (m !== 'none') sim.setParams(paramsFor(preset, m as any)); sim.advance(12);
  const s = averageBeats(sim.beats.slice(-6));
  console.log(m.padEnd(10), 'EDV', s.edv.toFixed(1), 'SV', s.sv.toFixed(1), 'HR', s.hr.toFixed(1), 'MAP', s.map.toFixed(1), 'CVP', s.cvp.toFixed(1), 'LVOT', s.lvotPeak.toFixed(1), 'click', s.sounds.click, 'mur', Object.entries(s.murmurs).filter(([,v])=>v>0.5).map(([k,v])=>k+':'+v.toFixed(1)).join(' '), 'baro', JSON.stringify(sim.baro,(k,v)=>typeof v==='number'?+v.toFixed(2):v));
}

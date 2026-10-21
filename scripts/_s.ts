import { HemoSimulator, averageBeats } from '../src/engine/hemo/simulator';
import { paramsFor } from '../src/engine/hemo/params';
import { audibleSoundsAvg } from '../src/engine/hemo/sounds';
import { PRESETS } from '../src/data/presets';
for (const pr of PRESETS) {
  const p = paramsFor(pr.id); const sim = new HemoSimulator(p); sim.advance(20);
  const bs = sim.beats.slice(-7, -1); const b = bs[bs.length-1]; if (!b) { console.log(pr.id, 'no beats'); continue; }
  console.log(pr.id.padEnd(22), audibleSoundsAvg(bs, p).map(e=>e.id+'@'+Math.round(e.t)).join(' '), '| edv', Math.round(b.edv), 'ef', b.ef.toFixed(2), 'mrf', b.mrFraction.toFixed(2), 'qpqs', b.qpqs.toFixed(1));
}

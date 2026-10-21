import { paramsFor } from '../src/engine/hemo/params';
import { HemoSimulator } from '../src/engine/hemo/simulator';
const p = paramsFor('asd'); console.log('asdArea', p.asdArea);
const sim = new HemoSimulator(p); sim.advance(10);
let q = 0; for (const s of sim.samples.slice(-1000)) q += s.qASD; console.log('mean qASD', q / 1000);
const s = sim.samples[sim.samples.length-1]; console.log(s.pLA, s.pRA, s.qASD);

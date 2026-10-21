import { paramsFor } from '../src/engine/hemo/params';
import { HemoSimulator } from '../src/engine/hemo/simulator';
for (const id of ['normal-hemo','asd','constrictive']) {
  const sim = new HemoSimulator(paramsFor(id)); sim.advance(40);
  const b = sim.beats.slice(-24);
  const f = (x: any[], k: (b:any)=>number) => (x.reduce((a,y)=>a+k(y),0)/x.length).toFixed(1);
  const I = b.filter(x=>x.insp>0.6), E = b.filter(x=>x.insp<0.3);
  console.log(id, 'rvEDV', f(I,x=>x.rvEdv), f(E,x=>x.rvEdv), 'lvEDV', f(I,x=>x.edv), f(E,x=>x.edv), 'split insp', f(I,x=>x.sounds.split), 'exp', f(E,x=>x.sounds.split), 'A2', f(I,x=>x.sounds.a2), f(E,x=>x.sounds.a2), 'P2', f(I,x=>x.sounds.p2), f(E,x=>x.sounds.p2), 'jvp insp', f(I,x=>x.jvp), 'exp', f(E,x=>x.jvp), 'qpqs', f(b,x=>x.qpqs));
}

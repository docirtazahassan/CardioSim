import { HemoSimulator } from '../src/engine/hemo/simulator';
import { paramsFor } from '../src/engine/hemo/params';
for (const hr of [72, 120, 170]) for (const baro of [false, true]) {
const s=new HemoSimulator({...paramsFor('normal-hemo'), hr, baroreflex: baro}); s.advance(60);
const b=s.beats.slice(-5); const x=b[b.length-1];
console.log(hr, baro, 'BP', Math.round(x.sbp)+'/'+Math.round(x.dbp), 'CO', x.co.toFixed(2), 'SV', Math.round(x.sv), 'EDV', Math.round(x.edv), 'LVEDP', x.lvEdp.toFixed(1), 'CVP', x.cvp.toFixed(1), 'HRe', Math.round(x.hr));
}

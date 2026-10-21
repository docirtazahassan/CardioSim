import { paramsFor } from '../src/engine/hemo/params';
import { steadyState } from '../src/engine/hemo/simulator';
const f = (x: number) => x.toFixed(1);
for (const arg of process.argv.slice(2)) {
  const [id, man] = arg.split(':');
  const { summary: s } = steadyState(paramsFor(id, (man as any) ?? 'none'), 35);
  console.log(`== ${arg}: HR ${f(s.hr)} SV ${f(s.sv)} EDV ${f(s.edv)} ESV ${f(s.esv)} EF ${f(s.ef*100)} CO ${f(s.co)} QpQs ${s.qpqs.toFixed(2)} BP ${f(s.sbp)}/${f(s.dbp)} MAP ${f(s.map)} LV ${f(s.lvSys)}/${f(s.lvEdp)} RV ${f(s.rvSys)}/${f(s.rvEdp)} PA ${f(s.paSys)}/${f(s.paDia)} PCWP ${f(s.pcwp)} LAv ${f(s.laV)} CVP ${f(s.cvp)} SVR ${f(s.svr)} SvO2 ${f(s.svo2*100)} AVg ${f(s.avGradMean)} MVg ${f(s.mvGradMean)} LVOT ${f(s.lvotPeak)} ARf ${f(s.arFraction*100)} MRf ${f(s.mrFraction*100)} up ${f(s.upstrokeMs)} ivc ${f(s.ivcVolumeChange)} ivr ${f(s.ivrVolumeChange)} peri ${f(s.pPeriMean)}`);
  console.log('   sounds', JSON.stringify(s.sounds, (k,v)=> typeof v==='number'? +v.toFixed(1): v), 'mur', Object.entries(s.murmurs).filter(([,v])=>v>0.05).map(([k,v])=>k+':'+v.toFixed(2)).join(' '));
}

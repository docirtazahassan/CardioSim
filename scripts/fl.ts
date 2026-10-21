import { generateRhythmEcg } from '../src/engine/electrical';
const g = generateRhythmEcg('flutter', {}, { durationMs: 4000, leads: ['II'] });
const b = g.ecg.beats; console.log(b.slice(3,6).map(x=>[x.qrsOn|0,x.qrsOff|0,x.tEnd|0]));
const II = g.ecg.leads.II; let s=''; for (let t=b[4].qrsOn|0; t< (b[5].qrsOn|0); t+=10) s+= II[t].toFixed(2)+' '; console.log(s);

import { generateRhythmEcg } from '../src/engine/electrical';
import { atrialTemplate } from '../src/engine/electrical/synth';
const g = generateRhythmEcg('mat', {}, { durationMs: 8000, leads: ['II'] });
const os = [...new Set(g.ecg.rhythm.atrial.map(a => JSON.stringify(a.origin)))];
for (const o of os) { const t = atrialTemplate(g.resolved, JSON.parse(o), ['II']); const x = t.leads.get('II')!; let a=0; for (const v of x) if (Math.abs(v)>Math.abs(a)) a=v; console.log(o, a.toFixed(3)); }

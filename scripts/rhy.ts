import { generateRhythmEcg } from '../src/engine/electrical';
for (const id of process.argv.slice(2)) {
  const g = generateRhythmEcg(id, {}, { durationMs: 12000, leads: ['II','V1'] });
  const r = g.ecg.rhythm;
  const vs = r.ventricular.map(v => v.t);
  const rr = vs.slice(1).map((t,i)=> Math.round(t - vs[i]));
  const pr = r.ventricular.filter(v=>v.fromAtrial!==undefined).map(v=> Math.round(v.t - r.atrial[v.fromAtrial!].t));
  console.log(`\n== ${id}: A ${r.atrial.length} V ${r.ventricular.length} cont ${r.continuous.map(c=>c.kind)} notes ${r.notes}`);
  console.log(' RR', rr.join(' '));
  console.log(' PR', pr.join(' '));
  console.log(' src', r.ventricular.map(v=>v.source[0]+(v.pattern.kind[0])).join(''));
  console.log(' blocked', r.ladder.filter(l=>l.blocked).length, ' A origins', [...new Set(r.atrial.map(a=>a.origin.kind + ((a.origin as any).id??'')))].join(','));
}

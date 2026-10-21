import { VENTRICULAR_REGIONS, U_ANT, U_SEP, LV_AXIS, NEIGHBOURS } from '../src/engine/electrical/geometry';
const f = (v: number[]) => v.map((x) => x.toFixed(2)).join(',');
console.log('U_ANT', f(U_ANT), 'U_SEP', f(U_SEP), 'AXIS', f(LV_AXIS));
VENTRICULAR_REGIONS.forEach((r, i) => {
  const fr = Math.atan2(r.n[1], r.n[0]) * 180 / Math.PI;
  const hz = Math.atan2(r.n[2], r.n[0]) * 180 / Math.PI;
  console.log(r.id.padEnd(7), 'pos', f(r.pos), 'n', f(r.n), 'frontal', fr.toFixed(0), 'horiz', hz.toFixed(0), 'nb', NEIGHBOURS[i].map(j => VENTRICULAR_REGIONS[j].id).join(' '));
});

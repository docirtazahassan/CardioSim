import { computeActivation, NORMAL_CONDUCTION } from '../src/engine/electrical/activation';
import { VENTRICULAR_REGIONS } from '../src/engine/electrical/geometry';
const c = { ...NORMAL_CONDUCTION, [process.argv[2] ?? 'lpfb']: true } as any;
const a = computeActivation({ kind: 'normal' }, c);
const n = computeActivation({ kind: 'normal' }, NORMAL_CONDUCTION);
let sx = 0, sy = 0;
VENTRICULAR_REGIONS.forEach((r, i) => {
  const x = a.regions[i], y = n.regions[i];
  const ar = x.halves ? x.halves.reduce((s, h) => [s[0]+h.area[0], s[1]+h.area[1], s[2]+h.area[2]], [0,0,0]) : x.area;
  sx += ar[0] * r.mass; sy += ar[1] * r.mass;
  console.log(r.id.padEnd(7), 't', y.t.toFixed(0).padStart(3), '->', x.t.toFixed(0).padStart(3), x.viaPurkinje ? 'P' : 'm', 'area', ar.map(v => v.toFixed(2)).join(','), ' n', r.n.map(v=>v.toFixed(2)).join(','));
});
console.log('frontal angle of sum', (Math.atan2(sy, sx) * 180 / Math.PI).toFixed(0));

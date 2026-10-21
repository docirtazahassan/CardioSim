import { norm, cross, dot, add, scale, orthoNorm, type V3 } from '../src/engine/math';
const desired: V3[] = [[0.15,-0.45,0.88],[-0.6,-0.2,0.77],[-0.65,0.6,0.45],[0.05,0.92,-0.38],[0.55,0.35,-0.76],[0.9,-0.3,-0.3]].map(v=>norm(v as V3));
let best = { err: 1e9, a: [0,0,0] as V3, psi: 0 };
for (let ax = -1; ax <= 1; ax += 0.05) for (let ay = -1; ay <= 1; ay += 0.05) for (let az = -1; az <= 1; az += 0.05) {
  if (ax < 0.2 || ay < 0 || az < 0) continue; // apex: left, inferior, anterior
  const a = norm([ax, ay, az]);
  for (let psi = 0; psi < 360; psi += 3) {
    // build U_ANT by rotating a reference ⟂ vector by psi
    const ref = orthoNorm([0, 0, 1], a);
    const ref2 = norm(cross(a, ref));
    const r = psi * Math.PI / 180;
    const uAnt = norm(add(scale(ref, Math.cos(r)), scale(ref2, Math.sin(r))));
    const uSep = norm(cross(a, uAnt)); // try both handedness
    for (const sgn of [1, -1]) {
      let err = 0;
      for (let k = 0; k < 6; k++) {
        const ph = k * 60 * Math.PI / 180;
        const c = norm(add(scale(uAnt, Math.cos(ph)), scale(uSep, sgn * Math.sin(ph))));
        err += 1 - dot(c, desired[k]);
      }
      if (err < best.err) best = { err, a, psi: psi * sgn };
    }
  }
}
console.log(best.err.toFixed(3), best.a.map(v=>v.toFixed(3)).join(','), best.psi);
const a = best.a; const ref = orthoNorm([0,0,1], a); const ref2 = norm(cross(a, ref)); const r = Math.abs(best.psi)*Math.PI/180;
const uAnt = norm(add(scale(ref, Math.cos(r)), scale(ref2, Math.sin(r)))); const sgn = Math.sign(best.psi)||1;
const uSep = scale(norm(cross(a, uAnt)), sgn);
console.log('U_ANT', uAnt.map(v=>v.toFixed(3)).join(','), 'U_SEP', uSep.map(v=>v.toFixed(3)).join(','));
for (let k=0;k<6;k++){const ph=k*60*Math.PI/180; const c=norm(add(scale(uAnt,Math.cos(ph)),scale(uSep,Math.sin(ph)))); console.log(k*60, c.map(v=>v.toFixed(2)).join(','), 'frontal', (Math.atan2(c[1],c[0])*180/Math.PI).toFixed(0));}

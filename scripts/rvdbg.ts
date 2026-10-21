import { resolveEcgModel } from '../src/engine/electrical/model';
import { ventricularSources } from '../src/engine/electrical/synth';
for (const rv of [1, 5, 10]) {
  const R = resolveEcgModel({ hypertrophy: { rv } });
  const { sources, qrsDur } = ventricularSources(R, { kind: 'normal' }, 830);
  let sx = 0, sy = 0, rx = 0;
  for (const s of sources) {
    let a = 0; for (let k = 0; k < s.wave.length; k++) if (s.t0 + k <= qrsDur) a += s.wave[k];
    if (s.t0 > qrsDur) continue;
    sx += s.vec[0] * a; sy += s.vec[1] * a;
  }
  console.log('rv', rv, 'qrsDur', qrsDur.toFixed(0), 'area x', sx.toFixed(1), 'y', sy.toFixed(1), 'axis', (Math.atan2(sy, sx) * 180 / Math.PI).toFixed(0), 'nsrc', sources.length);
}

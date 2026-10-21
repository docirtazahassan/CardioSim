/**
 * Ground-truth hemodynamic tests 25–32 (+ the hemodynamic parts of tests 6 and 24).
 * Directions of change are asserted against the healthy baseline, all emerging from the
 * lumped circulation model.
 */
import { describe, expect, it } from 'vitest';
import { paramsFor } from '../src/engine/hemo/params';
import { HemoSimulator, averageBeats, type BeatSummary } from '../src/engine/hemo/simulator';
import type { Intervention, Maneuver } from '../src/data/types';

const cache = new Map<string, { s: BeatSummary; sim: HemoSimulator }>();
function run(preset: string, maneuver: Maneuver = 'none', iv: Partial<Record<Intervention, number>> = {}, seconds = 32) {
  const key = `${preset}|${maneuver}|${JSON.stringify(iv)}|${seconds}`;
  if (!cache.has(key)) {
    const sim = new HemoSimulator(paramsFor(preset, maneuver, iv), { sampleEvery: 2, maxSamples: 12000 });
    sim.advance(seconds);
    cache.set(key, { s: sim.beats.length ? averageBeats(sim.beats.slice(-8)) : (null as unknown as BeatSummary), sim });
  }
  return cache.get(key)!;
}
const N = () => run('normal-hemo').s;

/** Bedside maneuver: steady baseline, then the maneuver; measure the acute response (6–12 s). */
const mcache = new Map<string, BeatSummary>();
function man(preset: string, maneuver: Maneuver) {
  const key = `${preset}|${maneuver}`;
  if (!mcache.has(key)) {
    const sim = new HemoSimulator(paramsFor(preset), { sampleEvery: 8, maxSamples: 4000 });
    sim.advance(24);
    if (maneuver !== 'none') sim.setParams(paramsFor(preset, maneuver));
    sim.advance(12);
    mcache.set(key, averageBeats(sim.beats.slice(-6)));
  }
  return mcache.get(key)!;
}
const lastBeats = (sim: HemoSimulator, n = 14) => sim.beats.slice(-n);

// ---------------------------------------------------------------- 25
describe('25. Heart failure', () => {
  it('HFrEF: ↓ ESPVR slope, ↑ EDV, ↓ EF, ↑ PCWP (PV loop shifts right)', () => {
    const h = run('hfref').s, n = N();
    expect(paramsFor('hfref').lvEes).toBeLessThan(paramsFor('normal-hemo').lvEes);
    expect(h.edv).toBeGreaterThan(n.edv + 40);
    expect(h.esv).toBeGreaterThan(n.esv + 40);
    expect(h.ef).toBeLessThan(0.4);
    expect(h.pcwp).toBeGreaterThan(n.pcwp + 2);
    expect(h.sounds.s3).toBeGreaterThanOrEqual(n.sounds.s3 * 0.9);
  });
  it('HFpEF: steep EDPVR, normal EF, ↑ filling pressures', () => {
    const h = run('hfpef').s, n = N();
    expect(h.ef).toBeGreaterThan(0.5);
    expect(h.lvEdp).toBeGreaterThan(n.lvEdp + 8);
    expect(h.pcwp).toBeGreaterThan(n.pcwp + 6);
    expect(h.edv).toBeLessThanOrEqual(n.edv);
    expect(h.sounds.s4).toBeGreaterThan(n.sounds.s4);
  });
});

// ---------------------------------------------------------------- 26
describe('26. Aortic valve disease', () => {
  it('AS: high LV systolic pressure, LV–aortic gradient, parvus et tardus, crescendo–decrescendo murmur', () => {
    const a = run('aortic-stenosis').s, n = N();
    expect(a.lvSys).toBeGreaterThan(a.sbp + 40);
    expect(a.avGradMean).toBeGreaterThan(40);
    expect(a.upstrokeMs).toBeGreaterThan(n.upstrokeMs * 1.5); // tardus
    expect(a.pp).toBeLessThan(n.pp); // parvus
    expect(a.murmurs.as).toBeGreaterThan(5 * Math.max(1, n.murmurs.as));
    // crescendo–decrescendo: peak in the middle of ejection
    const mid = (a.murmurPeakMs.as! - a.ejectionStartMs!) / (a.ejectionEndMs! - a.ejectionStartMs!);
    expect(mid).toBeGreaterThan(0.25);
    expect(mid).toBeLessThan(0.75);
  });
  it('AR: wide pulse pressure, no true isovolumetric relaxation, early diastolic decrescendo murmur', () => {
    const r = run('aortic-regurgitation').s, n = N();
    expect(r.pp).toBeGreaterThan(n.pp + 40);
    expect(r.dbp).toBeLessThan(n.dbp - 15);
    expect(r.ivrVolumeChange).toBeGreaterThan(3); // LV fills from the aorta before the MV opens
    expect(Math.abs(n.ivrVolumeChange)).toBeLessThan(1);
    expect(r.murmurs.ar).toBeGreaterThan(5);
    expect(r.murmurPeakMs.ar! - r.sounds.a2!).toBeLessThan(130); // peaks in early diastole, then decreases
    const smp = run('aortic-regurgitation').sim.samples;
    const late = smp.slice(-1600).filter((x) => x.eLV === 0 && x.qMV > 0);
    expect(Math.min(...late.map((x) => x.m.ar))).toBeLessThan(r.murmurs.ar * 0.7);
  });
});

// ---------------------------------------------------------------- 27
describe('27. Mitral valve disease', () => {
  it('MS: ↑ LA pressure, LA–LV diastolic gradient, opening snap with short A2–OS, diastolic rumble', () => {
    const m = run('mitral-stenosis').s, n = N();
    expect(m.laMean).toBeGreaterThan(n.laMean + 5);
    expect(m.mvGradMean).toBeGreaterThan(5);
    expect(m.sounds.os!).toBeLessThan(n.sounds.os!);
    expect(m.murmurs.ms).toBeGreaterThan(1 + n.murmurs.ms);
    expect(m.paMean).toBeGreaterThan(n.paMean);
  });
  it('MR: no true isovolumetric contraction; acute = large v wave in a small LA, chronic = dilated compliant LA', () => {
    const a = run('mr-acute').s, c = run('mr-chronic').s, n = N();
    expect(a.ivcVolumeChange).toBeLessThan(-2);
    expect(Math.abs(n.ivcVolumeChange)).toBeLessThan(1);
    expect(a.laV - a.laMean).toBeGreaterThan(c.laV - c.laMean + 3);
    expect(a.laV).toBeGreaterThan(c.laV);
    expect(a.pcwp).toBeGreaterThan(c.pcwp);
    expect(a.murmurs.mr).toBeGreaterThan(5);
    const laVolA = run('mr-acute').sim.samples.slice(-500).reduce((x, s) => Math.max(x, s.vLA), 0);
    const laVolC = run('mr-chronic').sim.samples.slice(-500).reduce((x, s) => Math.max(x, s.vLA), 0);
    expect(laVolC).toBeGreaterThan(laVolA + 30);
  });
});

// ---------------------------------------------------------------- 28
describe('28. Shunts', () => {
  it('VSD: left-to-right shunt, Qp:Qs > 1.5, holosystolic murmur', () => {
    const v = run('vsd').s;
    expect(v.qpqs).toBeGreaterThan(1.5);
    expect(v.murmurs.vsd).toBeGreaterThan(5);
  });
  it('ASD: Qp:Qs > 1.5 with wide FIXED split S2', () => {
    const { sim, s } = run('asd', 'none', {}, 40);
    expect(s.qpqs).toBeGreaterThan(1.5);
    const beats = lastBeats(sim, 24);
    const insp = beats.filter((b) => b.insp > 0.6 && b.sounds.split !== null);
    const exp = beats.filter((b) => b.insp < 0.3 && b.sounds.split !== null);
    const mean = (x: BeatSummary[]) => x.reduce((a, b) => a + b.sounds.split!, 0) / x.length;
    const nExp = lastBeats(run('normal-hemo', 'none', {}, 40).sim, 24).filter((b) => b.insp < 0.3);
    expect(mean(exp)).toBeGreaterThan(mean(nExp) + 10);
    expect(Math.abs(mean(insp) - mean(exp))).toBeLessThan(12);
    // normal: physiological split widens on inspiration
    const ns = lastBeats(run('normal-hemo', 'none', {}, 40).sim, 24);
    const ni = ns.filter((b) => b.insp > 0.6), ne = ns.filter((b) => b.insp < 0.3);
    expect(mean(ni) - mean(ne)).toBeGreaterThan(12);
  });
  it('PDA: continuous (systolic AND diastolic) aorta → PA flow with Qp:Qs > 1', () => {
    const { sim, s } = run('pda');
    expect(s.qpqs).toBeGreaterThan(1.3);
    const smp = sim.samples.slice(-1500);
    const sys = smp.filter((x) => x.eLV > 0.3), dia = smp.filter((x) => x.eLV === 0);
    expect(sys.every((x) => x.qPDA > 0)).toBe(true);
    expect(dia.every((x) => x.qPDA > 0)).toBe(true);
    expect(s.murmurs.pda).toBeGreaterThan(2);
  });
  it('Eisenmenger: high PVR reverses the shunt (Qp:Qs < 1)', () => {
    const e = run('eisenmenger').s;
    expect(e.qpqs).toBeLessThan(1);
    expect(e.paSys).toBeGreaterThan(80);
  });
});

// ---------------------------------------------------------------- 29
describe('29. HOCM dynamic obstruction', () => {
  const g = (m: Maneuver) => man('hocm', m).lvotPeak;
  const base = g('none');
  it('gradient ↑ with Valsalva, standing and nitrates (↓ preload/afterload)', () => {
    expect(g('valsalva')).toBeGreaterThan(base * 1.1);
    expect(g('standing')).toBeGreaterThan(base * 1.05);
    expect(run('hocm', 'none', { nitrate: 1 }).s.lvotPeak).toBeGreaterThan(run('hocm').s.lvotPeak * 1.05);
    expect(g('amylNitrite')).toBeGreaterThan(base * 1.05);
  });
  it('gradient ↓ with squatting, handgrip and leg raise', () => {
    expect(g('squatting')).toBeLessThan(base * 0.95);
    expect(g('handgrip')).toBeLessThan(base * 0.95);
    expect(g('legRaise')).toBeLessThan(base * 0.95);
  });
  it('murmur follows the gradient', () => {
    expect(man('hocm', 'valsalva').murmurs.hocm).toBeGreaterThan(man('hocm', 'none').murmurs.hocm);
    expect(man('hocm', 'squatting').murmurs.hocm).toBeLessThan(man('hocm', 'none').murmurs.hocm);
  });
});

// ---------------------------------------------------------------- 30
describe('30. Pericardial disease', () => {
  it('tamponade: equalisation of diastolic pressures, pulsus paradoxus > 10 mmHg, ↓ CO, blunted y descent', () => {
    const { sim, s } = run('tamponade', 'none', {}, 40), n = N();
    const diastolic = [s.cvp, s.rvEdp, s.paDia, s.pcwp];
    expect(Math.max(...diastolic) - Math.min(...diastolic)).toBeLessThan(5);
    expect(s.co).toBeLessThan(n.co * 0.85);
    const sbps = lastBeats(sim, 20).map((b) => b.sbp);
    expect(Math.max(...sbps) - Math.min(...sbps)).toBeGreaterThan(10);
    const ns = lastBeats(run('normal-hemo', 'none', {}, 40).sim, 20).map((b) => b.sbp);
    expect(Math.max(...ns) - Math.min(...ns)).toBeLessThan(10);
    const yT = s.raV - s.raMin, yC = run('constrictive').s.raV - run('constrictive').s.raMin;
    expect(yT).toBeLessThan(yC);
  });
  it('constriction: Kussmaul sign, square-root sign, pericardial knock', () => {
    const { sim } = run('constrictive', 'none', {}, 40);
    // Kussmaul: the JVP fails to fall (or rises) on inspiration; normally it falls
    const jvpSwing = (sm: typeof sim.samples) => {
      const I = sm.filter((x) => x.pTh < -6.3), E = sm.filter((x) => x.pTh > -3.4);
      const avg = (a: typeof sm) => a.reduce((acc, x) => acc + x.pJV, 0) / a.length;
      return avg(I) - avg(E);
    };
    expect(jvpSwing(sim.samples.slice(-6000))).toBeGreaterThan(-0.25);
    expect(jvpSwing(run('normal-hemo', 'none', {}, 40).sim.samples.slice(-6000))).toBeLessThan(-0.35);
    // square root sign: RV diastolic pressure dips early, rises quickly, then stays flat (plateau)
    const smp = sim.samples.slice(-3000);
    const idx = smp.findIndex((x, i) => i > 0 && smp[i - 1].eLV > 0 && x.eLV === 0);
    const next = smp.findIndex((x, i) => i > idx && smp[i - 1].eLV === 0 && x.eLV > 0);
    const dia = smp.slice(idx, next);
    const minI = dia.reduce((m, x, i) => (x.pRV < dia[m].pRV ? i : m), 0);
    const plateau = dia[Math.floor(dia.length * 0.85)].pRV;
    const rise = plateau - dia[minI].pRV;
    expect(rise).toBeGreaterThan(5);
    const t90 = dia.findIndex((x, i) => i > minI && x.pRV >= dia[minI].pRV + 0.9 * rise);
    expect(t90 / dia.length).toBeLessThan(0.4); // plateau reached in the first part of diastole
    const half = dia[Math.floor(dia.length * 0.5)].pRV;
    expect(Math.abs(plateau - half)).toBeLessThan(0.2 * rise); // flat plateau
    expect(run('constrictive').s.sounds.knock).toBeGreaterThan(0);
    expect(N().sounds.knock).toBe(0);
  });
});

// ---------------------------------------------------------------- 31
describe('31. Shock profiles (CVP, PCWP, CO, SVR, SvO₂)', () => {
  const n = () => N();
  it('hypovolemic: ↓ CVP, ↓ PCWP, ↓ CO, ↑ SVR, ↓ SvO₂', () => {
    const s = run('hypovolemic-shock').s;
    expect(s.cvp).toBeLessThan(n().cvp); expect(s.pcwp).toBeLessThan(n().pcwp);
    expect(s.co).toBeLessThan(n().co); expect(s.svr).toBeGreaterThan(n().svr); expect(s.svo2).toBeLessThan(n().svo2);
  });
  it('cardiogenic: ↑ CVP, ↑ PCWP, ↓ CO, ↑ SVR, ↓ SvO₂', () => {
    const s = run('cardiogenic-shock').s;
    expect(s.cvp).toBeGreaterThan(n().cvp); expect(s.pcwp).toBeGreaterThan(n().pcwp);
    expect(s.co).toBeLessThan(n().co); expect(s.svr).toBeGreaterThan(n().svr); expect(s.svo2).toBeLessThan(n().svo2);
  });
  it('distributive (septic): ↓ CVP, ↓ PCWP, ↑ CO, ↓ SVR, ↑ SvO₂', () => {
    const s = run('septic-shock').s;
    expect(s.cvp).toBeLessThan(n().cvp); expect(s.pcwp).toBeLessThan(n().pcwp);
    expect(s.co).toBeGreaterThan(n().co); expect(s.svr).toBeLessThan(n().svr); expect(s.svo2).toBeGreaterThan(n().svo2);
  });
  it('obstructive (PE): ↑ CVP, ↓ PCWP, ↓ CO, ↑ SVR, ↓ SvO₂; tamponade: ↑ CVP and PCWP', () => {
    const s = run('obstructive-shock-pe').s;
    expect(s.cvp).toBeGreaterThan(n().cvp); expect(s.pcwp).toBeLessThan(n().pcwp);
    expect(s.co).toBeLessThan(n().co); expect(s.svr).toBeGreaterThan(n().svr); expect(s.svo2).toBeLessThan(n().svo2);
    const t = run('tamponade').s;
    expect(t.cvp).toBeGreaterThan(n().cvp);
  });
});

// ---------------------------------------------------------------- 32
describe('32. Murmur maneuvers', () => {
  it('↑ preload (leg raise) increases AS, MR and VSD murmurs', () => {
    for (const [p, k] of [['aortic-stenosis', 'as'], ['mr-chronic', 'mr'], ['vsd', 'vsd']] as const) {
      expect(man(p, 'legRaise').murmurs[k]).toBeGreaterThan(man(p, 'none').murmurs[k]);
    }
  });
  it('MVP: ↓ preload (standing, Valsalva) → earlier click and longer murmur', () => {
    const b = man('mvp', 'none'), st = man('mvp', 'standing'), va = man('mvp', 'valsalva'), lr = man('mvp', 'legRaise');
    expect(b.sounds.click).not.toBeNull();
    expect(st.sounds.click!).toBeLessThan(b.sounds.click!);
    expect(va.sounds.click!).toBeLessThan(b.sounds.click!);
    expect(lr.sounds.click ?? 1e9).toBeGreaterThan(b.sounds.click!);
    // the murmur (click → S2) occupies a larger part of systole
    const frac = (x: typeof b) => (x.sounds.a2! - x.sounds.click!) / (x.sounds.a2! - (x.sounds.s1 ?? 0));
    expect(frac(st)).toBeGreaterThan(frac(b));
    expect(frac(va)).toBeGreaterThan(frac(b));
  });
  it('handgrip (↑ afterload): ↑ MR, AR, VSD; ↓ AS and HOCM', () => {
    for (const [p, k] of [['mr-chronic', 'mr'], ['aortic-regurgitation', 'ar'], ['vsd', 'vsd']] as const) {
      expect(man(p, 'handgrip').murmurs[k]).toBeGreaterThan(man(p, 'none').murmurs[k]);
    }
    expect(man('aortic-stenosis', 'handgrip').murmurs.as).toBeLessThan(man('aortic-stenosis', 'none').murmurs.as);
    expect(man('hocm', 'handgrip').murmurs.hocm).toBeLessThan(man('hocm', 'none').murmurs.hocm);
  });
  it('amyl nitrite (↓ afterload): ↓ MR and AR, ↑ AS', () => {
    expect(man('mr-chronic', 'amylNitrite').murmurs.mr).toBeLessThan(man('mr-chronic', 'none').murmurs.mr);
    expect(man('aortic-regurgitation', 'amylNitrite').murmurs.ar).toBeLessThan(man('aortic-regurgitation', 'none').murmurs.ar);
    expect(man('aortic-stenosis', 'amylNitrite').murmurs.as).toBeGreaterThan(man('aortic-stenosis', 'none').murmurs.as);
  });
});

// ---------------------------------------------------------------- 6 & 24 (hemodynamic parts)
describe('6. RV infarction is preload dependent', () => {
  it('hypotension with high CVP and low PCWP; fluids raise and nitrates lower BP', () => {
    const r = run('rv-infarct').s, n = N();
    expect(r.map).toBeLessThan(n.map - 5);
    expect(r.cvp).toBeGreaterThan(r.pcwp);
    const fl = run('rv-infarct', 'none', { fluids: 1 }).s;
    const ni = run('rv-infarct', 'none', { nitrate: 1 }).s;
    expect(fl.co).toBeGreaterThan(r.co);
    expect(fl.map).toBeGreaterThan(r.map);
    expect(r.map - ni.map).toBeGreaterThan(N().map - run('normal-hemo', 'none', { nitrate: 1 }).s.map);
  });
});

describe('24. PEA: organised ECG with zero mechanical output', () => {
  it('no ejection, pulse pressure collapses', () => {
    const { sim } = run('pea-hemo', 'none', {}, 12);
    // samples are 1 ms apart: integrate forward aortic flow over the last 2 s
    const ejected = sim.samples.slice(-2000).reduce((a, x) => a + Math.max(0, x.qAV) * 0.001, 0);
    expect(ejected).toBeLessThan(5);
    const late = sim.samples.slice(-1000).map((x) => x.pAo);
    expect(Math.max(...late) - Math.min(...late)).toBeLessThan(2);
  });
});

describe('Rhythm → mechanics coupling', () => {
  it('AF: no a wave and beat-to-beat stroke volume variation', () => {
    const { sim } = run('af-hemo', 'none', {}, 30);
    const sv = sim.beats.slice(-15).map((b) => b.sv);
    expect(Math.max(...sv) - Math.min(...sv)).toBeGreaterThan(10);
  });
  it('complete heart block: intermittent giant (cannon) a waves from variable AV timing', () => {
    const peaks = (sim: HemoSimulator) => {
      const smp = sim.samples.slice(-14000);
      const out: number[] = [];
      for (let i = 1; i < smp.length; i++) {
        if (smp[i].eLA > 0 && smp[i - 1].eLA === 0) {
          let mx = -99, j = i;
          while (j < smp.length && smp[j].eLA > 0) { mx = Math.max(mx, smp[j].pJV); j++; }
          out.push(mx);
        }
      }
      return out;
    };
    const chb = peaks(run('chb-hemo', 'none', {}, 30).sim);
    const nrm = peaks(run('normal-hemo', 'none', {}, 30).sim);
    expect(Math.max(...chb)).toBeGreaterThan(Math.max(...nrm) + 4);
    expect(Math.max(...chb) - Math.min(...chb)).toBeGreaterThan(3); // intermittent
  });
});

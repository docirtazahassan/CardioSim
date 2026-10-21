/**
 * Ground-truth rhythm tests 21–24. The rhythms emerge from the conduction-system engine.
 */
import { describe, expect, it } from 'vitest';
import { generateRhythmEcg } from '../src/engine/electrical';
import type { AtrialOrigin, RhythmOutput } from '../src/engine/rhythm/types';
import { atrialTemplate } from '../src/engine/electrical/synth';
import type { ResolvedEcg } from '../src/engine/electrical/model';
import type { LeadId } from '../src/data/types';

/** Signed peak of a P-wave template in one lead. */
function pPeak(R: ResolvedEcg, origin: AtrialOrigin, lead: LeadId) {
  const tpl = atrialTemplate(R, origin, [lead]);
  const x = tpl.leads.get(lead)!;
  let a = 0;
  for (let t = 0; t < tpl.zero + tpl.pDur; t++) if (Math.abs(x[t]) > Math.abs(a)) a = x[t];
  return a;
}

const run = (id: string, extra: Parameters<typeof generateRhythmEcg>[2] = {}) =>
  generateRhythmEcg(id, {}, { durationMs: 14000, leads: ['I', 'II', 'III', 'aVF', 'V1', 'V6'], ...extra });

const rrs = (r: RhythmOutput, from = 0) => {
  const v = r.ventricular.filter((x) => x.t >= from).map((x) => x.t);
  return v.slice(1).map((t, i) => t - v[i]);
};
const prs = (r: RhythmOutput) => r.ventricular.filter((v) => v.fromAtrial !== undefined && r.atrial[v.fromAtrial].origin.kind === 'sinus').map((v) => v.t - r.atrial[v.fromAtrial!].t);
const cv = (x: number[]) => {
  const m = x.reduce((a, b) => a + b, 0) / x.length;
  return Math.sqrt(x.reduce((a, b) => a + (b - m) ** 2, 0) / x.length) / m;
};
const rate = (intervals: number[]) => 60000 / (intervals.reduce((a, b) => a + b, 0) / intervals.length);

// ---------------------------------------------------------------- 21
describe('21. AV blocks', () => {
  it('first-degree: PR > 200 ms, every P conducted', () => {
    const r = run('first-degree-avb').ecg.rhythm;
    for (const pr of prs(r)) expect(pr).toBeGreaterThan(200);
    expect(r.atrial.every((a) => a.conducted || a.t > 13500)).toBe(true);
  });
  it('Mobitz I: progressive PR prolongation then a dropped QRS; shortest PR after the pause', () => {
    const r = run('mobitz1').ecg.rhythm;
    const sinus = r.atrial.filter((a) => a.origin.kind === 'sinus' && a.t < 13000);
    const dropped = sinus.map((a, i) => ({ a, i })).filter(({ a }) => !a.conducted);
    expect(dropped.length).toBeGreaterThanOrEqual(2);
    // PRs within a Wenckebach cycle increase
    const prOf = (aIdx: number) => {
      const v = r.ventricular.find((x) => x.fromAtrial !== undefined && r.atrial[x.fromAtrial] === sinus[aIdx]);
      return v ? v.t - sinus[aIdx].t : null;
    };
    const d = dropped[0].i;
    const before = [prOf(d - 3), prOf(d - 2), prOf(d - 1)].filter((x): x is number => x !== null);
    for (let k = 1; k < before.length; k++) expect(before[k]).toBeGreaterThan(before[k - 1]);
    const after = prOf(d + 1)!;
    expect(after).toBeLessThan(before[before.length - 1]);
    expect(r.ladder.some((l) => l.blocked === 'av')).toBe(true);
  });
  it('Mobitz II: constant PR then a sudden non-conducted P (infra-Hisian)', () => {
    const r = run('mobitz2').ecg.rhythm;
    const p = prs(r);
    expect(Math.max(...p) - Math.min(...p)).toBeLessThan(10);
    expect(r.atrial.filter((a) => !a.conducted && a.t < 13000).length).toBeGreaterThanOrEqual(2);
    expect(r.ladder.some((l) => l.blocked === 'his')).toBe(true);
  });
  it('third-degree: AV dissociation, P–P and R–R each regular and independent, slow escape', () => {
    const r = run('chb').ecg.rhythm;
    const pp = r.atrial.slice(1).map((a, i) => a.t - r.atrial[i].t);
    const rr = rrs(r, 2500);
    expect(cv(pp)).toBeLessThan(0.08);
    expect(cv(rr)).toBeLessThan(0.02);
    expect(rate(rr)).toBeLessThan(45);
    expect(rate(pp)).toBeGreaterThan(rate(rr));
    expect(r.ventricular.every((v) => v.fromAtrial === undefined)).toBe(true);
    // ventricular escape is wide
    const g = run('chb');
    expect(g.measure!.qrs).toBeGreaterThanOrEqual(120);
    const nodal = run('chb-nodal');
    expect(nodal.measure!.qrs).toBeLessThan(120);
  });
});

// ---------------------------------------------------------------- 22
describe('22. Atrial arrhythmias', () => {
  it('AF: irregularly irregular, no P waves', () => {
    const g = run('af');
    const rr = rrs(g.ecg.rhythm);
    expect(cv(rr)).toBeGreaterThan(0.12);
    expect(g.ecg.pWaves.length).toBe(0);
    expect(g.ecg.rhythm.continuous.some((c) => c.kind === 'fibrillation')).toBe(true);
    // successive RR differences are not periodic
    const diffs = rr.slice(1).map((x, i) => Math.abs(x - rr[i]));
    expect(diffs.filter((d) => d > 40).length).toBeGreaterThan(rr.length / 3);
  });
  it('atrial flutter: sawtooth ~300/min, 2:1 → ~150 ventricular rate, negative in inferior leads', () => {
    const g = run('flutter');
    const fl = g.ecg.rhythm.continuous.find((c) => c.kind === 'flutter')!;
    expect(fl.rate).toBeGreaterThanOrEqual(250);
    expect(fl.rate).toBeLessThanOrEqual(350);
    const rr = rrs(g.ecg.rhythm, 1500);
    expect(rate(rr)).toBeGreaterThan(140);
    expect(rate(rr)).toBeLessThan(160);
    expect(cv(rr)).toBeLessThan(0.03);
    // sawtooth: unmask with adenosine; in II the waves have a slow downslope and sharp upstroke
    const ad = run('flutter', { drugEvents: [{ t: 6000, drug: 'adenosine' }] });
    const II = ad.ecg.leads.II;
    const quiet = ad.ecg.beats.filter((b) => b.qrsOn > 6000);
    const gapStart = Math.round(Math.max(...ad.ecg.beats.filter((b) => b.qrsOn < 7000).map((b) => b.tEnd)));
    const gapEnd = Math.round(quiet.find((b) => b.qrsOn > gapStart)?.qrsOn ?? 12000);
    expect(gapEnd - gapStart).toBeGreaterThan(600);
    let mn = 0, mx = 0, down = 0, up = 0;
    for (let t = gapStart + 20; t < gapEnd - 20; t++) {
      mn = Math.min(mn, II[t]); mx = Math.max(mx, II[t]);
      const d = II[t + 1] - II[t];
      if (d < 0) down++; else up++;
    }
    expect(mx - mn).toBeGreaterThan(0.15);
    expect(down).toBeGreaterThan(up); // slow descending limb dominates (negative sawtooth)
    expect(g.ecg.pWaves.length).toBe(0);
  });
  it('atrial flutter with variable block: irregular RR in multiples of the flutter cycle', () => {
    const rr = rrs(run('flutter-variable').ecg.rhythm, 1500);
    expect(cv(rr)).toBeGreaterThan(0.1);
  });
  it('MAT: ≥ 3 P-wave morphologies, rate > 100, varying PR', () => {
    const g = run('mat');
    const origins = new Set(g.ecg.rhythm.atrial.map((a) => JSON.stringify(a.origin)));
    expect(origins.size).toBeGreaterThanOrEqual(3);
    expect(rate(rrs(g.ecg.rhythm))).toBeGreaterThan(100);
    const pr = g.ecg.rhythm.ventricular.filter((v) => v.fromAtrial !== undefined).map((v) => v.t - g.ecg.rhythm.atrial[v.fromAtrial!].t);
    expect(Math.max(...pr) - Math.min(...pr)).toBeGreaterThan(20);
    // the P waves really look different: compare each focus's P template in II
    const leads: LeadId[] = ['II', 'aVL', 'V1'];
    const vecs = [...origins].map((o) => leads.map((l) => pPeak(g.resolved, JSON.parse(o), l)));
    const differs = (a: number[], b: number[]) => a.some((x, k) => Math.abs(x - b[k]) > 0.03);
    const distinct = vecs.filter((p, i) => vecs.every((q, j) => j >= i || differs(p, q)));
    expect(distinct.length).toBeGreaterThanOrEqual(3);
  });
});

// ---------------------------------------------------------------- 23
describe('23. SVT, junctional and ectopy', () => {
  it('AVNRT: started by a PAC, regular narrow tachycardia 150–250, retrograde P inside the QRS', () => {
    const g = run('avnrt');
    const r = g.ecg.rhythm;
    const rr = rrs(r, 4000);
    expect(rate(rr)).toBeGreaterThan(150);
    expect(rate(rr)).toBeLessThan(250);
    expect(cv(rr)).toBeLessThan(0.02);
    expect(r.atrial.some((a) => a.origin.kind === 'ectopic')).toBe(true);
    const retro = r.atrial.filter((a) => a.origin.kind === 'retrograde' && a.t > 4000);
    for (const a of retro.slice(0, 5)) {
      const nearest = Math.min(...r.ventricular.map((v) => Math.abs(v.t - a.t)));
      expect(nearest).toBeLessThan(60); // P buried in / just after QRS
    }
    expect(r.ladder.some((l) => l.pathway === 'slow')).toBe(true);
    expect(g.measure!.qrs).toBeLessThan(120);
  });
  it('adenosine terminates AVNRT (AV-node-dependent re-entry)', () => {
    const g = run('avnrt', { drugEvents: [{ t: 7000, drug: 'adenosine' }] });
    const after = g.ecg.rhythm.ventricular.filter((v) => v.t > 7500 && v.t < 12000);
    expect(after.length).toBeLessThan(6);
  });
  it('adenosine does NOT terminate flutter but unmasks flutter waves (fewer QRS)', () => {
    const base = run('flutter').ecg.rhythm.ventricular.filter((v) => v.t > 7000 && v.t < 11000).length;
    const ad = run('flutter', { drugEvents: [{ t: 7000, drug: 'adenosine' }] }).ecg.rhythm;
    expect(ad.ventricular.filter((v) => v.t > 7000 && v.t < 11000).length).toBeLessThan(base / 2);
    expect(ad.continuous.some((c) => c.kind === 'flutter' && c.end > 11000)).toBe(true);
  });
  it('orthodromic AVRT: narrow regular tachycardia with retrograde P after the QRS (RP > 70 ms)', () => {
    const g = run('avrt-ortho');
    const r = g.ecg.rhythm;
    const rr = rrs(r, 5000);
    expect(rate(rr)).toBeGreaterThan(140);
    expect(cv(rr)).toBeLessThan(0.03);
    const tachyBeats = g.ecg.beats.filter((b) => b.qrsOn > 5000);
    expect(tachyBeats.every((b) => b.pattern.kind === 'normal')).toBe(true);
    const retro = r.atrial.filter((a) => a.t > 5000 && a.origin.kind === 'ectopic');
    const v = r.ventricular.filter((x) => x.t > 4500).map((x) => x.t);
    const rp = retro.slice(0, 5).map((a) => a.t - Math.max(...v.filter((t) => t < a.t)));
    for (const x of rp) expect(x).toBeGreaterThan(70);
  });
  it('antidromic AVRT: regular wide (pre-excited) tachycardia', () => {
    const g = run('avrt-anti');
    const rr = rrs(g.ecg.rhythm, 5000);
    expect(rate(rr)).toBeGreaterThan(150);
    expect(g.ecg.beats.filter((b) => b.qrsOn > 5000).every((b) => b.pattern.kind === 'preexcited' && b.qrsOff - b.qrsOn >= 120)).toBe(true);
  });
  it('junctional rhythm: narrow QRS at 40–60 with retrograde (inverted inferior) P', () => {
    const g = run('junctional');
    const rr = rrs(g.ecg.rhythm, 1000);
    expect(rate(rr)).toBeGreaterThanOrEqual(38);
    expect(rate(rr)).toBeLessThanOrEqual(60);
    expect(g.measure!.qrs).toBeLessThan(120);
    expect(g.ecg.rhythm.atrial.every((a) => a.origin.kind === 'retrograde')).toBe(true);
    // retrograde P is negative in the inferior leads
    expect(pPeak(g.resolved, { kind: 'retrograde' }, 'II')).toBeLessThan(0);
    expect(pPeak(g.resolved, { kind: 'retrograde' }, 'aVF')).toBeLessThan(0);
  });
  it('PAC: early P with different morphology and NON-compensatory pause', () => {
    const r = run('pac').ecg.rhythm;
    const sinusPP = 60000 / 72;
    const i = r.atrial.findIndex((a) => a.origin.kind === 'ectopic');
    const prev = r.atrial[i - 1].t, pac = r.atrial[i].t, next = r.atrial[i + 1].t;
    expect(pac - prev).toBeLessThan(0.8 * sinusPP);
    expect(next - prev).toBeLessThan(2 * sinusPP - 60);
  });
  it('PVC: wide early QRS without P and a FULL compensatory pause', () => {
    const g = run('pvc');
    const r = g.ecg.rhythm;
    const idx = r.ventricular.findIndex((v) => v.source === 'ventricular');
    const before = r.ventricular[idx - 1].t, after = r.ventricular[idx + 1].t;
    const sinusRR = 60000 / 72;
    expect(after - before).toBeGreaterThan(1.85 * sinusRR);
    const beat = g.ecg.beats[idx];
    expect(beat.qrsOff - beat.qrsOn).toBeGreaterThanOrEqual(120);
  });
  it('ventricular bigeminy: alternating sinus beat and PVC', () => {
    const r = run('bigeminy').ecg.rhythm;
    const src = r.ventricular.slice(2, 14).map((v) => v.source);
    for (let k = 1; k < src.length; k++) expect(src[k]).not.toBe(src[k - 1]);
  });
  it('sinus arrest: a pause with a junctional escape; sick sinus: brady + AF paroxysm + pause', () => {
    const r = run('sinus-arrest', { seed: 3 }).ecg.rhythm;
    expect(r.ventricular.some((v) => v.source === 'junctional')).toBe(true);
    const ss = run('sick-sinus').ecg.rhythm;
    expect(ss.continuous.some((c) => c.kind === 'fibrillation')).toBe(true);
    expect(Math.max(...rrs(ss))).toBeGreaterThan(1500);
  });
});

// ---------------------------------------------------------------- 24
describe('24. Ventricular rhythms and arrest', () => {
  it('monomorphic VT: regular wide identical complexes > 100/min with AV dissociation', () => {
    const g = run('mono-vt');
    const r = g.ecg.rhythm;
    const vt = g.ecg.beats.filter((b) => b.qrsOn > 3000);
    expect(vt.every((b) => b.qrsOff - b.qrsOn >= 120)).toBe(true);
    expect(new Set(vt.map((b) => JSON.stringify(b.pattern))).size).toBe(1);
    expect(rate(rrs(r, 3000))).toBeGreaterThan(100);
    expect(r.atrial.filter((a) => a.t > 3000).length).toBeGreaterThan(5); // atria still beating
    expect(r.ventricular.filter((v) => v.t > 3000).every((v) => v.fromAtrial === undefined)).toBe(true);
  });
  it('polymorphic VT: changing QRS morphology beat to beat', () => {
    const g = run('poly-vt');
    const vt = g.ecg.beats.filter((b) => b.qrsOn > 3000);
    expect(new Set(vt.map((b) => JSON.stringify(b.pattern))).size).toBeGreaterThanOrEqual(4);
  });
  it('torsades: preceded by long QT, twisting amplitude around the baseline', () => {
    const g = run('torsades');
    expect(g.measure!.qtcBazett!).toBeGreaterThan(500);
    const II = g.ecg.leads.II;
    // amplitude envelope waxes and wanes, and the polarity of peaks reverses
    const env: number[] = [];
    let pos = 0, neg = 0;
    for (let w = 3200; w < 13000; w += 250) {
      let m = 0;
      for (let t = w; t < w + 250; t++) { m = Math.max(m, Math.abs(II[t])); if (II[t] > 0.4) pos++; if (II[t] < -0.4) neg++; }
      env.push(m);
    }
    expect(Math.max(...env)).toBeGreaterThan(2.5 * Math.min(...env));
    expect(pos).toBeGreaterThan(50);
    expect(neg).toBeGreaterThan(50);
  });
  it('VF: chaotic activity, no organised QRS, no mechanical output', () => {
    const g = run('vf');
    const r = g.ecg.rhythm;
    expect(r.continuous.some((c) => c.kind === 'vf')).toBe(true);
    expect(r.ventricular.filter((v) => v.t > 2000).length).toBe(0);
  });
  it('asystole: flat line', () => {
    const g = run('asystole');
    const II = g.ecg.leads.II;
    let m = 0;
    for (let t = 0; t < II.length; t++) m = Math.max(m, Math.abs(II[t]));
    expect(m).toBeLessThan(0.02);
  });
  it('idioventricular rhythm: wide QRS 20–40/min', () => {
    const g = run('idioventricular');
    const rr = rrs(g.ecg.rhythm);
    expect(rate(rr)).toBeGreaterThanOrEqual(20);
    expect(rate(rr)).toBeLessThanOrEqual(40);
    expect(g.measure!.qrs).toBeGreaterThanOrEqual(120);
  });
  it('PEA: organised ECG but zero mechanical activation', () => {
    const r = run('pea').ecg.rhythm;
    expect(r.ventricular.length).toBeGreaterThan(10);
    expect(r.ventricular.every((v) => v.mechanical === 0)).toBe(true);
  });
});

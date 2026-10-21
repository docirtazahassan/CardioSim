/**
 * Ground-truth ECG tests 1–20 (from the project brief).
 * Every assertion is a textbook (USMLE-level) finding; the ECG itself is produced by the
 * dipole engine, never pasted per lead.
 */
import { describe, expect, it } from 'vitest';
import { ecgFor, measureOf, MM } from './helpers';
import { generateEcg } from '../src/engine/electrical';
import { ALL_LEADS } from '../src/engine/electrical/leads';
import { cornell, lowVoltageLimb, sgarbossa, sokolowLyon } from '../src/engine/electrical/criteria';
import { CONDITIONS } from '../src/data/conditions';

const normal = measureOf('normal');

// ---------------------------------------------------------------- 1
describe('1. Einthoven and Goldberger relations', () => {
  const ids = ['normal', 'lbbb', 'stemi-inferior-rca', 'pericarditis', 'limb-reversal', 'hyperkalemia', 'wpw'];
  for (const id of ids) {
    it(`I + III = II and aVR + aVL + aVF = 0 at every sample (${id})`, () => {
      const { ecg } = ecgFor(id);
      const { I, II, III, aVR, aVL, aVF } = ecg.leads;
      let maxE = 0, maxG = 0;
      for (let t = 0; t < I.length; t++) {
        maxE = Math.max(maxE, Math.abs(I[t] + III[t] - II[t]));
        maxG = Math.max(maxG, Math.abs(aVR[t] + aVL[t] + aVF[t]));
      }
      expect(maxE).toBeLessThan(1e-5);
      expect(maxG).toBeLessThan(1e-5);
    });
  }
  it('holds for every condition in the library', () => {
    for (const c of CONDITIONS) {
      const { ecg } = generateEcg(c.model, { leads: ALL_LEADS, durationMs: 3000 });
      const { I, II, III, aVR, aVL, aVF } = ecg.leads;
      for (let t = 0; t < I.length; t += 7) {
        expect(Math.abs(I[t] + III[t] - II[t])).toBeLessThan(1e-5);
        expect(Math.abs(aVR[t] + aVL[t] + aVF[t])).toBeLessThan(1e-5);
      }
    }
  });
});

// ---------------------------------------------------------------- 2
describe('2. Frontal axis', () => {
  it('normal axis (−30° to +90°) with QRS positive in I and aVF', () => {
    expect(normal.axis).toBeGreaterThanOrEqual(-30);
    expect(normal.axis).toBeLessThanOrEqual(90);
    expect(normal.leads.I.qrsNet).toBeGreaterThan(0);
    expect(normal.leads.aVF.qrsNet).toBeGreaterThan(0);
  });
  it('left axis deviation: I positive, II and aVF negative', () => {
    const m = measureOf('axis-left');
    expect(m.leads.I.qrsNet).toBeGreaterThan(0);
    expect(m.leads.II.qrsNet).toBeLessThan(0);
    expect(m.leads.aVF.qrsNet).toBeLessThan(0);
    expect(m.axis).toBeLessThan(-30);
  });
  it('right axis deviation: I negative, aVF positive', () => {
    const m = measureOf('axis-right');
    expect(m.leads.I.qrsNet).toBeLessThan(0);
    expect(m.leads.aVF.qrsNet).toBeGreaterThan(0);
    expect(m.axis).toBeGreaterThan(90);
  });
  it('extreme axis: I and aVF both negative', () => {
    const m = measureOf('axis-extreme');
    expect(m.leads.I.qrsNet).toBeLessThan(0);
    expect(m.leads.aVF.qrsNet).toBeLessThan(0);
  });
});

// ---------------------------------------------------------------- 3
describe('3. Precordial R-wave progression', () => {
  it('R grows and S shrinks from V1 to V6 with transition around V3–V4', () => {
    const L = normal.leads;
    expect(L.V1.r).toBeLessThan(L.V1.s); // rS in V1
    expect(L.V6.r).toBeGreaterThan(L.V6.s); // qR in V6
    const ratio = (l: string) => L[l].r / Math.max(0.01, L[l].s);
    const firstDominant = ['V1', 'V2', 'V3', 'V4', 'V5', 'V6'].find((l) => ratio(l) >= 1);
    expect(['V3', 'V4']).toContain(firstDominant);
    expect(L.V3.r).toBeGreaterThan(L.V1.r);
    expect(L.V5.s).toBeLessThan(L.V1.s);
  });
  it('septal q waves in I and V6', () => {
    expect(normal.leads.I.q).toBeGreaterThan(0.03);
    expect(normal.leads.V6.q).toBeGreaterThan(0.03);
  });
});

// ---------------------------------------------------------------- 4
describe('4. Fascicular blocks', () => {
  it('LAFB: axis beyond −45°, qR in aVL, rS in II/III/aVF', () => {
    const m = measureOf('lafb');
    expect(m.axis).toBeLessThan(-45);
    const aVL = m.leads.aVL;
    expect(aVL.lobes[0].sign).toBe(-1); // initial q
    expect(aVL.r).toBeGreaterThan(aVL.q * 2);
    for (const l of ['II', 'III', 'aVF']) expect(m.leads[l].s).toBeGreaterThan(m.leads[l].r);
    expect(m.qrs).toBeLessThan(120);
  });
  it('LPFB: right axis deviation, rS in I, dominant R in III', () => {
    const m = measureOf('lpfb');
    expect(m.axis).toBeGreaterThan(90);
    expect(m.leads.I.s).toBeGreaterThanOrEqual(m.leads.I.r * 0.95);
    expect(m.leads.III.qrsNet).toBeGreaterThan(0);
    expect(Math.max(m.leads.III.r, m.leads.III.rPrime)).toBeGreaterThan(m.leads.III.s);
  });
});

// ---------------------------------------------------------------- 5–11
describe('5. Inferior STEMI (RCA, right dominant)', () => {
  const m = measureOf('stemi-inferior-rca');
  it('ST elevation in II, III, aVF', () => {
    for (const l of ['II', 'III', 'aVF']) expect(m.leads[l].stJ).toBeGreaterThanOrEqual(1 * MM);
  });
  it('reciprocal ST depression in I and aVL', () => {
    expect(m.leads.I.stJ).toBeLessThanOrEqual(-0.5 * MM);
    expect(m.leads.aVL.stJ).toBeLessThanOrEqual(-1 * MM);
  });
  it('STE III > II (RCA rather than LCx)', () => {
    expect(m.leads.III.stJ).toBeGreaterThan(m.leads.II.stJ);
    const lcx = measureOf('stemi-inferior-lcx');
    expect(lcx.leads.II.stJ).toBeGreaterThanOrEqual(lcx.leads.III.stJ);
    expect(lcx.leads.I.stJ).toBeGreaterThan(0);
  });
});

describe('6. RV infarction', () => {
  it('ST elevation in V4R', () => {
    const m = measureOf('rv-infarct');
    expect(m.leads.V4R.stJ).toBeGreaterThanOrEqual(1 * MM);
    expect(normal.leads.V4R.stJ).toBeLessThan(0.5 * MM);
  });
});

describe('7. Anterior STEMI (LAD)', () => {
  it('mid LAD: ST elevation V1–V4', () => {
    const m = measureOf('stemi-anterior');
    for (const l of ['V2', 'V3', 'V4']) expect(m.leads[l].stJ).toBeGreaterThanOrEqual(1.5 * MM);
    expect(m.leads.V1.stJ).toBeGreaterThanOrEqual(1 * MM);
  });
  it('proximal LAD adds I/aVL elevation, greater V1 elevation and inferior reciprocal depression', () => {
    const p = measureOf('stemi-anterior-proximal');
    const mid = measureOf('stemi-anterior');
    expect(p.leads.aVL.stJ).toBeGreaterThanOrEqual(1 * MM);
    expect(p.leads.I.stJ).toBeGreaterThanOrEqual(1 * MM);
    expect(p.leads.V1.stJ).toBeGreaterThan(mid.leads.V1.stJ);
    expect(p.leads.III.stJ).toBeLessThanOrEqual(-1 * MM);
  });
});

describe('8. Lateral STEMI', () => {
  it('STE in I, aVL, V5, V6 with reciprocal inferior STD', () => {
    const m = measureOf('stemi-lateral');
    for (const l of ['I', 'aVL', 'V5', 'V6']) expect(m.leads[l].stJ).toBeGreaterThanOrEqual(1 * MM);
    expect(m.leads.III.stJ).toBeLessThanOrEqual(-1 * MM);
    expect(m.leads.aVF.stJ).toBeLessThan(0);
  });
});

describe('9. Posterior MI', () => {
  const m = measureOf('stemi-posterior');
  it('ST depression in V1–V3 with upright T waves', () => {
    for (const l of ['V1', 'V2', 'V3']) {
      expect(m.leads[l].stJ).toBeLessThanOrEqual(-0.5 * MM);
      expect(m.leads[l].tMax).toBeGreaterThan(0.1);
    }
  });
  it('tall R in V2 (R/S > 1) and taller than normal in V1–V2', () => {
    expect(m.leads.V2.r).toBeGreaterThan(m.leads.V2.s);
    expect(m.leads.V2.r / m.leads.V2.s).toBeGreaterThan(normal.leads.V2.r / normal.leads.V2.s);
  });
  it('ST elevation in V7–V9', () => {
    for (const l of ['V7', 'V8', 'V9']) expect(m.leads[l].stJ).toBeGreaterThanOrEqual(0.5 * MM);
  });
});

describe('10. LMCA / multivessel pattern', () => {
  it('STE in aVR (> V1) with widespread ST depression', () => {
    const m = measureOf('lmca');
    expect(m.leads.aVR.stJ).toBeGreaterThanOrEqual(1 * MM);
    expect(m.leads.aVR.stJ).toBeGreaterThan(m.leads.V1.stJ);
    const depressed = ['I', 'II', 'III', 'aVL', 'aVF', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6'].filter((l) => m.leads[l].stJ <= -0.5 * MM);
    expect(depressed.length).toBeGreaterThanOrEqual(6);
  });
});

describe('11. Subendocardial ischemia', () => {
  it('diffuse ST depression without ST elevation except aVR', () => {
    const m = measureOf('subendocardial-ischemia');
    const twelve = ['I', 'II', 'III', 'aVR', 'aVL', 'aVF', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6'];
    const depressed = twelve.filter((l) => m.leads[l].stJ <= -0.5 * MM);
    expect(depressed.length).toBeGreaterThanOrEqual(5);
    for (const l of twelve) if (l !== 'aVR') expect(m.leads[l].stJ).toBeLessThan(0.5 * MM);
    expect(m.leads.aVR.stJ).toBeGreaterThan(0.5 * MM);
  });
});

// ---------------------------------------------------------------- 12
describe('12. Time evolution of STEMI', () => {
  const stage = (s: string) => measureOf('stemi-anterior', s);
  const hyper = stage('hyperacute');
  const acute = stage('acute');
  const evolving = stage('evolving');
  const reperf = stage('reperfused');
  const old = stage('old');
  it('hyperacute T waves before marked ST elevation', () => {
    expect(hyper.leads.V3.tMax).toBeGreaterThan(2 * normal.leads.V3.tMax);
    expect(hyper.leads.V3.stJ).toBeLessThan(acute.leads.V3.stJ);
  });
  it('acute ST elevation', () => {
    expect(acute.leads.V2.stJ).toBeGreaterThanOrEqual(2 * MM);
    expect(acute.leads.V3.stJ).toBeGreaterThanOrEqual(2 * MM);
  });
  it('Q waves / loss of R waves develop', () => {
    expect(evolving.leads.V2.r).toBeLessThan(0.3 * normal.leads.V2.r);
    expect(evolving.leads.V3.r).toBeLessThan(0.3 * normal.leads.V3.r);
  });
  it('T-wave inversion after reperfusion', () => {
    expect(reperf.leads.V2.t).toBeLessThan(-0.2);
    expect(reperf.leads.V3.t).toBeLessThan(-0.2);
    expect(reperf.leads.V2.stJ).toBeLessThan(acute.leads.V2.stJ / 4);
  });
  it('persistent Q waves with resolved ST (old MI)', () => {
    expect(old.leads.V2.r).toBeLessThan(0.3 * normal.leads.V2.r);
    expect(Math.abs(old.leads.V2.stJ)).toBeLessThan(0.5 * MM);
    expect(old.leads.V3.t).toBeGreaterThan(reperf.leads.V3.t);
  });
});

// ---------------------------------------------------------------- 13
describe('13. Clinician patterns: Wellens, de Winter, Sgarbossa', () => {
  it('Wellens type B: deep T inversion V2–V3, preserved R, minimal STE', () => {
    const m = measureOf('wellens', 'type-b');
    for (const l of ['V2', 'V3']) {
      expect(m.leads[l].t).toBeLessThan(-0.3);
      expect(m.leads[l].stJ).toBeLessThan(1 * MM);
      expect(m.leads[l].r).toBeGreaterThan(0.8 * normal.leads[l].r);
    }
  });
  it('Wellens type A: biphasic (up then down) T in the anterior leads', () => {
    const m = measureOf('wellens', 'type-a');
    const biphasic = ['V2', 'V3', 'V4'].some((l) => m.leads[l].tBiphasic === 'pos-neg');
    expect(biphasic).toBe(true);
  });
  it('de Winter: upsloping J-point depression into tall symmetric T waves', () => {
    const m = measureOf('de-winter');
    for (const l of ['V2', 'V3', 'V4']) {
      expect(m.leads[l].stJ).toBeLessThanOrEqual(-1 * MM);
      expect(m.leads[l].stSlope).toBeGreaterThan(0);
      expect(m.leads[l].tMax).toBeGreaterThan(1.5 * normal.leads[l].tMax);
    }
  });
  it('Sgarbossa: positive in LBBB with acute MI, negative in uncomplicated LBBB', () => {
    expect(sgarbossa(measureOf('sgarbossa')).positive).toBe(true);
    expect(sgarbossa(measureOf('sgarbossa')).score).toBeGreaterThanOrEqual(3);
    const plain = sgarbossa(measureOf('lbbb'));
    expect(plain.score).toBe(0);
    expect(plain.smithPositive).toBe(false);
  });
});

// ---------------------------------------------------------------- 14
describe('14. Bundle branch blocks', () => {
  it('RBBB: QRS ≥ 120 ms, rSR′ in V1, wide S in I and V6', () => {
    const m = measureOf('rbbb');
    expect(m.qrs).toBeGreaterThanOrEqual(120);
    expect(m.leads.V1.rPrime).toBeGreaterThan(m.leads.V1.r);
    expect(m.leads.V1.morphology).toMatch(/R'/);
    for (const l of ['I', 'V6']) {
      expect(m.leads[l].s).toBeGreaterThanOrEqual(0.15);
      expect(m.leads[l].lobes[m.leads[l].lobes.length - 1].sign).toBe(-1);
    }
    expect(m.leads.V1.t).toBeLessThan(0); // secondary T inversion
  });
  it('LBBB: QRS ≥ 120 ms, broad R without q in I/aVL/V6, deep S in V1, discordant ST–T', () => {
    const m = measureOf('lbbb');
    expect(m.qrs).toBeGreaterThanOrEqual(120);
    for (const l of ['I', 'aVL', 'V6']) {
      expect(m.leads[l].q).toBe(0);
      expect(m.leads[l].r).toBeGreaterThan(0.5);
      expect(m.leads[l].t).toBeLessThan(0);
      expect(m.leads[l].stJ).toBeLessThanOrEqual(0);
    }
    expect(Math.max(m.leads.V1.s, m.leads.V1.q)).toBeGreaterThan(1.0);
    expect(m.leads.V1.stJ).toBeGreaterThan(0.5 * MM);
    expect(m.leads.V1.t).toBeGreaterThan(0);
    expect(m.leads.I.notchedR || m.leads.V6.notchedR || m.timeTo50 > normal.timeTo50 + 10).toBe(true);
  });
});

// ---------------------------------------------------------------- 15
describe('15. Hypertrophy and atrial enlargement', () => {
  it('LVH meets Sokolow–Lyon (and Cornell for women) with lateral strain; normal does not', () => {
    const m = measureOf('lvh');
    expect(sokolowLyon(m).positive).toBe(true);
    expect(cornell(m, 'female').positive).toBe(true);
    expect(sokolowLyon(normal).positive).toBe(false);
    for (const l of ['V5', 'V6']) {
      expect(m.leads[l].st60).toBeLessThan(-0.5 * MM);
      expect(m.leads[l].t).toBeLessThan(0);
    }
  });
  it('RVH: right axis deviation and dominant R in V1', () => {
    const m = measureOf('rvh');
    expect(m.axis).toBeGreaterThan(90);
    expect(m.leads.V1.r).toBeGreaterThan(m.leads.V1.s);
  });
  it('LAE: broad P (≥ 120 ms) and terminal negative P in V1 (≥ 1 small box)', () => {
    const g = ecgFor('lae');
    const pw = g.ecg.pWaves[2];
    expect(pw.off - pw.on).toBeGreaterThanOrEqual(120);
    expect(g.measure!.leads.V1.pTerminalNegArea).toBeGreaterThanOrEqual(4); // 0.1 mV × 40 ms
    const n = ecgFor('normal');
    expect(n.ecg.pWaves[2].off - n.ecg.pWaves[2].on).toBeLessThan(120);
    expect(n.measure!.leads.V1.pTerminalNegArea).toBeLessThan(4);
  });
  it('RAE: peaked P ≥ 2.5 mm in II', () => {
    expect(measureOf('rae').leads.II.pMax).toBeGreaterThanOrEqual(2.5 * MM);
    expect(normal.leads.II.pMax).toBeLessThan(2.5 * MM);
  });
});

// ---------------------------------------------------------------- 16
describe('16. WPW', () => {
  it('short PR, delta wave (slurred upstroke), wide QRS', () => {
    const m = measureOf('wpw');
    expect(m.pr!).toBeLessThan(120);
    expect(m.qrs).toBeGreaterThan(110);
    expect(m.timeTo50).toBeGreaterThan(normal.timeTo50 + 15);
  });
});

// ---------------------------------------------------------------- 17
describe('17. Pericardial disease', () => {
  it('pericarditis: diffuse concave STE, PR depression, PR elevation in aVR, no reciprocal STD except aVR/V1', () => {
    const m = measureOf('pericarditis');
    for (const l of ['I', 'II', 'aVF', 'V3', 'V4', 'V5']) expect(m.leads[l].st60).toBeGreaterThanOrEqual(0.5 * MM);
    expect(m.leads.II.stSlope).toBeGreaterThan(0); // concave (upsloping) ST
    expect(m.leads.aVR.stJ).toBeLessThan(0);
    expect(m.leads.II.prSegment).toBeLessThanOrEqual(-0.5 * MM);
    expect(m.leads.aVR.prSegment).toBeGreaterThanOrEqual(0.5 * MM);
    for (const l of ['I', 'II', 'III', 'aVL', 'aVF', 'V2', 'V3', 'V4', 'V5', 'V6']) expect(m.leads[l].stJ).toBeGreaterThan(-0.5 * MM);
  });
  it('tamponade: low voltage and electrical alternans with sinus tachycardia', () => {
    const g = ecgFor('tamponade');
    expect(lowVoltageLimb(g.measure!)).toBe(true);
    expect(g.resolved.hr).toBeGreaterThan(100);
    const amps = g.ecg.beats.slice(1, 7).map((b) => {
      let mx = 0;
      for (let t = Math.round(b.qrsOn); t < b.qrsOff; t++) mx = Math.max(mx, Math.abs(g.ecg.leads.V3[t]));
      return mx;
    });
    for (let i = 1; i < amps.length; i++) expect(Math.abs(amps[i] - amps[i - 1]) / Math.max(amps[i], amps[i - 1])).toBeGreaterThan(0.2);
  });
});

// ---------------------------------------------------------------- 18
describe('18. Pulmonary embolism', () => {
  it('sinus tachycardia, S1Q3T3 and right precordial T inversion', () => {
    const g = ecgFor('pe');
    const m = g.measure!;
    expect(g.resolved.hr).toBeGreaterThan(100);
    expect(m.leads.I.s).toBeGreaterThanOrEqual(1.5 * MM);
    expect(m.leads.III.q).toBeGreaterThan(0.5 * MM);
    expect(m.leads.III.t).toBeLessThan(0);
    for (const l of ['V1', 'V2', 'V3']) expect(m.leads[l].t).toBeLessThan(0);
  });
  it('a new RBBB variant is available', () => {
    const m = measureOf('pe', 'rbbb');
    expect(m.qrs).toBeGreaterThanOrEqual(120);
    expect(m.leads.V1.rPrime).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------- 19
describe('19. Electrolytes', () => {
  const k6 = measureOf('hyperkalemia', 'k6');
  const k7 = measureOf('hyperkalemia', 'k7');
  const k8 = measureOf('hyperkalemia', 'k8');
  const k9 = ecgFor('hyperkalemia', 'k9');
  it('hyperkalemia stage 1: peaked T, shorter QT', () => {
    expect(k6.leads.V3.tMax).toBeGreaterThan(1.5 * normal.leads.V3.tMax);
    expect(k6.leads.II.tMax).toBeGreaterThan(1.5 * normal.leads.II.tMax);
    expect(k6.qt).toBeLessThan(normal.qt);
    expect(k6.qrs).toBeLessThan(120);
  });
  it('stage 2: PR prolongation and P flattening', () => {
    expect(k7.pr!).toBeGreaterThan(200);
    expect(k7.leads.II.pMax).toBeLessThan(0.7 * normal.leads.II.pMax);
  });
  it('stage 3: QRS widening', () => {
    expect(k8.qrs).toBeGreaterThanOrEqual(120);
    expect(k8.qrs).toBeGreaterThan(k7.qrs);
  });
  it('stage 4: sine wave (very wide QRS merging with T, no P waves)', () => {
    expect(k9.measure!.qrs).toBeGreaterThanOrEqual(200);
    expect(k9.ecg.pWaves.length).toBe(0);
  });
  it('hypokalemia: flat T, prominent U, apparent QT prolongation', () => {
    const m = measureOf('hypokalemia');
    expect(m.leads.II.tMax).toBeLessThan(0.5 * normal.leads.II.tMax);
    expect(m.leads.V2.u).toBeGreaterThan(m.leads.V2.tMax);
    expect(m.qt).toBeGreaterThan(normal.qt);
  });
  it('hypercalcemia short QT; hypocalcemia long QT with normal T', () => {
    const hi = measureOf('hypercalcemia');
    const lo = measureOf('hypocalcemia');
    expect(hi.qt).toBeLessThan(normal.qt - 30);
    expect(lo.qt).toBeGreaterThan(normal.qt + 25);
    expect(lo.leads.II.tMax).toBeGreaterThan(0.7 * normal.leads.II.tMax);
  });
});

// ---------------------------------------------------------------- 20
describe('20. Other patterns and teaching artefacts', () => {
  it('Brugada type 1: coved STE ≥ 2 mm in V1 with negative T, confined to right precordial leads', () => {
    const m = measureOf('brugada');
    expect(m.leads.V1.stJ).toBeGreaterThanOrEqual(2 * MM);
    expect(m.leads.V1.stSlope).toBeLessThan(0); // descending (coved)
    expect(m.leads.V1.tMin).toBeLessThan(-0.1);
    expect(Math.abs(m.leads.II.stJ)).toBeLessThan(0.5 * MM);
    expect(m.leads.V5.stJ).toBeLessThan(0.5 * MM);
  });
  it('long QT: QTc > 470 ms', () => {
    expect(measureOf('long-qt').qtcBazett!).toBeGreaterThan(470);
    expect(normal.qtcBazett!).toBeLessThan(450);
  });
  it('digoxin effect: scooped ST depression, short QT, long PR', () => {
    const m = measureOf('digoxin-effect');
    expect(m.leads.V5.st60).toBeLessThan(-0.5 * MM);
    expect(m.leads.II.st60).toBeLessThan(-0.5 * MM);
    expect(m.qtcBazett!).toBeLessThan(normal.qtcBazett!);
    expect(m.pr!).toBeGreaterThan(normal.pr!);
  });
  it('hypothermia: Osborn J waves, bradycardia, long QT', () => {
    const g = ecgFor('hypothermia');
    const m = g.measure!;
    expect(g.resolved.hr).toBeLessThan(60);
    expect(m.leads.V4.stJ).toBeGreaterThanOrEqual(1 * MM);
    expect(m.leads.V4.stJ).toBeGreaterThan(m.leads.V4.st60 + 0.05);
    expect(m.qt).toBeGreaterThan(normal.qt);
  });
  it('dextrocardia: inverted P/QRS in I, upright aVR, reverse R progression', () => {
    const m = measureOf('dextrocardia');
    expect(m.leads.I.qrsNet).toBeLessThan(0);
    expect(m.leads.I.pMin).toBeLessThan(-0.05);
    expect(m.leads.aVR.qrsNet).toBeGreaterThan(0);
    expect(m.leads.V6.r).toBeLessThan(m.leads.V1.r + 0.2);
    expect(m.leads.V6.r).toBeLessThan(0.3);
  });
  it('LA/RA reversal: inverted I but normal chest leads', () => {
    const m = measureOf('limb-reversal');
    expect(m.leads.I.qrsNet).toBeLessThan(0);
    expect(m.leads.I.pMin).toBeLessThan(-0.05);
    expect(m.leads.aVR.qrsNet).toBeGreaterThan(0);
    for (const l of ['V1', 'V3', 'V6']) expect(m.leads[l].r).toBeCloseTo(normal.leads[l].r, 5);
  });
});

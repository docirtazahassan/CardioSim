/** Equations lab: known textbook values and consistency with the engines. */
import { describe, expect, it } from 'vitest';
import { EQUATIONS } from '../src/data/equations';
import { generateEcg } from '../src/engine/electrical';

const eq = (id: string) => EQUATIONS.find((e) => e.id === id)!;
const run = (id: string, over: Record<string, number> = {}) => {
  const e = eq(id);
  const v = { ...Object.fromEntries(e.vars.map((x) => [x.key, x.value])), ...over };
  return Object.fromEntries(e.compute(v).map((o) => [o.label, o.value]));
};

describe('Equations lab', () => {
  it('every equation computes finite outputs at its default values', () => {
    for (const e of EQUATIONS) for (const o of e.compute(Object.fromEntries(e.vars.map((x) => [x.key, x.value])))) expect(Number.isFinite(o.value), `${e.id}: ${o.label}`).toBe(true);
  });
  it('Bernoulli: 4 m/s → 64 mmHg; normal Fick gives SvO₂ ≈ 70–78%; Poiseuille r/2 → 16× R', () => {
    expect(run('bernoulli', { vav: 4 })['Peak gradient']).toBeCloseTo(64, 5);
    const sv = run('fick')['SvO₂'];
    expect(sv).toBeGreaterThan(68);
    expect(sv).toBeLessThan(80);
    expect(run('poiseuille', { r: 0.5 })['Resistance']).toBeCloseTo(16, 5);
  });
  it('resting potential ≈ −85 mV at K 4.2 and depolarises with hyperkalemia', () => {
    const n = run('nernst')['Resting Vm (GHK)'];
    expect(n).toBeLessThan(-80);
    expect(n).toBeGreaterThan(-95);
    expect(run('nernst', { ko: 7.5 })['Resting Vm (GHK)']).toBeGreaterThan(n + 10);
  });
  it('Bazett: QTc = QT at 60/min; over-corrects relative to Fridericia at fast rates', () => {
    expect(run('qtc', { qt: 400, hr: 60 })['QTc Bazett']).toBeCloseTo(400, 5);
    const fast = run('qtc', { qt: 320, hr: 120 });
    expect(fast['QTc Bazett']).toBeGreaterThan(fast['QTc Fridericia']);
  });
  it('axis formula agrees with the ECG engine (net QRS area in I and aVF)', () => {
    for (const rot of [-100, -40, 0, 40, 90]) {
      const g = generateEcg({ frontalRotationDeg: rot }, { durationMs: 2500 });
      const m = g.measure!;
      const th = run('axis', { i: m.leads.I.qrsNet, avf: m.leads.aVF.qrsNet })['QRS axis'];
      const d = Math.abs(((th - m.axis + 540) % 360) - 180);
      expect(d, `rotation ${rot}`).toBeLessThan(6);
    }
  });
});

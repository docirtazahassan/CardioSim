/**
 * Cellular electrophysiology: drug and electrolyte effects must appear in the action potential
 * AND propagate to the ECG.
 */
import { describe, expect, it } from 'vitest';
import { pacemakerAP, ventricularAP } from '../src/engine/cellular/ap';
import { generateEcg } from '../src/engine/electrical';

const base = ventricularAP();
const ecg = (m: Parameters<typeof generateEcg>[0]) => generateEcg(m, { leads: ['II', 'V2', 'V3'], durationMs: 5000 }).measure!;
const normalEcg = ecg({});

describe('Ventricular action potential', () => {
  it('normal resting potential ≈ −85 mV with a fast upstroke', () => {
    expect(base.rest).toBeLessThan(-80);
    expect(base.vmax).toBeGreaterThan(150);
    expect(base.apd90).toBeGreaterThan(200);
  });
  it('class III (IKr block) prolongs APD and the QT interval', () => {
    const ap = ventricularAP({ drugs: ['class3'] });
    expect(ap.apd90).toBeGreaterThan(base.apd90 + 30);
    expect(ecg({ drugs: ['class3'] }).qt).toBeGreaterThan(normalEcg.qt + 30);
  });
  it('class Ic slows phase 0 and widens QRS; class Ia also prolongs QT', () => {
    expect(ventricularAP({ drugs: ['class1c'] }).vmax).toBeLessThan(base.vmax * 0.6);
    expect(ecg({ drugs: ['class1c'] }).qrs).toBeGreaterThan(normalEcg.qrs + 15);
    const ia = ecg({ drugs: ['class1a'] });
    expect(ia.qrs).toBeGreaterThan(normalEcg.qrs);
    expect(ia.qt).toBeGreaterThan(normalEcg.qt);
  });
  it('class Ib shortens APD slightly', () => {
    expect(ventricularAP({ drugs: ['class1b'] }).apd90).toBeLessThan(base.apd90);
  });
  it('hyperkalemia depolarises the resting membrane and slows the upstroke', () => {
    const ap = ventricularAP({ k: 7.5 });
    expect(ap.rest).toBeGreaterThan(base.rest + 8);
    expect(ap.vmax).toBeLessThan(base.vmax * 0.8);
    expect(ap.apd90).toBeLessThan(base.apd90);
  });
  it('hypokalemia and hypomagnesemia raise EAD (torsades) risk', () => {
    expect(ventricularAP({ k: 2.4, mg: 1.0, drugs: ['class3'] }).ead).toBe(true);
    expect(ventricularAP({ k: 2.4, mg: 1.0, drugs: ['class3', 'magnesium'] }).ead).toBe(false);
  });
  it('calcium changes the plateau: hypercalcemia shortens, hypocalcemia lengthens', () => {
    expect(ventricularAP({ ca: 13 }).apd90).toBeLessThan(base.apd90);
    expect(ventricularAP({ ca: 7 }).apd90).toBeGreaterThan(base.apd90);
  });
});

describe('Pacemaker (SA node) action potential', () => {
  const p = pacemakerAP();
  it('fires spontaneously at 60–100/min with a slow Ca²⁺ upstroke', () => {
    expect(p.rate!).toBeGreaterThan(55);
    expect(p.rate!).toBeLessThan(105);
    expect(p.vmax).toBeLessThan(20);
  });
  it('β-blockade, Ca-channel blockade and adenosine slow the rate; atropine speeds it', () => {
    expect(pacemakerAP({ drugs: ['class2'] }).rate!).toBeLessThan(p.rate!);
    expect(pacemakerAP({ drugs: ['class4'] }).rate!).toBeLessThan(p.rate!);
    const ado = pacemakerAP({ drugs: ['adenosine'] });
    expect(ado.rest).toBeLessThan(p.rest - 5);
    expect(ado.rate!).toBeLessThan(p.rate!);
    expect(pacemakerAP({ drugs: ['atropine'] }).rate!).toBeGreaterThan(p.rate!);
  });
  it('class II and IV prolong PR on the ECG', () => {
    expect(ecg({ drugs: ['class2'] }).pr!).toBeGreaterThan(normalEcg.pr!);
    expect(ecg({ drugs: ['class4'] }).pr!).toBeGreaterThan(normalEcg.pr!);
  });
});

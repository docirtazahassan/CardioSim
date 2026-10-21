/** Heart sounds and murmurs synthesised from the circulation model. */
import { describe, expect, it } from 'vitest';
import { paramsFor } from '../src/engine/hemo/params';
import { HemoSimulator } from '../src/engine/hemo/simulator';
import { describeMurmurs, synthPhono, type AuscSite, type ChestPiece } from '../src/engine/audio/phono';

const cache = new Map<string, HemoSimulator>();
function sim(id: string) {
  if (!cache.has(id)) {
    const s = new HemoSimulator(paramsFor(id), { sampleEvery: 4, maxSamples: 8000 });
    s.advance(16);
    cache.set(id, s);
  }
  return cache.get(id)!;
}
function phono(id: string, site: AuscSite, piece: ChestPiece = 'diaphragm') {
  const s = sim(id);
  return synthPhono({ samples: s.samples, beats: s.beats.slice(-12), params: paramsFor(id), site, piece, seconds: 6 });
}
/** RMS of the audio in systole vs diastole using the simulated beats. */
function phaseRms(id: string, site: AuscSite) {
  const s = sim(id);
  const r = phono(id, site);
  let sys = 0, ns = 0, dia = 0, nd = 0;
  for (const b of s.beats) {
    if (b.tStart < r.t0 || b.ejectionStartMs == null || b.ejectionEndMs == null) continue;
    for (let i = 0; i < r.audio.length; i++) {
      const t = r.t0 + i / r.fs;
      if (t < b.tStart || t > b.tEnd) continue;
      const ms = (t - b.tStart) * 1000;
      // skip ±40 ms around valve sounds so only murmurs are compared
      if (ms > b.ejectionStartMs + 40 && ms < b.ejectionEndMs - 20) { sys += r.audio[i] ** 2; ns++; }
      else if (ms > b.ejectionEndMs + 60 && ms < (b.tEnd - b.tStart) * 1000 - 60) { dia += r.audio[i] ** 2; nd++; }
    }
  }
  return { sys: Math.sqrt(sys / Math.max(1, ns)), dia: Math.sqrt(dia / Math.max(1, nd)) };
}

describe('Auscultation: heart sounds', () => {
  it('normal heart: S1 and S2, no murmur, no S3/S4', () => {
    const r = phono('normal-hemo', 'aortic');
    const ids = new Set(r.events.map((e) => e.id));
    expect(ids.has('S1')).toBe(true);
    expect(ids.has('A2')).toBe(true);
    expect(ids.has('S3')).toBe(false);
    expect(ids.has('S4')).toBe(false);
    expect(describeMurmurs(sim('normal-hemo').beats.slice(-6))).toHaveLength(0);
  });
  it('HFrEF has an S3; HFpEF and AS have an S4; MS an opening snap; MVP a click', () => {
    const has = (id: string, s: string) => phono(id, 'mitral', 'bell').events.some((e) => e.id === s);
    expect(has('hfref', 'S3')).toBe(true);
    expect(has('hfpef', 'S4')).toBe(true);
    expect(has('aortic-stenosis', 'S4')).toBe(true);
    expect(has('mitral-stenosis', 'OS')).toBe(true);
    expect(has('mvp', 'click')).toBe(true);
  });
});

describe('Auscultation: murmurs', () => {
  it('AS: systolic murmur loudest at the aortic area', () => {
    const a = phono('aortic-stenosis', 'aortic').siteLoudness.as ?? 0;
    const m = phono('aortic-stenosis', 'mitral').siteLoudness.as ?? 0;
    expect(a).toBeGreaterThan(m);
    const r = phaseRms('aortic-stenosis', 'aortic');
    expect(r.sys).toBeGreaterThan(r.dia * 2);
  });
  it('AR: diastolic murmur at the left sternal border', () => {
    const r = phaseRms('aortic-regurgitation', 'erb');
    expect(r.dia).toBeGreaterThan(0.02);
    const d = describeMurmurs(sim('aortic-regurgitation').beats.slice(-6));
    expect(d.find((x) => x.key === 'ar')?.timing).toBe('diastolic');
  });
  it('MR: holosystolic at the apex; MS: low rumble heard best with the bell at the apex', () => {
    const mr = phaseRms('mr-chronic', 'mitral');
    expect(mr.sys).toBeGreaterThan(mr.dia * 2);
    const bell = phono('mitral-stenosis', 'mitral', 'bell').siteLoudness.ms ?? 0;
    const diaph = phono('mitral-stenosis', 'mitral', 'diaphragm').siteLoudness.ms ?? 0;
    const base = phono('mitral-stenosis', 'aortic', 'bell').siteLoudness.ms ?? 0;
    expect(bell).toBeGreaterThan(diaph * 2);
    expect(bell).toBeGreaterThan(base * 4);
  });
  it('VSD loudest at the lower left sternal border; PDA continuous at the pulmonic area', () => {
    expect(phono('vsd', 'tricuspid').siteLoudness.vsd ?? 0).toBeGreaterThan(phono('vsd', 'aortic').siteLoudness.vsd ?? 0);
    const p = phaseRms('pda', 'pulmonic');
    expect(p.sys).toBeGreaterThan(0.02);
    expect(p.dia).toBeGreaterThan(0.01);
  });
});

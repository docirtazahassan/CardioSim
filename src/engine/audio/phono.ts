/**
 * Phonocardiogram / heart-sound synthesis from the circulation model (no audio files).
 *
 * Heart sounds are damped low-frequency oscillations timed from valve events; murmurs are
 * band-limited noise whose envelope follows the instantaneous turbulent jet power computed by the
 * hemodynamic engine. What you hear depends on where the stethoscope is (each sound has a site of
 * maximal intensity and radiation) and on bell (low-pass) vs diaphragm (high-pass).
 */
import type { HemoParams } from '../../data/types';
import { rng } from '../math';
import type { BeatSummary, Murmurs, Sample } from '../hemo/simulator';
import { audibleSounds, audibleSoundsAvg, type SoundEvent } from '../hemo/sounds';

export type AuscSite = 'aortic' | 'pulmonic' | 'erb' | 'tricuspid' | 'mitral';
export type ChestPiece = 'diaphragm' | 'bell';

export const SITES: Record<AuscSite, { label: string; where: string; x: number; y: number }> = {
  aortic: { label: 'Aortic area', where: '2nd right intercostal space, right sternal border', x: -1, y: 2 },
  pulmonic: { label: 'Pulmonic area', where: '2nd left intercostal space, left sternal border', x: 1, y: 2 },
  erb: { label: "Erb's point", where: '3rd left intercostal space, left sternal border', x: 1, y: 3 },
  tricuspid: { label: 'Tricuspid area', where: '4th–5th left intercostal space, lower left sternal border', x: 1, y: 4.5 },
  mitral: { label: 'Mitral area (apex)', where: '5th intercostal space, mid-clavicular line', x: 4, y: 5 },
};

type MurmurKey = keyof Murmurs;
interface MurmurSpec { name: string; centre: number; q: number; threshold: number; sites: Record<AuscSite, number>; radiation: string; timing: 'systolic' | 'diastolic' | 'continuous' }

/** Character, threshold (beat energy) and distribution of each turbulent jet. */
export const MURMUR_SPECS: Record<MurmurKey, MurmurSpec> = {
  as: { name: 'Aortic ejection murmur', centre: 220, q: 0.9, threshold: 3, sites: { aortic: 1, pulmonic: 0.6, erb: 0.75, tricuspid: 0.45, mitral: 0.55 }, radiation: 'to the carotids (and apex – Gallavardin)', timing: 'systolic' },
  ar: { name: 'Aortic regurgitation', centre: 450, q: 1.2, threshold: 1.5, sites: { aortic: 0.8, pulmonic: 0.5, erb: 1, tricuspid: 0.65, mitral: 0.4 }, radiation: 'down the left sternal border', timing: 'diastolic' },
  mr: { name: 'Mitral regurgitation', centre: 380, q: 1.0, threshold: 1.5, sites: { aortic: 0.2, pulmonic: 0.2, erb: 0.35, tricuspid: 0.45, mitral: 1 }, radiation: 'to the left axilla', timing: 'systolic' },
  ms: { name: 'Mitral stenosis rumble', centre: 60, q: 1.4, threshold: 2.5, sites: { aortic: 0.05, pulmonic: 0.05, erb: 0.2, tricuspid: 0.35, mitral: 1 }, radiation: 'localised to the apex (left lateral position, bell)', timing: 'diastolic' },
  tr: { name: 'Tricuspid regurgitation', centre: 300, q: 1.0, threshold: 1.0, sites: { aortic: 0.15, pulmonic: 0.2, erb: 0.55, tricuspid: 1, mitral: 0.4 }, radiation: 'to the right sternal border; louder on inspiration (Carvallo)', timing: 'systolic' },
  ps: { name: 'Pulmonic ejection murmur', centre: 200, q: 0.9, threshold: 4, sites: { aortic: 0.4, pulmonic: 1, erb: 0.7, tricuspid: 0.3, mitral: 0.15 }, radiation: 'to the left clavicle/back', timing: 'systolic' },
  pr: { name: 'Pulmonic regurgitation', centre: 320, q: 1.1, threshold: 1.5, sites: { aortic: 0.3, pulmonic: 1, erb: 0.9, tricuspid: 0.4, mitral: 0.1 }, radiation: 'down the left sternal border', timing: 'diastolic' },
  vsd: { name: 'Ventricular septal defect', centre: 300, q: 0.8, threshold: 2, sites: { aortic: 0.35, pulmonic: 0.5, erb: 0.85, tricuspid: 1, mitral: 0.5 }, radiation: 'across the precordium (thrill)', timing: 'systolic' },
  pda: { name: 'Patent ductus ("machinery")', centre: 200, q: 0.8, threshold: 2, sites: { aortic: 0.5, pulmonic: 1, erb: 0.65, tricuspid: 0.3, mitral: 0.2 }, radiation: 'to the left infraclavicular area and back', timing: 'continuous' },
  hocm: { name: 'Dynamic LVOT obstruction (HOCM)', centre: 220, q: 0.9, threshold: 2, sites: { aortic: 0.35, pulmonic: 0.3, erb: 1, tricuspid: 0.85, mitral: 0.7 }, radiation: 'little to the carotids', timing: 'systolic' },
  pulmFlow: { name: 'Pulmonary flow murmur', centre: 180, q: 0.9, threshold: 7, sites: { aortic: 0.3, pulmonic: 1, erb: 0.6, tricuspid: 0.3, mitral: 0.1 }, radiation: 'none (soft, mid-systolic)', timing: 'systolic' },
  tvFlow: { name: 'Tricuspid flow rumble', centre: 70, q: 1.3, threshold: 4, sites: { aortic: 0.05, pulmonic: 0.1, erb: 0.3, tricuspid: 1, mitral: 0.3 }, radiation: 'localised', timing: 'diastolic' },
  mvFlow: { name: 'Mitral flow rumble', centre: 55, q: 1.3, threshold: 9, sites: { aortic: 0.05, pulmonic: 0.05, erb: 0.2, tricuspid: 0.3, mitral: 1 }, radiation: 'localised to the apex', timing: 'diastolic' },
};

const SOUND_SPEC: Record<SoundEvent['id'], { f: number[]; tau: number; sites: Record<AuscSite, number> }> = {
  S1: { f: [48, 95], tau: 0.016, sites: { aortic: 0.5, pulmonic: 0.5, erb: 0.7, tricuspid: 1, mitral: 1 } },
  A2: { f: [70, 130], tau: 0.012, sites: { aortic: 1, pulmonic: 0.9, erb: 0.8, tricuspid: 0.5, mitral: 0.6 } },
  P2: { f: [65, 120], tau: 0.012, sites: { aortic: 0.25, pulmonic: 1, erb: 0.6, tricuspid: 0.3, mitral: 0.1 } },
  S3: { f: [32], tau: 0.03, sites: { aortic: 0.05, pulmonic: 0.05, erb: 0.25, tricuspid: 0.5, mitral: 1 } },
  S4: { f: [27], tau: 0.03, sites: { aortic: 0.05, pulmonic: 0.05, erb: 0.25, tricuspid: 0.5, mitral: 1 } },
  OS: { f: [130, 240], tau: 0.008, sites: { aortic: 0.3, pulmonic: 0.4, erb: 0.8, tricuspid: 1, mitral: 0.9 } },
  click: { f: [160, 300], tau: 0.006, sites: { aortic: 0.2, pulmonic: 0.2, erb: 0.5, tricuspid: 0.6, mitral: 1 } },
  knock: { f: [75, 140], tau: 0.014, sites: { aortic: 0.1, pulmonic: 0.2, erb: 0.6, tricuspid: 1, mitral: 0.9 } },
};

/** Chest-piece transfer: the bell passes low frequencies, the (pressed) diaphragm filters them out. */
export function chestPieceGain(f: number, piece: ChestPiece) {
  if (piece === 'diaphragm') return f < 80 ? 0.3 : f < 140 ? 0.7 : 1;
  return f > 300 ? 0.3 : f > 180 ? 0.6 : 1.15;
}

export interface PhonoResult {
  fs: number;
  audio: Float32Array;
  t0: number; // simulation time (s) of audio[0]
  events: Array<{ t: number; id: SoundEvent['id'] }>; // seconds from t0
  murmurs: Array<{ key: MurmurKey; loud: number }>;
  /** Per-key murmur loudness at this site (0..~1.2). */
  siteLoudness: Partial<Record<MurmurKey, number>>;
}

/** Loudness (0..~1.2) of each murmur over the beats, before site weighting. */
export function murmurLoudness(beats: BeatSummary[]): Array<{ key: MurmurKey; loud: number }> {
  if (!beats.length) return [];
  const out: Array<{ key: MurmurKey; loud: number }> = [];
  for (const key of Object.keys(MURMUR_SPECS) as MurmurKey[]) {
    const e = beats.reduce((a, b) => a + b.murmurs[key], 0) / beats.length;
    const spec = MURMUR_SPECS[key];
    if (e > spec.threshold) out.push({ key, loud: Math.min(1.2, Math.sqrt((e - spec.threshold) / 12)) });
  }
  return out;
}

/** Grade (Levine 1–6) estimated from loudness; thrills are not modelled beyond grade 4. */
export const levineGrade = (loud: number) => Math.max(1, Math.min(4, Math.round(1 + loud * 3)));

/** Simple two-pole band-pass (RBJ biquad). */
function bandpass(x: Float32Array, fs: number, f0: number, q: number) {
  const w = (2 * Math.PI * f0) / fs, al = Math.sin(w) / (2 * q), c = Math.cos(w);
  const b0 = al, b2 = -al, a0 = 1 + al, a1 = -2 * c, a2 = 1 - al;
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = (b0 * x[i] + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
  }
  return y;
}

export function synthPhono(opts: { samples: Sample[]; beats: BeatSummary[]; params: HemoParams; site: AuscSite; piece: ChestPiece; seconds?: number; fs?: number; seed?: number }): PhonoResult {
  const fs = opts.fs ?? 8000;
  const { samples, params, site, piece } = opts;
  const lastBeat = opts.beats[opts.beats.length - 1];
  const tEnd = lastBeat ? lastBeat.tEnd : samples[samples.length - 1]?.t ?? 0;
  const t0 = Math.max(samples[0]?.t ?? 0, tEnd - (opts.seconds ?? 8));
  const n = Math.max(1, Math.round((tEnd - t0) * fs));
  const audio = new Float32Array(n);
  const rand = rng(opts.seed ?? 7);
  const win = samples.filter((s) => s.t >= t0 && s.t <= tEnd);
  const beats = opts.beats.filter((b) => b.tStart >= t0 - 0.05 && b.tEnd <= tEnd + 0.01);
  const events: PhonoResult['events'] = [];

  // ---- transients
  const audibleIds = new Set(audibleSoundsAvg(beats.length ? beats : opts.beats.slice(-5), params).map((e) => e.id));
  for (const b of beats) {
    for (const e of audibleSounds(b, params)) {
      if (!audibleIds.has(e.id) && e.id !== 'P2') continue;
      const spec = SOUND_SPEC[e.id];
      const tt = b.tStart - t0 + e.t / 1000;
      events.push({ t: tt, id: e.id });
      const amp = e.loud * spec.sites[site];
      const i0 = Math.round(tt * fs);
      const len = Math.round(spec.tau * 6 * fs);
      for (const f of spec.f) {
        const g = amp * chestPieceGain(f, piece) / spec.f.length;
        const ph = rand() * Math.PI;
        for (let k = 0; k < len && i0 + k < n; k++) {
          if (i0 + k < 0) continue;
          const t = k / fs;
          const attack = Math.min(1, t / 0.003);
          audio[i0 + k] += g * attack * Math.exp(-t / spec.tau) * Math.sin(2 * Math.PI * f * t + ph);
        }
      }
    }
  }

  // ---- murmurs: noise shaped by the instantaneous jet power
  const murmurs = murmurLoudness(beats.length ? beats : opts.beats.slice(-5));
  const siteLoudness: PhonoResult['siteLoudness'] = {};
  for (const { key, loud } of murmurs) {
    const spec = MURMUR_SPECS[key];
    const g = loud * spec.sites[site] * chestPieceGain(spec.centre, piece) * 0.55;
    siteLoudness[key] = loud * spec.sites[site] * chestPieceGain(spec.centre, piece);
    if (g < 0.01 || win.length < 2) continue;
    let peak = 0;
    for (const s of win) peak = Math.max(peak, s.m[key]);
    if (peak <= 0) continue;
    const noise = new Float32Array(n);
    for (let i = 0; i < n; i++) noise[i] = rand() * 2 - 1;
    let shaped = bandpass(noise, fs, spec.centre, spec.q);
    shaped = bandpass(shaped, fs, spec.centre, spec.q); // 4th order: more "pitched"
    let j = 0;
    for (let i = 0; i < n; i++) {
      const t = t0 + i / fs;
      while (j < win.length - 2 && win[j + 1].t < t) j++;
      const a = win[j], b = win[j + 1];
      const u = b.t > a.t ? Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t))) : 0;
      const env = Math.sqrt(Math.max(0, (a.m[key] + (b.m[key] - a.m[key]) * u) / peak));
      audio[i] += g * env * shaped[i] * 4;
    }
  }

  // normalise
  let mx = 0;
  for (let i = 0; i < n; i++) mx = Math.max(mx, Math.abs(audio[i]));
  if (mx > 0) {
    const k = 0.8 / Math.max(mx, 0.6);
    for (let i = 0; i < n; i++) audio[i] *= k;
  }
  // short fades so looping does not click
  const fade = Math.min(n >> 1, Math.round(0.02 * fs));
  for (let i = 0; i < fade; i++) { audio[i] *= i / fade; audio[n - 1 - i] *= i / fade; }
  return { fs, audio, t0, events: events.sort((a, b) => a.t - b.t), murmurs, siteLoudness };
}

/** Plain-language description of the murmurs present (timing, site, radiation, grade). */
export function describeMurmurs(beats: BeatSummary[]) {
  const all = murmurLoudness(beats);
  const has = (k: MurmurKey) => all.some((m) => m.key === k);
  // a flow rumble across a valve that already has its own lesion murmur is not listed separately
  return all.filter((m) => !(m.key === 'mvFlow' && has('ms')) && !(m.key === 'tvFlow' && has('tr'))).map(({ key, loud }) => {
    const spec = MURMUR_SPECS[key];
    const best = (Object.entries(spec.sites) as Array<[AuscSite, number]>).sort((a, b) => b[1] - a[1])[0][0];
    return { key, name: spec.name, timing: spec.timing, grade: levineGrade(loud), site: SITES[best].label, radiation: spec.radiation, pitch: spec.centre < 100 ? 'low-pitched (bell)' : spec.centre > 330 ? 'high-pitched (diaphragm)' : 'medium-pitched' };
  });
}

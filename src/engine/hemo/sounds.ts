/**
 * Which heart sounds are audible for a simulated beat, and when.
 *
 * The circulation model gives continuous measures (early-filling deceleration, the LV pressure
 * rise produced by atrial contraction, valve event times). Audibility is decided with explicit,
 * textbook-based rules on top of those measures:
 *  - S3: rapid early filling that decelerates abruptly into a volume-loaded ventricle
 *        (dilated LV, low EF with high filling pressure, severe MR/AR, large left-to-right shunt).
 *  - S4: atrial contraction into a stiff ventricle (needs atrial kick; high LVEDP or a large
 *        atrial pressure rise), absent in AF and in constriction.
 *  - Opening snap: only with mitral stenosis (pliable leaflets assumed); A2–OS interval shortens
 *        as LA pressure rises.
 *  - Pericardial knock: constriction (earlier and higher-pitched than an S3).
 *  - Mid-systolic click: mitral valve prolapse.
 * These rules are documented in docs/CONTENT_NOTES.md.
 */
import type { HemoParams } from '../../data/types';
import type { BeatSummary } from './simulator';

export interface SoundEvent {
  id: 'S1' | 'A2' | 'P2' | 'S3' | 'S4' | 'OS' | 'click' | 'knock';
  t: number; // ms from beat start (onset of ventricular contraction)
  loud: number; // 0..1
  pitch: 'high' | 'low';
}

export function audibleSounds(b: BeatSummary, p: HemoParams): SoundEvent[] {
  const S = b.sounds;
  const ev: SoundEvent[] = [];
  const dur = (b.tEnd - b.tStart) * 1000;
  if (S.s1 != null) ev.push({ id: 'S1', t: Math.max(0, S.s1), loud: S.s1 < 60 && p.mvArea < 2 ? 1 : 0.8, pitch: 'high' });
  if (S.a2 != null) ev.push({ id: 'A2', t: S.a2, loud: p.avArea < 1 ? 0.35 : 0.75, pitch: 'high' });
  if (S.p2 != null && (S.split == null || Math.abs(S.split) > 15)) ev.push({ id: 'P2', t: S.p2, loud: b.paSys > 40 ? 0.9 : 0.45, pitch: 'high' });
  const constr = p.pericardialStiffness > 1.5;
  const volumeLoad = b.edv >= 165 || (b.ef < 0.45 && b.lvEdp >= 18) || b.mrFraction >= 0.3 || b.arFraction >= 0.3 || (b.qpqs >= 1.8 && b.edv >= 150);
  if (!constr && S.s3 >= 6 && volumeLoad && S.mvOpen != null) ev.push({ id: 'S3', t: S.mvOpen + 130, loud: 0.5, pitch: 'low' });
  if (!constr && p.atrialKick > 0 && p.rhythm === 'sinus' && S.s4 >= 1.8 && b.lvEdp >= 16) ev.push({ id: 'S4', t: dur - 70, loud: 0.45, pitch: 'low' });
  if (p.mvArea < 2 && S.mvOpen != null) ev.push({ id: 'OS', t: S.mvOpen + 10, loud: 0.7, pitch: 'high' });
  if (constr && S.knock > 0 && S.mvOpen != null) ev.push({ id: 'knock', t: S.mvOpen + 90, loud: 0.6, pitch: 'high' });
  if (S.click != null && S.s1 != null) ev.push({ id: 'click', t: S.s1 + S.click, loud: 0.55, pitch: 'high' });
  return ev.filter((e) => e.t >= 0 && e.t <= dur);
}

/**
 * Audibility judged on the mean of several beats (respiration makes single beats noisy);
 * timing taken from the most recent beat.
 */
export function audibleSoundsAvg(beats: BeatSummary[], p: HemoParams): SoundEvent[] {
  const last = beats[beats.length - 1];
  if (!last) return [];
  const m = (f: (b: BeatSummary) => number) => beats.reduce((a, b) => a + f(b), 0) / beats.length;
  const merged: BeatSummary = {
    ...last,
    edv: m((b) => b.edv), ef: m((b) => b.ef), lvEdp: m((b) => b.lvEdp), paSys: m((b) => b.paSys),
    mrFraction: m((b) => b.mrFraction), arFraction: m((b) => b.arFraction), qpqs: m((b) => b.qpqs),
    sounds: { ...last.sounds, s3: m((b) => b.sounds.s3), s4: m((b) => b.sounds.s4), knock: m((b) => b.sounds.knock) },
  };
  return audibleSounds(merged, p);
}

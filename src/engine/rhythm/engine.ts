/**
 * Conduction-system rhythm engine (event-driven state machine).
 *
 * Nodes and their key properties:
 *  • SA node – automaticity (rate), respiratory sinus arrhythmia, reset by premature atrial beats.
 *  • Atria – refractory period; flutter (macro re-entry, ~300/min) or fibrillation (random impulses).
 *  • AV node – DECREMENTAL conduction: the A–H time grows the sooner an impulse arrives after the
 *    previous one left the node (A–H = AHmin + decrement·e^(−recovery/τ)); impulses arriving within
 *    the refractory period are blocked (Wenckebach emerges naturally). Optional dual pathways
 *    (fast: short conduction, long refractoriness; slow: the reverse) → AV nodal re-entry.
 *  • His–Purkinje – all-or-none (Mobitz II / complete infra-Hisian block).
 *  • Accessory pathway – non-decremental, fast; antegrade (pre-excitation) and/or retrograde.
 *  • Escape pacemakers – junctional (40–60/min), ventricular (20–40/min).
 *  • Ventricular foci / re-entry – PVCs, VT, torsades, VF.
 * Output: atrial and ventricular events (which drive both ECG morphology and mechanics) plus
 * a ladder diagram.
 */
import type { DrugId, RhythmModel, VentricularRegionId } from '../../data/types';
import { rng } from '../math';
import type { ResolvedEcg } from '../electrical/model';
import type { VentricularPattern } from '../electrical/activation';
import type { AtrialEvent, AtrialOrigin, ContinuousActivity, LadderEntry, RhythmOutput, VentricularEvent } from './types';
import { rhythmById } from '../../data/rhythms';

export interface RhythmOptions {
  durationMs: number;
  seed?: number;
  /** Drugs given at a time point (e.g. adenosine at 4000 ms). */
  drugEvents?: Array<{ t: number; drug: DrugId }>;
  /** Extra ectopic beats injected by the user (Arrhythmia lab "trigger"). */
  triggers?: Array<{ t: number; type: 'pac' | 'pvc'; origin?: VentricularRegionId }>;
}

const ATRIAL_TO_AVN = 40; // P onset → impulse reaches the AV node (ms)
const HV = 45; // His → ventricular activation
const ATRIAL_ERP = 180;
const HIS_ERP = 260;
const V_ERP = 250;

interface Ev {
  t: number;
  kind: 'sinus' | 'A' | 'AVN' | 'SLOWTOP' | 'HIS' | 'V' | 'escape' | 'ectopicV' | 'flutterA' | 'fibA';
  origin?: AtrialOrigin;
  aIndex?: number;
  ladder?: LadderEntry;
  pattern?: VentricularPattern;
  source?: VentricularEvent['source'];
  noAV?: boolean; // atrial bystander activation that must not re-enter the AV node
  token?: number;
}

const MAT_ORIGINS: AtrialOrigin[] = [
  { kind: 'ectopic', axisDeg: 70, id: 'mat-a' },
  { kind: 'ectopic', axisDeg: -10, id: 'mat-b' },
  { kind: 'ectopic', axisDeg: 115, horizontalDeg: 20, id: 'mat-c' },
  { kind: 'ectopic', axisDeg: 30, horizontalDeg: -30, id: 'mat-d' },
];
const PAC_ORIGIN: AtrialOrigin = { kind: 'ectopic', axisDeg: 15, horizontalDeg: -25, id: 'pac' };

export function simulateRhythm(model: RhythmModel, R: ResolvedEcg, opts: RhythmOptions): RhythmOutput {
  const rand = rng(opts.seed ?? 7);
  const D = opts.durationMs;
  const out: RhythmOutput = { duration: D, atrial: [], ventricular: [], continuous: [], ladder: [], notes: [] };

  // ---------------------------------------------------------------- parameters
  const sinusRate = (model.sinusRate ?? R.hr) * (model.sinusRate !== undefined ? R.mods.hrFactor : 1);
  const atrialMode = R.mods.atrialStandstill ? 'none' : model.atrial ?? 'sinus';
  const av = model.av ?? {};
  const ahMin = (av.ahMin ?? 75) + R.mods.prDeltaMs;
  let decrement = av.decrement ?? 120;
  const tau = 110;
  let avErp = (av.erp ?? 250) + R.mods.avNodalErpDelta; // measured from node exit
  const dual = !!av.dualPathway;
  const fast = { ah: 60 + R.mods.prDeltaMs * 0.5, erp: 400 + R.mods.avNodalErpDelta, retroErp: 240, last: -1e9 };
  const slow = { ah: 250 + R.mods.prDeltaMs, erp: 260 + R.mods.avNodalErpDelta * 0.5, last: -1e9 };
  const ap = model.accessoryPathway ?? (R.accessoryPathway ? { location: R.accessoryPathway, antegrade: true, retrograde: true } : undefined);
  const apErp = model.svt?.type === 'avrt-anti' ? 250 : 300;
  const avRetroErp = 200;
  const junctionalRate = model.escape?.junctional ?? 45;
  const ventricularEscapeRate = model.escape?.ventricular ?? 33;
  const mobitz2Ratio = model.infraHis?.block === 'mobitz2' ? model.infraHis.ratio ?? 3 : 0;
  const completeInfra = model.infraHis?.block === 'complete';
  const completeNodal = !!model.completeNodalBlock;
  const pea = !!model.pea;
  const conductedPattern: VentricularPattern = { kind: 'normal' };

  // ---------------------------------------------------------------- state
  let lastA = -1e9;
  let lastAVExit = -1e9;
  let lastHis = -1e9;
  let lastV = -1e9;
  let lastAP = -1e9;
  let hisCount = 0;
  let nextSinus = 300 + rand() * 100;
  let adenosineUntil = -1;
  let circuit: 'none' | 'avnrt' | 'avrt-ortho' | 'avrt-anti' = 'none';
  let vToken = 0;

  const queue: Ev[] = [];
  const push = (e: Ev) => {
    let i = queue.length;
    while (i > 0 && queue[i - 1].t > e.t) i--;
    queue.splice(i, 0, e);
  };

  const sinusCL = (t: number) => {
    if (sinusRate <= 0) return Infinity;
    const base = 60000 / sinusRate;
    const sa = model.sinusArrhythmia ?? 0.03;
    return base * (1 + sa * Math.sin((2 * Math.PI * t) / 4000));
  };

  const isAdenosine = (t: number) => t < adenosineUntil;
  for (const d of opts.drugEvents ?? []) if (d.drug === 'adenosine') push({ t: d.t, kind: 'sinus', token: -99 });

  // ---------------------------------------------------------------- sources of atrial impulses
  if (atrialMode === 'sinus' && sinusRate > 0) push({ t: nextSinus, kind: 'sinus' });
  if (atrialMode === 'mat') {
    let t = 300;
    while (t < D) {
      push({ t, kind: 'A', origin: MAT_ORIGINS[Math.floor(rand() * MAT_ORIGINS.length)] });
      t += 420 + rand() * 230;
    }
  }
  if (atrialMode === 'flutter') {
    const rate = model.flutterRate ?? 300;
    const cl = 60000 / rate;
    out.continuous.push({ kind: 'flutter', start: 0, end: D, rate, seed: 3 });
    for (let t = 100; t < D; t += cl) push({ t, kind: 'flutterA' });
    // the AV node lets every Nth flutter wave through (little decrement at a fixed ratio)
    decrement = 40;
    avErp = (model.flutterBlock === 'variable' ? 2 : model.flutterBlock ?? 2) * cl - cl / 2 - ahMin - 20;
  }
  if (atrialMode === 'fibrillation') {
    out.continuous.push({ kind: 'fibrillation', start: 0, end: D, rate: 450, seed: 5 });
    let t = 50;
    while (t < D) {
      push({ t, kind: 'fibA' });
      t += 90 + rand() * 120;
    }
    avErp = Math.max(avErp, 300);
  }

  // Sick sinus: a paroxysm of AF (brady–tachy syndrome), followed by a post-conversion pause
  const tachyWindow = model.sinusPauses === 'sick-sinus' ? [Math.min(4500, D * 0.4), Math.min(8000, D * 0.7)] : null;
  if (tachyWindow) {
    out.continuous.push({ kind: 'fibrillation', start: tachyWindow[0], end: tachyWindow[1], rate: 450, seed: 9 });
    let t = tachyWindow[0];
    while (t < tachyWindow[1]) {
      push({ t, kind: 'fibA' });
      t += 90 + rand() * 120;
    }
  }

  // ---------------------------------------------------------------- ventricular-level rhythms
  const vr = model.ventricular;
  let ventricularTakeover = Infinity;
  if (vr) {
    const onset = vr.onsetMs ?? 0;
    ventricularTakeover = onset;
    const origin = vr.origin ?? 'seg11';
    if (vr.mode === 'vt-mono' || vr.mode === 'idioventricular' || vr.mode === 'aivr') {
      const rate = vr.rate ?? (vr.mode === 'vt-mono' ? 170 : vr.mode === 'aivr' ? 75 : 35);
      for (let t = onset + 50; t < D; t += 60000 / rate) push({ t, kind: 'ectopicV', pattern: { kind: 'ectopic', origin }, source: vr.mode === 'vt-mono' ? 'reentry' : 'escape' });
    } else if (vr.mode === 'vt-poly') {
      const origins: VentricularRegionId[] = ['seg11', 'rvApex', 'seg7', 'seg4', 'rvot', 'seg16', 'seg3'];
      let k = 0;
      for (let t = onset + 50; t < D; t += 60000 / (vr.rate ?? 210) * (0.85 + rand() * 0.3)) {
        push({ t, kind: 'ectopicV', pattern: { kind: 'ectopic', origin: origins[k++ % origins.length] }, source: 'reentry' });
      }
    } else if (vr.mode === 'torsades' || vr.mode === 'vf') {
      out.continuous.push({ kind: vr.mode, start: onset, end: D, rate: vr.rate ?? (vr.mode === 'vf' ? 300 : 230), seed: 11 });
      if (vr.mode === 'torsades') {
        for (let t = onset; t < D; t += 60000 / (vr.rate ?? 230)) {
          out.ventricular.push({ t, pattern: { kind: 'ectopic', origin }, source: 'reentry', rr: 260, mechanical: 0.15, scale: 0 });
        }
      }
    }
    // the atria may keep beating (AV dissociation) – sinus continues unless asystole
  }

  // ---------------------------------------------------------------- programmed ectopy and triggers
  const ectopy = model.ectopy ?? [];
  for (const tr of opts.triggers ?? []) {
    if (tr.type === 'pac') push({ t: tr.t, kind: 'A', origin: PAC_ORIGIN });
    else push({ t: tr.t, kind: 'ectopicV', pattern: { kind: 'ectopic', origin: tr.origin ?? 'seg11' }, source: 'ventricular' });
  }
  // SVT: an initiating premature atrial beat is timed after the first sinus beat past onsetMs
  let svtPending = !!model.svt;
  const svtCoupling = model.svt?.type === 'avnrt' ? 310 : model.svt?.type === 'avrt-ortho' ? 270 : 300;
  let conductedSinceEctopic = 0;
  let sinceAtrialEctopic = 0;

  // ---------------------------------------------------------------- helpers
  const recordA = (t: number, origin: AtrialOrigin, mechanical = true): number => {
    out.atrial.push({ t, origin, conducted: false, mechanical });
    return out.atrial.length - 1;
  };

  const scheduleEscape = (afterV: number) => {
    vToken++;
    const tok = vToken;
    const nodeOk = !completeInfra;
    // escape pacemakers are overdrive-suppressed: the first escape comes a little later than their cycle length
    const cl = (nodeOk ? 60000 / junctionalRate : 60000 / ventricularEscapeRate) * 1.15;
    push({ t: afterV + cl, kind: 'escape', token: tok });
  };

  const fireV = (t: number, pattern: VentricularPattern, source: VentricularEvent['source'], aIndex?: number, ladder?: LadderEntry) => {
    if (t - lastV < V_ERP) return false;
    if (t >= ventricularTakeover && source !== 'reentry' && source !== 'escape') return false;
    const rr = lastV > 0 ? t - lastV : 60000 / Math.max(30, sinusRate || 60);
    lastV = t;
    const ev: VentricularEvent = { t, pattern, source, rr, mechanical: pea ? 0 : 1, fromAtrial: aIndex };
    out.ventricular.push(ev);
    if (aIndex !== undefined) out.atrial[aIndex].conducted = true;
    if (ladder) { ladder.v = t; out.ladder.push(ladder); }
    else out.ladder.push({ v: t, label: source });
    // retrograde penetration of the His bundle by ectopic ventricular beats (→ compensatory pause)
    if (source === 'ventricular' || source === 'reentry' || source === 'escape') lastHis = Math.max(lastHis, t + 80);
    // programmed PVCs follow conducted beats at a fixed coupling interval
    if (source === 'conducted' || source === 'preexcited') {
      conductedSinceEctopic++;
      for (const ec of ectopy) {
        if (ec.type !== 'pvc') continue;
        const every = ec.pattern === 'bigeminy' || ec.pattern === 'couplet' ? 1 : ec.pattern === 'trigeminy' ? 2 : 5;
        if ((ec.at === undefined && conductedSinceEctopic >= every) || (ec.at !== undefined && Math.abs(t - ec.at) < 450)) {
          conductedSinceEctopic = 0;
          const o = ec.origin ?? 'seg11';
          push({ t: t + ec.couplingMs, kind: 'ectopicV', pattern: { kind: 'ectopic', origin: o }, source: 'ventricular' });
          if (ec.pattern === 'couplet') push({ t: t + ec.couplingMs + 380, kind: 'ectopicV', pattern: { kind: 'ectopic', origin: o }, source: 'ventricular' });
        }
      }
    }
    // accessory pathway retrograde limb (orthodromic AVRT)
    if (ap?.retrograde && circuit === 'avrt-ortho' && t - lastAP >= apErp) {
      lastAP = t + 30;
      push({ t: t + 100, kind: 'A', origin: { kind: 'ectopic', axisDeg: ap.location === 'right-free-wall' ? 30 : 150, horizontalDeg: -40, id: 'ap-retro' } });
    }
    // antidromic AVRT: retrograde up the His/AV node
    if (circuit === 'avrt-anti') {
      if (isAdenosine(t)) { circuit = 'none'; out.notes.push('Antidromic AVRT terminated (AV node blocked).'); }
      else if (t - lastAVExit >= avRetroErp) {
        lastAVExit = t + 100;
        push({ t: t + 220, kind: 'A', origin: { kind: 'retrograde' }, noAV: true });
      }
    }
    scheduleEscape(t);
    return true;
  };

  // escape timer from the start (e.g. complete heart block has no conducted beat to restart it)
  scheduleEscape(-200);

  // ---------------------------------------------------------------- main loop
  let guard = 0;
  while (queue.length && guard++ < 200000) {
    const e = queue.shift()!;
    if (e.t > D) break;
    switch (e.kind) {
      case 'sinus': {
        if (e.token === -99) {
          // adenosine: transient high-grade AV nodal block (~6 s) and brief sinus slowing
          adenosineUntil = e.t + 6000;
          out.notes.push(`Adenosine at ${(e.t / 1000).toFixed(1)} s: transient AV nodal block.`);
          break;
        }
        let cl = sinusCL(e.t);
        // pauses
        if (model.sinusPauses === 'arrest' && rand() < 0.18) cl *= 3.2;
        if (tachyWindow && e.t >= tachyWindow[0] - 200 && e.t < tachyWindow[1]) {
          // sinus node suppressed during AF; long post-termination pause
          nextSinus = tachyWindow[1] + 2200;
          push({ t: nextSinus, kind: 'sinus' });
          break;
        }
        if (isAdenosine(e.t)) cl *= 1.25;
        if (e.t - lastA >= ATRIAL_ERP) push({ t: e.t, kind: 'A', origin: { kind: 'sinus' } });
        if (svtPending && model.svt && e.t >= model.svt.onsetMs) {
          svtPending = false;
          push({ t: e.t + svtCoupling, kind: 'A', origin: PAC_ORIGIN, token: -1 });
        }
        nextSinus = e.t + cl;
        push({ t: nextSinus, kind: 'sinus' });
        break;
      }
      case 'A': {
        if (e.t - lastA < ATRIAL_ERP) break;
        // ectopy pattern: PACs inserted after N conducted sinus beats
        const origin = e.origin!;
        lastA = e.t;
        if (e.token === -1 && model.svt) circuit = model.svt.type;
        const ai = recordA(e.t, origin);
        // premature atrial beats reset the sinus node (non-compensatory pause)
        if (origin.kind !== 'sinus' && atrialMode === 'sinus') {
          for (let i = queue.length - 1; i >= 0; i--) if (queue[i].kind === 'sinus' && queue[i].token !== -99) queue.splice(i, 1);
          nextSinus = e.t + sinusCL(e.t);
          push({ t: nextSinus, kind: 'sinus' });
        }
        if (!e.noAV) push({ t: e.t + ATRIAL_TO_AVN, kind: 'AVN', aIndex: ai, ladder: { a: e.t, avIn: e.t + ATRIAL_TO_AVN } });
        // accessory pathway antegrade (pre-excitation): fast, non-decremental
        if (ap?.antegrade && e.t + 60 - lastAP >= apErp) {
          lastAP = e.t + 60;
          const apV = e.t + 108;
          const normalV = e.t + ATRIAL_TO_AVN + ahMin + HV;
          const lead = Math.max(0, Math.min(140, normalV - apV));
          const anti = circuit === 'avrt-anti';
          const pattern: VentricularPattern = { kind: 'preexcited', pathway: ap.location, leadMs: anti ? 140 : lead };
          if (fireV(apV, pattern, 'preexcited', ai, { a: e.t, avIn: e.t + 30, avOut: apV - 5, pathway: 'accessory' })) {
            lastHis = Math.max(lastHis, apV + (anti ? 0 : lead)); // fused activation reaches His from below
          }
        }
        // programmed atrial/junctional ectopy (PVCs are handled after conducted beats)
        if (origin.kind === 'sinus') {
          for (const ec of ectopy) {
            if (ec.type === 'pvc') continue;
            sinceAtrialEctopic++;
            const every = ec.pattern === 'bigeminy' ? 1 : ec.pattern === 'trigeminy' ? 2 : 4;
            if ((ec.at === undefined && sinceAtrialEctopic >= every) || (ec.at !== undefined && Math.abs(e.t - ec.at) < 400)) {
              sinceAtrialEctopic = 0;
              if (ec.type === 'pac') push({ t: e.t + ec.couplingMs, kind: 'A', origin: PAC_ORIGIN });
              else push({ t: e.t + ec.couplingMs, kind: 'HIS', ladder: { label: 'PJC' }, token: -2 });
            }
          }
        }
        break;
      }
      case 'flutterA':
      case 'fibA': {
        const origin: AtrialOrigin = { kind: e.kind === 'flutterA' ? 'flutter' : 'fibrillation' };
        out.atrial.push({ t: e.t, origin, conducted: false, mechanical: false });
        const ai = out.atrial.length - 1;
        const jitter = e.kind === 'fibA' ? (rand() - 0.5) * 120 : model.flutterBlock === 'variable' ? (rand() < 0.4 ? 200 : 0) : 0;
        push({ t: e.t + (e.kind === 'fibA' ? 10 : ATRIAL_TO_AVN), kind: 'AVN', aIndex: ai, ladder: { a: e.t, avIn: e.t + ATRIAL_TO_AVN }, token: jitter });
        break;
      }
      case 'AVN': {
        const t = e.t;
        const ladder = e.ladder ?? {};
        if (completeNodal || isAdenosine(t)) { ladder.blocked = 'av'; out.ladder.push(ladder); break; }
        if (dual) {
          let ah = -1;
          const fastOk = t - fast.last >= fast.erp;
          const slowOk = t - slow.last >= slow.erp;
          if (fastOk) { ah = fast.ah; ladder.pathway = 'fast'; }
          else if (slowOk) { ah = slow.ah; ladder.pathway = 'slow'; }
          if (ah < 0) { ladder.blocked = 'av'; out.ladder.push(ladder); break; }
          // the impulse enters every recovered pathway (the slower wave is concealed/collides)
          if (fastOk) fast.last = t;
          if (slowOk) slow.last = t;
          const bottom = t + ah;
          ladder.avOut = bottom;
          push({ t: bottom, kind: 'HIS', aIndex: e.aIndex, ladder });
          // AVNRT: impulse that went down the slow pathway may return up the recovered fast pathway
          if (ladder.pathway === 'slow' && circuit === 'avnrt') push({ t: bottom, kind: 'SLOWTOP' });
          break;
        }
        // single (decremental) AV node, measured from previous exit
        const extraErp = (e.token ?? 0) > 0 ? (e.token as number) : 0;
        const recovery = t - lastAVExit - (avErp + extraErp);
        if (recovery < 0) {
          // concealed conduction in AF: blocked impulse partially re-sets refractoriness
          if (atrialMode === 'fibrillation') lastAVExit = Math.max(lastAVExit, t - avErp * 0.55);
          ladder.blocked = 'av'; out.ladder.push(ladder); break;
        }
        const ah = ahMin + decrement * Math.exp(-recovery / tau);
        const exit = t + ah;
        lastAVExit = exit;
        ladder.avOut = exit;
        ladder.pathway = 'av';
        push({ t: exit, kind: 'HIS', aIndex: e.aIndex, ladder });
        break;
      }
      case 'SLOWTOP': {
        // fast pathway retrograde: bystander retrograde atrial activation + re-entry into slow pathway
        const bottom = e.t;
        if (isAdenosine(bottom)) { circuit = 'none'; out.notes.push('AVNRT terminated: adenosine blocked the slow pathway.'); break; }
        if (bottom - fast.last < fast.retroErp) break; // fast pathway still refractory: no echo
        fast.last = bottom;
        const top = bottom + 45;
        push({ t: top - 5, kind: 'A', origin: { kind: 'retrograde' }, noAV: true });
        out.ladder.push({ avIn: top, avOut: bottom, retrograde: true, pathway: 'fast', label: 'AVNRT' });
        if (top - slow.last >= slow.erp) {
          slow.last = top;
          const nb = top + slow.ah;
          const lad: LadderEntry = { avIn: top, avOut: nb, pathway: 'slow', label: 'AVNRT' };
          push({ t: nb, kind: 'HIS', ladder: lad });
          push({ t: nb, kind: 'SLOWTOP' });
        }
        break;
      }
      case 'HIS': {
        const t = e.t;
        const ladder = e.ladder ?? {};
        if (t - lastHis < HIS_ERP) { ladder.blocked = 'his'; out.ladder.push(ladder); break; }
        if (completeInfra) { ladder.blocked = 'his'; out.ladder.push(ladder); break; }
        hisCount++;
        if (mobitz2Ratio && hisCount % mobitz2Ratio === 0) { ladder.blocked = 'his'; out.ladder.push(ladder); break; }
        lastHis = t;
        const isPJC = e.token === -2;
        if (isPJC) push({ t: t + 25, kind: 'A', origin: { kind: 'retrograde' }, noAV: true });
        fireV(t + HV, conductedPattern, isPJC ? 'junctional' : 'conducted', e.aIndex, ladder);
        break;
      }
      case 'ectopicV': {
        fireV(e.t, e.pattern!, e.source ?? 'ventricular', undefined, { v: e.t, label: e.source === 'reentry' ? 'VT' : 'PVC' });
        break;
      }
      case 'escape': {
        if (e.token !== vToken) break; // a ventricular beat occurred since
        if (e.t >= ventricularTakeover) break;
        if (completeInfra || (model.ventricular?.mode === 'idioventricular')) {
          fireV(e.t, { kind: 'ectopic', origin: 'seg14' }, 'escape', undefined, { v: e.t, label: 'ventricular escape' });
        } else {
          lastHis = e.t - HV;
          if (fireV(e.t, conductedPattern, 'junctional', undefined, { v: e.t, avOut: e.t - HV, label: 'junctional escape' })) {
            // retrograde P when the atria are not already activated
            if (e.t - lastA > 300 && atrialMode === 'sinus' && (sinusRate === 0 || model.sinusPauses)) push({ t: e.t + 20, kind: 'A', origin: { kind: 'retrograde' }, noAV: true });
          }
        }
        break;
      }
    }
  }
  // the very first escape timer
  out.ventricular.sort((a, b) => a.t - b.t);
  const prs = out.ventricular.filter((v) => v.fromAtrial !== undefined).map((v) => v.t - out.atrial[v.fromAtrial!]?.t);
  out.meanPrMs = prs.length ? prs.reduce((a, b) => a + b, 0) / prs.length : undefined;
  return out;
}

/** Rhythm for the ECG library: resolves a rhythm id (or sinus) for a condition. */
export function rhythmForEcg(id: string, R: ResolvedEcg, durationMs: number, seed: number, extra: Partial<RhythmOptions> = {}): RhythmOutput {
  const r = rhythmById(id);
  const model: RhythmModel = r ? { ...r.model } : { sinusRate: undefined };
  if (!r || id === 'sinus' || id === 'wpw-sinus') model.sinusRate = undefined; // use condition heart rate
  return simulateRhythm(model, R, { durationMs, seed, ...extra });
}

export type { RhythmOutput, AtrialEvent, VentricularEvent, ContinuousActivity };

/**
 * Rule-based ECG interpretation from measurements. Every finding carries a `because`
 * (mechanism + structure) so the learner sees WHY the pattern appears.
 */
import type { BeatMeasure } from './measure';
import type { EcgOutput } from './synth';
import { axisCategory, cornell, lowVoltageLimb, sgarbossa, sokolowLyon } from './criteria';

export interface Finding {
  id: string;
  category: 'rate' | 'rhythm' | 'axis' | 'intervals' | 'hypertrophy' | 'ischemia' | 'conduction' | 'other';
  label: string;
  detail: string;
  because: string;
  leads?: string[];
  level?: 'student' | 'clinician';
}

const MM = 0.1;
const GROUPS: Record<string, { leads: string[]; name: string; artery: string; wall: string }> = {
  inferior: { leads: ['II', 'III', 'aVF'], name: 'inferior', artery: 'RCA (or LCx if left dominant)', wall: 'inferior wall' },
  lateral: { leads: ['I', 'aVL', 'V5', 'V6'], name: 'lateral', artery: 'LCx / diagonal', wall: 'lateral wall' },
  anterior: { leads: ['V1', 'V2', 'V3', 'V4'], name: 'anterior/anteroseptal', artery: 'LAD', wall: 'anterior wall and septum' },
  posterior: { leads: ['V7', 'V8', 'V9'], name: 'posterior', artery: 'LCx or dominant RCA', wall: 'inferolateral (posterior) wall' },
  right: { leads: ['V4R'], name: 'right ventricular', artery: 'proximal RCA', wall: 'RV free wall' },
};

export function interpret(m: BeatMeasure, ecg: EcgOutput, hr: number): Finding[] {
  const f: Finding[] = [];
  const L = m.leads;
  const has = (l: string) => L[l] !== undefined;
  const TWELVE = ['I', 'II', 'III', 'aVR', 'aVL', 'aVF', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6'].filter(has);
  const r = ecg.rhythm;

  // ---------------- rate & rhythm
  const rrs = ecg.beats.slice(1).map((b, i) => b.qrsOn - ecg.beats[i].qrsOn);
  const vRate = rrs.length ? 60000 / (rrs.reduce((a, b) => a + b, 0) / rrs.length) : hr;
  const cv = rrs.length > 2 ? Math.sqrt(rrs.reduce((a, b) => a + (b - 60000 / vRate) ** 2, 0) / rrs.length) / (60000 / vRate) : 0;
  f.push({
    id: 'rate', category: 'rate',
    label: `Ventricular rate ≈ ${Math.round(vRate)}/min${vRate < 60 ? ' (bradycardia)' : vRate > 100 ? ' (tachycardia)' : ''}`,
    detail: '300 ÷ number of large boxes between R waves, or count QRS in 6 s × 10.',
    because: vRate > 100 ? 'Faster impulse formation (↑ sympathetic tone steepens phase 4) or a re-entrant/ectopic rhythm.' : vRate < 60 ? 'Slower impulse formation (↑ vagal tone, drugs) or AV block with a slower escape pacemaker.' : 'SA node firing at its normal intrinsic rate under balanced autonomic tone.',
  });
  const noP = ecg.pWaves.length === 0;
  if (r.continuous.some((c) => c.kind === 'fibrillation')) f.push({ id: 'af', category: 'rhythm', label: 'Irregularly irregular rhythm without P waves', detail: 'Atrial fibrillation', because: 'Chaotic atrial re-entry bombards the AV node; its refractoriness and concealed conduction let impulses through at random.' });
  else if (r.continuous.some((c) => c.kind === 'flutter')) f.push({ id: 'flutter', category: 'rhythm', label: 'Sawtooth flutter waves', detail: 'Atrial flutter', because: 'A macro-re-entrant circuit around the tricuspid annulus activates the atria ~300/min; the AV node conducts every 2nd–4th wave.' });
  else if (r.continuous.some((c) => c.kind === 'vf')) f.push({ id: 'vf', category: 'rhythm', label: 'Chaotic ventricular activity', detail: 'Ventricular fibrillation', because: 'Multiple wandering re-entrant wavelets – no coordinated depolarisation, no output.' });
  else if (r.continuous.some((c) => c.kind === 'torsades')) f.push({ id: 'tdp', category: 'rhythm', label: 'Polymorphic VT twisting around the baseline', detail: 'Torsades de pointes', because: 'Long repolarisation allows early afterdepolarisations that trigger rotating re-entry.' });
  else if (noP && ecg.beats.length) f.push({ id: 'nop', category: 'rhythm', label: 'No P waves visible', detail: 'Junctional/ventricular rhythm or atrial standstill', because: 'Atria are not depolarised before the ventricles (subsidiary pacemaker, or atrial myocytes inexcitable, e.g. hyperkalemia).' });
  else if (cv < 0.08) f.push({ id: 'regular', category: 'rhythm', label: 'Regular rhythm with P before each QRS', detail: 'Sinus rhythm', because: 'SA node impulses conduct through the AV node to the ventricles one-to-one.' });
  if (r.atrial.some((a) => !a.conducted && a.origin.kind === 'sinus' && a.t < ecg.duration - 600)) {
    f.push({ id: 'avblock', category: 'conduction', label: 'Some P waves are not followed by QRS', detail: 'Second- or third-degree AV block', because: 'Impulses fail in the AV node (decremental – Mobitz I) or in the His–Purkinje system (all-or-none – Mobitz II / complete).' });
  }

  // ---------------- intervals
  if (m.pr !== null) {
    if (m.pr > 200) f.push({ id: 'pr-long', category: 'intervals', label: `PR ${Math.round(m.pr)} ms (> 200)`, detail: 'First-degree AV block (if constant)', because: 'Slowed conduction through the AV node (vagal tone, AV-nodal blocking drugs, ischemia, hyperkalemia).' });
    else if (m.pr < 120) f.push({ id: 'pr-short', category: 'intervals', label: `PR ${Math.round(m.pr)} ms (< 120)`, detail: 'Pre-excitation or low atrial/junctional rhythm', because: 'An accessory pathway bypasses the AV-nodal delay, or the impulse starts close to the AV node.' });
  }
  if (m.qrs >= 120) {
    let detail = 'Wide QRS';
    let because = 'Ventricles activated by slow cell-to-cell spread instead of the fast Purkinje network.';
    if (has('V1') && has('V6')) {
      if (L.V1.rPrime > L.V1.r * 0.8 && L.V6.s > 0.1) { detail = 'Right bundle branch block pattern'; because = 'RV activated late across the septum → terminal rightward/anterior forces (R′ in V1, wide S in I/V6).'; }
      else if (L.V1.qrsNet < 0 && Math.max(L.V1.q, L.V1.s) > 0.8 && L.V6.q === 0 && L.V6.r > 0.4) { detail = 'Left bundle branch block pattern'; because = 'Septum activated right → left and LV activated late by slow spread → broad leftward forces, discordant ST–T.'; }
    }
    if (m.timeTo50 > 45 && m.pr !== null && m.pr < 120) { detail = 'Pre-excitation (delta wave)'; because = 'Ventricle near the accessory pathway is activated early by slow muscle spread (slurred upstroke), fusing with normal conduction.'; }
    f.push({ id: 'qrs-wide', category: 'conduction', label: `QRS ${Math.round(m.qrs)} ms (≥ 120)`, detail, because });
  }
  if (m.qtcBazett) {
    if (m.qtcBazett > 470) f.push({ id: 'qt-long', category: 'intervals', label: `QTc ${Math.round(m.qtcBazett)} ms (Bazett) – prolonged`, detail: `Fridericia ${Math.round(m.qtcFridericia ?? 0)} ms${m.qrs >= 120 ? ' – part of this is the wide QRS (use the JT interval)' : ''}`, because: 'Delayed ventricular repolarisation (↓ IKr/IKs, ↑ late INa; drugs, hypokalemia, hypocalcemia, hypomagnesemia, congenital) – risk of torsades.' });
    if (m.qtcBazett < 360) f.push({ id: 'qt-short', category: 'intervals', label: `QTc ${Math.round(m.qtcBazett)} ms – short`, detail: 'Hypercalcemia, digoxin, congenital short QT', because: 'Shortened plateau (phase 2) or accelerated repolarisation.' });
  }

  // ---------------- axis
  const ax = axisCategory(m.axis);
  const axisText = `${Math.round(m.axis)}°`;
  if (ax === 'normal') f.push({ id: 'axis', category: 'axis', label: `Normal axis (${axisText})`, detail: 'QRS positive in I and aVF', because: 'The LV dominates and is activated towards the apex – leftward and inferior.' });
  else {
    let because = ax === 'left' ? 'Mean QRS vector points superiorly: LAFB (late anterosuperior forces), inferior MI (loss of inferior forces), LVH, pacing.' : ax === 'right' ? 'Mean QRS vector points rightward: RVH, LPFB, lateral MI, PE, COPD, dextrocardia/lead reversal.' : 'Vector points superiorly and rightward ("northwest"): ventricular origin, severe hyperkalemia, or lead reversal.';
    if (ax === 'left' && m.axis < -45 && has('aVL') && L.aVL.lobes[0]?.sign === -1 && L.III.s > L.III.r) because = 'Left anterior fascicular block: inferior wall activated first, then late unopposed anterosuperior forces.';
    f.push({ id: 'axis', category: 'axis', label: `${ax === 'left' ? 'Left' : ax === 'right' ? 'Right' : 'Extreme'} axis deviation (${axisText})`, detail: ax === 'left' ? 'I positive, II/aVF negative' : ax === 'right' ? 'I negative, aVF positive' : 'I and aVF negative', because });
  }

  // ---------------- hypertrophy & atria
  if (has('V1') && has('V5')) {
    const sl = sokolowLyon(m);
    if (sl.positive) f.push({ id: 'lvh', category: 'hypertrophy', label: `LVH voltage: Sokolow–Lyon ${(sl.value * 10).toFixed(0)} mm (≥ 35)`, detail: `Cornell ${(cornell(m).value * 10).toFixed(0)} mm`, because: 'Thicker LV wall → larger leftward/posterior depolarisation forces (tall R in V5–V6, deep S in V1).' });
    if (sl.positive && L.V6.st60 < -0.05 && L.V6.t < 0) f.push({ id: 'strain', category: 'hypertrophy', label: 'Lateral ST depression with asymmetric T inversion', detail: 'LV "strain" (repolarisation abnormality of LVH)', because: 'Relative subendocardial ischemia and altered repolarisation of the thick wall.', leads: ['I', 'aVL', 'V5', 'V6'] });
    if (L.V1.r > L.V1.s && L.V1.r > 0.5 && m.axis > 90) f.push({ id: 'rvh', category: 'hypertrophy', label: 'Dominant R in V1 with right axis deviation', detail: 'RVH pattern', because: 'RV forces (rightward, anterior) now outweigh the LV.' });
  }
  if (has('II') && L.II.pMax >= 0.25) f.push({ id: 'rae', category: 'hypertrophy', label: `Peaked P in II (${(L.II.pMax * 10).toFixed(1)} mm)`, detail: 'Right atrial enlargement (P pulmonale)', because: 'Larger RA forces the early, inferiorly directed part of the P wave.' });
  const p = ecg.pWaves[1];
  if (has('V1') && L.V1.pTerminalNegArea >= 4 && p && p.off - p.on >= 115) f.push({ id: 'lae', category: 'hypertrophy', label: 'Broad P with deep terminal negativity in V1', detail: 'Left atrial enlargement (P mitrale)', because: 'The LA depolarises last and posteriorly; enlargement prolongs and enlarges that late posterior force.' });

  // ---------------- ST/T
  const stLeads = TWELVE.filter((l) => l !== 'aVR');
  const strain = f.some((x) => x.id === 'strain');
  const ste = (l: string) => (L[l]?.stJ ?? 0) >= (['V2', 'V3'].includes(l) ? 1.5 : 1) * MM;
  const std = (l: string) => (L[l]?.stJ ?? 0) <= -0.5 * MM;
  const prDep = has('II') && L.II.prSegment <= -0.5 * MM && has('aVR') && L.aVR.prSegment >= 0.5 * MM;
  const steCount = stLeads.filter(ste).length;
  if (prDep && steCount >= 5) {
    f.push({ id: 'pericarditis', category: 'ischemia', label: 'Diffuse ST elevation with PR depression', detail: 'Pattern of acute pericarditis', because: 'Diffuse epicardial (and atrial) inflammation: summed injury vector points to the apex; only aVR (and V1) face away. Atrial injury current depresses the PR segment.', leads: stLeads.filter(ste) });
  } else {
    for (const [key, g] of Object.entries(GROUPS)) {
      const leads = g.leads.filter((l) => has(l) && ste(l));
      if (key === 'right' && !f.some((x) => x.id === 'ste-inferior')) continue; // RV MI accompanies inferior MI
      if (strain && key !== 'inferior') continue;
      if (leads.length >= (g.leads.length === 1 ? 1 : 2)) {
        f.push({ id: `ste-${g.name}`, category: 'ischemia', label: `ST elevation in ${leads.join(', ')}`, detail: `${g.name[0].toUpperCase() + g.name.slice(1)} injury – likely ${g.artery}`, because: `Transmural injury of the ${g.wall}: injured cells stay partially depolarised, so during the plateau current flows towards them and the leads facing that wall record ST elevation.`, leads });
      }
    }
    // reciprocal changes
    const recips = TWELVE.filter((l) => l !== 'aVR' && std(l));
    if (recips.length && f.some((x) => x.id.startsWith('ste-'))) {
      f.push({ id: 'reciprocal', category: 'ischemia', label: `Reciprocal ST depression in ${recips.join(', ')}`, detail: 'Mirror image of the injury current', because: 'Leads on the opposite side of the heart see the same injury vector pointing away from them.', leads: recips });
    }
    if (has('V1') && has('V2') && std('V1') && std('V2') && L.V2.r > L.V2.s && !f.some((x) => x.id === 'ste-anterior')) {
      f.push({ id: 'posterior', category: 'ischemia', label: 'ST depression V1–V3 with tall R waves', detail: 'Consider posterior MI – record V7–V9', because: 'The anterior leads see the mirror image of a posterior injury current and of posterior Q waves.' });
    }
    if (!strain && has('aVR') && L.aVR.stJ >= 1 * MM && recips.length >= 6 && !f.some((x) => x.id.startsWith('ste-') && x.id !== 'ste-right')) {
      f.push({ id: 'avr', category: 'ischemia', label: 'ST elevation in aVR with widespread ST depression', detail: 'Left main / multivessel subendocardial ischemia pattern', because: 'Global subendocardial injury points towards the LV cavity – the direction aVR faces.' });
    } else if (recips.length >= 4 && !strain && !f.some((x) => x.id.startsWith('ste-'))) {
      f.push({ id: 'std', category: 'ischemia', label: `ST depression in ${recips.join(', ')}`, detail: 'Subendocardial ischemia, strain, digoxin or electrolyte effect', because: 'An injury current confined to the subendocardium points away from the surface electrodes.', leads: recips });
    }
  }
  // Q waves
  const qLeads = TWELVE.filter((l) => l !== 'aVR' && l !== 'III' && (L[l].q >= 0.1 && L[l].qDur >= 35 || (L[l].morphology === 'QS' && !['V1'].includes(l))));
  if (qLeads.length >= 2 && m.qrs < 120) f.push({ id: 'q', category: 'ischemia', label: `Pathological Q waves in ${qLeads.join(', ')}`, detail: 'Established (old or evolving) infarction', because: 'Necrotic myocardium generates no depolarisation force, so the net vector points away from the dead region – the facing leads begin with a negative deflection.', leads: qLeads });
  // T waves
  const tInv = TWELVE.filter((l) => !['aVR', 'III', 'V1'].includes(l) && L[l].t < -0.1);
  if (tInv.length >= 2 && m.qrs < 120 && !strain) f.push({ id: 't-inv', category: 'ischemia', label: `T-wave inversion in ${tInv.join(', ')}`, detail: 'Ischemia, reperfusion, strain, PE (right leads), Wellens', because: 'Altered repolarisation reverses the regional ventricular gradient (the affected region repolarises late).', leads: tInv });
  const peaked = ['V2', 'V3', 'V4'].filter((l) => has(l) && L[l].tMax > 1.0 && L[l].stJ < 0.1);
  if (peaked.length >= 2) f.push({ id: 't-peaked', category: 'other', label: 'Tall, peaked T waves', detail: 'Hyperkalemia or hyperacute ischemia', because: 'Faster phase-3 repolarisation (↑ K⁺ conductance) or an early ischemic gradient.' });
  if (has('V2') && L.V2.u > 0.1 && L.V2.u >= L.V2.tMax * 0.8) f.push({ id: 'u', category: 'other', label: 'Prominent U waves', detail: 'Hypokalemia', because: 'Slowed late repolarisation (↓ IK) becomes visible as a separate wave after T.' });
  if (lowVoltageLimb(m)) f.push({ id: 'lowv', category: 'other', label: 'Low QRS voltage in the limb leads', detail: 'Effusion, obesity, COPD, infiltrative disease', because: 'Fluid/air/tissue between heart and electrodes attenuates the signal.' });
  if (ecg.beats.length > 3) {
    const a = ecg.beats.slice(1, 5).map((b) => b.scale);
    if (Math.abs(a[0] - a[1]) / Math.max(a[0], a[1]) > 0.2) f.push({ id: 'alt', category: 'other', label: 'Electrical alternans', detail: 'Large pericardial effusion', because: 'The heart swings within the fluid every other beat, changing its electrical orientation.' });
  }
  if (has('V4') && L.V4.stJ > L.V4.st60 + 0.08 && L.V4.stJ > 0.1 && m.qrs < 120) f.push({ id: 'jwave', category: 'other', label: 'J (Osborn) waves', detail: 'Hypothermia', because: 'Cold enhances the epicardial Ito notch → a hump at the J point.' });
  if (has('V1') && L.V1.stJ >= 0.2 && L.V1.stSlope < 0 && L.V1.tMin < -0.1) f.push({ id: 'brugada', category: 'other', label: 'Coved ST elevation in V1 with negative T', detail: 'Brugada type 1 pattern', because: 'Loss of Na⁺ current in the RVOT epicardium unmasks a large Ito notch → transmural gradient.', level: 'clinician' });
  // Sgarbossa
  if (f.some((x) => x.detail === 'Left bundle branch block pattern')) {
    const sg = sgarbossa(m);
    f.push({ id: 'sgarbossa', category: 'ischemia', label: `Sgarbossa score ${sg.score}${sg.smithPositive ? ' (Smith-modified positive)' : ''}`, detail: sg.positive ? 'Criteria suggest acute MI despite LBBB' : 'No Sgarbossa criteria met', because: sg.reasons.join('; ') || 'ST–T changes are appropriately discordant to the QRS.', level: 'clinician' });
  }
  return f;
}

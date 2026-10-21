# CardioSim – content notes

This file lists every deliberate simplification, calibration constant, debated point and item a
cardiologist/electrophysiologist should verify before CardioSim is used for teaching. It is written
for medical reviewers; no programming knowledge is needed. File paths point to where each item lives.

**General principle.** The engines are *mechanistic teaching models*, not patient-specific or
validated clinical simulators. They are tuned so that the textbook pattern for each condition
appears for the right physiological reason, and each key claim is checked by an automated test
(`tests/`, 133 tests; the site will not publish if any fails).

---

## 1. ECG engine (`src/engine/electrical/`)

### Model
- The ventricles are 22 regions: the 17 AHA LV segments plus 5 RV regions (apex, anterior, free
  wall/acute margin, inferior, outflow tract). Each region carries a depolarisation dipole whose
  direction follows the local activation-time gradient (endocardium → epicardium plus the
  direction of spread along the wall). The atria are 4 regions.
- Activation times come from a Purkinje model (septal, anterior and posterior fascicles, apex,
  right bundle) and cell-to-cell spread between neighbouring regions (shortest-path / Dijkstra).
- Limb leads are ideal far-field projections (Einthoven triangle, Goldberger augmented leads), so
  Einthoven's law and aVR + aVL + aVF = 0 hold exactly. Chest leads blend a far-field part (45%)
  and a position-dependent near-field part (55%), which is why regional changes localise.
- Repolarisation (T wave) uses the ventricular-gradient idea (Wilson): a primary gradient from
  apex–base and transmural action-potential-duration differences, minus a secondary part that
  mirrors abnormal depolarisation (this produces discordant ST–T in bundle branch block, LVH
  strain and ventricular beats).
- Injury currents: transmural injury → current towards the injured region (ST elevation in facing
  leads, reciprocal depression opposite); subendocardial injury → current towards the cavity
  (diffuse ST depression, ST elevation in aVR).
- QT follows heart rate with a Fridericia-type restitution.

### Calibration constants (chosen to reproduce textbook patterns – please verify)
| Item | Value | Why |
|---|---|---|
| Tangential (along-the-wall) dipole weight | 1.0 (×6 for spread through an intact Purkinje network around a blocked fascicle) | Gives fascicular block axes (LAFB ≈ −45 to −60°, LPFB ≈ +100 to +120°). |
| Secondary ST–T fraction | 30% of the secondary gradient appears as ST plateau shift | Discordant ST deviation in LBBB/RBBB proportional to QRS. |
| Chest-lead near-field fraction / gain / reference distance | 0.55 / 1.1 / 8.5 cm | R-wave progression with transition V3–V4; V1 rS. |
| RV hypertrophy scale | RV mass ×20 in `rvh` | The RV is far smaller than the LV; a large factor is needed before RV forces dominate (right axis, tall R in V1). |
| Brugada | Modelled as a local RVOT epicardial source near V1–V2 rather than a whole-region injury | A region-wide source produced spurious inferior ST depression. |
| Pulmonary embolism | Extra "calibration" dipoles (S1Q3T3 pattern, right-sided T inversion) in `conditions.ts` | Acute RV strain is not otherwise represented by regional geometry. |
| MI stages | Injury / necrosis / T-gradient multipliers per stage (`MI_STAGE_EFFECTS` in `model.ts`) | Hyperacute T → ST elevation → Q waves with resolving ST → T inversion → persistent Q. |

### Known simplifications and limitations
- Single, average adult heart orientation; no body habitus, sex or age variation (except voltage
  scaling for effusion/obesity). Pediatric norms are not modelled.
- QRS widths are model-derived (≈ 90–100 ms normal) – slightly long but within normal.
- The LPFB pattern has only a small initial r in III; real LPFB often shows a clearer qR.
- Wellens type A biphasic T appears mainly in V2–V3 (V3 strongest).
- Posterior MI: ST depression in V1–V3 is modest (≈ 1 mm); the posterior leads V7–V9 show the
  elevation more clearly, as in reality.
- LMCA pattern shows the subtotal/multivessel subendocardial pattern (ST elevation aVR, diffuse
  ST depression). Complete LMCA occlusion (massive anterolateral STEMI, usually fatal) is described
  in text but the coronary lab shows its territory/STE pattern from the rules.
- Most ECG conditions are shown in sinus rhythm; combining any condition with any rhythm works in
  the engine but not every combination has been reviewed.
- ECG fiducials (PR, QRS, QT, axis) are measured on the synthesised signal like a reader would,
  so they inherit model limitations.
- Interpretation text is rule-based on the engine's own measurements; it is meant to explain the
  pattern, not to be a diagnostic algorithm.
- "14 leads" in the brief: standard extended layouts are 15-lead (12 + V4R, V8, V9) and 18-lead
  (12 + V4R–V6R + V7–V9); both are provided.
- Axis formula in the Equations lab uses θ = atan2((2/√3)·aVF, I). The 2/√3 factor corrects for
  aVF's lower gain relative to lead I in the Einthoven model; many texts use the approximation
  atan(aVF/I). The engine's measured axis agrees with this formula within 6° (tested).

## 2. Rhythm engine (`src/engine/rhythm/`)
- Event-driven model of SA node, decremental AV node (AH = minimum + decrement·e^(−recovery/110 ms)),
  dual AV-nodal pathways (AVNRT), accessory pathway (orthodromic/antidromic AVRT, pre-excitation),
  His–Purkinje block (Mobitz II, complete), escape pacemakers with overdrive suppression, PACs (reset
  the SA node), PVCs (retrograde concealed conduction → full compensatory pause), flutter (2:1 /
  variable), AF with concealed conduction, MAT, sick sinus, VT/polymorphic VT/torsades/VF.
- AV-nodal refractory periods and decrement constants are tuned (e.g. Wenckebach 4:3–5:4 groups,
  flutter 2:1 at ~150/min). Re-entrant SVTs are started by a timed premature beat after a few sinus
  beats so the onset is visible.
- Adenosine is a timed event: transient AV-nodal block (terminates AVNRT/AVRT, reveals flutter waves).
- The interpretation separates ectopy, escape, SVT, AV dissociation and AV block using the simulated
  conduction events (not pattern recognition of the waveform).

## 3. Cellular model (`src/engine/cellular/`)
- Phenomenological action potentials (not Hodgkin–Huxley/Luo–Rudy): each phase is shaped by the
  current that dominates it. Drug classes and electrolytes scale those currents; the same factors
  change the ECG (QRS width, QT, T and U waves). Na⁺-channel availability uses a 16 mV
  half-inactivation shift from the resting potential; QT from calcium uses a 1.15 coefficient.
- The plotted currents are schematic in magnitude (INa is ~20× larger and is clipped on screen).

## 4. Hemodynamic engine (`src/engine/hemo/`)

### Model
Time-varying elastance chambers (4), orifice (Bernoulli) valves with inertial AV-valve inflow,
three-element Windkessels (systemic and pulmonary), systemic veins with an inertial venous return
into an intrathoracic great-vein compartment (JVP), pericardium (exponential pressure–volume),
respiration (intrathoracic and abdominal pressures), shunts (ASD, VSD, PDA), dynamic LVOT
obstruction (HOCM), MVP latch, IABP, baroreflex (HR, SVR, contractility, venous tone), Fick SvO₂.
Integration: RK4, 0.5 ms step.

### Calibration and simplifications
- Default parameters are tuned to a healthy adult (≈ 125/75 mmHg, CO ≈ 5 L/min, EF ≈ 57%).
  LVEDP/PCWP run slightly high (≈ 13–14 mmHg) and RV systolic ≈ 36 mmHg – upper normal.
- **Cardiac output rises with heart rate more than in real hearts** (72 → 170/min: +54% without
  reflexes, +44% with baroreflex). Real hearts plateau because extrathoracic veins collapse (the flat
  part of Guyton's venous return curve) and filling time shortens. A venous "waterfall" was tried
  (collapse at 2.5–4.5 mmHg) but it broke the RV-infarct nitrate-sensitivity and Eisenmenger tests,
  so it was not adopted. Treat BP/CO numbers during tachyarrhythmias as qualitative.
- Pulmonary "hang-out" interval (P2 timing) is scaled by pulmonary reserve; ejection time is load
  dependent (∝ EDV^0.45 LV, ^0.5 RV) – both tuned so physiological, wide fixed (ASD) and paradoxical
  splitting appear.
- HOCM obstruction area follows a sigmoid of LV volume (centre 68 mL) – qualitative.
- MVP prolapse occurs when LV volume falls below a threshold during systole (earlier with ↓ preload).
- The model cannot cleanly separate atrial contraction during ventricular systole from late
  diastole for cannon waves; cannon a waves appear as intermittent giant JVP a waves in complete
  heart block (tested), which is the clinically relevant sign.
- Valsalva/standing/squatting/handgrip/amyl nitrite are applied as acute parameter changes
  (intrathoracic/abdominal pressure, venous capacity, SVR, HR) – the timing of the four Valsalva
  phases is not modelled.
- Guyton diagram: the venous-return line passes through the simulated operating point with slope
  −1/Rvr (Rvr = 1.33 mmHg per L/min); the cardiac-function curve is the analytic coupling formula
  scaled to pass through the same point. It is an approximation drawn from the simulation, not an
  independent model.

### Heart sounds and murmurs (`src/engine/hemo/sounds.ts`, `src/engine/audio/phono.ts`)
- Valve event times (S1, A2, P2, mitral opening) come from the simulation.
- Audibility rules (explicit, textbook-based):
  - S3 if early filling decelerates abruptly **and** the LV is volume loaded (EDV ≥ 165 mL, or EF < 45%
    with LVEDP ≥ 18, or MR/AR fraction ≥ 30%, or a large left-to-right shunt with a dilated LV).
  - S4 if sinus rhythm with atrial kick, LVEDP ≥ 16 mmHg and a sizeable atrial-induced LV pressure
    rise; never in AF or constriction.
  - Opening snap only with mitral stenosis (pliable leaflets assumed); pericardial knock only with
    constriction; click only with MVP.
  - *Debatable outputs:* chronic AR and chronic MR presets show an S4 by these rules (an S3 is more
    typical in decompensated volume overload); PDA also shows an S4. Please review.
- Murmur loudness = turbulent jet power (flow × pressure drop above a laminar threshold), mapped to a
  Levine grade (1–4; thrills not modelled). Physiological flow murmurs are suppressed below
  thresholds. Site of maximal intensity and radiation are assigned per lesion (tables in `phono.ts`).
- Sounds are synthesised (damped oscillations and filtered noise); they are representative, not
  recordings.

## 5. Coronary anatomy and territories (`src/data/coronaries.ts`)
- Territories are typical textbook distributions for right, left and codominant circulations;
  real anatomy varies widely (wraparound LAD, large OMs, ramus intermedius, etc.).
- Segments 3, 4, 9, 10, 15 depend on dominance; segments 6, 12, 16 have dual supply. The AHA
  segment-to-artery assignment is itself a simplification (≈ 20% of patients differ).
- Time course of ECG stages in the coronary lab assumes no early reperfusion until the
  "T-wave inversion" stage; reperfusion changes the course (earlier T inversion, smaller Q waves).
- The 3D coronary tree is drawn on the epicardial surface and does not move with contraction.

## 6. 3D model (`src/ui/three/`)
- Procedural, schematic geometry in the same coordinate frame as the ECG engine (LV as a truncated
  prolate spheroid, RV as a crescent, spherical atria, tube vessels). Proportions are approximate.
- Chamber sizes follow the simulated volumes; valves open with simulated flow; activation colouring
  uses the ECG engine's activation times.

## 7. Clinical content
- All text was written for this project. Management is given at mechanism/drug-class level only –
  **no doses**. Guideline-dependent statements (e.g. HFrEF therapy, hyperkalemia sequence, WPW + AF
  drug avoidance) reflect current mainstream recommendations and should be checked against local
  guidelines.
- Each condition/rhythm/preset has a `references` field describing the *type* of source
  (standard cardiology/physiology texts, AHA/ACC/HRS guidance). Specific citations were not added.

## 8. Items to verify (checklist for a reviewer)
- [ ] Sgarbossa / Smith-modified criteria wording and thresholds (`criteria.ts`).
- [ ] de Winter and Wellens descriptions and the decision to show them as clinician-level.
- [ ] Hyperkalemia stage thresholds (K⁺ 6, 7, 8, 9 mEq/L) – the ECG correlates poorly with levels.
- [ ] QTc cut-offs used in interpretation (> 470 ms flagged; > 500 ms high risk).
- [ ] RV infarction: V4R threshold and transience statement.
- [ ] S3/S4 audibility rules and the AR/MR/PDA S4 outputs (section 4).
- [ ] Murmur site/radiation tables in `phono.ts`.
- [ ] Coronary territory fractions per artery/site/dominance.
- [ ] Post-MI complication time windows (`MI_TIMELINE`).
- [ ] Case vignettes (`src/data/cases.ts`): answers and explanations.

## 9. Not included (suggested next steps)
Congenital heart disease module (beyond ASD/VSD/PDA/Eisenmenger), echocardiographic views,
pediatric norms, pacemaker/ICD rhythms, exercise physiology, an Urdu (or other) translation layer,
and expert review of every item in section 8.

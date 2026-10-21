# CardioSim — Plan

## Goal
One browser app that connects anatomy, electrophysiology, the ECG and hemodynamics, for two
audiences: USMLE students (default) and practising clinicians (toggle). Medical accuracy is
the first priority; every key teaching claim is encoded as an automated test.

## Stack (as requested)
- Vite + React 18 + TypeScript (strict)
- Three.js via `@react-three/fiber` + `@react-three/drei` (3D heart, all procedural)
- `zustand` for app state
- Vitest for tests (engines are pure TypeScript and run headless)
- KaTeX for equations
- Charts: custom Canvas (ECG, fast traces) and SVG (static plots). No chart library needed.
- Styling: one plain CSS file with CSS variables (light/dark themes). *Change from brief:* plain
  CSS instead of Tailwind/CSS-modules, to avoid an extra build tool; same result.
- Hemodynamic ODE runs in a Web Worker (`src/workers/hemo.worker.ts`).

## Architecture

```
src/
  data/        medical content only (typed TS data files) — editable without touching rendering
  engine/      pure TS physiology engines, no React / no Three.js
    electrical/  heart regions, activation, dipoles, lead fields, ECG synthesis, measurement, interpretation
    rhythm/      conduction-system state machine → atrial/ventricular events + ladder diagram
    cellular/    action potentials + ion currents, drug/electrolyte modifiers → ECG modifiers
    hemo/        lumped-parameter circulation (elastance chambers, valves, Windkessels, pericardium,
                 respiration, baroreflex), RK4 integrator, beat analysis, Starling/Guyton analytics
  workers/     web worker wrapping the hemodynamic engine
  store/       zustand stores (UI mode, student/clinician, scenario selections)
  scenes/      Three.js procedural heart, coronary tree, conduction system, torso
  ui/          panels, ECG paper, graphs, labs, cases, equations
  audio/       Web Audio heart sounds and murmurs
tests/         Vitest ground-truth tests 1–32 (+ engine unit tests)
docs/          PLAN.md, CONTENT_NOTES.md
```

Data flow: `data/` → engines → plain output objects → UI/3D only read outputs.

## Data schema (src/data/types.ts)
- `Structure` {id, name, category, function, bloodSupply, pearls[], clinicianPearls?[]}
- `CoronaryArtery` {id, name, parent, origin, course, branches, dominanceNotes, pearls}
- `MyocardialSegment` {id 1–17, name, level, wall, supply by dominance, notes}
- `EcgCondition` {id, name, category, level, mechanism, findings (per lead group), criteria[],
  mimics[], pearls[], references, model: `EcgModel`} — `model` is a *declarative* list of
  physiological changes (injured regions, necrosis, blocks, hypertrophy, electrolytes, rhythm),
  never per-lead waveforms.
- `Rhythm` {id, name, mechanism, conduction, ecgCriteria[], hemodynamics, management[], pearls,
  model: `RhythmModel`}
- `HemoPreset` {id, name, params (overrides), expected {pressures, murmur, jvp, pulse, pvLoop}, pearls}
- `Case` {id, title, vignette, media (condition/rhythm/preset ids), questions[], explanation, links}

## Engine design

### Electrical (vector / dipole) engine
- ~27 ventricular regions (AHA 17 segments + 5 RV regions + septal sub-regions are the septal
  segments) and 5 atrial regions, each with position, outward normal, mass, normal Purkinje
  entry time, and action potential duration.
- Activation: Dijkstra-style propagation on a region graph. Sources are Purkinje entry points of
  intact fascicles (or an ectopic/accessory-pathway origin); cells reached only by
  cell-to-cell spread conduct slowly and produce longer, tangential dipoles.
- Each region contributes a depolarisation dipole (direction of propagation, magnitude ∝ mass)
  for its transmural transit time → QRS. Necrosis removes that region's dipole → Q waves.
- Repolarisation uses Wilson's *ventricular gradient*: per region, T-wave area =
  primary gradient (γ·n·mass) − that region's QRS area. Abnormal activation therefore produces
  secondary (discordant) ST-T automatically; ischemia/drugs/electrolytes change γ (primary).
- Injury current: transmural injury → ST vector toward the region (+n); subendocardial →
  away (−n). Reciprocal changes are simply the negative projection in opposite leads.
- Leads: limb leads are ideal far-field projections on the hexaxial axes (I 0°, II 60°, III 120°,
  aVR −150°, aVL −30°, aVF 90°, with III = II − I and augmented leads derived from them, so
  Einthoven's law holds exactly). Chest leads (V1–V6, V1R–V6R, V7–V9) use a near-field dipole
  lead field from electrode positions on the chest, which localises anterior/posterior/right
  changes realistically.
- Output per beat type: template; rhythm events place templates in time → per-lead Float32Array
  (1 kHz), VCG, intervals (PR, QRS, QT, QTc Bazett/Fridericia), axis, findings with `because`.

### Rhythm engine
Event-driven state machine: SA node, atrial ectopic foci, AV node (dual pathways, decremental
conduction, refractoriness, concealed conduction), His–Purkinje (refractoriness, infranodal
block), accessory pathway, junctional/ventricular escape pacemakers, ventricular foci and
re-entry circuits. Output: atrial events, ventricular events (with activation pattern id),
ladder entries (A/AV/V), and continuous atrial activity (flutter/fibrillation) descriptors.

### Cellular engine
Phenomenological action-potential model (pacemaker and ventricular cell) with named ionic
currents (If, ICa-T, ICa-L, IK, INa, Ito, IKr, IKs, IK1). Drug classes and electrolytes change
current scale factors → AP shape → summary ECG modifiers (QRS widening, QT, T shape, U wave,
rate and AV effects) which feed the electrical and rhythm engines.

### Hemodynamic engine
Lumped model: LA, LV, RA, RV time-varying elastance (with exponential EDPVR); valves as orifices
(forward area, regurgitant area); systemic and pulmonary arterial Windkessels; systemic veins
(intra/extrathoracic) and pulmonary veins; pericardium (shared pressure, effusion volume,
stiffness); shunts (ASD, VSD, PDA); dynamic LVOT obstruction (HOCM); respiration (intrathoracic
pressure); optional baroreflex. Fixed-step RK4 (0.5 ms). Atrial and ventricular contraction are
timed by the rhythm engine, so AV dissociation → cannon a waves, AF → beat-to-beat SV variation.
Per-beat outputs: all pressures/volumes/flows, SV, EF, CO, MAP, CVP, PCWP, SVR, PVR, Qp:Qs,
gradients, regurgitant fractions, murmur intensities, sound timings.

## Phases
1. Scaffold, schemas, knowledge base.
2. Electrical engine, ECG paper, vector lab; tests 1–20.
3. Rhythm engine, ladder, action potentials; tests 21–24.
4. Hemodynamic engine + worker + graphs; tests 25–32.
5. Procedural 3D heart (beating, electrical overlay, coronaries, bull's-eye, torso/electrodes).
6. Heart sounds and murmurs, auscultation map, maneuvers.
7. Equations lab.
8. Modes: Explore, labs, Cases, Teach, Student/Clinician.
9. Polish: responsive, themes, accessibility, performance, README, deploy workflow.

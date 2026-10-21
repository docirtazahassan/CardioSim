import type { HemoPreset } from './types';

/**
 * Hemodynamic disease presets: parameter overrides on top of the healthy defaults
 * (src/engine/hemo/params.ts). The expected findings are the USMLE textbook pattern and are
 * checked by the test suite (tests/hemo.test.ts).
 */
const REF = 'Standard physiology and cardiology texts (Guyton & Hall–level physiology; ACC/AHA valvular and heart-failure guidance).';

export const PRESETS: HemoPreset[] = [
  {
    id: 'normal-hemo', name: 'Normal', group: 'normal', level: 'student',
    description: 'Healthy adult at rest, sinus rhythm.',
    params: {},
    expected: { pressures: 'LV 120/8, Ao 120/80, RV 25/5, PA 25/10, PCWP 6–12, RA 2–6 mmHg', murmur: 'None (soft physiological flow only)', jvp: 'a, c, x, v, y – normal height', pulse: 'Normal upstroke, dicrotic notch', pvLoop: 'Rectangular loop; EDV ~120, ESV ~50 mL' },
    pearls: ['EF = SV/EDV ≈ 55–70%.', 'Physiological split S2 widens on inspiration.'], references: REF,
  },
  // ------------------------------------------------------------ heart failure
  {
    id: 'hfref', name: 'Heart failure with reduced EF (systolic)', group: 'failure', level: 'student',
    description: 'Loss of contractility (ischemic or dilated cardiomyopathy) with neurohormonal volume retention and remodeling.',
    params: { lvEes: 0.9, lvV0: 45, lvEdA: 0.12, lvEdB: 0.026, totalVolume: 5900, rvEes: 0.5, mrArea: 0.05 },
    expected: { pressures: '↑ LVEDP, ↑ PCWP, ↓ BP/CO', murmur: 'S3 gallop; functional MR possible', jvp: 'Raised', pulse: 'Low volume; pulsus alternans when severe', pvLoop: 'Shifted RIGHT: ↓ ESPVR slope, ↑ EDV and ESV, ↓ SV and EF' },
    pearls: ['S3 = rapid early filling into a dilated, volume-loaded ventricle.', 'Mortality-reducing drugs: ACEi/ARB/ARNI, β-blockers, MRA, SGLT2 inhibitors.'], references: REF,
  },
  {
    id: 'hfpef', name: 'Heart failure with preserved EF (diastolic)', group: 'failure', level: 'student',
    description: 'Stiff, hypertrophied LV (hypertension, aging, diabetes): normal contractility but high filling pressures.',
    params: { lvEdA: 0.65, lvEdB: 0.055, lvEes: 3.6, totalVolume: 5400 },
    expected: { pressures: '↑ LVEDP and PCWP at a normal/small EDV', murmur: 'S4 (atrial kick into a stiff ventricle)', jvp: 'May be raised', pulse: 'Normal', pvLoop: 'Steep EDPVR; loop shifted up/left; EF normal' },
    pearls: ['AF is poorly tolerated (loss of atrial kick).'], references: REF,
  },
  // ------------------------------------------------------------ valves
  {
    id: 'aortic-stenosis', name: 'Aortic stenosis (severe)', group: 'valve', level: 'student',
    description: 'Calcific AS (valve area 0.7 cm²) with compensatory concentric LV hypertrophy.',
    params: { avArea: 0.7, lvEes: 4.0, lvEdA: 0.5, lvEdB: 0.045 },
    expected: { pressures: 'LV systolic ≫ aortic systolic (mean gradient > 40 mmHg)', murmur: 'Crescendo–decrescendo systolic ejection murmur, right 2nd ICS → carotids; soft A2; S4', jvp: 'Normal until late', pulse: 'Pulsus parvus et tardus (small, slow-rising)', pvLoop: 'Tall loop (high LV systolic pressure), steep EDPVR' },
    pearls: ['Symptoms: angina, syncope, dyspnea (HF) – each predicts survival without valve replacement.', 'Later peaking murmur = more severe.'], references: REF,
  },
  {
    id: 'aortic-regurgitation', name: 'Aortic regurgitation (chronic)', group: 'valve', level: 'student',
    description: 'Incompetent aortic valve (regurgitant orifice 0.5 cm²) with eccentric LV dilation.',
    params: { arArea: 0.32, lvV0: 40, lvEdA: 0.12, lvEdB: 0.024, totalVolume: 5450, sysR: 0.85 },
    expected: { pressures: 'Wide pulse pressure (high systolic, low diastolic)', murmur: 'Early diastolic decrescendo murmur (left sternal border); Austin Flint rumble', jvp: 'Normal', pulse: 'Water-hammer (Corrigan) pulse, bounding; de Musset, Quincke signs', pvLoop: 'Large loop shifted right with NO true isovolumetric relaxation (LV fills from aorta)' },
    pearls: ['Handgrip (↑ afterload) increases the murmur; amyl nitrite decreases it.', 'Causes: aortic root dilation (Marfan, syphilis), bicuspid valve, endocarditis, rheumatic.'], references: REF,
  },
  {
    id: 'mitral-stenosis', name: 'Mitral stenosis', group: 'valve', level: 'student',
    description: 'Rheumatic mitral stenosis (valve area 1.0 cm²) with LA enlargement and reactive pulmonary hypertension.',
    params: { mvArea: 0.5, laV0: 30, laEdA: 0.35, laEdB: 0.045, pulR: 0.14, totalVolume: 5300 },
    expected: { pressures: '↑ LA pressure and PCWP; LA–LV diastolic gradient; ↑ PA pressure; normal LVEDP', murmur: 'Opening snap then mid-diastolic rumble with presystolic accentuation (apex, left lateral decubitus)', jvp: 'Prominent a wave (pulmonary hypertension)', pulse: 'Normal/small', pvLoop: 'Small (underfilled) LV loop' },
    pearls: ['The shorter the A2–OS interval, the more severe the stenosis.', 'Complications: AF, LA thrombus, hemoptysis, hoarseness (Ortner), dysphagia.'], references: REF,
  },
  {
    id: 'mr-acute', name: 'Mitral regurgitation – acute', group: 'valve', level: 'student',
    description: 'Papillary muscle rupture or chordal rupture: large regurgitant orifice into a small, non-compliant LA.',
    params: { mrArea: 0.5, laEdA: 0.5, laEdB: 0.075 },
    expected: { pressures: 'Giant v wave on PCWP tracing; pulmonary edema; ↓ forward CO', murmur: 'Early systolic/holosystolic murmur, may be short and soft', jvp: 'Normal', pulse: 'Low volume, tachycardic', pvLoop: 'No true isovolumetric contraction; ↓ ESV, forward SV ↓' },
    pearls: ['Posteromedial papillary muscle (PDA supply) after inferior MI, 2–7 days.', 'Afterload reduction (nitroprusside) and IABP stabilise.'], references: REF,
  },
  {
    id: 'mr-chronic', name: 'Mitral regurgitation – chronic', group: 'valve', level: 'student',
    description: 'Compensated chronic MR: dilated compliant LA and eccentric LV hypertrophy.',
    params: { mrArea: 0.4, laV0: 70, laEdA: 0.06, laEdB: 0.018, lvV0: 35, lvEdA: 0.12, lvEdB: 0.025, totalVolume: 5600 },
    expected: { pressures: 'LA pressure only mildly ↑ (compliant LA)', murmur: 'Holosystolic blowing murmur at apex → axilla; S3', jvp: 'Normal', pulse: 'Normal/brisk', pvLoop: 'Large loop, ↑ EDV, no true isovolumetric contraction' },
    pearls: ['Handgrip ↑ MR murmur, amyl nitrite ↓.'], references: REF,
  },
  {
    id: 'mvp', name: 'Mitral valve prolapse', group: 'valve', level: 'student',
    description: 'Myxomatous leaflets buckle into the LA when the LV becomes small enough during systole.',
    params: { mvp: 1 },
    expected: { pressures: 'Normal', murmur: 'Mid-systolic click followed by late systolic murmur; ↓ preload (standing, Valsalva) → earlier click and longer murmur', jvp: 'Normal', pulse: 'Normal', pvLoop: 'Normal (mild late MR)' },
    pearls: ['Associated with Marfan, Ehlers–Danlos, ADPKD.'], references: REF,
  },
  {
    id: 'tr', name: 'Tricuspid regurgitation', group: 'valve', level: 'student',
    description: 'Functional or endocarditis-related TR (IV drug use).',
    params: { trArea: 0.6, raV0: 30, raEdA: 0.15, totalVolume: 5400 },
    expected: { pressures: '↑ RA pressure with large cv wave', murmur: 'Holosystolic murmur at left lower sternal border, ↑ with inspiration (Carvallo)', jvp: 'Giant v (cv) waves with steep y descent', pulse: 'Normal; pulsatile liver', pvLoop: 'RV volume overload' },
    pearls: ['S. aureus endocarditis in IV drug users; carcinoid.'], references: REF,
  },
  // ------------------------------------------------------------ shunts
  {
    id: 'vsd', name: 'Ventricular septal defect', group: 'shunt', level: 'student',
    description: 'Restrictive perimembranous VSD with left-to-right shunt.',
    params: { vsdArea: 0.35 },
    expected: { pressures: 'O₂ step-up in RV; ↑ pulmonary flow', murmur: 'Holosystolic murmur at left lower sternal border (smaller defect = louder)', jvp: 'Normal', pulse: 'Normal', pvLoop: 'LV volume overload' },
    pearls: ['Qp:Qs > 1.5–2 usually needs closure.', 'Untreated large shunts → pulmonary vascular disease → Eisenmenger.'], references: REF,
  },
  {
    id: 'asd', name: 'Atrial septal defect (secundum)', group: 'shunt', level: 'student',
    description: 'Left-to-right atrial shunt → RV volume overload.',
    params: { asdArea: 2.5, rvEdA: 0.15, rvEdB: 0.024, rvV0: 30 },
    expected: { pressures: 'O₂ step-up in RA; RV volume overload', murmur: 'Systolic ejection murmur at pulmonic area (↑ flow) + wide FIXED split S2', jvp: 'Normal', pulse: 'Normal', pvLoop: 'RV volume overload' },
    pearls: ['Fixed split: the shunt equalises respiratory changes in RV filling; RV ejection is always prolonged.', 'Paradoxical emboli.'], references: REF,
  },
  {
    id: 'pda', name: 'Patent ductus arteriosus', group: 'shunt', level: 'student',
    description: 'Persistent aorta → pulmonary artery connection (left-to-right in systole AND diastole).',
    params: { pdaArea: 0.14 },
    expected: { pressures: 'Wide pulse pressure; ↑ pulmonary flow', murmur: 'Continuous "machine-like" murmur at left infraclavicular area', jvp: 'Normal', pulse: 'Bounding', pvLoop: 'LV volume overload' },
    pearls: ['Kept open by PGE (and congenital rubella); closed by indomethacin/ibuprofen.', 'Eisenmenger PDA → differential cyanosis (lower body).'], references: REF,
  },
  {
    id: 'eisenmenger', name: 'Eisenmenger syndrome (VSD)', group: 'shunt', level: 'clinician',
    description: 'Long-standing left-to-right shunt causes pulmonary vascular remodeling; PVR exceeds SVR and the shunt reverses.',
    params: { vsdArea: 0.9, pulR: 1.6, rvEes: 2.0, rvEdA: 0.5 },
    expected: { pressures: 'PA pressure ≈ systemic; right-to-left shunt (Qp:Qs < 1); cyanosis', murmur: 'VSD murmur fades; loud P2', jvp: 'Prominent a wave', pulse: 'Normal', pvLoop: 'RV pressure overload' },
    pearls: ['Late cyanosis, clubbing, polycythemia.'], references: REF,
  },
  // ------------------------------------------------------------ cardiomyopathy
  {
    id: 'hocm', name: 'Hypertrophic obstructive cardiomyopathy', group: 'cardiomyopathy', level: 'student',
    description: 'Asymmetric septal hypertrophy with dynamic LVOT obstruction from systolic anterior motion of the mitral leaflet.',
    params: { hocm: 1, lvV0: 8, lvEes: 4.2, lvEdA: 0.6, lvEdB: 0.05, mrArea: 0.04 },
    expected: { pressures: 'Dynamic LVOT gradient (↑ when the LV is smaller)', murmur: 'Systolic ejection murmur at LLSB: ↑ Valsalva, standing, nitrates; ↓ squatting, handgrip, leg raise', jvp: 'Normal', pulse: 'Bisferiens ("spike and dome")', pvLoop: 'Small cavity, steep EDPVR' },
    pearls: ['Most common cause of sudden cardiac death in young athletes.', 'Treatment: β-blockers or non-DHP CCB; avoid dehydration, nitrates, diuretics.'], references: REF,
  },
  // ------------------------------------------------------------ pericardial
  {
    id: 'tamponade', name: 'Cardiac tamponade', group: 'pericardial', level: 'student',
    description: 'Rapidly accumulating effusion raises pericardial pressure above diastolic chamber pressures.',
    params: { effusion: 380, respDepth: 6 },
    expected: { pressures: 'Equalisation of diastolic pressures (RA ≈ RVEDP ≈ PADP ≈ PCWP); ↓ CO; hypotension', murmur: 'Muffled heart sounds (Beck triad)', jvp: 'Raised, with BLUNTED y descent (no early diastolic filling)', pulse: 'Pulsus paradoxus (SBP falls > 10 mmHg on inspiration)', pvLoop: 'Small loops (both ventricles underfilled)' },
    pearls: ['Ventricular interdependence: inspiratory RV filling pushes the septum left → ↓ LV filling → pulsus paradoxus.', 'Treat with pericardiocentesis; fluids temporise.'], references: REF,
  },
  {
    id: 'constrictive', name: 'Constrictive pericarditis', group: 'pericardial', level: 'student',
    description: 'Rigid scarred pericardium limits filling after early diastole and isolates the heart from intrathoracic pressure.',
    params: { pericardialStiffness: 6, totalVolume: 5500 },
    expected: { pressures: 'Diastolic dip-and-plateau ("square root sign"); equalised diastolic pressures', murmur: 'Pericardial knock (early diastolic, abrupt halt of filling)', jvp: 'Raised, steep x and y descents; Kussmaul sign (JVP ↑ on inspiration)', pulse: 'Pulsus paradoxus uncommon', pvLoop: 'Small loops' },
    pearls: ['Causes: TB (developing world), radiation, cardiac surgery, viral.', 'Calcified pericardium on imaging.'], references: REF,
  },
  // ------------------------------------------------------------ RV infarct
  {
    id: 'rv-infarct', name: 'Right ventricular infarction', group: 'failure', level: 'student',
    description: 'Proximal RCA occlusion: the RV loses contractility, dilates, and cannot deliver preload to the LV.',
    params: { rvEes: 0.18, rvEdA: 0.18, lvEes: 2.6 },
    expected: { pressures: '↑ RA (CVP) with normal/low PCWP; hypotension; RA/PCWP ratio > 0.8', murmur: 'Possible TR murmur', jvp: 'Raised; Kussmaul sign possible', pulse: 'Low volume', pvLoop: 'Small LV loop (underfilled)' },
    pearls: ['Preload dependent: give fluids, avoid nitrates and diuretics.', 'Look for ST elevation in V4R.'], references: REF,
  },
  // ------------------------------------------------------------ shock
  {
    id: 'hypovolemic-shock', name: 'Hypovolemic shock', group: 'shock', level: 'student',
    description: 'Hemorrhage (~1.4 L) or severe dehydration; baroreflex compensates.',
    params: { totalVolume: 3600 },
    expected: { pressures: '↓ CVP, ↓ PCWP, ↓ CO, ↑ SVR, ↓ SvO₂', murmur: 'Tachycardia', jvp: 'Flat', pulse: 'Weak, thready, tachycardic', pvLoop: 'Small loop shifted left (↓ preload)' },
    pearls: ['Treat: volume/blood.'], references: REF,
  },
  {
    id: 'cardiogenic-shock', name: 'Cardiogenic shock', group: 'shock', level: 'student',
    description: 'Large anterior MI: acute loss of contractility.',
    params: { lvEes: 0.75, totalVolume: 5300, lvEdA: 0.25 },
    expected: { pressures: '↑ CVP, ↑ PCWP, ↓ CO, ↑ SVR, ↓ SvO₂', murmur: 'S3; possible new murmur (MR/VSD)', jvp: 'Raised', pulse: 'Weak', pvLoop: 'Shifted right with ↓ ESPVR' },
    pearls: ['Treat: revascularisation, inotropes, vasopressors, mechanical support (IABP, Impella).'], references: REF,
  },
  {
    id: 'septic-shock', name: 'Distributive (septic) shock', group: 'shock', level: 'student',
    description: 'Vasodilation, venodilation and capillary leak; impaired tissue O₂ extraction.',
    params: { sysR: 0.38, unstressedFraction: 1.05, totalVolume: 4800, extractionDefect: 0.45, hr: 92 },
    expected: { pressures: '↓/normal CVP, ↓/normal PCWP, ↑ CO, ↓ SVR, ↑ SvO₂ (early, "warm")', murmur: 'Tachycardia, flow murmur', jvp: 'Low/normal', pulse: 'Bounding, warm extremities', pvLoop: 'Shifted left/down (↓ afterload)' },
    pearls: ['Treat: fluids, norepinephrine, antibiotics, source control.', 'Also: anaphylaxis, neurogenic (bradycardic) shock.'], references: REF,
  },
  {
    id: 'obstructive-shock-pe', name: 'Obstructive shock (massive PE)', group: 'shock', level: 'student',
    description: 'Acute obstruction of the pulmonary circulation: the RV fails against a sudden afterload rise.',
    params: { pulR: 0.62, rvEdA: 0.2, hr: 100 },
    expected: { pressures: '↑ CVP, ↓ PCWP, ↓ CO, ↑ SVR, ↓ SvO₂', murmur: 'Loud P2', jvp: 'Raised', pulse: 'Weak, tachycardic', pvLoop: 'Small LV loop (underfilled); RV dilated' },
    pearls: ['Tamponade and tension pneumothorax are the other obstructive shocks (tamponade: PCWP ↑ – equalised).', 'Treat: thrombolysis/embolectomy.'], references: REF,
  },
  // ------------------------------------------------------------ rhythm-linked
  {
    id: 'af-hemo', name: 'Atrial fibrillation', group: 'other', level: 'student',
    description: 'Loss of atrial kick and beat-to-beat variation in filling.',
    params: { rhythm: 'af', atrialKick: 0 },
    expected: { pressures: 'Variable SBP beat to beat', murmur: 'Variable S1 intensity', jvp: 'Absent a wave', pulse: 'Irregularly irregular; pulse deficit', pvLoop: 'Loops of varying size' },
    pearls: [], references: REF,
  },
  {
    id: 'chb-hemo', name: 'Complete heart block', group: 'other', level: 'student',
    description: 'AV dissociation with a slow ventricular escape.',
    params: { rhythm: 'chb' },
    expected: { pressures: '↓ CO from bradycardia; large SV', murmur: 'Variable S1', jvp: 'Intermittent CANNON a waves (atria contract against closed AV valves)', pulse: 'Slow, large volume', pvLoop: 'Large, variable loops' },
    pearls: [], references: REF,
  },
  {
    id: 'pea-hemo', name: 'Pulseless electrical activity', group: 'other', level: 'student',
    description: 'Organised ECG without mechanical contraction.',
    params: { rhythm: 'pea', baroreflex: false },
    expected: { pressures: 'Arterial pressure decays to mean filling pressure; no pulse', murmur: 'None', jvp: 'Raised, non-pulsatile', pulse: 'Absent', pvLoop: 'No loop' },
    pearls: [], references: REF,
  },
];

export const presetById = (id: string) => PRESETS.find((p) => p.id === id);

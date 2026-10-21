/**
 * Clinical vignettes (USMLE style). Original text. Management is mechanism / drug-class level only –
 * no doses. Each case shows a simulated ECG and/or hemodynamics from the engines.
 */
import type { CaseItem } from './types';

export const CASES: CaseItem[] = [
  {
    id: 'inferior-rv', title: 'Hypotension after nitroglycerin', level: 'student',
    vignette: 'A 63-year-old man has 40 minutes of crushing chest pain and diaphoresis. BP 92/60 mmHg, HR 54/min. Jugular veins are distended; the lungs are clear. After sublingual nitroglycerin his BP falls to 70/40 mmHg.',
    media: { condition: 'rv-infarct', preset: 'rv-infarct', heartRate: 54, layout: '15' },
    questions: [
      { id: 'q1', prompt: 'Which artery is most likely occluded?', options: ['Proximal left anterior descending', 'Proximal right coronary artery', 'Distal left circumflex', 'Left main coronary artery'], answer: 1, explanation: 'Inferior ST elevation with ST elevation in V4R (RV free wall) and bradycardia points to the RCA proximal to its acute marginal (RV) branches.' },
      { id: 'q2', prompt: 'Why did nitroglycerin cause profound hypotension?', options: ['It caused coronary steal', 'The infarcted RV depends on preload; venodilation reduced RV filling and LV output', 'It triggered a vasovagal reaction only', 'It caused methemoglobinemia'], answer: 1, explanation: 'A non-contracting RV is a passive conduit: its output depends on venous pressure. Venodilators (nitrates) and diuretics drop preload → LV underfilled → hypotension. Volume loading is the first step.' },
      { id: 'q3', prompt: 'Which additional ECG lead best confirms this diagnosis?', options: ['aVR', 'V4R', 'V6', 'V9'], answer: 1, explanation: 'ST elevation ≥ 1 mm in V4R is the classic marker of RV infarction (it fades within hours, so record it early).' },
    ],
    teachingPoints: ['Inferior MI + hypotension + clear lungs + raised JVP = RV infarction.', 'AV nodal artery usually from the RCA → bradycardia/AV block.'],
    links: ['stemi-inferior-rca', 'rv-infarct', 'mobitz1'],
  },
  {
    id: 'peaked-t', title: 'Weakness in a patient on dialysis', level: 'student',
    vignette: 'A 55-year-old woman with end-stage kidney disease missed two dialysis sessions. She reports generalised weakness. Her ECG is shown.',
    media: { condition: 'hyperkalemia', stage: 'k8' },
    questions: [
      { id: 'q1', prompt: 'What is the most likely electrolyte disturbance?', options: ['Hypokalemia', 'Hyperkalemia', 'Hypercalcemia', 'Hypomagnesemia'], answer: 1, explanation: 'Tall peaked T waves, flattened P waves and QRS widening are the progression of hyperkalemia.' },
      { id: 'q2', prompt: 'What is the first-line immediate treatment to stabilise the myocardium?', options: ['Insulin with glucose', 'Intravenous calcium', 'Loop diuretic', 'Sodium polystyrene sulfonate'], answer: 1, explanation: 'Calcium raises the threshold potential and restores the gap to the depolarised resting potential within minutes; it does not lower K⁺. Insulin/glucose and β2-agonists then shift K⁺ into cells; dialysis removes it.' },
      { id: 'q3', prompt: 'Why does hyperkalemia widen the QRS?', options: ['It hyperpolarises the membrane', 'It depolarises the resting membrane, inactivating Na⁺ channels and slowing conduction', 'It blocks L-type Ca²⁺ channels', 'It shortens the refractory period of the AV node only'], answer: 1, explanation: 'EK becomes less negative → resting Vm rises → fewer available Na⁺ channels → slower phase 0 → slow conduction (wide QRS, eventually sine wave).' },
    ],
    teachingPoints: ['Sequence: peaked T → long PR/flat P → wide QRS → sine wave → VF/asystole.'],
    links: ['hyperkalemia', 'nernst'],
  },
  {
    id: 'syncope-murmur', title: 'Exertional syncope in an older man', level: 'student',
    vignette: 'A 76-year-old man has two episodes of light-headedness while climbing stairs. There is a harsh crescendo–decrescendo systolic murmur at the right upper sternal border radiating to the carotids, with a soft single S2 and a slow-rising carotid pulse.',
    media: { preset: 'aortic-stenosis', showHemo: true, condition: 'lvh' },
    questions: [
      { id: 'q1', prompt: 'Which finding indicates the most severe disease?', options: ['A loud A2', 'An early-peaking murmur', 'A late-peaking murmur with a soft A2', 'A wide pulse pressure'], answer: 2, explanation: 'As stenosis worsens, ejection lengthens and the murmur peaks later; leaflets barely move, so A2 softens. Pulse is parvus et tardus with a narrow pulse pressure.' },
      { id: 'q2', prompt: 'What compensatory change does the LV undergo?', options: ['Eccentric hypertrophy (dilation)', 'Concentric hypertrophy', 'Wall thinning', 'No change'], answer: 1, explanation: 'Pressure overload raises wall stress (Laplace); sarcomeres added in parallel thicken the wall to normalise it.' },
      { id: 'q3', prompt: 'Which maneuver makes this murmur softer?', options: ['Squatting', 'Passive leg raise', 'Valsalva strain', 'Amyl nitrite'], answer: 2, explanation: 'Valsalva ↓ preload → ↓ flow across the valve → softer AS murmur (the opposite of HOCM).' },
    ],
    teachingPoints: ['Symptoms (angina, syncope, heart failure) in severe AS → valve replacement.'],
    links: ['aortic-stenosis', 'lvh', 'bernoulli'],
  },
  {
    id: 'young-palpitations', title: 'Sudden palpitations in a young woman', level: 'student',
    vignette: 'A 24-year-old woman develops sudden rapid palpitations while at rest. HR 170/min, BP 112/70 mmHg. She feels pounding in her neck. The rhythm strip is shown.',
    media: { rhythm: 'avnrt' },
    questions: [
      { id: 'q1', prompt: 'What is the most likely mechanism?', options: ['Enhanced automaticity of an atrial focus', 'Re-entry within the AV node using slow and fast pathways', 'Triggered activity from delayed afterdepolarisations', 'Re-entry around the tricuspid annulus'], answer: 1, explanation: 'Typical AVNRT: a premature beat blocks in the fast pathway, conducts down the slow one and returns up the fast one; atria and ventricles depolarise almost together (P hidden, "frog sign" neck pulsations).' },
      { id: 'q2', prompt: 'What is the first step in management in a stable patient?', options: ['Synchronised cardioversion', 'Vagal maneuvers', 'Amiodarone', 'Defibrillation'], answer: 1, explanation: 'Vagal maneuvers (modified Valsalva, carotid sinus massage) slow AV nodal conduction; if they fail, adenosine transiently blocks the node and terminates the circuit.' },
    ],
    teachingPoints: ['AV node is part of the circuit → anything that blocks the node terminates AVNRT/AVRT.'],
    links: ['avnrt', 'avrt-ortho'],
  },
  {
    id: 'pleuritic', title: 'Chest pain better leaning forward', level: 'student',
    vignette: 'A 28-year-old man had a viral illness a week ago. He now has sharp chest pain that worsens lying flat and improves sitting forward. A scratchy sound is heard at the left sternal border.',
    media: { condition: 'pericarditis' },
    questions: [
      { id: 'q1', prompt: 'Which ECG feature best distinguishes this from STEMI?', options: ['ST elevation in V2–V3', 'Diffuse concave ST elevation with PR depression and no reciprocal changes (except aVR)', 'Q waves in II, III, aVF', 'ST depression in V1–V3'], answer: 1, explanation: 'Pericardial inflammation is diffuse, so the injury vector points to the apex: ST elevation in most leads, PR depression (atrial injury); only aVR (± V1) shows ST depression/PR elevation.' },
      { id: 'q2', prompt: 'Which serious complication should you look for?', options: ['Aortic dissection', 'Pericardial effusion with tamponade', 'Mitral valve prolapse', 'Complete heart block'], answer: 1, explanation: 'Effusion → tamponade (Beck triad, pulsus paradoxus, electrical alternans).' },
    ],
    teachingPoints: ['First-line therapy: NSAID/aspirin plus colchicine (reduces recurrence).'],
    links: ['pericarditis', 'tamponade'],
  },
  {
    id: 'pulsus', title: 'Dyspnea, hypotension and quiet heart sounds', level: 'student',
    vignette: 'A 60-year-old woman with metastatic lung cancer has progressive dyspnea. BP 88/70 mmHg, HR 118/min, JVP raised. Heart sounds are distant. Systolic pressure falls by 18 mmHg during inspiration.',
    media: { condition: 'tamponade', preset: 'tamponade', showHemo: true },
    questions: [
      { id: 'q1', prompt: 'What explains the inspiratory fall in systolic pressure?', options: ['Inspiratory venous return fills the RV, which can only expand by pushing the septum into the LV inside a fixed pericardial volume', 'Inspiration increases afterload on the LV only', 'Inspiration causes AV block', 'Inspiration raises pulmonary vein pressure'], answer: 0, explanation: 'Ventricular interdependence: the pericardium fixes total heart volume, so RV filling on inspiration happens at the expense of LV filling → pulsus paradoxus (> 10 mmHg).' },
      { id: 'q2', prompt: 'Which hemodynamic finding is characteristic?', options: ['Equalisation of diastolic pressures (RA ≈ RV diastolic ≈ PCWP)', 'Square-root sign with a prominent y descent', 'Large v waves on the PCWP tracing', 'Low CVP'], answer: 0, explanation: 'Fluid compresses all chambers equally; the y descent is blunted because the heart cannot fill rapidly in early diastole (contrast constriction: steep y and square-root sign).' },
    ],
    teachingPoints: ['Beck triad: hypotension, raised JVP, muffled heart sounds.', 'Treat with urgent pericardiocentesis; avoid diuretics/vasodilators.'],
    links: ['tamponade', 'constrictive'],
  },
  {
    id: 'wpw-af', title: 'Irregular wide-complex tachycardia in a young man', level: 'clinician',
    vignette: 'A 31-year-old man known to have a "short PR and delta wave" presents with palpitations. The previous baseline ECG is shown.',
    media: { condition: 'wpw' },
    questions: [
      { id: 'q1', prompt: 'He now develops atrial fibrillation with very fast irregular wide complexes. Which drug class should be AVOIDED?', options: ['Class Ia (procainamide)', 'AV-nodal blockers (adenosine, β-blockers, non-DHP Ca²⁺ channel blockers, digoxin)', 'Synchronised cardioversion', 'Class III (ibutilide)'], answer: 1, explanation: 'Blocking the AV node leaves the accessory pathway (no decremental conduction) as the only route → very fast ventricular rates → VF. Procainamide/ibutilide slow the pathway; unstable → cardioversion.' },
      { id: 'q2', prompt: 'What produces the delta wave?', options: ['Slow conduction in the AV node', 'Early activation of ventricular muscle via the accessory pathway, spreading cell to cell', 'Right bundle branch block', 'Atrial repolarisation'], answer: 1, explanation: 'The pathway bypasses AV-nodal delay (short PR) and enters ordinary myocardium, which conducts slowly → slurred upstroke; the rest of the QRS is a fusion with normal conduction.' },
    ],
    teachingPoints: ['Definitive therapy: catheter ablation of the pathway.'],
    links: ['wpw', 'avrt-ortho', 'avrt-anti'],
  },
  {
    id: 'hfref', title: 'Breathless with an S3', level: 'student',
    vignette: 'A 58-year-old man with a large anterior MI a year ago has worsening dyspnea and orthopnea. He has bibasilar crackles, a displaced apex beat and a third heart sound.',
    media: { preset: 'hfref', showHemo: true, condition: 'stemi-anterior', stage: 'old' },
    questions: [
      { id: 'q1', prompt: 'How is the pressure–volume loop changed?', options: ['Shifted right with a less steep ESPVR (↓ contractility), ↑ EDV and ESV, ↓ EF', 'Shifted left with a steeper EDPVR', 'Taller loop with normal volumes', 'Loop without isovolumetric phases'], answer: 0, explanation: 'Systolic failure: lower Ees, so ESV rises; the ventricle dilates (↑ EDV, eccentric remodelling) to preserve stroke volume at the cost of high filling pressure.' },
      { id: 'q2', prompt: 'Which therapy improves survival by reducing afterload and remodelling?', options: ['Digoxin', 'ACE inhibitor/ARNI with β-blocker, MRA and SGLT2 inhibitor', 'Loop diuretic alone', 'Non-dihydropyridine Ca²⁺ channel blocker'], answer: 1, explanation: 'Neurohormonal blockade (RAAS, sympathetic) and SGLT2 inhibition reduce mortality; diuretics and digoxin relieve symptoms without a survival benefit.' },
    ],
    teachingPoints: ['S3 = rapid early filling decelerating in a dilated, volume-loaded ventricle.'],
    links: ['hfref', 'coupling'],
  },
  {
    id: 'mid-systolic-click', title: 'A click and a late murmur', level: 'student',
    vignette: 'A 30-year-old woman has a mid-systolic click followed by a late systolic murmur at the apex. On standing, the click moves earlier.',
    media: { preset: 'mvp', showHemo: true },
    questions: [
      { id: 'q1', prompt: 'Why does standing move the click earlier?', options: ['↑ afterload', '↓ LV volume (preload) so the leaflets prolapse earlier in systole', '↑ heart rate only', 'Mitral annulus calcification'], answer: 1, explanation: 'Prolapse happens when the LV gets small enough during ejection; with less filling that point is reached sooner → earlier click, longer murmur. Squatting does the opposite.' },
    ],
    teachingPoints: ['Same direction as HOCM with preload: both louder/longer with ↓ preload.'],
    links: ['mvp', 'hocm'],
  },
  {
    id: 'torsades', title: 'Syncope after a new antibiotic', level: 'clinician',
    vignette: 'A 70-year-old woman on a class III antiarrhythmic is started on a macrolide. She has diarrhoea and low K⁺ and Mg²⁺. She collapses; the monitor shows a polymorphic tachycardia twisting around the baseline.',
    media: { rhythm: 'torsades', condition: 'long-qt' },
    questions: [
      { id: 'q1', prompt: 'What is the immediate drug treatment if she has a pulse?', options: ['Intravenous magnesium', 'Amiodarone', 'Procainamide', 'Adenosine'], answer: 0, explanation: 'Magnesium suppresses the early afterdepolarisations (L-type Ca²⁺ current) that trigger torsades. Stop QT-prolonging drugs, correct K⁺; overdrive pacing/isoproterenol shortens QT. Pulseless → defibrillate.' },
      { id: 'q2', prompt: 'Which cellular event triggers torsades?', options: ['Delayed afterdepolarisations from Ca²⁺ overload', 'Early afterdepolarisations during a prolonged phase 2–3', 'Re-entry around a scar', 'Enhanced phase 4 automaticity'], answer: 1, explanation: 'Reduced repolarising K⁺ current (IKr) prolongs the plateau, letting L-type Ca²⁺ channels reactivate → EADs.' },
    ],
    teachingPoints: ['Risk factors: female, bradycardia, hypokalemia, hypomagnesemia, multiple QT drugs.'],
    links: ['torsades', 'long-qt', 'qtc'],
  },
  {
    id: 'chb', title: 'Slow pulse and cannon waves', level: 'student',
    vignette: 'An 81-year-old man presents with fatigue and near-syncope. HR 34/min. Intermittent very large waves are seen in the jugular venous pulse.',
    media: { rhythm: 'chb', preset: 'chb-hemo', showHemo: true },
    questions: [
      { id: 'q1', prompt: 'What causes the intermittent giant neck waves?', options: ['Tricuspid regurgitation', 'The right atrium contracting against a closed tricuspid valve (AV dissociation)', 'Constrictive pericarditis', 'Pulmonary hypertension'], answer: 1, explanation: 'In complete heart block atria and ventricles beat independently; when atrial systole happens to fall during ventricular systole, blood is ejected backward into the neck veins → cannon a waves.' },
      { id: 'q2', prompt: 'A wide-QRS escape at ~30/min suggests block at which level?', options: ['AV node', 'Below the His bundle (infranodal)', 'SA node', 'Atrial muscle'], answer: 1, explanation: 'Narrow junctional escape at 40–60/min → block in the AV node; a slow wide ventricular escape → infranodal block, which needs pacing.' },
    ],
    teachingPoints: ['Symptomatic complete heart block → pacemaker.'],
    links: ['chb', 'chb-nodal'],
  },
  {
    id: 'pe', title: 'Sudden dyspnea after surgery', level: 'student',
    vignette: 'Five days after hip replacement, a 67-year-old woman becomes acutely short of breath. HR 118/min, BP 96/60 mmHg, SpO₂ 88%. JVP raised.',
    media: { condition: 'pe', preset: 'obstructive-shock-pe', showHemo: true, heartRate: 118 },
    questions: [
      { id: 'q1', prompt: 'What is the most common ECG finding in pulmonary embolism?', options: ['S1Q3T3', 'Sinus tachycardia', 'New RBBB', 'Right axis deviation'], answer: 1, explanation: 'S1Q3T3, RBBB and right-sided T inversion reflect acute RV strain but are insensitive; sinus tachycardia is the most frequent abnormality.' },
      { id: 'q2', prompt: 'What hemodynamic profile is expected with a massive PE?', options: ['↑ CVP, ↓ PCWP, ↓ CO, ↑ SVR', '↓ CVP, ↓ PCWP, ↑ CO, ↓ SVR', '↑ CVP, ↑ PCWP, ↓ CO, ↑ SVR', 'Normal CVP, ↑ PCWP'], answer: 0, explanation: 'Obstruction to RV outflow: the right heart backs up (↑ CVP), the left heart is underfilled (↓ PCWP) → ↓ CO and reflex vasoconstriction.' },
    ],
    teachingPoints: ['Massive PE with shock → systemic thrombolysis (or catheter/surgical therapy).'],
    links: ['pe', 'obstructive-shock-pe'],
  },
];

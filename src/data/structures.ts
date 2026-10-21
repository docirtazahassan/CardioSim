import type { Structure } from './types';

/**
 * Cardiac structures shown in Explore mode.
 * Text is concise and exam-focused. Blood supply assumes right dominance unless stated.
 */
export const STRUCTURES: Structure[] = [
  // ---------------- chambers
  {
    id: 'ra', name: 'Right atrium', category: 'chamber',
    function: 'Receives systemic venous return (SVC, IVC) and coronary sinus blood; contracts late in diastole (atrial kick) to top up RV filling. Contains the SA node and AV node.',
    bloodSupply: 'RCA atrial branches; SA nodal artery (RCA ~60%, LCx ~40%).',
    pearls: [
      'RA pressure ≈ CVP ≈ JVP; normal mean 2–6 mmHg.',
      'JVP a wave = RA contraction; absent in AF; cannon a waves when the RA contracts against a closed tricuspid valve (AV dissociation).',
      'Crista terminalis separates the smooth (sinus venarum) and trabeculated (pectinate) parts – the smooth part derives from the sinus venosus.',
      'The cavotricuspid isthmus is the critical slow-conduction zone of typical atrial flutter.',
    ],
    relatedConditions: ['rae', 'flutter', 'normal-hemo'],
  },
  {
    id: 'rv', name: 'Right ventricle', category: 'chamber',
    function: 'Thin-walled, crescent-shaped pump for the low-resistance pulmonary circulation. Most anterior chamber (directly behind the sternum).',
    bloodSupply: 'Mostly RCA (acute marginal branches); anterior RV wall partly from LAD; conus branch supplies the outflow tract.',
    pearls: [
      'Normal RV pressure ≈ 25/5 mmHg.',
      'RV infarction (proximal RCA) → hypotension, clear lungs, raised JVP; preload dependent — avoid nitrates and diuretics, give fluids.',
      'Most anterior chamber → most likely injured by a stab wound to the anterior chest.',
      'RV pressure overload (PE, pulmonary hypertension) → RV strain, right axis, dominant R in V1.',
    ],
    relatedConditions: ['rv-infarct', 'rvh', 'pe', 'rv-infarct-hemo'],
  },
  {
    id: 'la', name: 'Left atrium', category: 'chamber',
    function: 'Receives oxygenated blood from four pulmonary veins; reservoir, conduit and booster pump for LV filling.',
    bloodSupply: 'LCx atrial branches.',
    pearls: [
      'Most posterior chamber: enlargement can compress the esophagus (dysphagia) or left recurrent laryngeal nerve (hoarseness, Ortner syndrome).',
      'LA pressure ≈ PCWP; normal mean 8–12 mmHg.',
      'Mitral stenosis → LA dilation → AF → mural thrombus (LA appendage).',
      'Pulmonary vein ostia are the usual triggers of AF (target of ablation).',
    ],
    relatedConditions: ['lae', 'af', 'mitral-stenosis'],
  },
  {
    id: 'lv', name: 'Left ventricle', category: 'chamber',
    function: 'Thick-walled pressure pump for the systemic circulation. Forms the cardiac apex and most of the left border.',
    bloodSupply: 'LAD (anterior wall, anterior 2/3 of septum, apex), LCx (lateral wall), RCA via PDA in right dominance (inferior wall, posterior 1/3 of septum).',
    pearls: [
      'Normal LV pressure ≈ 120/10 mmHg; EF 55–70%.',
      'Concentric hypertrophy (pressure overload: hypertension, AS) – sarcomeres added in parallel. Eccentric hypertrophy (volume overload: AR, MR) – sarcomeres in series.',
      'Laplace: wall stress = P·r/2h — hypertrophy (↑h) normalises stress; dilation (↑r) raises it.',
      'Apex beat at 5th intercostal space, midclavicular line.',
    ],
    relatedConditions: ['lvh', 'hfref', 'hfpef', 'aortic-stenosis'],
  },
  // ---------------- valves
  {
    id: 'mitral', name: 'Mitral valve', category: 'valve',
    function: 'Bicuspid (anterior and posterior leaflets) atrioventricular valve between LA and LV, tethered by chordae to two papillary muscles.',
    bloodSupply: 'Avascular leaflets; papillary muscles supplied as below.',
    pearls: [
      'Closure contributes to S1 (with tricuspid). Best heard at the apex.',
      'Rheumatic fever most often affects the mitral valve (stenosis late, regurgitation early).',
      'MVP: midsystolic click then late systolic murmur; ↓ preload → earlier click, longer murmur.',
      'No true isovolumetric contraction in MR – blood leaks back into the LA from the start of systole.',
    ],
    relatedConditions: ['mitral-stenosis', 'mr-acute', 'mr-chronic', 'mvp'],
  },
  {
    id: 'tricuspid', name: 'Tricuspid valve', category: 'valve',
    function: 'Three-leaflet atrioventricular valve between RA and RV.',
    bloodSupply: 'Avascular leaflets; RV papillary muscles from RCA/LAD.',
    pearls: [
      'TR → holosystolic murmur at the left lower sternal border that ↑ with inspiration (Carvallo sign); giant v (cv) waves; pulsatile liver.',
      'IV drug use endocarditis affects the tricuspid valve (S. aureus).',
      'Carcinoid syndrome → tricuspid regurgitation and pulmonic stenosis.',
    ],
    relatedConditions: ['tr'],
  },
  {
    id: 'aortic', name: 'Aortic valve', category: 'valve',
    function: 'Three-cusp semilunar valve between LV and aorta. The coronary ostia arise from the right and left aortic sinuses.',
    bloodSupply: 'Avascular cusps.',
    pearls: [
      'AS: crescendo–decrescendo systolic ejection murmur at the right 2nd intercostal space radiating to the carotids; pulsus parvus et tardus; soft/absent A2 when severe.',
      'Classic triad of severe AS: syncope, angina, dyspnea (SAD).',
      'AR: early diastolic decrescendo murmur (left sternal border); wide pulse pressure; water-hammer (Corrigan) pulse.',
      'Bicuspid aortic valve (Turner syndrome) → earlier AS; associated with coarctation and aortic dilation.',
    ],
    relatedConditions: ['aortic-stenosis', 'aortic-regurgitation'],
  },
  {
    id: 'pulmonic', name: 'Pulmonic valve', category: 'valve',
    function: 'Three-cusp semilunar valve between RV outflow tract and pulmonary trunk.',
    bloodSupply: 'Avascular cusps.',
    pearls: [
      'P2 is softer than A2 and best heard at the left 2nd intercostal space; it moves later with inspiration (physiological split S2).',
      'Loud P2 = pulmonary hypertension.',
      'Pulmonic stenosis is part of tetralogy of Fallot and Noonan syndrome.',
    ],
    relatedConditions: [],
  },
  // ---------------- septa and papillary muscles
  {
    id: 'ivs', name: 'Interventricular septum', category: 'septum',
    function: 'Muscular wall between ventricles (with a small membranous part). Contracts with the LV. First part of the ventricles to depolarise (left → right), producing the septal q in I, aVL, V5–V6 and the r in V1.',
    bloodSupply: 'Anterior 2/3: LAD septal perforators. Posterior 1/3: PDA (RCA in right dominance).',
    pearls: [
      'Membranous VSD is the most common congenital heart defect: holosystolic murmur at the left lower sternal border.',
      'Post-MI septal rupture: 3–5 days (range 3–14) after MI, new holosystolic murmur, O2 step-up from RA to RV.',
      'Asymmetric septal hypertrophy in HOCM causes dynamic LVOT obstruction with systolic anterior motion (SAM) of the mitral leaflet.',
    ],
    relatedConditions: ['vsd', 'hocm', 'lbbb'],
  },
  {
    id: 'ias', name: 'Interatrial septum', category: 'septum',
    function: 'Separates RA and LA; contains the fossa ovalis (remnant of the foramen ovale).',
    bloodSupply: 'Atrial branches of RCA and LCx.',
    pearls: [
      'Ostium secundum ASD is the most common ASD: wide, fixed split S2 and a pulmonary flow murmur.',
      'Patent foramen ovale (~25% of adults) allows paradoxical emboli.',
      'Ostium primum ASD is associated with Down syndrome (endocardial cushion defects).',
    ],
    relatedConditions: ['asd'],
  },
  {
    id: 'pm-al', name: 'Anterolateral papillary muscle', category: 'papillary',
    function: 'Anchors chordae of both mitral leaflets (anterolateral commissure).',
    bloodSupply: 'Dual supply: LAD (diagonal) and LCx (obtuse marginal).',
    pearls: ['Dual blood supply makes rupture rare.'],
    relatedConditions: [],
  },
  {
    id: 'pm-pm', name: 'Posteromedial papillary muscle', category: 'papillary',
    function: 'Anchors chordae of both mitral leaflets (posteromedial commissure).',
    bloodSupply: 'Usually a single vessel: the PDA (RCA in right-dominant hearts).',
    pearls: [
      'Single blood supply → most often ruptured; classically after an inferior (RCA) MI, 2–7 days after.',
      'Rupture → acute severe MR: sudden pulmonary edema, new holosystolic murmur, large v waves on PCWP tracing, small non-dilated LA.',
    ],
    relatedConditions: ['mr-acute'],
  },
  // ---------------- conduction system
  {
    id: 'sa-node', name: 'Sinoatrial (SA) node', category: 'conduction',
    function: 'Primary pacemaker (60–100 bpm) at the junction of SVC and RA. Phase 4 depolarisation via the funny current (If, HCN channels) and T-type Ca²⁺ current; phase 0 via L-type Ca²⁺.',
    bloodSupply: 'SA nodal artery: RCA in ~60%, LCx in ~40%.',
    pearls: [
      'Sympathetic (β1) ↑ If and ICa → steeper phase 4 → faster rate. Vagal (ACh) opens IK-ACh → hyperpolarisation, flatter phase 4.',
      'Ivabradine blocks If to slow the sinus rate without affecting contractility.',
      'Sick sinus syndrome: bradycardia, pauses, and brady–tachy syndrome; often elderly.',
    ],
    relatedConditions: ['sinus', 'sinus-arrest', 'sick-sinus'],
  },
  {
    id: 'internodal', name: 'Internodal pathways', category: 'conduction',
    function: 'Preferential atrial conduction routes (anterior, middle, posterior) from SA to AV node.',
    bloodSupply: 'Atrial branches.',
    pearls: ['Atrial conduction is mostly through working myocardium; these tracts are preferential routes rather than insulated cables.'],
  },
  {
    id: 'bachmann', name: 'Bachmann bundle', category: 'conduction',
    function: 'Interatrial band carrying the impulse from RA to LA. The RA depolarises first (early P wave), the LA later (late P wave).',
    bloodSupply: 'Atrial branches of RCA/LCx.',
    pearls: ['Interatrial block (delay in Bachmann bundle) produces a broad, notched P wave even without LA enlargement.'],
    relatedConditions: ['lae'],
  },
  {
    id: 'av-node', name: 'Atrioventricular (AV) node', category: 'conduction',
    function: 'Slow (Ca²⁺-dependent) conduction delays the impulse ~100 ms so the atria finish emptying before ventricular systole; decremental conduction protects ventricles from rapid atrial rates.',
    bloodSupply: 'AV nodal artery from the dominant artery – RCA in right-dominant hearts (~70–80%).',
    pearls: [
      'Slowest conduction velocity in the heart; the PR interval mostly reflects AV nodal delay.',
      'Inferior MI (RCA) → AV nodal ischemia → first-degree or Mobitz I block, often transient and atropine-responsive.',
      'Dual AV nodal pathways (slow and fast) form the circuit of AVNRT.',
      'Adenosine, β-blockers, non-DHP CCBs and digoxin slow AV nodal conduction.',
    ],
    relatedConditions: ['first-degree-avb', 'mobitz1', 'avnrt'],
  },
  {
    id: 'his', name: 'Bundle of His', category: 'conduction',
    function: 'Penetrates the fibrous skeleton to carry the impulse from AV node to the bundle branches. Fast conduction.',
    bloodSupply: 'AV nodal artery and septal branches of LAD (dual).',
    pearls: ['Infranodal (His–Purkinje) disease causes Mobitz II and wide-escape complete heart block – needs a pacemaker.'],
    relatedConditions: ['mobitz2', 'chb'],
  },
  {
    id: 'rbb', name: 'Right bundle branch', category: 'conduction',
    function: 'Thin cord-like branch down the right side of the septum to the RV (moderator band to anterior papillary muscle).',
    bloodSupply: 'LAD septal perforators (and AV nodal artery proximally).',
    pearls: ['RBBB: RV activated late via the septum → terminal rightward/anterior forces: rSR′ in V1, wide S in I and V6. Can be normal; new RBBB suggests PE or anterior MI.'],
    relatedConditions: ['rbbb'],
  },
  {
    id: 'lbb', name: 'Left bundle branch', category: 'conduction',
    function: 'Broad sheet on the left septal surface; divides into the left anterior and left posterior fascicles (and septal fibres that start septal depolarisation left → right).',
    bloodSupply: 'LAD septal perforators; posterior fascicle also from PDA (dual).',
    pearls: ['LBBB: septum depolarises right → left, LV is activated late → broad notched R in I, aVL, V5–V6 and deep S in V1; new LBBB is an indication to assess for MI (Sgarbossa).'],
    relatedConditions: ['lbbb', 'sgarbossa'],
  },
  {
    id: 'laf', name: 'Left anterior fascicle', category: 'conduction',
    function: 'Thin fascicle to the anterosuperior LV and anterolateral papillary muscle.',
    bloodSupply: 'LAD only (single supply → commonly blocked).',
    pearls: ['LAFB: the superior/anterior LV is activated last → terminal forces point up and left → left axis deviation beyond −45°, qR in aVL, rS in II/III/aVF.'],
    relatedConditions: ['lafb'],
  },
  {
    id: 'lpf', name: 'Left posterior fascicle', category: 'conduction',
    function: 'Short, broad fascicle to the inferoposterior LV and posteromedial papillary muscle.',
    bloodSupply: 'Dual: LAD and PDA → rarely blocked in isolation.',
    pearls: ['LPFB is a diagnosis of exclusion: right axis deviation with rS in I and qR in III after excluding RVH, lateral MI, PE, and normal variants.'],
    relatedConditions: ['lpfb'],
  },
  {
    id: 'purkinje', name: 'Purkinje network', category: 'conduction',
    function: 'Subendocardial network with the fastest conduction (2–4 m/s) – activates the ventricles nearly simultaneously from endocardium to epicardium, apex before base.',
    bloodSupply: 'Subendocardial – most vulnerable to ischemia (watershed of the coronary circulation).',
    pearls: ['Normal QRS < 120 ms (usually 80–100 ms) because of rapid Purkinje spread; cell-to-cell spread (PVC, BBB, pacing) gives a wide QRS.', 'Intrinsic ventricular escape rate ~20–40 bpm.'],
  },
  // ---------------- pericardium & vessels
  {
    id: 'pericardium', name: 'Pericardium', category: 'pericardium',
    function: 'Fibrous and serous sac around the heart; limits acute dilation and couples filling of the two ventricles (ventricular interdependence).',
    bloodSupply: 'Pericardiacophrenic arteries (internal thoracic). Innervated by the phrenic nerve (referred shoulder pain).',
    pearls: [
      'Pericarditis: pleuritic chest pain relieved by sitting forward, friction rub, diffuse concave ST elevation with PR depression.',
      'Tamponade: Beck triad (hypotension, raised JVP, muffled heart sounds), pulsus paradoxus, electrical alternans, equalisation of diastolic pressures.',
      'Constrictive pericarditis: Kussmaul sign, pericardial knock, square-root sign; causes include TB (developing countries) and prior surgery/radiation.',
    ],
    relatedConditions: ['pericarditis', 'tamponade', 'constrictive'],
  },
  {
    id: 'aorta', name: 'Aorta', category: 'vessel',
    function: 'Elastic conduit and Windkessel: stores energy in systole and keeps flow going in diastole (diastolic recoil).',
    bloodSupply: 'Vasa vasorum.',
    pearls: [
      'Stiffer aorta (aging) → ↑ systolic and pulse pressure (isolated systolic hypertension).',
      'Coronary perfusion of the LV occurs mainly in diastole – aortic diastolic pressure drives it (↓ in AR).',
      'Coarctation: upper-extremity hypertension, weak femoral pulses, rib notching.',
    ],
    relatedConditions: ['aortic-regurgitation'],
  },
  {
    id: 'pa', name: 'Pulmonary trunk', category: 'vessel',
    function: 'Carries deoxygenated blood to the lungs; low pressure (≈25/10 mmHg).',
    bloodSupply: 'Vasa vasorum.',
    pearls: ['Pulmonary hypertension: mean PA pressure > 20 mmHg at rest; loud P2, RV heave, RVH on ECG.', 'PDA connects the pulmonary artery to the descending aorta: continuous machine-like murmur.'],
    relatedConditions: ['pda', 'eisenmenger'],
  },
  {
    id: 'svc-ivc', name: 'Venae cavae', category: 'vessel',
    function: 'Return systemic venous blood to the RA. Intrathoracic pressure changes with breathing alter venous return (↑ on inspiration).',
    bloodSupply: 'Vasa vasorum.',
    pearls: ['SVC syndrome: facial plethora and arm swelling, often from lung cancer (Pancoast) or lymphoma.'],
  },
  {
    id: 'pulm-veins', name: 'Pulmonary veins', category: 'vessel',
    function: 'Four veins returning oxygenated blood to the LA.',
    bloodSupply: 'Bronchial circulation.',
    pearls: ['Myocardial sleeves in the pulmonary vein ostia trigger AF; ablation isolates them.'],
  },
];

export const structureById = (id: string) => STRUCTURES.find((s) => s.id === id);

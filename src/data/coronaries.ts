import type { ArteryId, CoronaryArtery, Dominance, MyocardialSegment, TerritoryRule } from './types';

/** Coronary tree. `parent: 'dominant'` means the vessel arises from whichever artery is dominant. */
export const ARTERIES: CoronaryArtery[] = [
  { id: 'LMCA', name: 'Left main coronary artery', parent: 'aorta', course: 'From the left aortic sinus, passes behind the pulmonary trunk and divides into LAD and LCx (sometimes a ramus intermedius as a trifurcation).', supplies: 'Everything supplied by LAD and LCx (≈75% of the LV in right dominance).', occludable: true, sites: ['proximal'], pearls: ['Complete LMCA occlusion is usually catastrophic (cardiogenic shock / sudden death).', 'Subtotal LMCA or severe three-vessel disease classically gives diffuse ST depression with ST elevation in aVR (± V1).'] },
  { id: 'LAD', name: 'Left anterior descending artery', parent: 'LMCA', course: 'Runs in the anterior interventricular groove to the apex; often wraps around the apex to the inferior wall.', supplies: 'Anterior LV wall, anterior 2/3 of the septum, apex, anterolateral papillary muscle (with LCx), most of the bundle branches.', occludable: true, sites: ['proximal', 'mid', 'distal'], pearls: ['Most commonly occluded coronary artery.', 'Anterior STEMI: ST elevation V1–V4. Proximal LAD (before the first septal/diagonal): add aVL/I and greater V1 involvement.', 'A "wraparound" LAD supplies the inferior apex → distal LAD occlusion can show inferior ST elevation too.'] },
  { id: 'D1', name: 'First diagonal branch', parent: 'LAD', course: 'Runs over the anterolateral LV wall.', supplies: 'Anterolateral (high lateral) wall.', occludable: true, sites: ['proximal'], pearls: ['Isolated D1 occlusion: ST elevation in I, aVL and V2 with reciprocal ST depression in III/aVF ("South African flag" pattern).'] },
  { id: 'D2', name: 'Second diagonal branch', parent: 'LAD', course: 'More distal diagonal branch.', supplies: 'Mid-apical anterolateral wall.', occludable: false, sites: [], pearls: [] },
  { id: 'SEPTALS', name: 'Septal perforators', parent: 'LAD', course: 'Penetrate the septum perpendicularly from the LAD.', supplies: 'Anterior 2/3 of the septum, right bundle branch and left anterior fascicle.', occludable: false, sites: [], pearls: ['Alcohol septal ablation for HOCM deliberately infarcts the first septal perforator territory.'] },
  { id: 'LCX', name: 'Left circumflex artery', parent: 'LMCA', course: 'Runs in the left atrioventricular groove around to the back of the heart.', supplies: 'Lateral and (with posterolateral branches) inferolateral LV wall, LA; SA node in ~40%; PDA in left-dominant hearts.', occludable: true, sites: ['proximal', 'distal'], pearls: ['LCx occlusion is the most "ECG-silent" STEMI – the lateral/posterior wall is poorly seen by the standard 12 leads; record V7–V9.', 'Posterior MI: ST depression in V1–V3 with tall R and upright T (mirror image).'] },
  { id: 'OM1', name: 'Obtuse marginal branch', parent: 'LCX', course: 'Runs down the lateral (obtuse) margin of the LV.', supplies: 'Lateral LV wall, anterolateral papillary muscle (with LAD).', occludable: true, sites: ['proximal'], pearls: [] },
  { id: 'OM2', name: 'Second obtuse marginal', parent: 'LCX', course: 'More distal lateral branch.', supplies: 'Inferolateral wall.', occludable: false, sites: [], pearls: [] },
  { id: 'RAMUS', name: 'Ramus intermedius', parent: 'LMCA', course: 'Present in ~15–30%: arises between LAD and LCx (trifurcation) and runs over the anterolateral wall.', supplies: 'High lateral wall (functionally like a diagonal or OM).', occludable: true, sites: ['proximal'], pearls: [] },
  { id: 'RCA', name: 'Right coronary artery', parent: 'aorta', course: 'From the right aortic sinus, runs in the right atrioventricular groove to the crux.', supplies: 'RA, RV, SA node (~60%), AV node and inferior wall/posterior septum via the PDA (right dominance), posteromedial papillary muscle.', occludable: true, sites: ['proximal', 'mid', 'distal'], pearls: ['Proximal RCA (before the RV/acute marginal branches) → inferior + RV infarction: check V4R.', 'Inferior MI → bradycardia and AV block (AV nodal artery, Bezold–Jarisch reflex).', 'ST elevation III > II and ST depression in I suggest RCA rather than LCx.'] },
  { id: 'CONUS', name: 'Conus branch', parent: 'RCA', course: 'First RCA branch (sometimes a separate ostium) to the RV outflow tract.', supplies: 'RV outflow tract (infundibulum).', occludable: false, sites: [], pearls: [] },
  { id: 'SANODAL', name: 'SA nodal artery', parent: 'RCA', course: 'Arises from the proximal RCA in ~60% (LCx in ~40%) and encircles the SVC.', supplies: 'SA node.', occludable: false, sites: [], pearls: ['Proximal RCA occlusion can cause sinus bradycardia/arrest.'] },
  { id: 'AM', name: 'Acute marginal (RV) branch', parent: 'RCA', course: 'Runs along the acute (right) margin of the heart.', supplies: 'RV free wall.', occludable: false, sites: [], pearls: [] },
  { id: 'PDA', name: 'Posterior descending artery', parent: 'dominant', course: 'Runs in the posterior interventricular groove. From RCA (right dominance ~70%), LCx (left ~10%), or both (codominant ~20%).', supplies: 'Inferior LV wall, posterior 1/3 of septum, posteromedial papillary muscle, AV node (via AV nodal artery at the crux).', occludable: true, sites: ['proximal'], pearls: ['Dominance is defined by which artery gives the PDA.'] },
  { id: 'PLB', name: 'Posterolateral branch', parent: 'dominant', course: 'Continuation of the dominant artery beyond the crux onto the inferolateral wall.', supplies: 'Inferolateral (posterior) wall.', occludable: false, sites: [], pearls: [] },
  { id: 'AVNODAL', name: 'AV nodal artery', parent: 'dominant', course: 'Arises at the crux from the dominant artery.', supplies: 'AV node.', occludable: false, sites: [], pearls: [] },
];

export const DOMINANCE_INFO: Record<Dominance, { label: string; prevalence: string; description: string }> = {
  right: { label: 'Right dominant', prevalence: '≈70%', description: 'PDA and AV nodal artery arise from the RCA. Inferior wall and posterior septum depend on the RCA.' },
  left: { label: 'Left dominant', prevalence: '≈10%', description: 'PDA arises from the LCx. LCx occlusion can cause inferior MI and AV block; the RCA is small and mainly supplies the RV.' },
  codominant: { label: 'Codominant', prevalence: '≈20%', description: 'PDA from RCA, posterolateral branches from LCx; the inferior wall is shared.' },
};

const ANY = (a: ArteryId[]): Record<Dominance, ArteryId[]> => ({ right: a, left: a, codominant: a });

/** AHA 17-segment model with typical supplying arteries. Segments 3, 4, 9, 10, 15 depend on dominance. */
export const SEGMENTS: MyocardialSegment[] = [
  { id: 1, name: 'Basal anterior', level: 'basal', wall: 'anterior', supply: ANY(['LAD']) },
  { id: 2, name: 'Basal anteroseptal', level: 'basal', wall: 'anteroseptal', supply: ANY(['LAD']) },
  { id: 3, name: 'Basal inferoseptal', level: 'basal', wall: 'inferoseptal', supply: { right: ['RCA'], left: ['LCX'], codominant: ['RCA'] } },
  { id: 4, name: 'Basal inferior', level: 'basal', wall: 'inferior', supply: { right: ['RCA'], left: ['LCX'], codominant: ['RCA'] } },
  { id: 5, name: 'Basal inferolateral', level: 'basal', wall: 'inferolateral', supply: { right: ['LCX', 'RCA'], left: ['LCX'], codominant: ['LCX'] }, note: 'Previously called "posterior". Often LCx; PLB of a large RCA in right dominance.' },
  { id: 6, name: 'Basal anterolateral', level: 'basal', wall: 'anterolateral', supply: ANY(['LCX', 'LAD']), note: 'LCx (OM) or diagonal.' },
  { id: 7, name: 'Mid anterior', level: 'mid', wall: 'anterior', supply: ANY(['LAD']) },
  { id: 8, name: 'Mid anteroseptal', level: 'mid', wall: 'anteroseptal', supply: ANY(['LAD']) },
  { id: 9, name: 'Mid inferoseptal', level: 'mid', wall: 'inferoseptal', supply: { right: ['RCA'], left: ['LCX'], codominant: ['RCA'] } },
  { id: 10, name: 'Mid inferior', level: 'mid', wall: 'inferior', supply: { right: ['RCA'], left: ['LCX'], codominant: ['RCA', 'LCX'] } },
  { id: 11, name: 'Mid inferolateral', level: 'mid', wall: 'inferolateral', supply: { right: ['LCX', 'RCA'], left: ['LCX'], codominant: ['LCX'] } },
  { id: 12, name: 'Mid anterolateral', level: 'mid', wall: 'anterolateral', supply: ANY(['LCX', 'LAD']), note: 'Diagonal (LAD) and OM (LCx) – dual supply common.' },
  { id: 13, name: 'Apical anterior', level: 'apical', wall: 'anterior', supply: ANY(['LAD']) },
  { id: 14, name: 'Apical septal', level: 'apical', wall: 'septal', supply: ANY(['LAD']) },
  { id: 15, name: 'Apical inferior', level: 'apical', wall: 'inferior', supply: { right: ['RCA', 'LAD'], left: ['LCX', 'LAD'], codominant: ['RCA', 'LAD'] }, note: 'Wraparound LAD often supplies the apical inferior segment.' },
  { id: 16, name: 'Apical lateral', level: 'apical', wall: 'lateral', supply: ANY(['LCX', 'LAD']) },
  { id: 17, name: 'Apex', level: 'apex', wall: 'apex', supply: ANY(['LAD']) },
];

/**
 * Territory rules used by the coronary lab and the electrical engine.
 * Fractions (0..1) express how much of each region is ischemic.
 * These encode the *typical* textbook distribution; real anatomy varies (see CONTENT_NOTES).
 */
export const TERRITORY_RULES: TerritoryRule[] = [
  // ---- LAD
  {
    artery: 'LAD', site: 'proximal', dominance: 'any',
    regions: { seg1: 1, seg2: 1, seg7: 1, seg8: 1, seg13: 1, seg14: 1, seg17: 1, seg12: 0.6, seg6: 0.5, seg16: 0.6, seg15: 0.3, rvAnt: 0.3 },
    alsoAtRisk: ['Right bundle branch and left anterior fascicle (septal perforators)', 'Anterolateral papillary muscle (partial – dual supply)'],
    ecgNote: 'Before the first septal and diagonal: ST elevation V1–V4 plus I and aVL (high lateral), reciprocal ST depression in II, III, aVF. New RBBB/LAFB possible.',
  },
  {
    artery: 'LAD', site: 'mid', dominance: 'any',
    regions: { seg7: 1, seg8: 1, seg13: 1, seg14: 1, seg17: 1, seg16: 0.4, seg15: 0.3, seg1: 0.3 },
    ecgNote: 'After the first diagonal/septal: ST elevation V2–V5; I/aVL spared.',
  },
  {
    artery: 'LAD', site: 'distal', dominance: 'any',
    regions: { seg13: 1, seg14: 1, seg17: 1, seg16: 0.8, seg15: 0.8 },
    ecgNote: 'Apical infarction: ST elevation V3–V6; a wraparound LAD adds II, III, aVF.',
  },
  {
    artery: 'D1', site: 'proximal', dominance: 'any',
    regions: { seg6: 0.9, seg12: 0.8, seg1: 0.4 },
    ecgNote: 'High lateral: ST elevation I, aVL (± V2); reciprocal ST depression III, aVF.',
  },
  // ---- LMCA (complete occlusion)
  {
    artery: 'LMCA', site: 'proximal', dominance: 'right',
    regions: { seg1: 1, seg2: 1, seg7: 1, seg8: 1, seg13: 1, seg14: 1, seg17: 1, seg6: 1, seg12: 1, seg16: 1, seg5: 1, seg11: 1, seg15: 0.3 },
    alsoAtRisk: ['≈75% of LV myocardium', 'Both papillary muscles (anterolateral)', 'Cardiogenic shock'],
    ecgNote: 'Complete LMCA occlusion: massive anterolateral injury (often presents as arrest). The classic "LMCA pattern" (STE aVR with diffuse STD) reflects subtotal occlusion – see the condition library.',
  },
  {
    artery: 'LMCA', site: 'proximal', dominance: 'left',
    regions: { seg1: 1, seg2: 1, seg7: 1, seg8: 1, seg13: 1, seg14: 1, seg17: 1, seg6: 1, seg12: 1, seg16: 1, seg5: 1, seg11: 1, seg3: 1, seg4: 1, seg9: 1, seg10: 1, seg15: 1 },
    alsoAtRisk: ['Entire LV', 'AV node'],
    ecgNote: 'In left dominance the LMCA supplies the whole LV.',
  },
  {
    artery: 'LMCA', site: 'proximal', dominance: 'codominant',
    regions: { seg1: 1, seg2: 1, seg7: 1, seg8: 1, seg13: 1, seg14: 1, seg17: 1, seg6: 1, seg12: 1, seg16: 1, seg5: 1, seg11: 1, seg10: 0.4, seg15: 0.4 },
    ecgNote: 'Massive anterolateral injury.',
  },
  // ---- LCx
  {
    artery: 'LCX', site: 'proximal', dominance: 'right',
    regions: { seg6: 1, seg12: 1, seg16: 0.6, seg5: 1, seg11: 1 },
    alsoAtRisk: ['Left atrium', 'SA node in ~40%', 'Anterolateral papillary muscle (partial)'],
    ecgNote: 'Lateral (I, aVL, V5–V6) and posterior (STD V1–V3, STE V7–V9) involvement; can be ECG-silent.',
  },
  {
    artery: 'LCX', site: 'distal', dominance: 'right',
    regions: { seg5: 1, seg11: 1, seg4: 0.3 },
    ecgNote: 'Isolated posterior (inferolateral) MI: ST depression V1–V3 with upright T; ST elevation V7–V9.',
  },
  {
    artery: 'LCX', site: 'proximal', dominance: 'left',
    regions: { seg6: 1, seg12: 1, seg16: 0.6, seg5: 1, seg11: 1, seg3: 1, seg4: 1, seg9: 1, seg10: 1, seg15: 0.7 },
    alsoAtRisk: ['AV node (left dominance)', 'Posteromedial papillary muscle'],
    ecgNote: 'Left dominance: inferolateral + inferior MI; ST elevation II > III with STE in I/V5–V6.',
  },
  {
    artery: 'LCX', site: 'distal', dominance: 'left',
    regions: { seg5: 1, seg11: 1, seg3: 1, seg4: 1, seg9: 1, seg10: 1, seg15: 0.7 },
    alsoAtRisk: ['AV node', 'Posteromedial papillary muscle'],
    ecgNote: 'Inferoposterior MI from the LCx-derived PDA.',
  },
  {
    artery: 'LCX', site: 'proximal', dominance: 'codominant',
    regions: { seg6: 1, seg12: 1, seg16: 0.6, seg5: 1, seg11: 1, seg10: 0.4 },
    ecgNote: 'Lateral + posterior MI.',
  },
  {
    artery: 'LCX', site: 'distal', dominance: 'codominant',
    regions: { seg5: 1, seg11: 1, seg10: 0.4, seg4: 0.3 },
    ecgNote: 'Posterior MI.',
  },
  {
    artery: 'OM1', site: 'proximal', dominance: 'any',
    regions: { seg6: 0.8, seg12: 1, seg16: 0.5, seg11: 0.4 },
    ecgNote: 'Lateral MI: ST elevation I, aVL, V5–V6 with reciprocal inferior ST depression.',
  },
  {
    artery: 'RAMUS', site: 'proximal', dominance: 'any',
    regions: { seg6: 0.9, seg12: 0.9 },
    ecgNote: 'High lateral MI (I, aVL).',
  },
  // ---- RCA (right dominant)
  {
    artery: 'RCA', site: 'proximal', dominance: 'right',
    regions: { seg3: 1, seg4: 1, seg9: 1, seg10: 1, seg15: 0.7, seg5: 0.4, seg11: 0.3, rvAnt: 0.7, rvLat: 1, rvInf: 1, rvApex: 0.5 },
    alsoAtRisk: ['RV free wall (acute marginal)', 'SA node (~60%)', 'AV node', 'Posteromedial papillary muscle'],
    ecgNote: 'Inferior + RV MI: ST elevation III > II, aVF; ST depression I, aVL; ST elevation V4R (and often V1).',
  },
  {
    artery: 'RCA', site: 'mid', dominance: 'right',
    regions: { seg3: 1, seg4: 1, seg9: 1, seg10: 1, seg15: 0.7, seg5: 0.4, seg11: 0.3, rvInf: 0.4 },
    alsoAtRisk: ['AV node', 'Posteromedial papillary muscle'],
    ecgNote: 'Inferior MI sparing most of the RV.',
  },
  {
    artery: 'RCA', site: 'distal', dominance: 'right',
    regions: { seg4: 1, seg10: 1, seg3: 0.6, seg9: 0.6, seg15: 0.5, seg5: 0.4 },
    alsoAtRisk: ['AV node', 'Posteromedial papillary muscle'],
    ecgNote: 'Inferior MI.',
  },
  {
    artery: 'RCA', site: 'proximal', dominance: 'left',
    regions: { rvAnt: 0.7, rvLat: 1, rvInf: 1, rvApex: 0.5 },
    alsoAtRisk: ['SA node (~60%)'],
    ecgNote: 'Non-dominant RCA: isolated RV infarction (STE V4R, V1) is possible.',
  },
  {
    artery: 'RCA', site: 'mid', dominance: 'left',
    regions: { rvLat: 0.6, rvInf: 0.5 },
    ecgNote: 'Small RV territory.',
  },
  {
    artery: 'RCA', site: 'distal', dominance: 'left',
    regions: { rvInf: 0.4 },
    ecgNote: 'Minimal territory in left dominance.',
  },
  {
    artery: 'RCA', site: 'proximal', dominance: 'codominant',
    regions: { seg3: 1, seg4: 1, seg9: 1, seg10: 0.6, seg15: 0.5, rvAnt: 0.7, rvLat: 1, rvInf: 1, rvApex: 0.5 },
    ecgNote: 'Inferior + RV MI.',
  },
  {
    artery: 'RCA', site: 'mid', dominance: 'codominant',
    regions: { seg3: 1, seg4: 1, seg9: 1, seg10: 0.6, seg15: 0.5 },
    ecgNote: 'Inferior MI.',
  },
  {
    artery: 'RCA', site: 'distal', dominance: 'codominant',
    regions: { seg3: 0.7, seg4: 0.8, seg9: 0.7, seg10: 0.6 },
    ecgNote: 'Inferior MI.',
  },
  {
    artery: 'PDA', site: 'proximal', dominance: 'any',
    regions: { seg3: 0.8, seg4: 0.9, seg9: 0.8, seg10: 0.9, seg15: 0.4 },
    alsoAtRisk: ['Posteromedial papillary muscle', 'Posterior 1/3 of septum'],
    ecgNote: 'Inferior MI (II, III, aVF).',
  },
];

export function territoryFor(artery: ArteryId, site: string, dominance: Dominance): TerritoryRule | undefined {
  return (
    TERRITORY_RULES.find((r) => r.artery === artery && r.site === site && r.dominance === dominance) ??
    TERRITORY_RULES.find((r) => r.artery === artery && r.site === site && r.dominance === 'any') ??
    TERRITORY_RULES.find((r) => r.artery === artery && r.dominance === dominance) ??
    TERRITORY_RULES.find((r) => r.artery === artery)
  );
}

/** Node and papillary-muscle supply (shown in coronary lab and explore cards). */
export const SPECIAL_SUPPLY = {
  saNode: { RCA: 0.6, LCX: 0.4, text: 'SA nodal artery: RCA in ~60%, LCx in ~40%.' },
  avNode: { text: 'AV nodal artery comes from the dominant artery at the crux: RCA in right dominance (~70–80% overall), LCx in left dominance.' },
  papillary: {
    anterolateral: 'Dual supply: LAD (diagonal) + LCx (obtuse marginal) → rarely ruptures.',
    posteromedial: 'Single supply: PDA (RCA in right dominance) → ruptures more often, classically after inferior MI.',
  },
} as const;

/** Post-MI complications by time (coronary lab timeline). */
export const MI_TIMELINE = [
  { from: 0, to: 24, unit: 'h', label: '0–24 h', pathology: 'Coagulative necrosis begins; wavy fibres, early neutrophils (after ~12 h).', complications: ['Ventricular arrhythmias (VF/VT) – leading cause of early death', 'Cardiogenic shock / acute HF', 'AV block (inferior MI)'], gross: 'Normal → dark mottling' },
  { from: 24, to: 72, unit: 'h', label: '1–3 days', pathology: 'Extensive neutrophil infiltration.', complications: ['Fibrinous (post-infarction) pericarditis – friction rub, pleuritic pain'], gross: 'Hyperemia' },
  { from: 72, to: 336, unit: 'h', label: '3–14 days', pathology: 'Macrophages remove debris; granulation tissue at margins. Wall is softest (~4–7 days).', complications: ['Papillary muscle rupture (2–7 d) → acute MR', 'Interventricular septal rupture (3–5 d) → acute VSD, O₂ step-up', 'Free wall rupture (5–14 d) → tamponade', 'LV pseudoaneurysm'], gross: 'Hyperemic border, yellow-brown softening' },
  { from: 336, to: 1440, unit: 'h', label: '2 weeks – 2 months', pathology: 'Collagen deposition; contracted grey-white scar.', complications: ['True ventricular aneurysm (persistent ST elevation, HF, arrhythmia)', 'Mural thrombus → systemic embolism', 'Dressler syndrome (autoimmune pericarditis, weeks–months)'], gross: 'Grey-white scar' },
] as const;

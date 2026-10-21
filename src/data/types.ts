/**
 * Data schema for all medical content.
 * Everything a clinician might want to review or edit lives in src/data/ and follows these types.
 * Engines read the `model` fields; the UI reads the text fields.
 */

export type Level = 'student' | 'clinician';

// ---------------------------------------------------------------- leads
export type LimbLead = 'I' | 'II' | 'III' | 'aVR' | 'aVL' | 'aVF';
export type PrecordialLead = 'V1' | 'V2' | 'V3' | 'V4' | 'V5' | 'V6';
export type RightLead = 'V1R' | 'V2R' | 'V3R' | 'V4R' | 'V5R' | 'V6R';
export type PosteriorLead = 'V7' | 'V8' | 'V9';
export type LeadId = LimbLead | PrecordialLead | RightLead | PosteriorLead;

// ---------------------------------------------------------------- anatomy
export interface Structure {
  id: string;
  name: string;
  category: 'chamber' | 'valve' | 'septum' | 'papillary' | 'conduction' | 'pericardium' | 'vessel';
  function: string;
  bloodSupply: string;
  pearls: string[];
  clinicianPearls?: string[];
  relatedConditions?: string[]; // ECG condition / preset / rhythm ids
}

export type Dominance = 'right' | 'left' | 'codominant';

export type ArteryId =
  | 'LMCA' | 'LAD' | 'D1' | 'D2' | 'SEPTALS' | 'LCX' | 'OM1' | 'OM2' | 'RAMUS'
  | 'RCA' | 'CONUS' | 'SANODAL' | 'AM' | 'PDA' | 'PLB' | 'AVNODAL';

export type OcclusionSite = 'proximal' | 'mid' | 'distal';

export interface CoronaryArtery {
  id: ArteryId;
  name: string;
  parent: ArteryId | 'aorta' | 'dominant';
  course: string;
  supplies: string;
  occludable: boolean;
  /** Which sites make sense to occlude for this vessel. */
  sites: OcclusionSite[];
  pearls: string[];
}

/** Region ids used by the electrical engine. seg1..seg17 are AHA segments. */
export type VentricularRegionId =
  | 'seg1' | 'seg2' | 'seg3' | 'seg4' | 'seg5' | 'seg6' | 'seg7' | 'seg8' | 'seg9'
  | 'seg10' | 'seg11' | 'seg12' | 'seg13' | 'seg14' | 'seg15' | 'seg16' | 'seg17'
  | 'rvApex' | 'rvAnt' | 'rvLat' | 'rvInf' | 'rvot';

export interface MyocardialSegment {
  id: number; // 1..17
  name: string;
  level: 'basal' | 'mid' | 'apical' | 'apex';
  wall: 'anterior' | 'anteroseptal' | 'inferoseptal' | 'inferior' | 'inferolateral' | 'anterolateral' | 'septal' | 'lateral' | 'apex';
  /** Typical supplying artery by dominance (AHA convention). */
  supply: Record<Dominance, ArteryId[]>;
  note?: string;
}

/** Fractional involvement (0..1) of each region by an occlusion at a given site. */
export interface TerritoryRule {
  artery: ArteryId;
  site: OcclusionSite;
  dominance: Dominance | 'any';
  regions: Partial<Record<VentricularRegionId, number>>;
  /** Extra structures put at risk (shown in coronary lab). */
  alsoAtRisk?: string[];
  ecgNote: string;
}

// ---------------------------------------------------------------- ECG model (declarative)
export type InjuryType = 'transmural' | 'subendocardial';
export type StShape = 'convex' | 'straight' | 'concave' | 'coved' | 'scooped' | 'upsloping';

export interface RegionChange {
  /** AHA segment numbers and/or RV region ids. */
  segments?: number[];
  rv?: Array<'rvApex' | 'rvAnt' | 'rvLat' | 'rvInf' | 'rvot'>;
  /** All LV segments (1..17). */
  allLv?: boolean;
  /** Fraction (0..1) applied to the listed regions. */
  weight?: number;
  injury?: InjuryType;
  /** Size of the injury current (≈ ST deviation scale, mV per unit mass). */
  injuryMag?: number;
  /** 0..1 loss of viable myocardium (removes the region's depolarisation force → Q waves). */
  necrosis?: number;
  /** Multiplier on the region's primary repolarisation gradient. 1 = normal; <0 = T inversion; >1 = hyperacute/tall T. */
  tGradient?: number;
  /** Delay (ms) of the region's repolarisation; with negative tGradient gives a biphasic T (Wellens A). */
  tDelay?: number;
  stShape?: StShape;
}

export interface MiOcclusionSpec {
  artery: ArteryId;
  site: OcclusionSite;
  dominance?: Dominance;
  stage: MiStage;
}

export type MiStage = 'hyperacute' | 'acute' | 'evolving' | 'reperfused' | 'old';

export interface ExtraSource {
  /** Calibration dipole (documented in CONTENT_NOTES). Direction in body frame x=left, y=inferior, z=anterior. */
  direction: [number, number, number];
  position?: [number, number, number];
  amplitude: number; // mV-equivalent at the heart centre for the limb leads
  /** Timing relative to QRS onset (ms). */
  start: number;
  duration: number;
  shape?: 'bump' | 'plateau';
  note: string;
}

export interface EcgModel {
  rhythm?: string; // rhythm id; default 'sinus'
  heartRate?: number;
  /** Rotates the whole ventricular vector in the frontal plane (teaching control and axis presets). */
  frontalRotationDeg?: number;
  /** Rotates in the horizontal plane (+ = counter-clockwise viewed from below → earlier transition). */
  horizontalRotationDeg?: number;
  conduction?: {
    rbbb?: boolean;
    lbbb?: boolean;
    lafb?: boolean;
    lpfb?: boolean;
    /** Global slowing of ventricular conduction (1 = normal, 2 = twice as slow). */
    slowing?: number;
    accessoryPathway?: 'left-lateral' | 'posteroseptal' | 'right-free-wall';
  };
  hypertrophy?: { lv?: number; rv?: number; la?: number; ra?: number; strain?: boolean };
  regions?: RegionChange[];
  occlusion?: MiOcclusionSpec;
  electrolytes?: { k?: number; ca?: number; mg?: number };
  drugs?: DrugId[];
  temperatureC?: number;
  global?: {
    /** Multiplies all voltages (effusion, obesity, emphysema). */
    voltageScale?: number;
    /** Beat-to-beat alternating amplitude factor (electrical alternans). */
    alternans?: number;
    /** Diffuse epicardial injury (pericarditis), 0..1. */
    pericarditis?: number;
    /** Brugada-type RVOT epicardial gradient, 0..1. */
    brugada?: number;
    /** Extra QT prolongation (ms) from channelopathy (congenital LQTS). */
    qtExtraMs?: number;
    /** U wave amplitude multiplier. */
    uWave?: number;
  };
  artefact?: { dextrocardia?: boolean; limbReversal?: 'LA-RA' };
  extraSources?: ExtraSource[];
}

export interface LeadFinding {
  leads: string; // e.g. "II, III, aVF"
  finding: string;
}

export interface ConditionStage {
  id: string;
  label: string;
  description: string;
  model: EcgModel;
}

export interface EcgCondition {
  id: string;
  name: string;
  category: 'normal' | 'axis' | 'conduction' | 'ischemia' | 'hypertrophy' | 'pericardial' | 'electrolyte' | 'drug' | 'other' | 'artefact';
  level: Level;
  mechanism: string;
  findings: LeadFinding[];
  criteria: string[];
  mimics: string[];
  pearls: string[];
  clinicianPearls?: string[];
  references: string;
  model: EcgModel;
  stages?: ConditionStage[];
  /** Linked hemodynamic preset, if any. */
  hemoPreset?: string;
}

// ---------------------------------------------------------------- drugs / electrolytes
export type DrugId =
  | 'class1a' | 'class1b' | 'class1c' | 'class2' | 'class3' | 'class4'
  | 'digoxin' | 'adenosine' | 'atropine' | 'magnesium';

export interface DrugInfo {
  id: DrugId;
  name: string;
  examples: string;
  mechanism: string;
  apEffect: string;
  ecgEffect: string;
  uses: string;
  toxicity: string;
}

// ---------------------------------------------------------------- rhythms
export type ArrhythmiaMechanism = 'normal' | 'automaticity' | 'triggered' | 're-entry' | 'conduction-block' | 'none';

export interface RhythmModel {
  /** Sinus node rate (bpm). 0 = sinus arrest/standstill. */
  sinusRate?: number;
  sinusArrhythmia?: number; // fractional respiratory variation
  /** Pattern of sinus pauses: 'arrest' (long pauses) or 'sick-sinus' (brady-tachy). */
  sinusPauses?: 'arrest' | 'sick-sinus';
  atrial?: 'sinus' | 'flutter' | 'fibrillation' | 'mat' | 'none';
  flutterRate?: number;
  /** Flutter conduction: fixed ratio (2 → 2:1) or 'variable'. */
  flutterBlock?: number | 'variable';
  av?: {
    /** Minimum AV nodal (A–H) conduction time, ms. */
    ahMin?: number;
    /** Extra delay added when the node is re-entered early (decremental property), ms. */
    decrement?: number;
    /** AV nodal effective refractory period, ms. */
    erp?: number;
    dualPathway?: boolean;
  };
  /** Infra-Hisian block: 'mobitz2' with conduction ratio, or 'complete'. */
  infraHis?: { block?: 'mobitz2' | 'complete'; ratio?: number };
  /** Complete AV block at the node (narrow junctional escape). */
  completeNodalBlock?: boolean;
  accessoryPathway?: { location: 'left-lateral' | 'posteroseptal' | 'right-free-wall'; antegrade: boolean; retrograde: boolean };
  escape?: { junctional?: number; ventricular?: number };
  /** Programmed ectopic beats. */
  ectopy?: Array<{ type: 'pac' | 'pvc' | 'pjc'; pattern: 'single' | 'bigeminy' | 'trigeminy' | 'couplet'; couplingMs: number; at?: number; origin?: VentricularRegionId }>;
  /** Ventricular-level rhythm overriding conduction. */
  ventricular?: { mode: 'vt-mono' | 'vt-poly' | 'torsades' | 'vf' | 'asystole' | 'idioventricular' | 'aivr'; rate?: number; origin?: VentricularRegionId; onsetMs?: number };
  /** Re-entrant SVT to start at time (ms) by a premature beat. */
  svt?: { type: 'avnrt' | 'avrt-ortho' | 'avrt-anti'; onsetMs: number };
  /** Electromechanical dissociation (PEA): ECG organised, no mechanical output. */
  pea?: boolean;
  /** Long QT substrate (ms added) – used with torsades. */
  qtExtraMs?: number;
}

export interface Rhythm {
  id: string;
  name: string;
  group: 'sinus' | 'av-block' | 'atrial' | 'svt' | 'junctional' | 'ectopy' | 'ventricular' | 'arrest';
  level: Level;
  mechanism: ArrhythmiaMechanism;
  mechanismText: string;
  conduction: string;
  ecgCriteria: string[];
  hemodynamics: string;
  management: string[];
  pearls: string[];
  references: string;
  model: RhythmModel;
  /** Default ECG substrate (e.g. WPW pre-excitation) */
  ecg?: EcgModel;
}

// ---------------------------------------------------------------- hemodynamics
export interface HemoParams {
  hr: number;
  /** Rhythm id driving contraction timing. */
  rhythm: string;
  // ventricles
  lvEes: number; lvV0: number; lvEdA: number; lvEdB: number;
  rvEes: number; rvV0: number; rvEdA: number; rvEdB: number;
  // atria
  laEes: number; laEdA: number; laEdB: number; laV0: number;
  raEes: number; raEdA: number; raEdB: number; raV0: number;
  atrialKick: number; // 0..1 (0 = AF / atrial standstill)
  // circulation
  sysR: number; // peripheral systemic resistance (mmHg·s/mL)
  sysC: number; // systemic arterial compliance (mL/mmHg)
  aoZ: number; // aortic characteristic impedance
  pulR: number; pulC: number; paZ: number;
  sysVenC: number; pulVenC: number;
  totalVolume: number; // mL
  unstressedFraction: number; // fraction of volume that is unstressed (venous tone ↓ → higher)
  // valves (cm²); regurgitant orifice areas (cm²)
  avArea: number; mvArea: number; tvArea: number; pvArea: number;
  arArea: number; mrArea: number; trArea: number; prArea: number;
  // shunts (cm²)
  asdArea: number; vsdArea: number; pdaArea: number;
  // pericardium
  effusion: number; // mL
  pericardialStiffness: number; // 1 = normal, high = constriction
  // HOCM dynamic obstruction 0..1
  hocm: number;
  // MVP: LV volume below which prolapse (click) occurs, fraction of EDV; 0 = off
  mvp: number;
  // respiration
  respRate: number; respDepth: number; // mmHg swing in intrathoracic pressure
  intrathoracicBias: number; // mmHg added (Valsalva = +40)
  abdominalPressure: number;
  // reflex & extras
  baroreflex: boolean;
  vo2: number; // mL/min
  hb: number; // g/dL
  sao2: number; // 0..1
  /** Fractional reduction of oxygen extraction (sepsis). */
  extractionDefect: number;
  pulsusAlternans: number; // 0..1
  /** Interventricular electrical delay (ms): +ve = RV late (RBBB), -ve = LV late (LBBB). */
  vvDelay: number;
  /** PEA / electromechanical dissociation. */
  pea: boolean;
  iabp: boolean;
}

export interface HemoPreset {
  id: string;
  name: string;
  group: 'normal' | 'failure' | 'valve' | 'shunt' | 'pericardial' | 'shock' | 'cardiomyopathy' | 'other';
  level: Level;
  description: string;
  params: Partial<HemoParams>;
  expected: {
    pressures: string;
    murmur: string;
    jvp: string;
    pulse: string;
    pvLoop: string;
  };
  pearls: string[];
  references: string;
}

export type Maneuver = 'none' | 'valsalva' | 'standing' | 'squatting' | 'handgrip' | 'legRaise' | 'amylNitrite' | 'inspiration' | 'expiration';

export type Intervention = 'fluids' | 'diuretic' | 'nitrate' | 'inotrope' | 'vasopressor' | 'betaBlocker' | 'afterloadReduction' | 'iabp';

// ---------------------------------------------------------------- cases
export interface CaseQuestion {
  id: string;
  prompt: string;
  options: string[];
  answer: number;
  explanation: string;
}

export interface CaseItem {
  id: string;
  title: string;
  level: Level;
  vignette: string;
  media: { condition?: string; stage?: string; rhythm?: string; preset?: string; showHemo?: boolean };
  questions: CaseQuestion[];
  teachingPoints: string[];
  links: string[]; // ids of conditions/rhythms/presets
}

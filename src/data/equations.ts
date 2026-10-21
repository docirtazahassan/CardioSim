/**
 * Equations lab content. Each entry: KaTeX formula, plain explanation, sliders, computed outputs and
 * a plot sweeping one input. Units are stated in every label. Where the app's own engines use the
 * same relation, `link` points there.
 */
import type { Level } from './types';

export interface EqVar { key: string; label: string; min: number; max: number; step: number; value: number; unit?: string }
export interface EqOutput { label: string; value: number; unit?: string; digits?: number; flag?: string }
export interface EqPlot { x: string; xLabel: string; yLabel: string; y: (v: Record<string, number>) => number; series?: Array<{ label: string; y: (v: Record<string, number>) => number }>; yMin?: number; yMax?: number }
export interface Equation {
  id: string;
  title: string;
  group: 'Circulation' | 'Pressure–volume' | 'Valves & flow' | 'Oxygen' | 'Electrophysiology' | 'ECG';
  level: Level;
  tex: string;
  explain: string;
  vars: EqVar[];
  compute: (v: Record<string, number>) => EqOutput[];
  plot?: EqPlot;
  pearls: string[];
  link?: { mode: 'hemo' | 'ecg' | 'arrhythmia'; id: string; label: string };
}

const deg = (r: number) => (r * 180) / Math.PI;

export const EQUATIONS: Equation[] = [
  // ------------------------------------------------------------ circulation
  {
    id: 'ohm', title: 'Pressure = flow × resistance', group: 'Circulation', level: 'student',
    tex: String.raw`\mathrm{MAP} - \mathrm{CVP} = \mathrm{CO} \times \mathrm{SVR} \qquad \mathrm{SVR}\,[\text{dyn·s·cm}^{-5}] = 80 \times \mathrm{SVR}\,[\text{Wood units}]`,
    explain: 'The circulation obeys an Ohm-like law: the pressure drop across the systemic bed equals flow times resistance. Arterioles set SVR, so vasodilation lowers MAP unless cardiac output rises (baroreflex).',
    vars: [
      { key: 'co', label: 'Cardiac output', min: 1, max: 12, step: 0.1, value: 5, unit: 'L/min' },
      { key: 'svr', label: 'SVR', min: 5, max: 40, step: 0.5, value: 18, unit: 'Wood units (mmHg·min/L)' },
      { key: 'cvp', label: 'CVP', min: 0, max: 25, step: 1, value: 4, unit: 'mmHg' },
    ],
    compute: (v) => [
      { label: 'MAP', value: v.co * v.svr + v.cvp, unit: 'mmHg', flag: v.co * v.svr + v.cvp < 65 ? 'below 65 mmHg – organ hypoperfusion risk' : undefined },
      { label: 'SVR', value: v.svr * 80, unit: 'dyn·s·cm⁻⁵', digits: 0 },
    ],
    plot: { x: 'co', xLabel: 'cardiac output (L/min)', yLabel: 'MAP (mmHg)', y: (v) => v.co * v.svr + v.cvp, series: [{ label: 'SVR halved (sepsis)', y: (v) => v.co * v.svr * 0.5 + v.cvp }] },
    pearls: ['Normal SVR ≈ 800–1200 dyn·s·cm⁻⁵ (10–15 Wood units).', 'Septic shock: SVR ↓ → MAP ↓ despite high CO. Cardiogenic shock: CO ↓, SVR ↑.'],
    link: { mode: 'hemo', id: 'septic-shock', label: 'See distributive shock' },
  },
  {
    id: 'co', title: 'Cardiac output, stroke volume and ejection fraction', group: 'Circulation', level: 'student',
    tex: String.raw`\mathrm{CO} = \mathrm{HR}\times\mathrm{SV}, \qquad \mathrm{SV} = \mathrm{EDV}-\mathrm{ESV}, \qquad \mathrm{EF} = \frac{\mathrm{SV}}{\mathrm{EDV}}`,
    explain: 'Stroke volume is the difference between end-diastolic and end-systolic volume. EF expresses it as a fraction of filling – it falls when contractility falls (ESV rises).',
    vars: [
      { key: 'hr', label: 'Heart rate', min: 30, max: 200, step: 1, value: 72, unit: '/min' },
      { key: 'edv', label: 'EDV', min: 60, max: 300, step: 1, value: 120, unit: 'mL' },
      { key: 'esv', label: 'ESV', min: 10, max: 250, step: 1, value: 50, unit: 'mL' },
    ],
    compute: (v) => {
      const sv = Math.max(0, v.edv - v.esv);
      return [
        { label: 'Stroke volume', value: sv, unit: 'mL', digits: 0 },
        { label: 'Ejection fraction', value: (100 * sv) / v.edv, unit: '%', digits: 0, flag: sv / v.edv < 0.4 ? 'reduced (HFrEF range ≤ 40%)' : undefined },
        { label: 'Cardiac output', value: (v.hr * sv) / 1000, unit: 'L/min', digits: 1 },
      ];
    },
    plot: { x: 'hr', xLabel: 'heart rate (/min)', yLabel: 'CO (L/min)', y: (v) => (v.hr * Math.max(0, v.edv - v.esv)) / 1000 },
    pearls: ['In reality SV falls at high rates (shorter filling time), so CO plateaus – the plot assumes SV is fixed.', 'Cardiac index = CO / body surface area (normal 2.5–4 L/min/m²).'],
    link: { mode: 'hemo', id: 'hfref', label: 'Compare HFrEF' },
  },
  {
    id: 'map', title: 'Mean arterial pressure and pulse pressure', group: 'Circulation', level: 'student',
    tex: String.raw`\mathrm{MAP} \approx \mathrm{DBP} + \tfrac{1}{3}(\mathrm{SBP}-\mathrm{DBP}), \qquad \mathrm{PP} = \mathrm{SBP}-\mathrm{DBP} \approx \frac{\mathrm{SV}}{C_{\text{arterial}}}`,
    explain: 'At normal heart rates diastole lasts ~2/3 of the cycle, hence the 1/3 weighting. Pulse pressure rises when stroke volume is large (AR, hyperdynamic states) or arteries are stiff (elderly).',
    vars: [
      { key: 'sbp', label: 'Systolic BP', min: 60, max: 240, step: 1, value: 120, unit: 'mmHg' },
      { key: 'dbp', label: 'Diastolic BP', min: 20, max: 140, step: 1, value: 80, unit: 'mmHg' },
    ],
    compute: (v) => [
      { label: 'MAP', value: v.dbp + (v.sbp - v.dbp) / 3, unit: 'mmHg', digits: 0 },
      { label: 'Pulse pressure', value: v.sbp - v.dbp, unit: 'mmHg', digits: 0, flag: v.sbp - v.dbp > 60 ? 'wide (AR, stiff aorta, high output)' : v.sbp - v.dbp < 25 ? 'narrow (low SV: AS, tamponade, shock)' : undefined },
    ],
    pearls: ['Wide PP with low DBP → aortic regurgitation; narrow PP → aortic stenosis, tamponade, severe HF.'],
    link: { mode: 'hemo', id: 'aortic-regurgitation', label: 'See AR pulse' },
  },
  {
    id: 'windkessel', title: 'Windkessel: diastolic pressure decay', group: 'Circulation', level: 'clinician',
    tex: String.raw`P(t) = P_{\text{es}}\, e^{-t/\tau}, \qquad \tau = R\,C`,
    explain: 'During diastole the aorta empties through the peripheral resistance like a capacitor discharging through a resistor. A long time constant (high R or C) keeps diastolic pressure up.',
    vars: [
      { key: 'pes', label: 'End-systolic aortic pressure', min: 60, max: 180, step: 1, value: 110, unit: 'mmHg' },
      { key: 'r', label: 'Peripheral resistance R', min: 0.3, max: 2.5, step: 0.05, value: 1.0, unit: 'mmHg·s/mL' },
      { key: 'c', label: 'Arterial compliance C', min: 0.5, max: 3, step: 0.05, value: 1.6, unit: 'mL/mmHg' },
      { key: 't', label: 'Time into diastole', min: 0, max: 1.5, step: 0.01, value: 0.5, unit: 's' },
    ],
    compute: (v) => [
      { label: 'τ = RC', value: v.r * v.c, unit: 's', digits: 2 },
      { label: 'Pressure at t', value: v.pes * Math.exp(-v.t / (v.r * v.c)), unit: 'mmHg', digits: 0 },
    ],
    plot: { x: 't', xLabel: 'time into diastole (s)', yLabel: 'aortic pressure (mmHg)', y: (v) => v.pes * Math.exp(-v.t / (v.r * v.c)), yMin: 0 },
    pearls: ['The simulator uses exactly this 3-element Windkessel (R, C plus characteristic impedance) for the systemic and pulmonary arteries.', 'Bradycardia lengthens diastole → lower DBP; sepsis (↓R) → fast decay, low DBP.'],
    link: { mode: 'hemo', id: 'septic-shock', label: 'Low-R circulation' },
  },
  {
    id: 'poiseuille', title: 'Poiseuille: resistance and vessel radius', group: 'Circulation', level: 'student',
    tex: String.raw`R = \frac{8\,\eta\,L}{\pi r^{4}} \quad\Rightarrow\quad Q = \frac{\Delta P\,\pi r^{4}}{8\,\eta\,L}`,
    explain: 'Resistance rises with the inverse fourth power of radius – the reason arterioles control flow and why a modest stenosis has little effect but a severe one is critical.',
    vars: [
      { key: 'r', label: 'Radius (fraction of normal)', min: 0.2, max: 1.5, step: 0.01, value: 1, unit: '×' },
      { key: 'eta', label: 'Viscosity (fraction of normal)', min: 0.5, max: 3, step: 0.05, value: 1, unit: '× (hematocrit)' },
    ],
    compute: (v) => [
      { label: 'Resistance', value: v.eta / Math.pow(v.r, 4), unit: '× normal', digits: 2 },
      { label: 'Flow at the same ΔP', value: (100 * Math.pow(v.r, 4)) / v.eta, unit: '% of normal', digits: 0 },
    ],
    plot: { x: 'r', xLabel: 'radius (× normal)', yLabel: 'flow (% normal)', y: (v) => Math.min(500, (100 * Math.pow(v.r, 4)) / v.eta), yMin: 0 },
    pearls: ['Halving the radius → 16× resistance.', 'Polycythemia ↑ viscosity → ↑ resistance; anemia the opposite (and ↑ CO).', 'Coronary autoregulation (arteriolar dilation) masks stenoses until ~70% diameter narrowing at rest.'],
  },
  {
    id: 'laplace', title: 'Law of Laplace: wall stress', group: 'Pressure–volume', level: 'student',
    tex: String.raw`\sigma = \frac{P\, r}{2\,h}`,
    explain: 'Wall stress rises with pressure and radius and falls with wall thickness. Pressure overload (AS, hypertension) → concentric hypertrophy to normalise stress; volume overload (AR, MR) → eccentric hypertrophy (dilation).',
    vars: [
      { key: 'p', label: 'LV systolic pressure', min: 80, max: 260, step: 1, value: 120, unit: 'mmHg' },
      { key: 'r', label: 'Cavity radius', min: 1.5, max: 5, step: 0.05, value: 2.5, unit: 'cm' },
      { key: 'h', label: 'Wall thickness', min: 0.5, max: 2, step: 0.05, value: 1.0, unit: 'cm' },
    ],
    compute: (v) => [{ label: 'Wall stress (relative units)', value: (v.p * v.r) / (2 * v.h), unit: 'mmHg', digits: 0, flag: (v.p * v.r) / (2 * v.h) > 220 ? 'high – increased O₂ demand' : undefined }],
    plot: { x: 'r', xLabel: 'cavity radius (cm)', yLabel: 'wall stress', y: (v) => (v.p * v.r) / (2 * v.h) },
    pearls: ['Wall stress is the main determinant of afterload and myocardial O₂ demand.', 'A dilated failing ventricle has high stress even at normal pressure → vicious cycle.'],
    link: { mode: 'hemo', id: 'aortic-stenosis', label: 'Pressure overload: AS' },
  },
  // ------------------------------------------------------------ pressure–volume
  {
    id: 'coupling', title: 'Ventricular–arterial coupling', group: 'Pressure–volume', level: 'clinician',
    tex: String.raw`P_{\text{es}} = E_{\text{es}}(\mathrm{ESV}-V_0) = E_a\,\mathrm{SV}, \quad E_a = \frac{R}{T} \;\Rightarrow\; \mathrm{SV} = \frac{E_{\text{es}}\,(\mathrm{EDV}-V_0)}{E_{\text{es}}+E_a}`,
    explain: 'The end-systolic point lies where the ESPVR (contractility, Ees) meets the arterial elastance line (afterload, Ea). Raising Ees or lowering Ea increases SV for the same preload.',
    vars: [
      { key: 'ees', label: 'Contractility Ees', min: 0.5, max: 6, step: 0.1, value: 3.0, unit: 'mmHg/mL' },
      { key: 'r', label: 'Peripheral resistance R', min: 0.4, max: 2.5, step: 0.05, value: 1.0, unit: 'mmHg·s/mL' },
      { key: 'hr', label: 'Heart rate', min: 40, max: 160, step: 1, value: 72, unit: '/min' },
      { key: 'edv', label: 'EDV', min: 60, max: 260, step: 1, value: 125, unit: 'mL' },
      { key: 'v0', label: 'V₀', min: 0, max: 40, step: 1, value: 15, unit: 'mL' },
    ],
    compute: (v) => {
      const ea = v.r / (60 / v.hr);
      const sv = (v.ees * Math.max(0, v.edv - v.v0)) / (v.ees + ea);
      return [
        { label: 'Ea', value: ea, unit: 'mmHg/mL', digits: 2 },
        { label: 'Stroke volume', value: sv, unit: 'mL', digits: 0 },
        { label: 'ESV', value: v.edv - sv, unit: 'mL', digits: 0 },
        { label: 'EF', value: (100 * sv) / v.edv, unit: '%', digits: 0 },
        { label: 'End-systolic pressure', value: ea * sv, unit: 'mmHg', digits: 0 },
        { label: 'Ea / Ees', value: ea / v.ees, digits: 2, flag: ea / v.ees > 1.3 ? 'uncoupled – inefficient (failing heart or high afterload)' : undefined },
      ];
    },
    plot: { x: 'edv', xLabel: 'EDV (mL)', yLabel: 'stroke volume (mL)', y: (v) => (v.ees * Math.max(0, v.edv - v.v0)) / (v.ees + v.r / (60 / v.hr)), series: [{ label: 'Ees halved', y: (v) => ((v.ees / 2) * Math.max(0, v.edv - v.v0)) / (v.ees / 2 + v.r / (60 / v.hr)) }] },
    pearls: ['This is the Frank–Starling curve drawn in the hemodynamics lab.', 'Optimal mechanical efficiency when Ea/Ees ≈ 0.5–1.'],
    link: { mode: 'hemo', id: 'hfref', label: 'PV loop in HFrEF' },
  },
  {
    id: 'edpvr', title: 'Diastolic pressure–volume relation (compliance)', group: 'Pressure–volume', level: 'clinician',
    tex: String.raw`P_{\text{ed}} = A\left(e^{B\,(V-V_0)}-1\right), \qquad C = \frac{dV}{dP} = \frac{1}{A B\, e^{B(V-V_0)}}`,
    explain: 'The relaxed ventricle stiffens exponentially as it fills. A stiff ventricle (high B: LVH, HFpEF, ischemia) needs high filling pressure for a normal volume → pulmonary congestion with normal EF.',
    vars: [
      { key: 'v', label: 'LV volume', min: 30, max: 220, step: 1, value: 125, unit: 'mL' },
      { key: 'b', label: 'Stiffness B', min: 0.015, max: 0.09, step: 0.001, value: 0.036, unit: '/mL' },
      { key: 'a', label: 'Scale A', min: 0.1, max: 1, step: 0.05, value: 0.3, unit: 'mmHg' },
    ],
    compute: (v) => {
      const p = v.a * (Math.exp(v.b * (v.v - 15)) - 1);
      return [
        { label: 'End-diastolic pressure', value: p, unit: 'mmHg', digits: 1, flag: p > 18 ? 'pulmonary congestion likely (PCWP > 18)' : undefined },
        { label: 'Compliance', value: 1 / (v.a * v.b * Math.exp(v.b * (v.v - 15))), unit: 'mL/mmHg', digits: 1 },
      ];
    },
    plot: { x: 'v', xLabel: 'LV volume (mL)', yLabel: 'pressure (mmHg)', y: (v) => v.a * (Math.exp(v.b * (v.v - 15)) - 1), series: [{ label: 'normal (B = 0.036)', y: (v) => v.a * (Math.exp(0.036 * (v.v - 15)) - 1) }], yMin: 0, yMax: 50 },
    pearls: ['The simulator uses this exact EDPVR for all four chambers.'],
    link: { mode: 'hemo', id: 'hfpef', label: 'See HFpEF' },
  },
  // ------------------------------------------------------------ valves & flow
  {
    id: 'bernoulli', title: 'Simplified Bernoulli and the continuity equation', group: 'Valves & flow', level: 'student',
    tex: String.raw`\Delta P = 4v^{2} \qquad A_{1}v_{1} = A_{2}v_{2} \;\Rightarrow\; \mathrm{AVA} = \frac{A_{\mathrm{LVOT}}\;v_{\mathrm{LVOT}}}{v_{\mathrm{AV}}}`,
    explain: 'Blood accelerates through a narrow orifice; the pressure drop is about 4 × velocity² (m/s → mmHg). Conservation of flow gives the valve area from LVOT size and the two velocities (Doppler echo).',
    vars: [
      { key: 'vav', label: 'Peak aortic jet velocity', min: 1, max: 6, step: 0.05, value: 4.5, unit: 'm/s' },
      { key: 'vlvot', label: 'LVOT velocity', min: 0.5, max: 1.6, step: 0.05, value: 1.0, unit: 'm/s' },
      { key: 'd', label: 'LVOT diameter', min: 1.6, max: 2.6, step: 0.05, value: 2.0, unit: 'cm' },
    ],
    compute: (v) => {
      const ava = (Math.PI * (v.d / 2) ** 2 * v.vlvot) / v.vav;
      return [
        { label: 'Peak gradient', value: 4 * v.vav ** 2, unit: 'mmHg', digits: 0 },
        { label: 'Aortic valve area', value: ava, unit: 'cm²', digits: 2, flag: ava < 1 ? 'severe AS (< 1.0 cm²)' : ava < 1.5 ? 'moderate AS' : undefined },
      ];
    },
    plot: { x: 'vav', xLabel: 'jet velocity (m/s)', yLabel: 'peak gradient (mmHg)', y: (v) => 4 * v.vav ** 2 },
    pearls: ['Severe AS: Vmax ≥ 4 m/s, mean gradient ≥ 40 mmHg, AVA < 1.0 cm².', 'Low-flow low-gradient AS: small area but low gradient because SV is low.', 'The simulator computes valve flow from the full orifice equation Q ∝ A√ΔP.'],
    link: { mode: 'hemo', id: 'aortic-stenosis', label: 'Simulate severe AS' },
  },
  {
    id: 'gorlin', title: 'Gorlin and Hakki formulas (cath lab valve area)', group: 'Valves & flow', level: 'clinician',
    tex: String.raw`\mathrm{AVA} = \frac{\mathrm{CO}/(\mathrm{HR}\times\mathrm{SEP})}{44.3\,\sqrt{\Delta P_{\text{mean}}}} \qquad \text{Hakki: } \mathrm{AVA}\approx\frac{\mathrm{CO}}{\sqrt{\Delta P_{\text{peak-to-peak}}}}`,
    explain: 'Valve area from flow and mean gradient measured invasively. SEP = systolic ejection period per beat. Flow appears in the numerator: at low output the gradient is low even for a tight valve.',
    vars: [
      { key: 'co', label: 'Cardiac output', min: 2, max: 8, step: 0.1, value: 4.5, unit: 'L/min' },
      { key: 'hr', label: 'Heart rate', min: 50, max: 120, step: 1, value: 75, unit: '/min' },
      { key: 'sep', label: 'Systolic ejection period', min: 0.2, max: 0.4, step: 0.01, value: 0.32, unit: 's/beat' },
      { key: 'dp', label: 'Mean gradient', min: 5, max: 100, step: 1, value: 45, unit: 'mmHg' },
    ],
    compute: (v) => [
      { label: 'AVA (Gorlin)', value: (v.co * 1000) / (v.hr * v.sep) / (44.3 * Math.sqrt(v.dp)), unit: 'cm²', digits: 2 },
      { label: 'AVA (Hakki approx.)', value: v.co / Math.sqrt(v.dp), unit: 'cm²', digits: 2 },
    ],
    plot: { x: 'dp', xLabel: 'mean gradient (mmHg)', yLabel: 'AVA (cm²)', y: (v) => (v.co * 1000) / (v.hr * v.sep) / (44.3 * Math.sqrt(v.dp)) },
    pearls: ['Gorlin constant is 44.3 for the aortic valve (37.7 used for the mitral valve).'],
  },
  {
    id: 'qpqs', title: 'Shunt fraction (Qp : Qs)', group: 'Valves & flow', level: 'clinician',
    tex: String.raw`\frac{Q_p}{Q_s} = \frac{S_{a}O_2 - S_{\bar v}O_2}{S_{pv}O_2 - S_{pa}O_2}`,
    explain: 'By the Fick principle, each circuit’s flow is inversely proportional to its O₂ saturation difference. A left-to-right shunt raises PA saturation (a "step-up").',
    vars: [
      { key: 'sa', label: 'Systemic arterial SaO₂', min: 70, max: 100, step: 1, value: 97, unit: '%' },
      { key: 'smv', label: 'Mixed venous (SVC) SO₂', min: 40, max: 85, step: 1, value: 70, unit: '%' },
      { key: 'spv', label: 'Pulmonary vein SO₂', min: 90, max: 100, step: 1, value: 98, unit: '%' },
      { key: 'spa', label: 'Pulmonary artery SO₂', min: 40, max: 95, step: 1, value: 84, unit: '%' },
    ],
    compute: (v) => [{ label: 'Qp : Qs', value: (v.sa - v.smv) / Math.max(0.5, v.spv - v.spa), digits: 2, flag: (v.sa - v.smv) / Math.max(0.5, v.spv - v.spa) > 1.5 ? 'significant left-to-right shunt (> 1.5)' : (v.sa - v.smv) / Math.max(0.5, v.spv - v.spa) < 1 ? 'net right-to-left shunt' : undefined }],
    pearls: ['Step-up between SVC and RA → ASD; RA → RV → VSD; RV → PA → PDA.'],
    link: { mode: 'hemo', id: 'vsd', label: 'Simulate a VSD' },
  },
  // ------------------------------------------------------------ oxygen
  {
    id: 'fick', title: 'Fick principle and oxygen content', group: 'Oxygen', level: 'student',
    tex: String.raw`\mathrm{CO} = \frac{\dot V_{O_2}}{(C_aO_2 - C_vO_2)\times 10}, \qquad C\,O_2 = 1.34\,\mathrm{Hb}\,S O_2 + 0.003\,P O_2`,
    explain: 'Oxygen consumed by the body equals the flow times the oxygen extracted. Low cardiac output forces more extraction, so mixed venous saturation (SvO₂) falls – a bedside marker of low output.',
    vars: [
      { key: 'vo2', label: 'O₂ consumption', min: 150, max: 1000, step: 10, value: 250, unit: 'mL/min' },
      { key: 'hb', label: 'Hemoglobin', min: 5, max: 20, step: 0.1, value: 14, unit: 'g/dL' },
      { key: 'sa', label: 'SaO₂', min: 70, max: 100, step: 1, value: 98, unit: '%' },
      { key: 'co', label: 'Cardiac output', min: 1, max: 12, step: 0.1, value: 5, unit: 'L/min' },
    ],
    compute: (v) => {
      const ca = 1.34 * v.hb * (v.sa / 100) + 0.003 * 95;
      const cv = ca - v.vo2 / (v.co * 10);
      const sv = Math.max(0, (cv - 0.003 * 40) / (1.34 * v.hb)) * 100;
      return [
        { label: 'CaO₂', value: ca, unit: 'mL O₂/dL', digits: 1 },
        { label: 'CvO₂', value: cv, unit: 'mL O₂/dL', digits: 1 },
        { label: 'SvO₂', value: sv, unit: '%', digits: 0, flag: sv < 60 ? 'low – inadequate delivery (low CO, anemia, hypoxemia)' : sv > 80 ? 'high – impaired extraction (sepsis) or shunt' : undefined },
        { label: 'O₂ delivery DO₂', value: v.co * ca * 10, unit: 'mL/min', digits: 0 },
      ];
    },
    plot: { x: 'co', xLabel: 'cardiac output (L/min)', yLabel: 'SvO₂ (%)', y: (v) => Math.max(0, ((1.34 * v.hb * (v.sa / 100) + 0.285 - v.vo2 / (v.co * 10)) - 0.12) / (1.34 * v.hb)) * 100, yMin: 0, yMax: 100 },
    pearls: ['The simulator computes SvO₂ from this relation for every beat (shock profiles).', 'Dissolved O₂ (0.003 × PO₂) is tiny except on hyperbaric oxygen.'],
    link: { mode: 'hemo', id: 'cardiogenic-shock', label: 'Low SvO₂ in cardiogenic shock' },
  },
  {
    id: 'starling-forces', title: 'Starling forces and pulmonary edema', group: 'Oxygen', level: 'student',
    tex: String.raw`J_v = K_f\left[(P_c - P_i) - \sigma(\pi_c - \pi_i)\right]`,
    explain: 'Fluid leaves capillaries when hydrostatic pressure outweighs the oncotic pull of plasma proteins. In the lung, capillary pressure ≈ PCWP; above ~18–20 mmHg filtration exceeds lymphatic clearance → edema.',
    vars: [
      { key: 'pc', label: 'Capillary pressure (≈ PCWP)', min: 4, max: 40, step: 1, value: 10, unit: 'mmHg' },
      { key: 'pi', label: 'Interstitial pressure', min: -8, max: 5, step: 1, value: -3, unit: 'mmHg' },
      { key: 'pic', label: 'Plasma oncotic pressure', min: 10, max: 30, step: 1, value: 25, unit: 'mmHg' },
      { key: 'pii', label: 'Interstitial oncotic pressure', min: 5, max: 20, step: 1, value: 14, unit: 'mmHg' },
      { key: 'sigma', label: 'Reflection coefficient σ', min: 0.2, max: 1, step: 0.05, value: 0.8 },
    ],
    compute: (v) => {
      const net = v.pc - v.pi - v.sigma * (v.pic - v.pii);
      return [{ label: 'Net filtration pressure', value: net, unit: 'mmHg', digits: 1, flag: net > 12 ? 'exceeds lymphatic reserve → pulmonary edema' : undefined }];
    },
    plot: { x: 'pc', xLabel: 'capillary pressure (mmHg)', yLabel: 'net filtration (mmHg)', y: (v) => v.pc - v.pi - v.sigma * (v.pic - v.pii), series: [{ label: 'leaky capillaries (σ 0.3, ARDS)', y: (v) => v.pc - v.pi - 0.3 * (v.pic - v.pii) }] },
    pearls: ['Cardiogenic edema: ↑ Pc. ARDS: ↓ σ (and ↑ Kf) at normal PCWP.', 'Hypoalbuminemia lowers πc → edema at lower pressures.'],
    link: { mode: 'hemo', id: 'mr-acute', label: 'High PCWP: acute MR' },
  },
  // ------------------------------------------------------------ electrophysiology
  {
    id: 'nernst', title: 'Nernst and Goldman: resting membrane potential', group: 'Electrophysiology', level: 'student',
    tex: String.raw`E_K = 61.5\,\log_{10}\frac{[K^+]_o}{[K^+]_i}, \qquad V_m = 61.5\log_{10}\frac{P_K[K^+]_o + P_{Na}[Na^+]_o + P_{Cl}[Cl^-]_i}{P_K[K^+]_i + P_{Na}[Na^+]_i + P_{Cl}[Cl^-]_o}`,
    explain: 'At rest the membrane is mostly permeable to K⁺ (IK1), so Vm sits near EK. Raising extracellular K⁺ makes the cell less negative (depolarised) → Na⁺ channels inactivate → slow conduction, wide QRS.',
    vars: [
      { key: 'ko', label: 'Extracellular K⁺', min: 2, max: 9, step: 0.1, value: 4.2, unit: 'mEq/L' },
      { key: 'ki', label: 'Intracellular K⁺', min: 120, max: 160, step: 1, value: 140, unit: 'mEq/L' },
      { key: 'pna', label: 'Relative Na⁺ permeability (P_Na/P_K)', min: 0.002, max: 0.1, step: 0.002, value: 0.01 },
    ],
    compute: (v) => {
      const ek = 61.5 * Math.log10(v.ko / v.ki);
      const vm = 61.5 * Math.log10((v.ko + v.pna * 140 + 0.05 * 10) / (v.ki + v.pna * 10 + 0.05 * 110));
      return [
        { label: 'EK', value: ek, unit: 'mV', digits: 1 },
        { label: 'Resting Vm (GHK)', value: vm, unit: 'mV', digits: 1, flag: vm > -80 ? 'depolarised → Na⁺ channel inactivation' : undefined },
      ];
    },
    plot: { x: 'ko', xLabel: 'extracellular K⁺ (mEq/L)', yLabel: 'mV', y: (v) => 61.5 * Math.log10(v.ko / v.ki), series: [{ label: 'resting Vm (GHK)', y: (v) => 61.5 * Math.log10((v.ko + v.pna * 140 + 0.05 * 10) / (v.ki + v.pna * 10 + 0.05 * 110)) }] },
    pearls: ['Paradox: hyperkalemia also increases IK conductance → faster repolarisation → peaked T waves.', 'The cellular model in the arrhythmia lab shifts its resting potential with K⁺ the same way.'],
    link: { mode: 'ecg', id: 'hyperkalemia', label: 'Hyperkalemia ECG stages' },
  },
  // ------------------------------------------------------------ ECG
  {
    id: 'qtc', title: 'QT correction for heart rate', group: 'ECG', level: 'student',
    tex: String.raw`\mathrm{QTc}_{\text{Bazett}} = \frac{\mathrm{QT}}{\sqrt{RR}}, \qquad \mathrm{QTc}_{\text{Fridericia}} = \frac{\mathrm{QT}}{\sqrt[3]{RR}}, \qquad \mathrm{QTc}_{\text{Framingham}} = \mathrm{QT} + 154\,(1-RR)`,
    explain: 'The QT shortens as heart rate rises, so it is corrected to a rate of 60/min (RR in seconds). Bazett over-corrects at fast rates and under-corrects at slow rates; Fridericia is preferred for drug monitoring.',
    vars: [
      { key: 'qt', label: 'Measured QT', min: 250, max: 600, step: 5, value: 380, unit: 'ms' },
      { key: 'hr', label: 'Heart rate', min: 40, max: 150, step: 1, value: 75, unit: '/min' },
    ],
    compute: (v) => {
      const rr = 60 / v.hr;
      const b = v.qt / Math.sqrt(rr);
      return [
        { label: 'RR', value: rr * 1000, unit: 'ms', digits: 0 },
        { label: 'QTc Bazett', value: b, unit: 'ms', digits: 0, flag: b > 470 ? 'prolonged' : undefined },
        { label: 'QTc Fridericia', value: v.qt / Math.cbrt(rr), unit: 'ms', digits: 0 },
        { label: 'QTc Framingham', value: v.qt + 154 * (1 - rr), unit: 'ms', digits: 0 },
      ];
    },
    plot: { x: 'hr', xLabel: 'heart rate (/min)', yLabel: 'QTc (ms) for this QT', y: (v) => v.qt / Math.sqrt(60 / v.hr), series: [{ label: 'Fridericia', y: (v) => v.qt / Math.cbrt(60 / v.hr) }, { label: 'Framingham', y: (v) => v.qt + 154 * (1 - 60 / v.hr) }] },
    pearls: ['QTc > 500 ms → high torsades risk.', 'The ECG engine uses a Fridericia-type restitution to set QT from RR.'],
    link: { mode: 'ecg', id: 'long-qt', label: 'Long QT ECG' },
  },
  {
    id: 'axis', title: 'Einthoven’s law and the QRS axis', group: 'ECG', level: 'student',
    tex: String.raw`\mathrm{II} = \mathrm{I} + \mathrm{III}, \quad \mathrm{aVF} = \tfrac{\mathrm{II}+\mathrm{III}}{2}, \quad \theta = \operatorname{atan2}\!\left(\tfrac{2}{\sqrt3}\,\mathrm{aVF},\; \mathrm{I}\right)`,
    explain: 'The frontal-plane leads are projections of one vector. Lead I points to 0°, aVF to +90°; because aVF is derived from II and III its gain is √3/2 of lead I, hence the 2/√3 factor.',
    vars: [
      { key: 'i', label: 'Net QRS in lead I', min: -1.5, max: 1.5, step: 0.05, value: 0.6, unit: 'mV' },
      { key: 'avf', label: 'Net QRS in aVF', min: -1.5, max: 1.5, step: 0.05, value: 0.5, unit: 'mV' },
    ],
    compute: (v) => {
      const th = deg(Math.atan2((2 / Math.sqrt(3)) * v.avf, v.i));
      const cat = th >= -30 && th <= 90 ? 'normal' : th < -30 && th >= -90 ? 'left axis deviation' : th > 90 && th <= 180 ? 'right axis deviation' : 'extreme axis';
      const ii = v.i / 2 + v.avf * (2 / Math.sqrt(3)) * (Math.sqrt(3) / 2);
      return [
        { label: 'QRS axis', value: th, unit: '°', digits: 0, flag: cat },
        { label: 'Lead II (= I + III)', value: ii, unit: 'mV', digits: 2 },
        { label: 'Lead III', value: ii - v.i, unit: 'mV', digits: 2 },
      ];
    },
    pearls: ['aVR + aVL + aVF = 0 at every instant.', 'Try it on real tracings in ECG lab → Axis practice.'],
    link: { mode: 'ecg', id: 'axis-left', label: 'Left axis deviation' },
  },
  {
    id: 'rate', title: 'Heart rate from the ECG', group: 'ECG', level: 'student',
    tex: String.raw`\mathrm{HR} = \frac{300}{\#\text{large boxes}} = \frac{1500}{\#\text{small boxes}} \quad (25\ \text{mm/s})`,
    explain: 'At 25 mm/s one large box is 0.2 s and one small box 0.04 s, so 300 large boxes fit in a minute.',
    vars: [{ key: 'boxes', label: 'Large boxes between R waves', min: 1, max: 10, step: 0.1, value: 4, unit: '' }],
    compute: (v) => [{ label: 'Heart rate', value: 300 / v.boxes, unit: '/min', digits: 0 }],
    plot: { x: 'boxes', xLabel: 'large boxes between R waves', yLabel: 'rate (/min)', y: (v) => 300 / v.boxes },
    pearls: ['Irregular rhythms: count QRS complexes in 6 s (30 large boxes) × 10.'],
  },
  {
    id: 'cpp', title: 'Coronary perfusion pressure', group: 'Oxygen', level: 'student',
    tex: String.raw`\mathrm{CPP} = \mathrm{DBP} - \mathrm{LVEDP}`,
    explain: 'The LV is perfused mainly in diastole, driven by aortic diastolic pressure against the pressure in the LV wall. Low DBP or high LVEDP (and tachycardia, which shortens diastole) cause subendocardial ischemia.',
    vars: [
      { key: 'dbp', label: 'Aortic diastolic pressure', min: 30, max: 110, step: 1, value: 75, unit: 'mmHg' },
      { key: 'lvedp', label: 'LVEDP', min: 2, max: 40, step: 1, value: 10, unit: 'mmHg' },
    ],
    compute: (v) => [{ label: 'CPP', value: v.dbp - v.lvedp, unit: 'mmHg', digits: 0, flag: v.dbp - v.lvedp < 50 ? 'low – subendocardial ischemia risk' : undefined }],
    pearls: ['An intra-aortic balloon pump inflates in diastole to raise DBP → ↑ CPP.', 'AR lowers DBP and raises LVEDP – a double hit on coronary perfusion.'],
    link: { mode: 'hemo', id: 'aortic-regurgitation', label: 'AR: low DBP' },
  },
];

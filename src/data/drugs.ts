import type { DrugInfo } from './types';

/** Antiarrhythmic drugs (Vaughan Williams) and related agents. Mechanism level only – no dosing. */
export const DRUGS: DrugInfo[] = [
  { id: 'class1a', name: 'Class Ia (Na⁺ channel blockers, intermediate)', examples: 'Quinidine, procainamide, disopyramide',
    mechanism: 'Block fast Na⁺ channels (moderate) and K⁺ channels.', apEffect: '↓ phase 0 slope, ↑ action potential duration and effective refractory period.',
    ecgEffect: '↑ QRS and ↑ QT.', uses: 'Atrial and ventricular arrhythmias; procainamide for WPW with AF.', toxicity: 'Torsades (long QT); quinidine cinchonism; procainamide drug-induced lupus.' },
  { id: 'class1b', name: 'Class Ib (Na⁺ channel blockers, fast)', examples: 'Lidocaine, mexiletine',
    mechanism: 'Block Na⁺ channels preferentially in depolarised/ischemic tissue; fast on–off kinetics.', apEffect: '↓ action potential duration in normal tissue; little effect on phase 0 at normal rates.',
    ecgEffect: 'Minimal change (QT may shorten slightly).', uses: 'Ventricular arrhythmias, especially post-MI/ischemic.', toxicity: 'CNS stimulation/depression (seizures), cardiovascular depression.' },
  { id: 'class1c', name: 'Class Ic (Na⁺ channel blockers, slow)', examples: 'Flecainide, propafenone',
    mechanism: 'Strong Na⁺ channel block with slow dissociation.', apEffect: 'Marked ↓ phase 0 slope; no change in action potential duration.',
    ecgEffect: '↑ QRS (QT ↑ only from the wider QRS).', uses: 'SVT/AF in structurally normal hearts.', toxicity: 'Proarrhythmic; contraindicated after MI or structural heart disease (CAST trial).' },
  { id: 'class2', name: 'Class II (β-blockers)', examples: 'Metoprolol, esmolol, propranolol, atenolol',
    mechanism: 'Block β1 → ↓ cAMP → ↓ If and ICa in nodal tissue.', apEffect: '↓ slope of phase 4 in the SA node; ↑ AV nodal refractory period.',
    ecgEffect: '↓ heart rate, ↑ PR interval.', uses: 'Rate control (AF/flutter), SVT, post-MI, ventricular rate control.', toxicity: 'Bradycardia, AV block, bronchospasm, masks hypoglycemia. Overdose: glucagon.' },
  { id: 'class3', name: 'Class III (K⁺ channel blockers)', examples: 'Amiodarone, sotalol, dofetilide, ibutilide',
    mechanism: 'Block IKr (delayed rectifier).', apEffect: '↑ action potential duration and effective refractory period (phase 3 prolonged).',
    ecgEffect: '↑ QT.', uses: 'AF, VT. Amiodarone has class I–IV effects.', toxicity: 'Torsades (sotalol, dofetilide, ibutilide). Amiodarone: pulmonary fibrosis, thyroid and liver dysfunction, corneal deposits, blue-grey skin.' },
  { id: 'class4', name: 'Class IV (non-dihydropyridine Ca²⁺ channel blockers)', examples: 'Verapamil, diltiazem',
    mechanism: 'Block L-type Ca²⁺ channels in nodal tissue.', apEffect: '↓ phase 0 slope and conduction velocity in the AV node; ↑ AV nodal ERP; ↓ SA rate.',
    ecgEffect: '↑ PR, ↓ heart rate.', uses: 'Rate control, SVT.', toxicity: 'Bradycardia, AV block, hypotension, constipation (verapamil). Avoid in WPW with AF and in HFrEF.' },
  { id: 'digoxin', name: 'Digoxin', examples: 'Digoxin',
    mechanism: 'Inhibits Na⁺/K⁺-ATPase → ↑ intracellular Ca²⁺ (positive inotropy) and ↑ vagal tone.', apEffect: 'Shortens ventricular action potential; ↓ AV nodal conduction (vagal).',
    ecgEffect: '"Scooped" (sagging) ST depression, short QT, flattened/inverted T, ↑ PR. Toxicity: almost any arrhythmia (classically atrial tachycardia with block, bidirectional VT).', uses: 'HFrEF symptoms, AF rate control.', toxicity: 'Nausea, yellow vision; hyperkalemia; worsened by hypokalemia, renal failure, verapamil/amiodarone/quinidine. Antidote: digoxin immune Fab.' },
  { id: 'adenosine', name: 'Adenosine', examples: 'Adenosine',
    mechanism: 'A1 receptor → opens IK-ACh/Ado K⁺ channels and ↓ ICa in the AV node → hyperpolarisation and transient AV block (seconds).', apEffect: 'Hyperpolarises nodal cells; very short half-life.',
    ecgEffect: 'Transient high-grade AV block; terminates AV-node-dependent SVT (AVNRT, AVRT); unmasks flutter waves.', uses: 'Diagnosis and termination of PSVT.', toxicity: 'Flushing, chest pain, sense of doom, bronchospasm. Effect blocked by theophylline/caffeine; enhanced by dipyridamole.' },
  { id: 'atropine', name: 'Atropine', examples: 'Atropine',
    mechanism: 'Muscarinic antagonist → removes vagal tone.', apEffect: '↑ SA node rate; ↑ AV nodal conduction.',
    ecgEffect: '↑ heart rate, ↓ PR. Helps nodal block (Mobitz I); does not help (may worsen) infranodal block.', uses: 'Symptomatic sinus bradycardia, nodal AV block.', toxicity: 'Anticholinergic effects.' },
  { id: 'magnesium', name: 'Magnesium sulfate', examples: 'IV magnesium',
    mechanism: 'Stabilises membranes and suppresses early afterdepolarisations (triggered activity).', apEffect: 'Suppresses EADs without necessarily shortening QT.',
    ecgEffect: 'Terminates/prevents torsades de pointes.', uses: 'Torsades de pointes; digoxin toxicity arrhythmias.', toxicity: 'Hypotension, loss of reflexes at high levels.' },
];

export const ELECTROLYTE_INFO = {
  k: { normal: 4.2, unit: 'mEq/L', range: [2.0, 9.0] as [number, number], label: 'Potassium' },
  ca: { normal: 9.5, unit: 'mg/dL', range: [5.5, 15] as [number, number], label: 'Calcium' },
  mg: { normal: 2.0, unit: 'mg/dL', range: [0.8, 4] as [number, number], label: 'Magnesium' },
};

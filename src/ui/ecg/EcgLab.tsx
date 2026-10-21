import { lazy, Suspense, useMemo, useState } from 'react';
import { CONDITIONS, conditionById } from '../../data/conditions';
import type { EcgCondition } from '../../data/types';
import { generateEcg } from '../../engine/electrical';
import { interpret } from '../../engine/electrical/interpret';
import { useApp } from '../../store/app';
import { LevelBadge, Pearls, Reveal, Tabs, Toggle } from '../common/controls';
import EcgPaper, { LEADS_FOR_LAYOUT, type EcgLayout } from './EcgPaper';
import { FindingsList, IntervalTable } from './Findings';

const VectorLab = lazy(() => import('./VectorLab'));
const LeadBuilder = lazy(() => import('./LeadBuilder'));
const AxisPractice = lazy(() => import('./AxisPractice'));

type View = 'library' | 'vector' | 'builder' | 'axis';
const CATEGORY_LABEL: Record<EcgCondition['category'], string> = {
  normal: 'Normal', axis: 'Axis', conduction: 'Conduction', ischemia: 'Ischemia & infarction', hypertrophy: 'Hypertrophy & atria',
  pericardial: 'Pericardial', electrolyte: 'Electrolytes', drug: 'Drugs & QT', other: 'Other patterns', artefact: 'Teaching artefacts',
};

export default function EcgLab() {
  const [view, setView] = useState<View>('library');
  return (
    <div className="stack">
      <div className="row">
        <h2 style={{ margin: 0 }}>ECG lab</h2>
        <Tabs<View> label="ECG lab views" value={view} onChange={setView} tabs={[
          { id: 'library', label: 'Condition library' },
          { id: 'vector', label: 'Vector lab' },
          { id: 'builder', label: 'Lead builder (torso)' },
          { id: 'axis', label: 'Axis practice' },
        ]} />
      </div>
      <Suspense fallback={<div className="panel">Loading…</div>}>
        {view === 'library' && <Library />}
        {view === 'vector' && <VectorLab />}
        {view === 'builder' && <LeadBuilder />}
        {view === 'axis' && <AxisPractice />}
      </Suspense>
    </div>
  );
}

function Library() {
  const { conditionId, stageId, level, openCondition } = useApp();
  const cond = conditionById(conditionId) ?? CONDITIONS[0];
  const stage = cond.stages?.find((s) => s.id === stageId) ?? null;
  const [layout, setLayout] = useState<EcgLayout>('3x4');
  const [gain, setGain] = useState(10);
  const [speed, setSpeed] = useState(25);
  const [calipers, setCalipers] = useState(false);
  const [ruler, setRuler] = useState(false);
  const [compare, setCompare] = useState(false);
  const model = stage?.model ?? cond.model;
  const leads = LEADS_FOR_LAYOUT[layout];
  const gen = useMemo(() => generateEcg(model, { leads: [...new Set([...leads, 'V4R', 'V7', 'V8', 'V9', 'V5R', 'V6R'])] as typeof leads, durationMs: 11000 }), [model, leads]);
  const normal = useMemo(() => (compare ? generateEcg({}, { leads, durationMs: 11000 }) : null), [compare, leads]);
  const findings = useMemo(() => (gen.measure ? interpret(gen.measure, gen.ecg, gen.resolved.hr) : []), [gen]);
  const groups = useMemo(() => {
    const g = new Map<string, EcgCondition[]>();
    for (const c of CONDITIONS) {
      if (c.level === 'clinician' && level === 'student') continue;
      const k = CATEGORY_LABEL[c.category];
      if (!g.has(k)) g.set(k, []);
      g.get(k)!.push(c);
    }
    return [...g.entries()];
  }, [level]);
  const hl = useMemo(() => [...new Set(findings.flatMap((f) => (f.category === 'ischemia' ? f.leads ?? [] : [])))], [findings]);

  return (
    <div className="grid cols-sidebar">
      <aside className="panel no-print" aria-label="Condition library">
        <h3>Conditions</h3>
        <ul className="list">
          {groups.map(([g, list]) => (
            <li key={g}>
              <div className="group">{g}</div>
              {list.map((c) => (
                <button key={c.id} aria-current={c.id === cond.id} onClick={() => openCondition(c.id, null)}>
                  <span style={{ flex: 1 }}>{c.name}</span>
                  {c.level === 'clinician' && <span className="badge">C</span>}
                </button>
              ))}
            </li>
          ))}
        </ul>
        {level === 'student' && <p className="note">Switch to <strong>Clinician</strong> (top right) for Sgarbossa, Wellens, de Winter, Brugada and more.</p>}
      </aside>
      <section className="stack">
        <div className="panel print-me">
          <div className="panel-title">
            <h2>{cond.name}{stage ? ` – ${stage.label}` : ''}</h2>
            <LevelBadge level={cond.level} />
            <span className="spacer" />
            <span className="muted small no-print">25 mm/s · 10 mm/mV unless changed</span>
          </div>
          {cond.stages && (
            <div className="chips no-print" style={{ marginBottom: 8 }} role="group" aria-label="Stages">
              <button className="chip" aria-pressed={!stage} onClick={() => openCondition(cond.id, null)}>Default</button>
              {cond.stages.map((s) => (
                <button key={s.id} className="chip" aria-pressed={stage?.id === s.id} onClick={() => openCondition(cond.id, s.id)} title={s.description}>{s.label}</button>
              ))}
            </div>
          )}
          <div className="row no-print" style={{ marginBottom: 8 }}>
            <label className="field">Layout
              <select value={layout} onChange={(e) => setLayout(e.target.value as EcgLayout)}>
                <option value="3x4">12-lead 3×4 + II rhythm</option>
                <option value="6x2">12-lead 6×2</option>
                <option value="15">15-lead (+V4R, V8, V9)</option>
                <option value="18">18-lead (+V4R–V6R, V7–V9)</option>
              </select>
            </label>
            <label className="field">Gain
              <select value={gain} onChange={(e) => setGain(Number(e.target.value))}>
                <option value={5}>5 mm/mV</option><option value={10}>10 mm/mV</option><option value={20}>20 mm/mV</option>
              </select>
            </label>
            <label className="field">Speed
              <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
                <option value={25}>25 mm/s</option><option value={50}>50 mm/s</option>
              </select>
            </label>
            <Toggle label="Calipers" value={calipers} onChange={setCalipers} title="Drag on the ECG to measure an interval" />
            <Toggle label="Rate ruler" value={ruler} onChange={setRuler} title="300-150-100 markers and the 6-second method" />
            <Toggle label="Compare with normal" value={compare} onChange={setCompare} />
            <button className="btn small" onClick={() => window.print()}>Print / PDF</button>
          </div>
          <EcgPaper ecg={gen.ecg} layout={layout} gain={gain} speed={speed} calipers={calipers} rateRuler={ruler} startMs={500} durationMs={speed === 50 ? 5000 : 10000} highlightLeads={hl} ariaLabel={`${cond.name} ECG`} />
          {normal && (
            <>
              <h3 style={{ marginTop: 12 }}>Normal ECG for comparison</h3>
              <EcgPaper ecg={normal.ecg} layout={layout} gain={gain} speed={speed} startMs={500} durationMs={speed === 50 ? 5000 : 10000} ariaLabel="Normal ECG" />
            </>
          )}
          <p className="note">Leads involved in ST/T or Q-wave findings are drawn in red. Typical textbook pattern – real ECGs vary.</p>
        </div>
        <div className="grid cols-2">
          <div className="panel">
            <h3>Interpretation (engine-measured)</h3>
            <FindingsList findings={findings} />
            {gen.measure && <><h3 style={{ marginTop: 10 }}>Measurements</h3><IntervalTable m={gen.measure} hr={gen.resolved.hr} /></>}
          </div>
          <ConditionInfo cond={cond} level={level} />
        </div>
      </section>
    </div>
  );
}

export function ConditionInfo({ cond, level }: { cond: EcgCondition; level: string }) {
  const openPreset = useApp((s) => s.openPreset);
  return (
    <div className="panel">
      <h3>Mechanism</h3>
      <p>{cond.mechanism}</p>
      <Reveal>
        <h3>Expected findings</h3>
        <table className="table"><tbody>
          {cond.findings.map((f, i) => <tr key={i}><th style={{ width: '32%' }}>{f.leads}</th><td>{f.finding}</td></tr>)}
        </tbody></table>
        {cond.criteria.length > 0 && <><h3 style={{ marginTop: 10 }}>Criteria</h3><ul className="pearls">{cond.criteria.map((c, i) => <li key={i}>{c}</li>)}</ul></>}
      </Reveal>
      {cond.mimics.length > 0 && <><h3 style={{ marginTop: 10 }}>Mimics</h3><p>{cond.mimics.join(' · ')}</p></>}
      <Pearls items={cond.pearls} />
      {level === 'clinician' && cond.clinicianPearls && <Pearls items={cond.clinicianPearls} title="Clinician notes" />}
      {cond.hemoPreset && <button className="btn small" onClick={() => openPreset(cond.hemoPreset!)}>Open the hemodynamics of this condition →</button>}
      <p className="note">Source type: {cond.references}</p>
    </div>
  );
}

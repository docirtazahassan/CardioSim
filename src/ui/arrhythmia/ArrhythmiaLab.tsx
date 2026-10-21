import { useEffect, useMemo, useState } from 'react';
import { DRUGS, ELECTROLYTE_INFO } from '../../data/drugs';
import { RHYTHMS, rhythmById } from '../../data/rhythms';
import type { DrugId, EcgModel, Rhythm, VentricularRegionId } from '../../data/types';
import { pacemakerAP, ventricularAP } from '../../engine/cellular/ap';
import { ecgModifiersFrom } from '../../engine/cellular/modifiers';
import { generateRhythmEcg } from '../../engine/electrical';
import { interpret } from '../../engine/electrical/interpret';
import { paramsFor } from '../../engine/hemo/params';
import { HemoSimulator } from '../../engine/hemo/simulator';
import { useApp } from '../../store/app';
import Chart from '../common/Chart';
import { LevelBadge, Pearls, Reveal, Slider, Tabs, Toggle } from '../common/controls';
import EcgPaper from '../ecg/EcgPaper';
import { FindingsList } from '../ecg/Findings';
import Ladder from './Ladder';

const GROUP_LABEL: Record<Rhythm['group'], string> = {
  sinus: 'Sinus node', 'av-block': 'AV block', atrial: 'Atrial', svt: 'Re-entrant SVT & WPW', junctional: 'Junctional',
  ectopy: 'Ectopic beats', ventricular: 'Ventricular', arrest: 'Cardiac arrest rhythms',
};
const DURATION = 10000;
const DRUG_BUTTONS: DrugId[] = ['class1a', 'class1b', 'class1c', 'class2', 'class3', 'class4', 'digoxin', 'atropine', 'magnesium'];
const MECH_TEXT: Record<Rhythm['mechanism'], string> = {
  normal: 'Normal impulse formation', automaticity: 'Altered automaticity', triggered: 'Triggered activity (after-depolarisations)',
  're-entry': 'Re-entry', 'conduction-block': 'Conduction block', none: 'No organised activity',
};

export default function ArrhythmiaLab() {
  const { rhythmId, level, openRhythm } = useApp();
  const rhythm = rhythmById(rhythmId) ?? RHYTHMS[0];
  const [drugs, setDrugs] = useState<DrugId[]>([]);
  const [k, setK] = useState(ELECTROLYTE_INFO.k.normal);
  const [ca, setCa] = useState(ELECTROLYTE_INFO.ca.normal);
  const [adenosineAt, setAdenosineAt] = useState<number | null>(null);
  const [triggers, setTriggers] = useState<Array<{ t: number; type: 'pac' | 'pvc'; origin?: VentricularRegionId }>>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [showV1, setShowV1] = useState(true);
  const [ruler, setRuler] = useState(false);
  const [seed, setSeed] = useState(1);
  const [apView, setApView] = useState<'ventricular' | 'pacemaker'>('ventricular');

  useEffect(() => { setTriggers([]); setAdenosineAt(null); setCursor(null); }, [rhythmId]);

  const base: EcgModel = useMemo(() => ({ drugs, electrolytes: { k, ca } }), [drugs, k, ca]);
  const gen = useMemo(() => generateRhythmEcg(rhythm.id, base, {
    durationMs: DURATION + 600, leads: ['I', 'II', 'III', 'aVR', 'aVL', 'aVF', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6'], seed,
    drugEvents: adenosineAt != null ? [{ t: adenosineAt, drug: 'adenosine' }] : [], triggers,
  }), [rhythm.id, base, adenosineAt, triggers, seed]);
  const findings = useMemo(() => (gen.measure ? interpret(gen.measure, gen.ecg, gen.resolved.hr).filter((f) => f.category !== 'ischemia') : []), [gen]);
  const mods = useMemo(() => ecgModifiersFrom({ drugs, k, ca }), [drugs, k, ca]);

  // Beat-aligned arterial pressure: drive the circulation with this exact beat sequence (two passes; show the second).
  const [pressure, setPressure] = useState<{ t: number[]; ao: number[]; lv: number[]; sbp: number; dbp: number; co: number } | null>(null);
  useEffect(() => {
    setPressure(null);
    const id = window.setTimeout(() => {
      const r = gen.ecg.rhythm;
      const sim = new HemoSimulator({ ...paramsFor('normal-hemo'), rhythm: rhythm.id, baroreflex: true }, { schedule: { atrial: r.atrial, ventricular: r.ventricular, duration: DURATION }, sampleEvery: 8 });
      sim.advance(DURATION / 1000);
      const t0 = sim.t;
      const beats0 = sim.beats.length;
      sim.advance(DURATION / 1000);
      const t: number[] = [], ao: number[] = [], lv: number[] = [];
      for (const s of sim.samples) if (s.t >= t0) { t.push((s.t - t0) * 1000); ao.push(s.pAo); lv.push(s.pLV); }
      const b = sim.beats.slice(beats0);
      const sbp = b.length ? b.reduce((a, x) => a + x.sbp, 0) / b.length : Math.max(...ao);
      const dbp = b.length ? b.reduce((a, x) => a + x.dbp, 0) / b.length : Math.min(...ao);
      const svTot = b.reduce((a, x) => a + Math.max(0, x.svNet), 0);
      setPressure({ t, ao, lv, sbp, dbp, co: (svTot / DURATION) * 60 });
    }, 30);
    return () => window.clearTimeout(id);
  }, [gen, rhythm.id]);

  const groups = useMemo(() => {
    const g = new Map<string, Rhythm[]>();
    for (const r of RHYTHMS) {
      if (r.level === 'clinician' && level === 'student') continue;
      const key = GROUP_LABEL[r.group];
      if (!g.has(key)) g.set(key, []);
      g.get(key)!.push(r);
    }
    return [...g.entries()];
  }, [level]);

  const at = cursor ?? 5000;
  const toggleDrug = (d: DrugId) => setDrugs((x) => (x.includes(d) ? x.filter((y) => y !== d) : [...x, d]));
  const ap = useMemo(() => (apView === 'ventricular' ? ventricularAP({ drugs, k, ca }) : pacemakerAP({ drugs: adenosineAt != null ? [...drugs, 'adenosine'] : drugs, k, ca })), [apView, drugs, k, ca, adenosineAt]);
  const apNormal = useMemo(() => (apView === 'ventricular' ? ventricularAP({}) : pacemakerAP({})), [apView]);

  return (
    <div className="grid cols-sidebar">
      <aside className="panel no-print" aria-label="Rhythm library">
        <h3>Rhythms</h3>
        <ul className="list">
          {groups.map(([g, list]) => (
            <li key={g}>
              <div className="group">{g}</div>
              {list.map((r) => (
                <button key={r.id} aria-current={r.id === rhythm.id} onClick={() => openRhythm(r.id)}>
                  <span style={{ flex: 1 }}>{r.name}</span>
                  {r.level === 'clinician' && <span className="badge">C</span>}
                </button>
              ))}
            </li>
          ))}
        </ul>
      </aside>
      <section className="stack">
        <div className="panel">
          <div className="panel-title">
            <h2>{rhythm.name}</h2>
            <LevelBadge level={rhythm.level} />
            <span className="badge">{MECH_TEXT[rhythm.mechanism]}</span>
            <span className="spacer" />
            <Toggle label="Show V1" value={showV1} onChange={setShowV1} />
            <Toggle label="Rate ruler" value={ruler} onChange={setRuler} />
            <button className="btn small" onClick={() => setSeed((s) => s + 1)} title="Run another 10-second sample">New strip</button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <EcgPaper ecg={gen.ecg} layout="strip" stripLeads={showV1 ? ['II', 'V1'] : ['II']} startMs={0} durationMs={DURATION} cursorMs={cursor} rateRuler={ruler} ariaLabel={`${rhythm.name} rhythm strip`} />
            <Ladder rhythm={gen.ecg.rhythm} startMs={0} durationMs={DURATION} cursorMs={cursor} onPick={setCursor} />
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <span className="small muted">Click the ladder to place the cursor ({Math.round(at)} ms), then:</span>
            <button className="btn small" onClick={() => setTriggers((x) => [...x, { t: at, type: 'pac' }])}>Insert PAC</button>
            <button className="btn small" onClick={() => setTriggers((x) => [...x, { t: at, type: 'pvc', origin: 'seg10' }])}>Insert PVC (LV)</button>
            <button className="btn small" onClick={() => setTriggers((x) => [...x, { t: at, type: 'pvc', origin: 'rvot' }])}>Insert PVC (RVOT)</button>
            <button className="btn small" onClick={() => setAdenosineAt(at)} title="Transient AV nodal block (IK-ACh opening)">Give adenosine here</button>
            {(triggers.length > 0 || adenosineAt != null) && <button className="btn small" onClick={() => { setTriggers([]); setAdenosineAt(null); }}>Clear</button>}
          </div>
          {gen.ecg.rhythm.notes.length > 0 && <p className="note">{gen.ecg.rhythm.notes.join(' ')}</p>}
        </div>

        <div className="grid cols-2">
          <div className="panel">
            <h3>Mechanism & conduction</h3>
            <p>{rhythm.mechanismText}</p>
            <p className="small"><strong>Conduction:</strong> {rhythm.conduction}</p>
            <Reveal>
              <h3>ECG criteria</h3>
              <ul className="pearls">{rhythm.ecgCriteria.map((c, i) => <li key={i}>{c}</li>)}</ul>
              <h3 style={{ marginTop: 8 }}>Engine-measured</h3>
              <FindingsList findings={findings} />
            </Reveal>
          </div>
          <div className="panel">
            <h3>Hemodynamic consequence</h3>
            <p>{rhythm.hemodynamics}</p>
            {pressure ? (
              <>
                <Chart height={170} xDomain={[0, DURATION]} yDomain={[0, 160]} xLabel="time (ms) – aligned with the strip above" yLabel="mmHg"
                  series={[{ label: 'Aortic', x: pressure.t, y: pressure.ao, color: 'var(--c-vermillion)' }, { label: 'LV', x: pressure.t, y: pressure.lv, color: 'var(--c-blue)', width: 1.2 }]}
                  vmarks={cursor != null ? [{ x: cursor, color: 'var(--c-orange)' }] : []} formatX={(x) => `${Math.round(x)}`} />
                <p className="small">Average BP over the strip <strong className="mono">{Math.round(pressure.sbp)}/{Math.round(pressure.dbp)}</strong> mmHg · cardiac output ≈ <strong className="mono">{pressure.co.toFixed(1)}</strong> L/min (otherwise normal heart, baroreflex on). Watch the pulse after a short RR (less filling) and after a pause (more filling). Model limitation: output rises with rate more than in real hearts, so treat tachycardia numbers as qualitative.</p>
              </>
            ) : <p className="muted small">Simulating circulation…</p>}
          </div>
        </div>

        <div className="grid cols-2">
          <div className="panel">
            <h3>Drugs & electrolytes (mechanism level)</h3>
            <div className="chips" role="group" aria-label="Drugs">
              {DRUG_BUTTONS.map((d) => {
                const info = DRUGS.find((x) => x.id === d)!;
                return <button key={d} className="chip" aria-pressed={drugs.includes(d)} onClick={() => toggleDrug(d)} title={`${info.mechanism} ${info.ecgEffect}`}>{info.name.split(' (')[0]}</button>;
              })}
            </div>
            <div className="grid cols-2" style={{ marginTop: 8 }}>
              <Slider label="Potassium" value={k} min={2} max={9} step={0.1} unit=" mEq/L" onChange={setK} />
              <Slider label="Calcium" value={ca} min={6} max={14} step={0.1} unit=" mg/dL" onChange={setCa} />
            </div>
            {drugs.length > 0 && (
              <table className="table" style={{ marginTop: 8 }}><tbody>
                {drugs.map((d) => {
                  const info = DRUGS.find((x) => x.id === d)!;
                  return <tr key={d}><th style={{ width: '30%' }}>{info.name}</th><td>{info.mechanism} <em>AP:</em> {info.apEffect} <em>ECG:</em> {info.ecgEffect}</td></tr>;
                })}
              </tbody></table>
            )}
            {mods.notes.length > 0 && <ul className="pearls small" style={{ marginTop: 6 }}>{mods.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>}
            <h3 style={{ marginTop: 10 }}>Management principles</h3>
            <ul className="pearls">{rhythm.management.map((m, i) => <li key={i}>{m}</li>)}</ul>
            <Pearls items={rhythm.pearls} />
            <p className="note">Mechanism and drug class only – no doses. Source type: {rhythm.references}</p>
          </div>
          <div className="panel">
            <div className="panel-title">
              <h3>Action potential</h3>
              <span className="spacer" />
              <Tabs<'ventricular' | 'pacemaker'> label="Cell type" value={apView} onChange={setApView} tabs={[{ id: 'ventricular', label: 'Ventricular myocyte' }, { id: 'pacemaker', label: 'SA node' }]} />
            </div>
            <Chart height={190} xLabel="ms" yLabel="mV" yDomain={[-100, 50]}
              series={[
                { label: 'Normal', x: apNormal.t, y: apNormal.vm, color: 'var(--muted)', dash: '4 3', width: 1.4 },
                { label: 'Current settings', x: ap.t, y: ap.vm, color: 'var(--c-blue)' },
              ]}
              bands={apView === 'ventricular' ? ap.phases.map((p) => ({ x0: p.start, x1: p.end, label: p.end - p.start >= 30 ? `phase ${p.phase}` : undefined, fill: Number(p.phase) % 2 ? 'var(--panel-2)' : 'transparent' })) : []} />
            <Chart height={170} xLabel="ms" yLabel="relative current (outward +)" crosshair yDomain={apView === 'ventricular' ? [-7, 7] : undefined}
              series={Object.entries(ap.currents).map(([name, y], i) => ({ label: name, x: ap.t, y, color: ['var(--c-blue)', 'var(--c-orange)', 'var(--c-green)', 'var(--c-vermillion)', 'var(--c-purple)', 'var(--c-sky)'][i % 6], width: 1.5 }))} />
            {apView === 'ventricular' && <p className="small muted">INa (phase 0) is ~20× larger than the other currents and is clipped at the bottom of this plot.</p>}
            <dl className="kv">
              <dt>APD90</dt><dd>{Math.round(ap.apd90)} ms (normal {Math.round(apNormal.apd90)})</dd>
              <dt>Resting / max diastolic</dt><dd>{Math.round(ap.rest)} mV</dd>
              <dt>Upstroke (dV/dt max)</dt><dd>{Math.round(ap.vmax)} V/s</dd>
              {ap.rate !== undefined && <><dt>Firing rate</dt><dd>{Math.round(ap.rate)} /min</dd></>}
              {ap.ead && <><dt>Warning</dt><dd>Early after-depolarisation risk (torsades substrate)</dd></>}
            </dl>
            <p className="note">Phenomenological teaching model: each phase is shaped by the current that dominates it, so a drug or electrolyte that changes a current changes the matching phase – and the ECG above.</p>
          </div>
        </div>
      </section>
    </div>
  );
}

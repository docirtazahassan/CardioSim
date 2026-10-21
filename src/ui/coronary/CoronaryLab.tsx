import { lazy, Suspense, useMemo, useState } from 'react';
import { ARTERIES, DOMINANCE_INFO, MI_TIMELINE, SEGMENTS, SPECIAL_SUPPLY, territoryFor } from '../../data/coronaries';
import type { ArteryId, MiStage, OcclusionSite, VentricularRegionId } from '../../data/types';
import { generateEcg } from '../../engine/electrical';
import { interpret } from '../../engine/electrical/interpret';
import { MI_STAGE_EFFECTS } from '../../engine/electrical/model';
import { useApp } from '../../store/app';
import { Pearls, Reveal, Tabs, Toggle } from '../common/controls';
import EcgPaper, { LEADS_FOR_LAYOUT, type EcgLayout } from '../ecg/EcgPaper';
import { FindingsList } from '../ecg/Findings';
import BullsEye from './BullsEye';

const Heart3D = lazy(() => import('../three/Heart3D'));

/** Typical time course of the ECG stages after an untreated or late-reperfused occlusion (hours). */
const STAGE_HOURS: Record<MiStage, [number, number]> = { hyperacute: [0, 0.5], acute: [0.5, 12], evolving: [12, 48], reperfused: [48, 336], old: [336, 1e9] };
const HOUR_MARKS = [0.25, 2, 24, 120, 720];

export default function CoronaryLab() {
  const { dominance, setDominance, openPreset, openRhythm, level } = useApp();
  const [occ, setOcc] = useState<{ artery: ArteryId; site: OcclusionSite } | null>({ artery: 'LAD', site: 'proximal' });
  const [hoursIdx, setHoursIdx] = useState(1);
  const [layout, setLayout] = useState<EcgLayout>('15');
  const [view, setView] = useState<'territory' | 'supply'>('territory');
  const [showCor, setShowCor] = useState(true);
  const [seg, setSeg] = useState<number | null>(null);
  const hours = HOUR_MARKS[hoursIdx];
  const stage = (Object.keys(STAGE_HOURS) as MiStage[]).find((s) => hours >= STAGE_HOURS[s][0] && hours < STAGE_HOURS[s][1]) ?? 'acute';

  const rule = occ ? territoryFor(occ.artery, occ.site, dominance) : undefined;
  const territory = rule?.regions ?? {};
  const akinesia = useMemo(() => {
    const k = stage === 'old' ? 0.9 : stage === 'reperfused' ? 0.6 : 1;
    return Object.fromEntries(Object.entries(territory).map(([r, f]) => [r, Math.min(1, (f ?? 0) * k)])) as Partial<Record<VentricularRegionId, number>>;
  }, [territory, stage]);

  const leads = LEADS_FOR_LAYOUT[layout];
  const gen = useMemo(() => generateEcg(occ ? { occlusion: { artery: occ.artery, site: occ.site, dominance, stage } } : {}, { leads: [...new Set([...leads, 'V4R', 'V8', 'V9'])] as typeof leads, durationMs: 11000, dominance }), [occ, dominance, stage, leads]);
  const findings = useMemo(() => (gen.measure ? interpret(gen.measure, gen.ecg, gen.resolved.hr) : []), [gen]);
  const hl = useMemo(() => [...new Set(findings.flatMap((f) => (f.category === 'ischemia' ? f.leads ?? [] : [])))], [findings]);

  const artery = occ ? ARTERIES.find((a) => a.id === occ.artery) : undefined;
  const pick = (a: ArteryId, s: OcclusionSite | null) => {
    const info = ARTERIES.find((x) => x.id === a);
    if (!info?.occludable) return;
    setOcc({ artery: a, site: s && info.sites.includes(s) ? s : info.sites[0] });
  };
  const consequences = useMemo(() => {
    if (!occ) return [] as Array<{ text: string; go?: () => void; label?: string }>;
    const out: Array<{ text: string; go?: () => void; label?: string }> = [];
    const inferior = (territory.seg4 ?? 0) > 0.5 || (territory.seg10 ?? 0) > 0.5;
    const anteriorLarge = (territory.seg7 ?? 0) > 0.5 && (territory.seg8 ?? 0) > 0.5;
    const rv = (territory.rvLat ?? 0) + (territory.rvInf ?? 0) + (territory.rvAnt ?? 0) > 0.8;
    const lvMass = SEGMENTS.reduce((a, s) => a + (territory[`seg${s.id}` as VentricularRegionId] ?? 0), 0) / 17;
    if (lvMass > 0.4) out.push({ text: `~${Math.round(lvMass * 100)}% of the LV at risk → high risk of cardiogenic shock.`, go: () => openPreset('cardiogenic-shock'), label: 'Cardiogenic shock' });
    if (rv) out.push({ text: 'RV involvement → hypotension with raised JVP and clear lungs; preload dependent (avoid nitrates).', go: () => openPreset('rv-infarct'), label: 'RV infarction' });
    if (inferior && (dominance !== 'left' ? occ.artery === 'RCA' || occ.artery === 'PDA' : occ.artery === 'LCX')) out.push({ text: 'AV nodal artery from the dominant vessel → AV-nodal block (Mobitz I, usually transient) and vagal bradycardia.', go: () => openRhythm('mobitz1'), label: 'Wenckebach' });
    if (anteriorLarge) out.push({ text: 'Septal perforators/bundle branches → new RBBB/LAFB, infranodal Mobitz II or complete block (poor prognosis).', go: () => openRhythm('mobitz2'), label: 'Mobitz II' });
    if ((territory.seg17 ?? 0) > 0.5) out.push({ text: 'Apical akinesia → LV mural thrombus and, later, true aneurysm.' });
    if (inferior) out.push({ text: SPECIAL_SUPPLY.papillary.posteromedial, go: () => openPreset('mr-acute'), label: 'Acute MR' });
    out.push({ text: 'Any large infarct: VF/VT in the first hours (re-entry around ischemic border zone).', go: () => openRhythm('mono-vt'), label: 'VT' });
    return out;
  }, [occ, territory, dominance, openPreset, openRhythm]);

  const occludable = ARTERIES.filter((a) => a.occludable && (level === 'clinician' || a.id !== 'RAMUS'));

  return (
    <div className="stack">
      <div className="grid cols-sidebar-r">
        <div className="panel" style={{ padding: 8 }}>
          <Suspense fallback={<div className="canvas3d" />}>
            <Heart3D height={500} showCoronaries={showCor} colorMode={view} territory={territory} akinesia={akinesia} dominance={dominance} occlusion={occ}
              onPickArtery={pick} onPickRegion={(r) => { const m = /^seg(\d+)$/.exec(r); if (m) setSeg(Number(m[1])); }} showLabels />
          </Suspense>
          <div className="row small muted" style={{ marginTop: 6 }}>
            Click an artery to occlude it there (black dot). Shaded myocardium = territory at risk; it stops contracting (watch the wall motion).
            <span className="spacer" />
            <Toggle label="Show arteries" value={showCor} onChange={setShowCor} />
          </div>
        </div>
        <div className="stack">
          <div className="panel">
            <h3>Occlusion</h3>
            <div className="chips" role="group" aria-label="Choose an occlusion">
              <button className="chip" aria-pressed={!occ} onClick={() => setOcc(null)}>None</button>
              {occludable.flatMap((a) => a.sites.map((s) => (
                <button key={a.id + s} className="chip" aria-pressed={occ?.artery === a.id && occ.site === s} onClick={() => setOcc({ artery: a.id, site: s })}>
                  {a.id === 'LCX' ? 'LCx' : a.id}{a.sites.length > 1 ? ` ${s}` : ''}
                </button>
              )))}
            </div>
            <label className="field" style={{ marginTop: 8 }}>Dominance
              <select value={dominance} onChange={(e) => setDominance(e.target.value as typeof dominance)}>
                {(Object.keys(DOMINANCE_INFO) as Array<keyof typeof DOMINANCE_INFO>).map((d) => <option key={d} value={d}>{DOMINANCE_INFO[d].label} ({DOMINANCE_INFO[d].prevalence})</option>)}
              </select>
            </label>
            <p className="small muted">{DOMINANCE_INFO[dominance].description}</p>
          </div>
          <div className="panel">
            <div className="panel-title">
              <h3>Bull's-eye</h3>
              <span className="spacer" />
              <Tabs<'territory' | 'supply'> label="Bull's-eye mode" value={view} onChange={setView} tabs={[{ id: 'territory', label: 'At risk' }, { id: 'supply', label: 'Usual supply' }]} />
            </div>
            <BullsEye values={territory} dominance={dominance} mode={view} onPick={setSeg} selected={seg} />
            {seg && (() => { const s = SEGMENTS.find((x) => x.id === seg)!; return <p className="small"><strong>{s.id}. {s.name}</strong> – usually {s.supply[dominance].join(' or ')}. {s.note ?? ''}</p>; })()}
          </div>
        </div>
      </div>

      <div className="panel print-me">
        <div className="panel-title">
          <h2>{occ ? `${artery?.name ?? occ.artery} – ${occ.site} occlusion` : 'No occlusion'}</h2>
          <span className="spacer" />
          <label className="field no-print">Leads
            <select value={layout} onChange={(e) => setLayout(e.target.value as EcgLayout)}>
              <option value="3x4">12-lead</option><option value="15">15-lead (+V4R, V8, V9)</option><option value="18">18-lead</option>
            </select>
          </label>
        </div>
        <div className="no-print" style={{ marginBottom: 8 }}>
          <div className="small muted">Time since occlusion (no reperfusion until the "T-wave inversion" stage)</div>
          <div className="chips" role="group" aria-label="Time since occlusion">
            {HOUR_MARKS.map((h, i) => {
              const st = (Object.keys(STAGE_HOURS) as MiStage[]).find((s) => h >= STAGE_HOURS[s][0] && h < STAGE_HOURS[s][1])!;
              return <button key={h} className="chip" aria-pressed={i === hoursIdx} onClick={() => setHoursIdx(i)}>{h < 1 ? `${h * 60} min` : h < 48 ? `${h} h` : `${Math.round(h / 24)} days`} · {MI_STAGE_EFFECTS[st].label}</button>;
            })}
          </div>
        </div>
        <EcgPaper ecg={gen.ecg} layout={layout} startMs={500} durationMs={10000} highlightLeads={hl} ariaLabel="ECG of the selected occlusion" />
        <div className="grid cols-2" style={{ marginTop: 10 }}>
          <div>
            <h3>Interpretation (engine-measured)</h3>
            <FindingsList findings={findings} />
          </div>
          <div>
            {rule && (
              <>
                <h3>Expected</h3>
                <Reveal><p>{rule.ecgNote}</p></Reveal>
                {rule.alsoAtRisk && <p className="small"><strong>Also at risk:</strong> {rule.alsoAtRisk.join('; ')}.</p>}
              </>
            )}
            {artery && <Pearls items={artery.pearls} />}
            <p className="note">Territories are typical textbook distributions – real coronary anatomy varies a lot (see CONTENT_NOTES).</p>
          </div>
        </div>
      </div>

      <div className="grid cols-2">
        <div className="panel">
          <h3>Consequences</h3>
          {occ ? (
            <ul className="pearls">
              {consequences.map((c, i) => <li key={i}>{c.text} {c.go && <button className="btn small" onClick={c.go}>{c.label} →</button>}</li>)}
            </ul>
          ) : <p className="muted">Choose an occlusion.</p>}
        </div>
        <div className="panel">
          <h3>After the infarct: timeline</h3>
          <ol className="pearls">
            {MI_TIMELINE.map((m) => {
              const now = hours >= m.from && hours < m.to;
              return (
                <li key={m.label} style={{ fontWeight: now ? 700 : 400 }}>
                  <span className="mono">{m.label}</span> – {m.pathology} <em>Gross:</em> {m.gross}.
                  <ul>{m.complications.map((c) => <li key={c} style={{ fontWeight: 400 }}>{c}</li>)}</ul>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </div>
  );
}

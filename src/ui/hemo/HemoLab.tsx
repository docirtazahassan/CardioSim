import { useMemo, useState } from 'react';
import { PRESETS, presetById } from '../../data/presets';
import type { HemoParams, HemoPreset, Intervention, Maneuver } from '../../data/types';
import { INTERVENTIONS, MANEUVERS, paramsFor } from '../../engine/hemo/params';
import type { BeatSummary } from '../../engine/hemo/simulator';
import { useApp } from '../../store/app';
import { LevelBadge, Pearls, Reveal, Slider, Tabs, Toggle } from '../common/controls';
import { Jvp, Monitor, PaCatheter, PulseContour, PvLoop, StarlingGuyton, Wiggers } from './HemoCharts';
import { lastFullBeat, useHemoSim } from './useHemoSim';

const GROUP_LABEL: Record<HemoPreset['group'], string> = {
  normal: 'Normal', failure: 'Heart failure & RV', valve: 'Valve disease', shunt: 'Shunts', pericardial: 'Pericardial disease',
  shock: 'Shock', cardiomyopathy: 'Cardiomyopathy', other: 'Rhythm & other',
};
type View = 'wiggers' | 'pv' | 'curves' | 'bedside';

export default function HemoLab() {
  const { presetId, level, openPreset } = useApp();
  const preset = presetById(presetId) ?? PRESETS[0];
  const [maneuver, setManeuver] = useState<Maneuver>('none');
  const [doses, setDoses] = useState<Partial<Record<Intervention, number>>>({});
  const [adj, setAdj] = useState({ hr: 1, ees: 1, svr: 1, vol: 0, stiff: 1 });
  const [baro, setBaro] = useState(true);
  const [resp, setResp] = useState(true);
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [view, setView] = useState<View>('wiggers');
  const [right, setRight] = useState(false);

  const params: HemoParams = useMemo(() => {
    const p = paramsFor(preset.id, maneuver, doses);
    return {
      ...p,
      hr: p.hr * adj.hr, lvEes: p.lvEes * adj.ees, sysR: p.sysR * adj.svr, totalVolume: p.totalVolume + adj.vol, lvEdB: p.lvEdB * adj.stiff,
      baroreflex: baro && p.baroreflex, respDepth: resp ? p.respDepth : 0,
    };
  }, [preset.id, maneuver, doses, adj, baro, resp]);

  const sim = useHemoSim(params, preset.id, running, speed);
  const beat = lastFullBeat(sim);
  const recent = sim.beats.slice(-5);

  const groups = useMemo(() => {
    const g = new Map<string, HemoPreset[]>();
    for (const p of PRESETS) {
      if (p.level === 'clinician' && level === 'student') continue;
      const k = GROUP_LABEL[p.group];
      if (!g.has(k)) g.set(k, []);
      g.get(k)!.push(p);
    }
    return [...g.entries()];
  }, [level]);

  const resetAll = () => { setManeuver('none'); setDoses({}); setAdj({ hr: 1, ees: 1, svr: 1, vol: 0, stiff: 1 }); };

  return (
    <div className="grid cols-sidebar">
      <aside className="panel no-print" aria-label="Hemodynamic presets">
        <h3>Presets</h3>
        <ul className="list">
          {groups.map(([g, list]) => (
            <li key={g}>
              <div className="group">{g}</div>
              {list.map((p) => (
                <button key={p.id} aria-current={p.id === preset.id} onClick={() => { resetAll(); openPreset(p.id); }}>
                  <span style={{ flex: 1 }}>{p.name}</span>
                  {p.level === 'clinician' && <span className="badge">C</span>}
                </button>
              ))}
            </li>
          ))}
        </ul>
      </aside>
      <section className="stack">
        <div className="panel">
          <div className="panel-title">
            <h2>{preset.name}</h2>
            <LevelBadge level={preset.level} />
            <span className="spacer" />
            <Toggle label={running ? 'Pause' : 'Run'} value={running} onChange={setRunning} />
            <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>Speed
              <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
                <option value={0.25}>¼× (slow motion)</option><option value={0.5}>½×</option><option value={1}>1× real time</option><option value={2}>2×</option>
              </select>
            </label>
          </div>
          <p className="small">{preset.description}</p>
          <div className="stack" style={{ gap: 8 }}>
            <div>
              <div className="small muted">Maneuvers</div>
              <div className="chips" role="group" aria-label="Maneuvers">
                {(Object.keys(MANEUVERS) as Maneuver[]).map((m) => (
                  <button key={m} className="chip" aria-pressed={maneuver === m} onClick={() => setManeuver(m)} title={MANEUVERS[m].description}>{MANEUVERS[m].label}</button>
                ))}
              </div>
              {maneuver !== 'none' && <p className="small" style={{ marginTop: 4 }}><strong>{MANEUVERS[maneuver].label}:</strong> {MANEUVERS[maneuver].description}</p>}
            </div>
            <div>
              <div className="small muted">Interventions (mechanism only – no doses)</div>
              <div className="grid cols-3" style={{ gap: 6 }}>
                {(Object.keys(INTERVENTIONS) as Intervention[]).map((k) => (
                  k === 'iabp'
                    ? <Toggle key={k} label={INTERVENTIONS[k].label} value={!!doses.iabp} onChange={(v) => setDoses((d) => ({ ...d, iabp: v ? 1 : 0 }))} title={INTERVENTIONS[k].mechanism} />
                    : <Slider key={k} label={INTERVENTIONS[k].label} value={doses[k] ?? 0} min={0} max={1} step={0.25} onChange={(v) => setDoses((d) => ({ ...d, [k]: v }))} format={(v) => (v === 0 ? 'off' : `${Math.round(v * 100)}%`)} />
                ))}
              </div>
              {Object.entries(doses).filter(([, d]) => d).length > 0 && (
                <ul className="pearls small" style={{ marginTop: 4 }}>
                  {Object.entries(doses).filter(([, d]) => d).map(([k]) => <li key={k}><strong>{INTERVENTIONS[k as Intervention].label}:</strong> {INTERVENTIONS[k as Intervention].mechanism}</li>)}
                </ul>
              )}
            </div>
            <details>
              <summary className="small">Physiology sliders</summary>
              <div className="grid cols-3" style={{ gap: 6, marginTop: 6 }}>
                <Slider label="Heart rate ×" value={adj.hr} min={0.5} max={2} step={0.05} onChange={(v) => setAdj((a) => ({ ...a, hr: v }))} format={(v) => v.toFixed(2)} />
                <Slider label="LV contractility (Ees) ×" value={adj.ees} min={0.3} max={2} step={0.05} onChange={(v) => setAdj((a) => ({ ...a, ees: v }))} format={(v) => v.toFixed(2)} />
                <Slider label="Systemic resistance ×" value={adj.svr} min={0.4} max={2.5} step={0.05} onChange={(v) => setAdj((a) => ({ ...a, svr: v }))} format={(v) => v.toFixed(2)} />
                <Slider label="Blood volume" value={adj.vol} min={-1500} max={1500} step={100} unit=" mL" onChange={(v) => setAdj((a) => ({ ...a, vol: v }))} />
                <Slider label="LV stiffness ×" value={adj.stiff} min={0.6} max={2.5} step={0.05} onChange={(v) => setAdj((a) => ({ ...a, stiff: v }))} format={(v) => v.toFixed(2)} />
                <div className="row">
                  <Toggle label="Baroreflex" value={baro} onChange={setBaro} title="Carotid/aortic baroreceptor control of HR, SVR, contractility and venous tone" />
                  <Toggle label="Breathing" value={resp} onChange={setResp} />
                  <button className="btn small" onClick={resetAll}>Reset</button>
                </div>
              </div>
            </details>
          </div>
        </div>

        <div className="grid cols-sidebar-r">
          <div className="panel">
            <div className="panel-title">
              <Tabs<View> label="Hemodynamic views" value={view} onChange={setView} tabs={[
                { id: 'wiggers', label: 'Wiggers diagram' }, { id: 'pv', label: 'PV loop' }, { id: 'curves', label: 'Starling & Guyton' }, { id: 'bedside', label: 'Bedside: monitor, JVP, pulse, PA catheter' },
              ]} />
              <span className="spacer" />
              {(view === 'wiggers' || view === 'pv') && <Toggle label={right ? 'Right heart' : 'Left heart'} value={right} onChange={setRight} title="Switch between left and right heart" />}
            </div>
            {view === 'wiggers' && <Wiggers view={sim} params={params} right={right} />}
            {view === 'pv' && <PvLoop view={sim} params={params} right={right} />}
            {view === 'curves' && <StarlingGuyton view={sim} params={params} />}
            {view === 'bedside' && (
              <div className="grid cols-2">
                <div><Monitor view={sim} /></div>
                <div className="stack"><Jvp view={sim} params={params} /><PulseContour view={sim} /><PaCatheter view={sim} /></div>
              </div>
            )}
          </div>
          <div className="stack">
            <div className="panel">
              <h3>Numbers (last 5 beats)</h3>
              {beat ? <Numbers beats={recent.length ? recent : [beat]} /> : <p className="muted">Simulating…</p>}
            </div>
            <div className="panel">
              <h3>Expected pattern</h3>
              <Reveal>
                <table className="table"><tbody>
                  <tr><th>Pressures</th><td>{preset.expected.pressures}</td></tr>
                  <tr><th>Murmur</th><td>{preset.expected.murmur}</td></tr>
                  <tr><th>JVP</th><td>{preset.expected.jvp}</td></tr>
                  <tr><th>Pulse</th><td>{preset.expected.pulse}</td></tr>
                  <tr><th>PV loop</th><td>{preset.expected.pvLoop}</td></tr>
                </tbody></table>
              </Reveal>
              <Pearls items={preset.pearls} />
              <p className="note">Lumped-parameter teaching model – numbers are physiologically plausible, not patient-specific. Source type: {preset.references}</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function Numbers({ beats }: { beats: BeatSummary[] }) {
  const avg = (k: keyof BeatSummary) => beats.reduce((a, b) => a + (b[k] as number), 0) / beats.length;
  const r = (x: number) => Math.round(x);
  const rows: Array<[string, string]> = [
    ['Heart rate', `${r(avg('hr'))} /min`],
    ['Arterial BP', `${r(avg('sbp'))}/${r(avg('dbp'))} (mean ${r(avg('map'))}) mmHg`],
    ['Cardiac output', `${avg('co').toFixed(1)} L/min`],
    ['Stroke volume', `${r(avg('sv'))} mL`],
    ['EF', `${r(avg('ef') * 100)} %`],
    ['LV EDV / ESV', `${r(avg('edv'))} / ${r(avg('esv'))} mL`],
    ['LV pressure', `${r(avg('lvSys'))}/${r(avg('lvEdp'))} mmHg`],
    ['RV pressure', `${r(avg('rvSys'))}/${r(avg('rvEdp'))} mmHg`],
    ['PA pressure', `${r(avg('paSys'))}/${r(avg('paDia'))} (mean ${r(avg('paMean'))}) mmHg`],
    ['PCWP', `${r(avg('pcwp'))} mmHg`],
    ['CVP (RA mean)', `${r(avg('cvp'))} mmHg`],
    ['SVR', `${r(avg('svr'))} dyn·s·cm⁻⁵`],
    ['PVR', `${r(avg('pvr'))} dyn·s·cm⁻⁵`],
    ['SvO₂', `${r(avg('svo2') * 100)} %`],
    ['Qp : Qs', avg('qpqs').toFixed(2)],
  ];
  const ag = avg('avGradMean'), mg = avg('mvGradMean'), lo = avg('lvotPeak');
  if (ag > 10) rows.push(['Aortic gradient (mean)', `${r(ag)} mmHg`]);
  if (mg > 4) rows.push(['Mitral gradient (mean)', `${r(mg)} mmHg`]);
  if (lo > 30) rows.push(['LVOT peak gradient', `${r(lo)} mmHg`]);
  const arf = avg('arFraction'), mrf = avg('mrFraction');
  if (arf > 0.05) rows.push(['AR regurgitant fraction', `${r(arf * 100)} %`]);
  if (mrf > 0.05) rows.push(['MR regurgitant fraction', `${r(mrf * 100)} %`]);
  const sbps = beats.map((b) => b.sbp);
  const swing = Math.max(...sbps) - Math.min(...sbps);
  if (swing > 8) rows.push(['Beat-to-beat SBP swing', `${r(swing)} mmHg`]);
  return (
    <dl className="kv">
      {rows.map(([k, v]) => <div key={k} style={{ display: 'contents' }}><dt>{k}</dt><dd>{v}</dd></div>)}
    </dl>
  );
}

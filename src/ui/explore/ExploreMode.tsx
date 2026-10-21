import { useEffect, useMemo, useRef, useState } from 'react';
import { conditionById } from '../../data/conditions';
import { PRESETS, presetById } from '../../data/presets';
import { rhythmById } from '../../data/rhythms';
import { STRUCTURES } from '../../data/structures';
import type { VentricularRegionId } from '../../data/types';
import { computeActivation, NORMAL_CONDUCTION, type ConductionState, type VentricularPattern } from '../../engine/electrical/activation';
import { VENTRICULAR_REGIONS } from '../../engine/electrical/geometry';
import { paramsFor } from '../../engine/hemo/params';
import type { Sample } from '../../engine/hemo/simulator';
import { useApp } from '../../store/app';
import { Pearls, Slider, Tabs, Toggle } from '../common/controls';
import { lazy, Suspense } from 'react';
import type { ColorMode, HeartState, SliceMode } from '../three/Heart3D';
import { heartStateFromSample } from '../three/Heart3D';
import { useHemoSim } from '../hemo/useHemoSim';

const Heart3D = lazy(() => import('../three/Heart3D'));

const PATTERNS: Array<{ id: string; label: string; pattern: VentricularPattern; cond?: Partial<ConductionState> }> = [
  { id: 'normal', label: 'Normal (Purkinje)', pattern: { kind: 'normal' } },
  { id: 'rbbb', label: 'Right bundle branch block', pattern: { kind: 'normal' }, cond: { rbbb: true } },
  { id: 'lbbb', label: 'Left bundle branch block', pattern: { kind: 'normal' }, cond: { lbbb: true } },
  { id: 'lafb', label: 'Left anterior fascicular block', pattern: { kind: 'normal' }, cond: { lafb: true } },
  { id: 'wpw', label: 'WPW – left lateral pathway', pattern: { kind: 'preexcited', pathway: 'left-lateral', leadMs: 50 } },
  { id: 'pvc-rv', label: 'PVC – RV outflow tract', pattern: { kind: 'ectopic', origin: 'rvot' } },
  { id: 'pvc-lv', label: 'PVC – LV inferolateral wall', pattern: { kind: 'ectopic', origin: 'seg11' } },
];

const TOUR = ['sa-node', 'internodal', 'bachmann', 'av-node', 'his', 'lbb', 'laf', 'lpf', 'rbb', 'ra', 'tricuspid', 'rv', 'pulmonic', 'pa', 'pulm-veins', 'la', 'mitral', 'lv', 'aortic', 'aorta'];

export default function ExploreMode() {
  const { level, openCondition, openPreset, openRhythm, dominance, setDominance } = useApp();
  const [color, setColor] = useState<ColorMode>('anatomy');
  const [conduction, setConduction] = useState(true);
  const [coronaries, setCoronaries] = useState(false);
  const [torso, setTorso] = useState(false);
  const [labels, setLabels] = useState(true);
  const [slice, setSlice] = useState<SliceMode>('none');
  const [slicePos, setSlicePos] = useState(0.5);
  const [patternId, setPatternId] = useState('normal');
  const [selected, setSelected] = useState<string | null>('sa-node');
  const [presetId, setPresetId] = useState('normal-hemo');
  const [slowmo, setSlowmo] = useState(1);
  const [tourIdx, setTourIdx] = useState(0);

  const pat = PATTERNS.find((p) => p.id === patternId)!;
  const activation = useMemo(() => {
    const res = computeActivation(pat.pattern, { ...NORMAL_CONDUCTION, ...(pat.cond ?? {}) });
    const m: Partial<Record<VentricularRegionId, { t: number; transit: number }>> = {};
    res.regions.forEach((r, i) => {
      const t = r.halves ? Math.min(...r.halves.map((h) => h.t)) : r.t;
      m[VENTRICULAR_REGIONS[i].id] = { t: t + res.preexcitationMs, transit: Math.max(18, r.transit) };
    });
    return { m, qrs: res.qrsDuration };
  }, [pat]);

  // Heart motion from the circulation model, played back smoothly (slightly behind real time).
  const params = useMemo(() => paramsFor(presetId), [presetId]);
  const sim = useHemoSim(params, presetId, true, slowmo);
  const stateRef = useRef<HeartState>(heartStateFromSample({ vLV: 125, vRV: 135, vLA: 60, vRA: 60, qMV: 0, qAV: 0, qTV: 0, qPV: 0 }, 500, 500));
  const simRef = useRef<{ samples: Sample[]; wall: number; t: number }>({ samples: [], wall: 0, t: 0 });
  useEffect(() => { simRef.current = { samples: sim.samples, wall: performance.now(), t: sim.t }; }, [sim]);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const { samples, wall, t } = simRef.current;
      if (samples.length > 10) {
        const target = t + ((performance.now() - wall) / 1000) * slowmo - 0.35 * slowmo;
        let lo = 0, hi = samples.length - 1;
        while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (samples[mid].t < target) lo = mid; else hi = mid; }
        const s = samples[lo];
        let iv = lo, ia = lo;
        while (iv > 0 && !(samples[iv].eLV > 0.003 && samples[iv - 1].eLV <= 0.003)) iv--;
        while (ia > 0 && !(samples[ia].eLA > 0.003 && samples[ia - 1].eLA <= 0.003)) ia--;
        stateRef.current = heartStateFromSample(s, (s.t - samples[iv].t) * 1000 + 20, (s.t - samples[ia].t) * 1000);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [slowmo]);

  const info = STRUCTURES.find((s) => s.id === selected);
  const related = (info?.relatedConditions ?? []).map((id) => {
    const c = conditionById(id); if (c) return { id, name: c.name, go: () => openCondition(id) };
    const p = presetById(id); if (p) return { id, name: `${p.name} (hemodynamics)`, go: () => openPreset(id) };
    const r = rhythmById(id); if (r) return { id, name: `${r.name} (rhythm)`, go: () => openRhythm(id) };
    return null;
  }).filter(Boolean) as Array<{ id: string; name: string; go: () => void }>;

  const goTour = (i: number) => {
    const k = (i + TOUR.length) % TOUR.length;
    setTourIdx(k);
    setSelected(TOUR[k]);
    if (['sa-node', 'internodal', 'bachmann', 'av-node', 'his', 'lbb', 'laf', 'lpf', 'rbb'].includes(TOUR[k])) setConduction(true);
  };

  return (
    <div className="grid cols-sidebar-r">
      <section className="stack">
        <div className="panel" style={{ padding: 8 }}>
          <Suspense fallback={<div className="canvas3d" style={{ height: 560 }} />}>
            <Heart3D stateRef={stateRef} height={560} colorMode={color} activation={activation.m} dominance={dominance}
              showConduction={conduction} showCoronaries={coronaries} showTorso={torso} showLabels={labels}
              slice={slice} slicePos={slicePos} highlight={selected} onPickStructure={setSelected} />
          </Suspense>
          <div className="row small muted" style={{ marginTop: 6 }}>
            Drag to rotate · scroll/pinch to zoom · click a structure for details.
            {color === 'activation' && (
              <span className="legend" style={{ marginLeft: 'auto' }}>
                <span><i style={{ borderTop: '8px solid #c99a94', width: 14 }} />resting</span>
                <span><i style={{ borderTop: '8px solid #ffb000', width: 14 }} />depolarising now</span>
                <span><i style={{ borderTop: '8px solid #c6dbef', width: 14 }} />activated early</span>
                <span><i style={{ borderTop: '8px solid #08306b', width: 14 }} />activated late (≥ 85 ms)</span>
              </span>
            )}
            {color === 'supply' && (
              <span className="legend" style={{ marginLeft: 'auto' }}>
                <span><i style={{ borderTop: '8px solid #0072b2', width: 14 }} />LAD</span>
                <span><i style={{ borderTop: '8px solid #e69f00', width: 14 }} />LCx</span>
                <span><i style={{ borderTop: '8px solid #009e73', width: 14 }} />RCA</span>
              </span>
            )}
          </div>
        </div>
      </section>
      <aside className="stack">
        <div className="panel">
          <h3>View</h3>
          <Tabs<ColorMode> label="Colouring" value={color} onChange={(c) => { setColor(c); if (c === 'activation') setSlowmo(0.1); }} tabs={[
            { id: 'anatomy', label: 'Anatomy' }, { id: 'activation', label: 'Electrical activation' }, { id: 'supply', label: 'Coronary supply' },
          ]} />
          <div className="chips" style={{ marginTop: 8 }}>
            <Toggle label="Conduction system" value={conduction} onChange={setConduction} />
            <Toggle label="Coronary arteries" value={coronaries} onChange={setCoronaries} />
            <Toggle label="Torso & electrodes" value={torso} onChange={setTorso} />
            <Toggle label="Labels" value={labels} onChange={setLabels} />
          </div>
          {(color === 'supply' || coronaries) && (
            <label className="field" style={{ marginTop: 8 }}>Coronary dominance
              <select value={dominance} onChange={(e) => setDominance(e.target.value as typeof dominance)}>
                <option value="right">Right dominant (~70%)</option><option value="codominant">Codominant (~20%)</option><option value="left">Left dominant (~10%)</option>
              </select>
            </label>
          )}
          {color === 'activation' && (
            <label className="field" style={{ marginTop: 8 }}>Activation sequence
              <select value={patternId} onChange={(e) => setPatternId(e.target.value)}>
                {PATTERNS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </label>
          )}
          <div className="row" style={{ marginTop: 8 }}>
            <label className="field">Cut plane
              <select value={slice} onChange={(e) => setSlice(e.target.value as SliceMode)}>
                <option value="none">None</option><option value="short">Short axis</option><option value="four">Four-chamber (long axis)</option><option value="two">Two-chamber</option>
              </select>
            </label>
            {slice !== 'none' && <div style={{ flex: 1, minWidth: 120 }}><Slider label="Cut position" value={slicePos} min={0.05} max={0.95} step={0.01} onChange={setSlicePos} format={(v) => `${Math.round(v * 100)}%`} /></div>}
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <label className="field">Heart driven by
              <select value={presetId} onChange={(e) => setPresetId(e.target.value)}>
                {PRESETS.filter((p) => level === 'clinician' || p.level === 'student').map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <label className="field">Speed
              <select value={slowmo} onChange={(e) => setSlowmo(Number(e.target.value))}>
                <option value={1}>Real time</option><option value={0.25}>¼ (slow motion)</option><option value={0.1}>1/10 (see activation)</option>
              </select>
            </label>
          </div>
        </div>
        <div className="panel">
          <div className="panel-title">
            <h3>Guided tour</h3>
            <span className="spacer" />
            <button className="btn small" onClick={() => goTour(tourIdx - 1)} aria-label="Previous stop">◀</button>
            <span className="small mono">{tourIdx + 1}/{TOUR.length}</span>
            <button className="btn small" onClick={() => goTour(tourIdx + 1)} aria-label="Next stop">▶</button>
          </div>
          <p className="small muted">Follow the impulse (SA node → Purkinje) and then the blood (right heart → lungs → left heart → aorta).</p>
        </div>
        {info && (
          <div className="panel" aria-live="polite">
            <h3>{info.name}</h3>
            <p>{info.function}</p>
            <p className="small"><strong>Blood supply:</strong> {info.bloodSupply}</p>
            <Pearls items={info.pearls} />
            {level === 'clinician' && info.clinicianPearls && <Pearls items={info.clinicianPearls} title="Clinician notes" />}
            {related.length > 0 && (
              <div className="chips" style={{ marginTop: 6 }}>
                {related.map((r) => <button key={r.id} className="chip" onClick={r.go}>{r.name} →</button>)}
              </div>
            )}
          </div>
        )}
        <div className="panel small">
          <h3>All structures</h3>
          <div className="chips">
            {STRUCTURES.map((s) => <button key={s.id} className="chip" aria-pressed={selected === s.id} onClick={() => setSelected(s.id)}>{s.name}</button>)}
          </div>
        </div>
      </aside>
    </div>
  );
}

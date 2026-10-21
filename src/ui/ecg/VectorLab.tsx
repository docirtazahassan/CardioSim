/**
 * Vector lab: the heart's electrical activity as one moving arrow (the cardiac vector).
 * Each lead "sees" the arrow's shadow (projection) on its own axis – that is the ECG.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { conditionById } from '../../data/conditions';
import type { EcgModel, LeadId } from '../../data/types';
import { generateEcg } from '../../engine/electrical';
import { CHEST_ANGLES, LIMB_ANGLES, TWELVE_LEADS } from '../../engine/electrical/leads';
import { Slider, Toggle } from '../common/controls';
import { MiniTrace } from '../common/Trace';

const SOURCES = ['normal', 'axis-left', 'axis-right', 'lafb', 'lpfb', 'rbbb', 'lbbb', 'lvh', 'rvh', 'wpw', 'stemi-anterior', 'stemi-inferior-rca', 'dextrocardia'];
type Phase = 'P' | 'QRS' | 'T' | 'all';

export default function VectorLab() {
  const [src, setSrc] = useState('normal');
  const [frontal, setFrontal] = useState(0);
  const [horizontal, setHorizontal] = useState(0);
  const [phase, setPhase] = useState<Phase>('QRS');
  const [playing, setPlaying] = useState(true);
  const [slow, setSlow] = useState(8);
  const [einthoven, setEinthoven] = useState(false);
  const cond = conditionById(src);

  const model: EcgModel = useMemo(() => {
    const m = cond?.model ?? {};
    return { ...m, frontalRotationDeg: (m.frontalRotationDeg ?? 0) + frontal, horizontalRotationDeg: (m.horizontalRotationDeg ?? 0) + horizontal };
  }, [cond, frontal, horizontal]);
  const gen = useMemo(() => generateEcg(model, { durationMs: 4000, leads: TWELVE_LEADS }), [model]);
  const beat = gen.ecg.beats[gen.beatIndex];
  const win = useMemo(() => {
    if (!beat) return [0, 1] as const;
    const pOn = beat.pOn ?? beat.qrsOn - 160;
    if (phase === 'P') return [pOn, beat.pOff ?? beat.qrsOn - 40] as const;
    if (phase === 'QRS') return [beat.qrsOn, beat.qrsOff] as const;
    if (phase === 'T') return [beat.qrsOff, beat.tEnd] as const;
    return [pOn - 20, beat.tEnd + 30] as const;
  }, [beat, phase]);
  const full = beat ? [(beat.pOn ?? beat.qrsOn - 160) - 30, beat.tEnd + 40] : [0, 1];

  const [t, setT] = useState(win[0]);
  const raf = useRef(0);
  useEffect(() => {
    setT(win[0]);
  }, [win]);
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = (now - last) / slow;
      last = now;
      setT((x) => {
        const nx = x + dt;
        return nx > win[1] ? win[0] : nx < win[0] ? win[0] : nx;
      });
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
  }, [playing, slow, win]);

  const [vx, vy, vz] = gen.ecg.vcg;
  const cur: [number, number, number] = [vx[Math.round(t)] ?? 0, vy[Math.round(t)] ?? 0, vz[Math.round(t)] ?? 0];
  const loop = useMemo(() => {
    const pts: Array<[number, number, number]> = [];
    for (let i = Math.round(win[0]); i <= Math.round(win[1]); i += 2) pts.push([vx[i], vy[i], vz[i]]);
    return pts;
  }, [vx, vy, vz, win]);
  const scale = useMemo(() => Math.max(0.15, ...loop.map((p) => Math.hypot(p[0], p[1], p[2]))), [loop]);

  const axis = gen.measure?.axis ?? 0;
  const frontalDeg = (Math.atan2(cur[1], cur[0]) * 180) / Math.PI;

  return (
    <div className="stack">
      <div className="panel">
        <div className="row">
          <label className="field">Heart
            <select value={src} onChange={(e) => setSrc(e.target.value)}>
              {SOURCES.map((s) => <option key={s} value={s}>{conditionById(s)?.name ?? s}</option>)}
            </select>
          </label>
          <div style={{ minWidth: 180 }}><Slider label="Rotate heart (frontal)" value={frontal} min={-120} max={120} step={5} onChange={setFrontal} unit="°" /></div>
          <div style={{ minWidth: 180 }}><Slider label="Rotate heart (horizontal)" value={horizontal} min={-60} max={60} step={5} onChange={setHorizontal} unit="°" /></div>
          <div className="chips" role="group" aria-label="Wave to trace">
            {(['P', 'QRS', 'T', 'all'] as Phase[]).map((p) => (
              <button key={p} className="chip" aria-pressed={phase === p} onClick={() => setPhase(p)}>{p === 'all' ? 'Whole beat' : `${p} loop`}</button>
            ))}
          </div>
          <Toggle label={playing ? 'Pause' : 'Play'} value={playing} onChange={setPlaying} />
          <div style={{ minWidth: 150 }}><Slider label="Slow motion" value={slow} min={1} max={40} onChange={setSlow} unit="×" /></div>
          <Toggle label="Einthoven triangle" value={einthoven} onChange={setEinthoven} />
        </div>
        <div style={{ marginTop: 6 }}>
          <input type="range" aria-label="Time within the beat" style={{ width: '100%' }} min={win[0]} max={win[1]} step={1} value={t}
            onChange={(e) => { setPlaying(false); setT(Number(e.target.value)); }} />
        </div>
      </div>
      <div className="grid cols-2">
        <div className="panel">
          <h3>Frontal plane (limb leads) – hexaxial reference</h3>
          <PlaneView plane="frontal" loop={loop} cur={cur} scale={scale} meanAxis={phase === 'QRS' ? axis : null} einthoven={einthoven} />
          <p className="small">Current vector direction: <strong className="mono">{Math.round(frontalDeg)}°</strong> · Mean QRS axis: <strong className="mono">{Math.round(axis)}°</strong>. Angles are measured from lead I (0°), positive going clockwise (downward), as on the hexaxial wheel.</p>
        </div>
        <div className="panel">
          <h3>Horizontal plane (chest leads) – viewed from below</h3>
          <PlaneView plane="horizontal" loop={loop} cur={cur} scale={scale} meanAxis={null} einthoven={false} />
          <p className="small">Front of the chest is at the bottom. The early septal force points right-anterior (toward V1, small r in V1); the big left-ventricular force swings posterior-left (deep S in V1, tall R in V5–V6).</p>
        </div>
      </div>
      <div className="panel">
        <h3>What each lead records (one beat, cursor = arrow position)</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
          {TWELVE_LEADS.map((l) => (
            <LeadCell key={l} lead={l} data={gen.ecg.leads[l]} t0={full[0]} t1={full[1]} t={t} />
          ))}
        </div>
        <ul className="pearls small" style={{ marginTop: 8 }}>
          <li>An arrow pointing toward a lead's positive pole writes an upward deflection; pointing away writes a downward one; at 90° it writes nothing (isoelectric).</li>
          <li>Einthoven's law holds at every instant: <span className="mono">I + III = II</span>. The augmented leads are combinations of the same two signals, so <span className="mono">aVR + aVL + aVF = 0</span>.</li>
          <li>Chest leads are closer to the heart, so nearby muscle dominates them (near field) – the reason infarcts "localise".</li>
        </ul>
      </div>
    </div>
  );
}

function LeadCell({ lead, data, t0, t1, t }: { lead: LeadId; data: Float32Array; t0: number; t1: number; t: number }) {
  const v = data[Math.round(t)] ?? 0;
  return (
    <div>
      <MiniTrace data={data} t0={t0} t1={t1} cursor={t} label={lead} width={180} height={70} mvRange={1.8} />
      <div className="small mono" aria-live="off">{v >= 0 ? '+' : ''}{v.toFixed(2)} mV {Math.abs(v) < 0.03 ? '(≈ isoelectric)' : v > 0 ? '▲ toward' : '▼ away'}</div>
    </div>
  );
}

const SIZE = 320;
const C = SIZE / 2;
const R = SIZE * 0.36;

function PlaneView({ plane, loop, cur, scale, meanAxis, einthoven }: { plane: 'frontal' | 'horizontal'; loop: Array<[number, number, number]>; cur: [number, number, number]; scale: number; meanAxis: number | null; einthoven: boolean }) {
  // frontal: screen x = body x (left), screen y = body y (inferior)
  // horizontal (from below): screen x = body x, screen y = body z (anterior → down)
  const proj = (p: [number, number, number]): [number, number] => (plane === 'frontal' ? [p[0], p[1]] : [p[0], p[2]]);
  const toScreen = ([a, b]: [number, number]) => [C + (a / scale) * R, C + (b / scale) * R] as const;
  const path = loop.map((p, i) => `${i ? 'L' : 'M'}${toScreen(proj(p)).map((n) => n.toFixed(1)).join(',')}`).join(' ');
  const [hx, hy] = toScreen(proj(cur));
  const angles: Array<[string, number]> = plane === 'frontal' ? Object.entries(LIMB_ANGLES) : Object.entries(CHEST_ANGLES).filter(([k]) => /^V[1-6]$/.test(k));
  return (
    <>
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width="100%" style={{ maxWidth: 420, display: 'block', margin: '0 auto' }} role="img"
      aria-label={`${plane} plane vector loop`}>
      <defs>
        <marker id={`arr-${plane}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--c-vermillion)" />
        </marker>
        <marker id={`arrm-${plane}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--c-blue)" />
        </marker>
      </defs>
      <circle cx={C} cy={C} r={R} fill="none" stroke="var(--border)" />
      {angles.map(([name, deg]) => {
        const a = (deg * Math.PI) / 180;
        const dx = Math.cos(a), dy = plane === 'frontal' ? Math.sin(a) : Math.sin(a);
        const x2 = C + dx * (R + 6), y2 = C + dy * (R + 6);
        const x1 = plane === 'frontal' ? C - dx * R : C;
        const y1 = plane === 'frontal' ? C - dy * R : C;
        return (
          <g key={name}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--muted)" strokeWidth={0.8} strokeDasharray={plane === 'frontal' ? '0' : '3 3'} />
            <text x={C + dx * (R + 20)} y={C + dy * (R + 20) + 4} textAnchor="middle" fontSize={12} fontWeight={600} fill="var(--text)">{name}{plane === 'frontal' ? ` ${deg > 0 ? '+' : ''}${deg}°` : ''}</text>
          </g>
        );
      })}
      {einthoven && plane === 'frontal' && (
        <g aria-label="Einthoven triangle">
          {/* RA (−150°), LA (−30°), LL (+90°) */}
          {(() => {
            const pt = (d: number) => [C + Math.cos((d * Math.PI) / 180) * R, C + Math.sin((d * Math.PI) / 180) * R];
            const [ra, la, ll] = [pt(-150), pt(-30), pt(90)];
            return (
              <>
                <polygon points={`${ra} ${la} ${ll}`} fill="rgba(0,114,178,0.06)" stroke="var(--c-blue)" strokeWidth={1.2} />
                <text x={ra[0] - 6} y={ra[1] - 6} fontSize={11} fill="var(--c-blue)">RA</text>
                <text x={la[0] - 6} y={la[1] - 6} fontSize={11} fill="var(--c-blue)">LA</text>
                <text x={ll[0] + 6} y={ll[1] + 4} fontSize={11} fill="var(--c-blue)">LL</text>
              </>
            );
          })()}
        </g>
      )}
      <path d={path} fill="none" stroke="var(--c-sky)" strokeWidth={1.6} />
      {meanAxis != null && (
        <line x1={C} y1={C} x2={C + Math.cos((meanAxis * Math.PI) / 180) * R * 0.85} y2={C + Math.sin((meanAxis * Math.PI) / 180) * R * 0.85}
          stroke="var(--c-blue)" strokeWidth={2} strokeDasharray="6 4" markerEnd={`url(#arrm-${plane})`} />
      )}
      <line x1={C} y1={C} x2={hx} y2={hy} stroke="var(--c-vermillion)" strokeWidth={3} markerEnd={`url(#arr-${plane})`} />
      <circle cx={C} cy={C} r={3} fill="var(--text)" />

    </svg>
    <div className="legend" style={{ justifyContent: 'center' }}>
      <span style={{ color: 'var(--c-vermillion)' }}><i />instantaneous vector</span>
      <span style={{ color: 'var(--c-sky)' }}><i />loop traced by its tip</span>
      {meanAxis != null && <span style={{ color: 'var(--c-blue)' }}><i style={{ borderTopStyle: 'dashed' }} />mean QRS axis</span>}
    </div>
    </>
  );
}

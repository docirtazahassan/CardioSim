/**
 * Lead builder: drag chest electrodes on a torso and watch the ECG change.
 * Teaches why electrode placement matters (high V1/V2 → rSr′ and inverted P; swapped limb leads).
 */
import { useMemo, useRef, useState } from 'react';
import { conditionById } from '../../data/conditions';
import type { EcgModel, LeadId } from '../../data/types';
import { generateEcg } from '../../engine/electrical';
import { ELECTRODES } from '../../engine/electrical/leads';
import type { V3 } from '../../engine/math';
import { Toggle } from '../common/controls';
import { MiniTrace } from '../common/Trace';

/** Chest wall cross-section used to place electrodes on the skin (cm, body frame). */
const CHEST = { a: 12.6, b: 10, z0: -2.4 };
const DRAGGABLE: LeadId[] = ['V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V4R', 'V7', 'V8', 'V9'];
const SOURCES = ['normal', 'stemi-anterior', 'stemi-inferior-rca', 'rv-infarct', 'stemi-posterior', 'rbbb', 'lvh', 'dextrocardia'];
/**
 * Screen mapping: the chest wall is "unrolled" so front, sides and back are all visible.
 * Horizontal = angle around the chest (0° = sternum, +90° = left mid-axillary line, 180° = spine);
 * vertical = 12 px per cm (y = 0 at the 4th intercostal space).
 */
const DEG = 1.45, X0 = 210, PX = 12, Y0 = 200;
const W = 520, H = 400;
const thetaOf = (p: V3) => (Math.atan2(p[0] / CHEST.a, (p[2] - CHEST.z0) / CHEST.b) * 180) / Math.PI;
/** Intercostal spaces (approx. y in cm relative to the 4th ICS) for the drawing. */
const ICS: Array<[string, number]> = [['2nd ICS', -6.6], ['3rd ICS', -3.6], ['4th ICS', -0.6], ['5th ICS', 2.4], ['6th ICS', 5.4]];

function onSkin(thetaDeg: number, y: number): V3 {
  const t = (Math.max(-135, Math.min(205, thetaDeg)) * Math.PI) / 180;
  return [CHEST.a * Math.sin(t), y, CHEST.z0 + CHEST.b * Math.cos(t)];
}

export default function LeadBuilder() {
  const [pos, setPos] = useState<Record<string, V3>>({});
  const [src, setSrc] = useState('normal');
  const [swapArms, setSwapArms] = useState(false);
  const [drag, setDrag] = useState<LeadId | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const electrodes = useMemo(() => ({ ...pos }), [pos]);
  const base = conditionById(src)?.model ?? {};
  const model: EcgModel = useMemo(() => ({ ...base, artefact: { ...(base.artefact ?? {}), ...(swapArms ? { limbReversal: 'LA-RA' as const } : {}) } }), [base, swapArms]);
  const leads: LeadId[] = ['I', 'II', 'III', 'aVR', 'aVL', 'aVF', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V4R', 'V7', 'V8', 'V9'];
  const gen = useMemo(() => generateEcg(model, { durationMs: 3000, leads, electrodes }), [model, electrodes]);
  const beat = gen.ecg.beats[gen.beatIndex];
  const t0 = beat ? (beat.pOn ?? beat.qrsOn - 160) - 40 : 0;
  const t1 = beat ? beat.tEnd + 60 : 1000;

  const get = (l: string): V3 => pos[l] ?? ELECTRODES[l];
  const moved = Object.keys(pos).length > 0;

  function toBody(e: React.PointerEvent): [number, number] {
    const svg = svgRef.current!;
    const r = svg.getBoundingClientRect();
    const sx = ((e.clientX - r.left) / r.width) * W;
    const sy = ((e.clientY - r.top) / r.height) * H;
    return [(sx - X0) / DEG, (sy - Y0) / PX];
  }
  const onMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const [x, y] = toBody(e);
    setPos((p) => ({ ...p, [drag]: onSkin(x, Math.max(-10, Math.min(9, y))) }));
  };
  const nudge = (l: LeadId, dx: number, dy: number) => {
    const e = get(l);
    setPos((p) => ({ ...p, [l]: onSkin(thetaOf(e) + dx * 4, Math.max(-10, Math.min(9, e[1] + dy))) }));
  };

  const preset = (name: 'high' | 'standard' | 'low') => {
    if (name === 'standard') return setPos({});
    const dy = name === 'high' ? -6 : 3;
    setPos({ V1: onSkin(thetaOf(ELECTRODES.V1), ELECTRODES.V1[1] + dy), V2: onSkin(thetaOf(ELECTRODES.V2), ELECTRODES.V2[1] + dy) });
  };

  return (
    <div className="grid cols-2">
      <div className="panel">
        <div className="row" style={{ marginBottom: 8 }}>
          <label className="field">Heart
            <select value={src} onChange={(e) => setSrc(e.target.value)}>
              {SOURCES.map((s) => <option key={s} value={s}>{conditionById(s)?.name ?? s}</option>)}
            </select>
          </label>
          <button className="btn small" onClick={() => preset('standard')}>Standard placement</button>
          <button className="btn small" onClick={() => preset('high')}>V1–V2 two spaces too high</button>
          <Toggle label="Swap arm electrodes (LA↔RA)" value={swapArms} onChange={setSwapArms} />
        </div>
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width="100%" role="application" aria-label="Torso with draggable chest electrodes. Use arrow keys on a focused electrode to move it."
          onPointerMove={onMove} onPointerUp={() => setDrag(null)} onPointerLeave={() => setDrag(null)} style={{ touchAction: 'none', maxWidth: 560 }}>
          {/* unrolled chest wall */}
          <rect x={X0 - 135 * DEG} y={40} width={340 * DEG} height={H - 50} rx={14} fill="var(--panel-2)" stroke="var(--border)" strokeWidth={2} />
          {([[-90, 'R mid-axillary'], [-35, 'R mid-clav.'], [0, 'sternum'], [35, 'L mid-clav.'], [60, 'ant. axillary'], [90, 'L mid-axillary'], [135, 'scapula'], [180, 'spine']] as Array<[number, string]>).map(([d, lab]) => (
            <g key={lab}>
              <line x1={X0 + d * DEG} x2={X0 + d * DEG} y1={46} y2={H - 14} stroke="var(--border)" strokeDasharray={d === 0 || d === 180 ? '0' : '4 4'} strokeWidth={d === 0 || d === 180 ? 2 : 1} />
              <text x={X0 + d * DEG} y={H - 2} textAnchor="middle" fontSize={9} fill="var(--muted)">{lab}</text>
            </g>
          ))}
          {ICS.map(([lab, y]) => (
            <g key={lab}>
              <line x1={X0 - 130 * DEG} x2={X0 + 200 * DEG} y1={Y0 + y * PX} y2={Y0 + y * PX} stroke="var(--border)" strokeOpacity={0.7} />
              <text x={X0 - 133 * DEG} y={Y0 + y * PX - 2} fontSize={9} fill="var(--muted)">{lab}</text>
            </g>
          ))}
          {/* heart silhouette as seen from the front (approximate) */}
          <ellipse cx={X0 + 14 * DEG} cy={Y0 + 10} rx={34 * DEG} ry={62} fill="rgba(213,94,0,0.10)" stroke="var(--c-vermillion)" strokeDasharray="3 3" transform={`rotate(-30 ${X0 + 14 * DEG} ${Y0 + 10})`} />
          <text x={X0 + 30 * DEG} y={Y0 + 70} fontSize={10} fill="var(--c-vermillion)">heart (behind)</text>
          <text x={X0 - 125 * DEG} y={30} fontSize={11} fill="var(--muted)">◄ patient's right side</text>
          <text x={X0 + 30 * DEG} y={30} fontSize={11} fill="var(--muted)">patient's left side ► back</text>
          {/* arm electrodes */}
          {[['RA', X0 - 110 * DEG, 64], ['LA', X0 + 110 * DEG, 64]].map(([n, x, y]) => (
            <g key={n as string}>
              <circle cx={x as number} cy={y as number} r={11} fill={swapArms ? 'var(--c-orange)' : 'var(--panel)'} stroke="var(--text)" />
              <text x={x as number} y={(y as number) + 4} textAnchor="middle" fontSize={10} fontWeight={700} fill="var(--text)">{swapArms ? (n === 'RA' ? 'LA' : 'RA') : n}</text>
            </g>
          ))}
          {DRAGGABLE.map((l) => {
            const e = get(l);
            const [x, y] = e;
            const sx = X0 + thetaOf(e) * DEG, sy = Y0 + y * PX;
            const changed = !!pos[l];
            return (
              <g key={l} tabIndex={0} role="slider" aria-label={`Electrode ${l}`} aria-valuetext={`${x.toFixed(1)} cm lateral, ${y.toFixed(1)} cm from 4th space`}
                style={{ cursor: 'grab' }} onPointerDown={(e) => { (e.target as Element).setPointerCapture?.(e.pointerId); setDrag(l); }}
                onKeyDown={(e) => {
                  const d = e.shiftKey ? 2 : 0.6;
                  if (e.key === 'ArrowLeft') nudge(l, -d, 0);
                  else if (e.key === 'ArrowRight') nudge(l, d, 0);
                  else if (e.key === 'ArrowUp') nudge(l, 0, -d);
                  else if (e.key === 'ArrowDown') nudge(l, 0, d);
                  else return;
                  e.preventDefault();
                }}>
                <circle cx={sx} cy={sy} r={12} fill={changed ? 'var(--c-orange)' : l === 'V4R' || l.startsWith('V7') || l === 'V8' || l === 'V9' ? 'var(--c-green)' : 'var(--accent)'} stroke="#fff" strokeWidth={2} />
                <text x={sx} y={sy + 4} textAnchor="middle" fontSize={10} fontWeight={700} fill="#fff" pointerEvents="none">{l}</text>
              </g>
            );
          })}
        </svg>
        <p className="small muted">Drag an electrode (or focus it with Tab and use the arrow keys). Orange = moved from the standard position. The chest wall is drawn unrolled (front, sides and back); electrodes stay on the skin, so moving one sideways also changes how far it is from the heart.</p>
      </div>
      <div className="panel">
        <h3>Resulting leads (one beat each)</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 6 }}>
          {leads.map((l) => <MiniTrace key={l} data={gen.ecg.leads[l]} t0={t0} t1={t1} label={l} width={150} height={74} mvRange={1.8} highlight={!!pos[l] || (swapArms && !l.startsWith('V'))} />)}
        </div>
        <div className="callout" style={{ marginTop: 10 }}>
          {swapArms && <p><strong>Limb lead reversal (LA↔RA):</strong> lead I inverts (negative P, QRS and T), II and III swap, aVR and aVL swap. aVF is unchanged. Chest leads look normal – a clue it is a technical error, not dextrocardia.</p>}
          {moved ? (
            <p><strong>Moved electrodes:</strong> placing V1–V2 too high (2nd–3rd space) commonly produces an rSr′ pattern, an inverted P wave and smaller r waves – it can mimic incomplete RBBB or anterior infarction. Placing them too low can exaggerate or hide R-wave progression.</p>
          ) : !swapArms && <p>Standard placement: V1 4th space right sternal edge, V2 4th space left sternal edge, V4 5th space mid-clavicular line, V3 midway, V5 anterior axillary and V6 mid-axillary line at the V4 level. V4R mirrors V4 on the right; V7–V9 continue around the back at the V6 level (posterior axillary, scapular and paraspinal lines).</p>}
          <p className="small muted">Model note: the torso is a homogeneous elliptical cylinder; real torso shape and lung tissue change these effects quantitatively.</p>
        </div>
      </div>
    </div>
  );
}

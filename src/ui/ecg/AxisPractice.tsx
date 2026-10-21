/** Axis practice: limb leads only – estimate the frontal QRS axis, then see the worked answer. */
import { useMemo, useState } from 'react';
import { generateEcg } from '../../engine/electrical';
import { axisCategory } from '../../engine/electrical/criteria';
import { LIMB_ANGLES } from '../../engine/electrical/leads';
import { rng } from '../../engine/math';
import { writePref } from '../../store/app';
import { MiniTrace } from '../common/Trace';

const LIMBS = ['I', 'II', 'III', 'aVR', 'aVL', 'aVF'] as const;
const NORMAL_AXIS = (() => generateEcg({}, { durationMs: 2500, leads: [...LIMBS] }).measure?.axis ?? 50)();
const CAT_LABEL = { normal: 'Normal (−30° to +90°)', left: 'Left axis deviation (−30° to −90°)', right: 'Right axis deviation (+90° to +180°)', extreme: 'Extreme axis (−90° to ±180°)' };

function loadScore(): { right: number; total: number } {
  try {
    const v = window.localStorage.getItem('cardiosim.axisScore');
    return v ? JSON.parse(v) : { right: 0, total: 0 };
  } catch {
    return { right: 0, total: 0 };
  }
}

export default function AxisPractice() {
  const [seed, setSeed] = useState(7);
  const [guess, setGuess] = useState<number | null>(null);
  const [score, setScore] = useState(loadScore);
  const target = useMemo(() => {
    const r = rng(seed);
    // bias toward the clinically common range but include every quadrant
    const u = r();
    return u < 0.45 ? -20 + r() * 110 : u < 0.7 ? -85 + r() * 55 : u < 0.92 ? 95 + r() * 80 : -175 + r() * 80;
  }, [seed]);
  const gen = useMemo(() => generateEcg({ frontalRotationDeg: target - NORMAL_AXIS }, { durationMs: 3000, leads: [...LIMBS] }), [target]);
  const axis = Math.round(gen.measure?.axis ?? target);
  const beat = gen.ecg.beats[gen.beatIndex];
  const t0 = beat ? (beat.pOn ?? beat.qrsOn - 160) - 40 : 0;
  const t1 = beat ? beat.tEnd + 60 : 900;
  const net = (l: string) => gen.measure?.leads[l]?.qrsNet ?? 0;
  const mostIso = LIMBS.reduce((a, b) => (Math.abs(net(b)) / ((gen.measure?.leads[b]?.qrsPeakToPeak ?? 1) + 0.05) < Math.abs(net(a)) / ((gen.measure?.leads[a]?.qrsPeakToPeak ?? 1) + 0.05) ? b : a));
  const err = guess == null ? 0 : Math.abs(((guess - axis + 540) % 360) - 180);

  const submit = (deg: number) => {
    if (guess != null) return;
    setGuess(deg);
    const e = Math.abs(((deg - axis + 540) % 360) - 180);
    const ns = { right: score.right + (e <= 30 ? 1 : 0), total: score.total + 1 };
    setScore(ns);
    writePref('cardiosim.axisScore', ns);
  };

  return (
    <div className="grid cols-2">
      <div className="panel">
        <div className="panel-title">
          <h3>Estimate the QRS axis</h3>
          <span className="spacer" />
          <span className="small muted">Score: {score.right}/{score.total} within ±30°</span>
          <button className="btn small" onClick={() => { setScore({ right: 0, total: 0 }); writePref('cardiosim.axisScore', { right: 0, total: 0 }); }}>Reset</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 6 }}>
          {LIMBS.map((l) => <MiniTrace key={l} data={gen.ecg.leads[l]} t0={t0} t1={t1} label={l} width={170} height={80} mvRange={1.6} highlight={guess != null && l === mostIso} />)}
        </div>
        <p className="small muted">Click the wheel where you think the mean QRS vector points (or use the buttons for each 30° step).</p>
        <Wheel guess={guess} answer={guess != null ? axis : null} onPick={submit} />
        <div className="legend" style={{ justifyContent: 'center', marginBottom: 6 }}>
          <span style={{ color: 'var(--c-green)' }}><i />normal range</span>
          <span style={{ color: 'var(--c-orange)' }}><i style={{ borderTopStyle: 'dashed' }} />your answer</span>
          <span style={{ color: 'var(--c-blue)' }}><i />measured axis</span>
        </div>
        <div className="chips" role="group" aria-label="Pick an axis angle">
          {[-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150, 180].map((d) => (
            <button key={d} className="chip" disabled={guess != null} onClick={() => submit(d)}>{d > 0 ? '+' : ''}{d}°</button>
          ))}
        </div>
      </div>
      <div className="panel">
        <h3>Method</h3>
        <ol className="pearls">
          <li><strong>Quadrant</strong>: is the QRS mainly positive in lead I? In aVF? (I+ aVF+ normal; I+ aVF− check lead II; I− aVF+ right; I− aVF− extreme.)</li>
          <li><strong>Isoelectric lead</strong>: find the limb lead whose QRS is most equiphasic – the axis is roughly 90° from it, on the side where the QRS is positive.</li>
          <li><strong>Check</strong>: the lead with the tallest net-positive QRS points closest to the axis.</li>
        </ol>
        {guess != null ? (
          <div className="callout" aria-live="polite">
            <p><strong>Engine-measured axis: {axis > 0 ? '+' : ''}{axis}°</strong> – {CAT_LABEL[axisCategory(axis)]}. Your answer was {guess > 0 ? '+' : ''}{guess}° ({err <= 30 ? 'within 30° – good' : `${Math.round(err)}° away`}).</p>
            <p>Lead I is {net('I') >= 0 ? 'positive' : 'negative'}, aVF is {net('aVF') >= 0 ? 'positive' : 'negative'}. The most equiphasic lead is <strong>{mostIso}</strong> ({LIMB_ANGLES[mostIso]}°), so the axis lies near {perp(LIMB_ANGLES[mostIso], axis)}.</p>
            <button className="btn primary" onClick={() => { setGuess(null); setSeed((s) => s + 1); }}>Next ECG</button>
          </div>
        ) : <p className="muted">Answer to see the worked solution.</p>}
        <p className="note">Axis measured from net QRS area in leads I and aVF (the same calculation used throughout the app). Hand estimates within ±15–30° are clinically adequate.</p>
      </div>
    </div>
  );
}

function perp(isoDeg: number, axis: number) {
  const a = isoDeg + 90, b = isoDeg - 90;
  const d = (x: number) => Math.abs(((x - axis + 540) % 360) - 180);
  const p = d(a) < d(b) ? a : b;
  const n = ((p + 540) % 360) - 180;
  return `${n > 0 ? '+' : ''}${n}°`;
}

function Wheel({ guess, answer, onPick }: { guess: number | null; answer: number | null; onPick: (d: number) => void }) {
  const S = 240, C = S / 2, R = 92;
  const ray = (d: number, r = R) => [C + Math.cos((d * Math.PI) / 180) * r, C + Math.sin((d * Math.PI) / 180) * r];
  return (
    <svg viewBox={`0 0 ${S} ${S}`} width="100%" style={{ maxWidth: 280, display: 'block', margin: '6px auto', cursor: guess == null ? 'crosshair' : 'default' }}
      role="img" aria-label="Hexaxial wheel; click to answer"
      onClick={(e) => {
        const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
        const x = ((e.clientX - r.left) / r.width) * S - C, y = ((e.clientY - r.top) / r.height) * S - C;
        onPick(Math.round((Math.atan2(y, x) * 180) / Math.PI / 5) * 5);
      }}>
      {/* normal sector */}
      <path d={`M${C},${C} L${ray(-30)} A${R},${R} 0 0 1 ${ray(90)} Z`} fill="rgba(0,158,115,0.12)" />
      <circle cx={C} cy={C} r={R} fill="none" stroke="var(--border)" />
      {Object.entries(LIMB_ANGLES).map(([n, d]) => {
        const [x, y] = ray(d, R + 2), [lx, ly] = ray(d, R + 17), [bx, by] = ray(d + 180, R);
        return (
          <g key={n}>
            <line x1={bx} y1={by} x2={x} y2={y} stroke="var(--muted)" strokeWidth={0.7} />
            <text x={lx} y={ly + 4} textAnchor="middle" fontSize={10} fill="var(--text)">{n}</text>
          </g>
        );
      })}
      {guess != null && <line x1={C} y1={C} x2={ray(guess)[0]} y2={ray(guess)[1]} stroke="var(--c-orange)" strokeWidth={3} strokeDasharray="5 3" />}
      {answer != null && <line x1={C} y1={C} x2={ray(answer)[0]} y2={ray(answer)[1]} stroke="var(--c-blue)" strokeWidth={3} />}
    </svg>
  );
}

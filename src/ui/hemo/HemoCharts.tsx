import { useMemo } from 'react';
import type { HemoParams } from '../../data/types';
import { generateEcg } from '../../engine/electrical';
import { edpvr, espvr, guytonCurves, starlingCurve } from '../../engine/hemo/curves';
import { paramsFor } from '../../engine/hemo/params';
import { audibleSoundsAvg } from '../../engine/hemo/sounds';
import type { BeatSummary, Sample } from '../../engine/hemo/simulator';
import Chart, { type Series, type VBand, type VMark } from '../common/Chart';
import { beatSamples, lastFullBeat, type HemoView } from './useHemoSim';

const C = { ao: 'var(--c-vermillion)', lv: 'var(--c-blue)', la: 'var(--c-green)', rv: 'var(--c-purple)', pa: 'var(--c-orange)', ra: 'var(--c-sky)', ghost: 'var(--muted)' };
const pick = (ss: Sample[], k: keyof Sample) => ss.map((s) => s[k] as number);

let ecgBeat: { t: number[]; v: number[]; qrsOn: number } | null = null;
function normalEcgBeat() {
  if (ecgBeat) return ecgBeat;
  const g = generateEcg({}, { durationMs: 2500, leads: ['II'] });
  const b = g.ecg.beats[g.beatIndex];
  const x = g.ecg.leads.II;
  const t: number[] = [], v: number[] = [];
  for (let i = Math.round((b.pOn ?? b.qrsOn - 160) - 40); i < b.tEnd + 80; i += 2) { t.push(i); v.push(x[i] ?? 0); }
  ecgBeat = { t, v, qrsOn: b.qrsOn };
  return ecgBeat;
}

/** Wiggers diagram: pressures, LV volume, ECG and heart sounds for the last complete beat. */
export function Wiggers({ view, params, right }: { view: HemoView; params: HemoParams; right?: boolean }) {
  const beat = lastFullBeat(view);
  const ss = beatSamples(view, beat);
  if (!beat || ss.length < 10) return <p className="muted">Waiting for a complete beat…</p>;
  const t = ss.map((s) => (s.t - beat.tStart) * 1000);
  const dur = t[t.length - 1];
  const S = beat.sounds;
  const bands: VBand[] = [];
  if (S.s1 != null && beat.ejectionStartMs != null) bands.push({ x0: Math.max(0, S.s1), x1: beat.ejectionStartMs, label: 'IVC', fill: 'rgba(0,114,178,0.10)' });
  if (beat.ejectionStartMs != null && beat.ejectionEndMs != null) bands.push({ x0: beat.ejectionStartMs, x1: beat.ejectionEndMs, label: 'ejection', fill: 'rgba(213,94,0,0.07)' });
  if (beat.ejectionEndMs != null && S.mvOpen != null && S.mvOpen > beat.ejectionEndMs) bands.push({ x0: beat.ejectionEndMs, x1: S.mvOpen, label: 'IVR', fill: 'rgba(0,114,178,0.10)' });
  if (S.mvOpen != null) bands.push({ x0: S.mvOpen, x1: dur, label: 'filling', fill: 'rgba(0,158,115,0.06)' });
  const marks: VMark[] = audibleSoundsAvg(view.beats.filter((x) => x.tStart <= beat.tStart).slice(-5), params).map((e) => ({ x: e.t, label: e.id }));
  const pres: Series[] = right
    ? [{ label: 'PA', x: t, y: pick(ss, 'pPA'), color: C.pa }, { label: 'RV', x: t, y: pick(ss, 'pRV'), color: C.rv }, { label: 'RA', x: t, y: pick(ss, 'pRA'), color: C.ra }]
    : [{ label: 'Aorta', x: t, y: pick(ss, 'pAo'), color: C.ao }, { label: 'LV', x: t, y: pick(ss, 'pLV'), color: C.lv }, { label: 'LA', x: t, y: pick(ss, 'pLA'), color: C.la }];
  const sinus = params.rhythm === 'sinus';
  const ecg = sinus ? normalEcgBeat() : null;
  const ecgT = ecg ? ecg.t.map((x) => x - ecg.qrsOn - 20) : [];
  return (
    <div>
      <Chart height={230} xDomain={[0, dur]} yLabel="mmHg" series={pres} bands={bands} vmarks={marks} formatX={(x) => `${Math.round(x)} ms`} ariaLabel="Wiggers diagram pressures" />
      <Chart height={110} xDomain={[0, dur]} yLabel="mL" legend={false} series={[{ label: right ? 'RV volume' : 'LV volume', x: t, y: pick(ss, right ? 'vRV' : 'vLV'), color: right ? C.rv : C.lv }]} bands={bands} formatX={(x) => `${Math.round(x)} ms`} title={right ? 'RV volume' : 'LV volume'} />
      {ecg ? (
        <Chart height={90} xDomain={[0, dur]} yDomain={[-0.6, 1.4]} legend={false} series={[{ label: 'ECG II', x: ecgT, y: ecg.v, color: 'var(--trace)', width: 1.4 }]} vmarks={marks} title="ECG (lead II, schematic timing)" formatX={(x) => `${Math.round(x)} ms`} formatY={(y) => y.toFixed(1)} />
      ) : <p className="small muted">ECG timing panel shown for sinus rhythm only.</p>}
      <p className="small muted">IVC = isovolumetric contraction (all valves closed, pressure rises at constant volume); IVR = isovolumetric relaxation. S1 = mitral/tricuspid closure, A2/P2 = aortic/pulmonic closure.</p>
    </div>
  );
}

/** Pressure–volume loop with ESPVR/EDPVR and the normal loop as a ghost. */
export function PvLoop({ view, params, right }: { view: HemoView; params: HemoParams; right?: boolean }) {
  const loops = [2, 1, 0].map((k) => beatSamples(view, lastFullBeat(view, k)));
  const series: Series[] = [];
  const g = view.ghost?.samples ?? [];
  if (g.length && !right) series.push({ label: 'Normal (ghost)', x: pick(g, 'vLV'), y: pick(g, 'pLV'), color: C.ghost, dash: '4 3', width: 1.5, ghost: true });
  loops.forEach((ss, i) => {
    if (ss.length) series.push({ label: i === 2 ? 'Current loop' : `beat −${2 - i}`, x: pick(ss, right ? 'vRV' : 'vLV'), y: pick(ss, right ? 'pRV' : 'pLV'), color: right ? C.rv : C.lv, width: i === 2 ? 2.4 : 1, ghost: i !== 2 });
  });
  const vmax = Math.max(200, ...series.flatMap((s) => Array.from(s.x as number[])).filter(Number.isFinite)) * 1.05;
  const pmax = Math.max(right ? 50 : 160, ...series.flatMap((s) => Array.from(s.y as number[])).filter(Number.isFinite)) * 1.08;
  if (!right) {
    const vs: number[] = [], es: number[] = [], ed: number[] = [];
    for (let v = params.lvV0; v <= vmax; v += 2) { vs.push(v); es.push(espvr(v, params)); ed.push(edpvr(v, params)); }
    series.push({ label: 'ESPVR (contractility)', x: vs, y: es, color: 'var(--c-vermillion)', dash: '6 3', width: 1.2, ghost: true });
    series.push({ label: 'EDPVR (compliance)', x: vs, y: ed, color: 'var(--c-green)', dash: '2 3', width: 1.2, ghost: true });
  }
  const b = lastFullBeat(view);
  return (
    <div>
      <Chart height={300} xDomain={[0, vmax]} yDomain={[0, pmax]} xLabel={`${right ? 'RV' : 'LV'} volume (mL)`} yLabel="pressure (mmHg)" series={series} crosshair={false}
        formatX={(x) => String(Math.round(x))} ariaLabel="Pressure–volume loop" />
      {b && !right && (
        <p className="small">EDV <b className="mono">{Math.round(b.edv)}</b> · ESV <b className="mono">{Math.round(b.esv)}</b> · SV <b className="mono">{Math.round(b.sv)}</b> mL · EF <b className="mono">{Math.round(b.ef * 100)}%</b> · stroke work ≈ loop area. Counter-clockwise: filling (bottom) → isovolumetric contraction (right side) → ejection (top) → isovolumetric relaxation (left side).</p>
      )}
    </div>
  );
}

/** Frank–Starling curves (current vs normal) with the simulated operating point, plus Guyton's diagram. */
export function StarlingGuyton({ view, params }: { view: HemoView; params: HemoParams }) {
  const b = lastFullBeat(view);
  const normal = useMemo(() => starlingCurve(paramsFor('normal-hemo')), []);
  const cur = useMemo(() => starlingCurve(params), [params]);
  const gy = useMemo(() => (b ? guytonCurves(params, b.cvp, b.co, b.lvEdp) : null), [params, b?.cvp, b?.co, b?.lvEdp]);
  return (
    <div className="grid cols-2">
      <div>
        <Chart height={230} xDomain={[0, 35]} xLabel="LV end-diastolic pressure (mmHg)" yLabel="stroke volume (mL)" crosshair={false}
          series={[{ label: 'Normal heart', x: normal.x, y: normal.y, color: C.ghost, dash: '4 3' }, { label: 'Current contractility & afterload', x: cur.x, y: cur.y, color: C.lv }]}
          points={b ? [{ x: b.lvEdp, y: b.sv, label: 'now' }] : []} title="Frank–Starling" />
        <p className="small muted">SV = Ees·(EDV − V0)/(Ees + Ea). ↑ contractility or ↓ afterload lifts the curve; fluids move the point along it.</p>
      </div>
      <div>
        {gy && (
          <Chart height={230} xDomain={[-4, 20]} xLabel="right atrial pressure (mmHg)" yLabel="L/min" crosshair={false}
            series={[{ label: 'Venous return', x: gy.venous.x, y: gy.venous.y, color: C.la }, { label: 'Cardiac function', x: gy.cardiac.x, y: gy.cardiac.y, color: C.lv }]}
            points={b ? [{ x: b.cvp, y: b.co, label: `CO ${b.co.toFixed(1)}` }] : []} title="Guyton: venous return meets cardiac function" />
        )}
        {gy && <p className="small muted">Mean systemic filling pressure ≈ <b className="mono">{gy.pmsf.toFixed(1)}</b> mmHg (x-intercept of venous return). Volume shifts the venous-return line; contractility rotates the cardiac function curve.</p>}
      </div>
    </div>
  );
}

/** Rolling bedside-monitor traces for the last few seconds. */
export function Monitor({ view }: { view: HemoView }) {
  const ss = view.samples;
  if (ss.length < 10) return <p className="muted">Starting…</p>;
  const t1 = ss[ss.length - 1].t;
  const t0 = Math.max(ss[0].t, t1 - 6);
  const w = ss.filter((s) => s.t >= t0);
  const x = w.map((s) => s.t - t1);
  return (
    <div>
      <Chart height={120} xDomain={[t0 - t1, 0]} legend={false} series={[{ label: 'Arterial', x, y: pick(w, 'pAo'), color: C.ao }]} title="Arterial pressure (mmHg)" formatX={(v) => `${v.toFixed(0)} s`} />
      <Chart height={100} xDomain={[t0 - t1, 0]} legend={false} series={[{ label: 'PA', x, y: pick(w, 'pPA'), color: C.pa }]} title="Pulmonary artery (mmHg)" formatX={(v) => `${v.toFixed(0)} s`} />
      <Chart height={100} xDomain={[t0 - t1, 0]} legend={false} series={[{ label: 'CVP', x, y: pick(w, 'pRA'), color: C.ra }]} title="Central venous / RA (mmHg)" formatX={(v) => `${v.toFixed(0)} s`} />
    </div>
  );
}

/** Jugular venous pulse with a, c, x, v, y labelled (sinus rhythm). */
export function Jvp({ view, params }: { view: HemoView; params: HemoParams }) {
  const beats = [2, 1, 0].map((k) => lastFullBeat(view, k)).filter(Boolean) as BeatSummary[];
  if (!beats.length) return null;
  const t0 = beats[0].tStart - 0.05, t1 = beats[beats.length - 1].tEnd;
  const ss = view.samples.filter((s) => s.t >= t0 && s.t <= t1);
  const x = ss.map((s) => (s.t - t0) * 1000), y = pick(ss, 'pJV');
  const pts: Array<{ x: number; y: number; label: string; color: string }> = [];
  if (params.rhythm === 'sinus' || params.rhythm === 'chb') {
    const ext = (a: number, b: number, mode: 'max' | 'min') => {
      let best = -1;
      for (let i = 0; i < ss.length; i++) {
        if (ss[i].t < a || ss[i].t > b) continue;
        if (best < 0 || (mode === 'max' ? y[i] > y[best] : y[i] < y[best])) best = i;
      }
      return best;
    };
    const b = beats[beats.length - 1];
    const ej = b.tStart + (b.ejectionEndMs ?? 300) / 1000, mo = b.tStart + (b.sounds.mvOpen ?? 380) / 1000;
    const cand: Array<[string, number]> = [
      ['a', ext(b.tStart - 0.16, b.tStart + 0.03, 'max')], ['c', ext(b.tStart + 0.03, b.tStart + 0.1, 'max')], ['x', ext(b.tStart + 0.1, ej, 'min')],
      ['v', ext(ej - 0.1, mo + 0.04, 'max')], ['y', ext(mo, mo + 0.3, 'min')],
    ];
    for (const [l, i] of cand) if (i >= 0) pts.push({ x: x[i], y: y[i], label: l, color: 'var(--c-blue)' });
  }
  return (
    <div>
      <Chart height={170} legend={false} series={[{ label: 'JVP', x, y, color: C.ra }]} points={pts} yLabel="mmHg" title="Jugular venous pulse (great-vein pressure)" formatX={(v) => `${Math.round(v)} ms`} />
      <p className="small muted">a = atrial contraction · c = tricuspid bulging/carotid artefact · x = atrial relaxation & descent of the valve ring · v = atrial filling against a closed valve · y = tricuspid opening.</p>
    </div>
  );
}

/** Arterial pulse contour vs normal. */
export function PulseContour({ view }: { view: HemoView }) {
  const b = lastFullBeat(view);
  const ss = beatSamples(view, b);
  const g = view.ghost?.samples ?? [];
  if (!b || !ss.length) return null;
  const gt0 = g[0]?.t ?? 0;
  return (
    <Chart height={170} yLabel="mmHg" xLabel="ms from start of contraction" title="Arterial pulse contour"
      series={[
        ...(g.length ? [{ label: 'Normal', x: g.map((s) => (s.t - gt0) * 1000), y: pick(g, 'pAo'), color: C.ghost, dash: '4 3', width: 1.5 }] : []),
        { label: 'Current', x: ss.map((s) => (s.t - b.tStart) * 1000), y: pick(ss, 'pAo'), color: C.ao },
      ]} formatX={(v) => `${Math.round(v)}`} />
  );
}

/** Simulated Swan–Ganz pull-through: RA → RV → PA → wedge (2 beats each). */
export function PaCatheter({ view }: { view: HemoView }) {
  const beats = [7, 6, 5, 4, 3, 2, 1, 0].map((k) => lastFullBeat(view, k)).filter(Boolean) as BeatSummary[];
  if (beats.length < 8) return <p className="muted small">Collecting beats…</p>;
  const keys: Array<[keyof Sample, string]> = [['pRA', 'RA'], ['pRV', 'RV'], ['pPA', 'PA'], ['pPCW', 'wedge']];
  const x: number[] = [], y: number[] = [];
  const marks: VMark[] = [];
  let off = 0;
  keys.forEach(([k, label], i) => {
    marks.push({ x: off, label });
    for (const b of beats.slice(i * 2, i * 2 + 2)) {
      const ss = beatSamples(view, b);
      for (const s of ss) { x.push(off + (s.t - b.tStart) * 1000); y.push(s[k] as number); }
      off += (b.tEnd - b.tStart) * 1000;
    }
  });
  const last = beats[beats.length - 1];
  return (
    <div>
      <Chart height={180} legend={false} series={[{ label: 'catheter tip', x, y, color: C.pa }]} vmarks={marks} yLabel="mmHg" title="Pulmonary artery catheter: advancing the tip" formatX={(v) => `${(v / 1000).toFixed(1)} s`} />
      <p className="small">RA {Math.round(last.raMin)}–{Math.round(last.raA)} (mean {Math.round(last.cvp)}) · RV {Math.round(last.rvSys)}/{Math.round(last.rvEdp)} · PA {Math.round(last.paSys)}/{Math.round(last.paDia)} (mean {Math.round(last.paMean)}) · PCWP {Math.round(last.pcwp)} mmHg</p>
      <p className="small muted">The step-up in diastolic pressure from RV to PA marks crossing the pulmonic valve; wedging the balloon shows a damped left atrial pressure (a and v waves).</p>
    </div>
  );
}

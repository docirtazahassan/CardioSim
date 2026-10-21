import type { Finding } from '../../engine/electrical/interpret';
import type { BeatMeasure } from '../../engine/electrical/measure';
import { useApp } from '../../store/app';
import { Reveal } from '../common/controls';

export function FindingsList({ findings }: { findings: Finding[] }) {
  const level = useApp((s) => s.level);
  const shown = findings.filter((f) => !(f.level === 'clinician' && level === 'student'));
  return (
    <Reveal label="Interpretation hidden (teach mode) – click to reveal">
      <div className="findings" aria-live="polite">
        {shown.map((f) => (
          <div key={f.id} className={`finding ${f.category}`}>
            <div><strong>{f.label}</strong>{f.detail ? <span className="muted"> — {f.detail}</span> : null}</div>
            <div className="because"><em>Because:</em> {f.because}</div>
          </div>
        ))}
      </div>
    </Reveal>
  );
}

export function IntervalTable({ m, hr }: { m: BeatMeasure; hr: number }) {
  const fmt = (x: number | null | undefined, d = 0) => (x === null || x === undefined ? '—' : x.toFixed(d));
  return (
    <dl className="kv">
      <dt>Rate</dt><dd>{Math.round(hr)} /min</dd>
      <dt>PR</dt><dd>{fmt(m.pr)} ms</dd>
      <dt>QRS</dt><dd>{fmt(m.qrs)} ms</dd>
      <dt>QT</dt><dd>{fmt(m.qt)} ms</dd>
      <dt>QTc Bazett</dt><dd>{fmt(m.qtcBazett)} ms</dd>
      <dt>QTc Fridericia</dt><dd>{fmt(m.qtcFridericia)} ms</dd>
      <dt>QRS axis</dt><dd>{fmt(m.axis)}°</dd>
      <dt>P axis</dt><dd>{fmt(m.pAxis)}°</dd>
      <dt>T axis</dt><dd>{fmt(m.tAxis)}°</dd>
    </dl>
  );
}

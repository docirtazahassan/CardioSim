import katex from 'katex';
import { useEffect, useMemo, useState } from 'react';
import { EQUATIONS, type Equation } from '../../data/equations';
import { useApp } from '../../store/app';
import Chart from '../common/Chart';
import { LevelBadge, Pearls, Reveal, Slider } from '../common/controls';

function Tex({ tex }: { tex: string }) {
  const html = useMemo(() => katex.renderToString(tex, { displayMode: true, throwOnError: false, output: 'htmlAndMathml' }), [tex]);
  return <div className="eq" dangerouslySetInnerHTML={{ __html: html }} />;
}

export default function EquationsLab() {
  const { level, openCondition, openPreset, openRhythm } = useApp();
  const list = EQUATIONS.filter((e) => level === 'clinician' || e.level === 'student');
  const [id, setId] = useState(list[0].id);
  const eq = EQUATIONS.find((e) => e.id === id) ?? list[0];
  const groups = useMemo(() => {
    const g = new Map<string, Equation[]>();
    for (const e of list) { if (!g.has(e.group)) g.set(e.group, []); g.get(e.group)!.push(e); }
    return [...g.entries()];
  }, [list]);

  return (
    <div className="grid cols-sidebar">
      <aside className="panel" aria-label="Equations">
        <h3>Equations</h3>
        <ul className="list">
          {groups.map(([g, items]) => (
            <li key={g}>
              <div className="group">{g}</div>
              {items.map((e) => (
                <button key={e.id} aria-current={e.id === eq.id} onClick={() => setId(e.id)}>
                  <span style={{ flex: 1 }}>{e.title}</span>
                  {e.level === 'clinician' && <span className="badge">C</span>}
                </button>
              ))}
            </li>
          ))}
        </ul>
      </aside>
      <EquationView key={eq.id} eq={eq} go={() => {
        if (!eq.link) return;
        if (eq.link.mode === 'hemo') openPreset(eq.link.id);
        else if (eq.link.mode === 'ecg') openCondition(eq.link.id);
        else openRhythm(eq.link.id);
      }} />
    </div>
  );
}

function EquationView({ eq, go }: { eq: Equation; go: () => void }) {
  const [vals, setVals] = useState<Record<string, number>>(() => Object.fromEntries(eq.vars.map((v) => [v.key, v.value])));
  useEffect(() => setVals(Object.fromEntries(eq.vars.map((v) => [v.key, v.value]))), [eq]);
  const out = eq.compute(vals);
  const plot = useMemo(() => {
    if (!eq.plot) return null;
    const xv = eq.vars.find((v) => v.key === eq.plot!.x)!;
    const xs: number[] = [];
    for (let i = 0; i <= 120; i++) xs.push(xv.min + ((xv.max - xv.min) * i) / 120);
    const at = (f: (v: Record<string, number>) => number) => xs.map((x) => f({ ...vals, [xv.key]: x }));
    const colors = ['var(--c-blue)', 'var(--c-orange)', 'var(--c-green)', 'var(--c-purple)'];
    return {
      xv,
      series: [
        { label: 'current settings', x: xs, y: at(eq.plot.y), color: colors[0] },
        ...(eq.plot.series ?? []).map((s, i) => ({ label: s.label, x: xs, y: at(s.y), color: colors[i + 1], dash: '5 3' })),
      ],
      point: { x: vals[xv.key], y: eq.plot.y(vals) },
    };
  }, [eq, vals]);

  return (
    <section className="stack">
      <div className="panel">
        <div className="panel-title">
          <h2>{eq.title}</h2>
          <LevelBadge level={eq.level} />
          <span className="spacer" />
          {eq.link && <button className="btn small" onClick={go}>{eq.link.label} →</button>}
        </div>
        <Tex tex={eq.tex} />
        <p>{eq.explain}</p>
      </div>
      <div className="grid cols-2">
        <div className="panel">
          <h3>Try it</h3>
          <div className="stack" style={{ gap: 8 }}>
            {eq.vars.map((v) => (
              <Slider key={v.key} label={`${v.label}${v.unit ? ` (${v.unit})` : ''}`} value={vals[v.key]} min={v.min} max={v.max} step={v.step}
                onChange={(x) => setVals((s) => ({ ...s, [v.key]: x }))} format={(x) => (Math.abs(x) < 10 && v.step < 1 ? x.toFixed(v.step < 0.01 ? 3 : 2) : String(Math.round(x * 100) / 100))} />
            ))}
            <button className="btn small" style={{ alignSelf: 'flex-start' }} onClick={() => setVals(Object.fromEntries(eq.vars.map((v) => [v.key, v.value])))}>Reset to normal</button>
          </div>
          <h3 style={{ marginTop: 12 }}>Result</h3>
          <Reveal label="Result hidden (teach mode) – click to reveal">
            <dl className="kv" aria-live="polite">
              {out.map((o) => (
                <div key={o.label} style={{ display: 'contents' }}>
                  <dt>{o.label}</dt>
                  <dd>
                    {Number.isFinite(o.value) ? o.value.toFixed(o.digits ?? 1) : '—'} {o.unit ?? ''}
                    {o.flag && <div className="small" style={{ fontFamily: 'var(--font)', color: 'var(--bad)' }}>⚠ {o.flag}</div>}
                  </dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>
        <div className="panel">
          {plot ? (
            <>
              <h3>How the output changes with {plot.xv.label.toLowerCase()}</h3>
              <Chart height={260} xLabel={eq.plot!.xLabel} yLabel={eq.plot!.yLabel} series={plot.series}
                yDomain={eq.plot!.yMin !== undefined || eq.plot!.yMax !== undefined ? [eq.plot!.yMin ?? Math.min(...plot.series.flatMap((s) => s.y)), eq.plot!.yMax ?? Math.max(...plot.series.flatMap((s) => s.y)) * 1.05] : undefined}
                points={[{ x: plot.point.x, y: plot.point.y, label: 'now' }]} />
            </>
          ) : <p className="muted">No plot for this relation – use the sliders.</p>}
          <Pearls items={eq.pearls} />
        </div>
      </div>
    </section>
  );
}

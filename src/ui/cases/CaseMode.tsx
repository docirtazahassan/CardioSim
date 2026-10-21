import { useEffect, useMemo, useState } from 'react';
import { CASES } from '../../data/cases';
import { CONDITIONS, conditionById } from '../../data/conditions';
import { presetById } from '../../data/presets';
import { RHYTHMS, rhythmById } from '../../data/rhythms';
import type { CaseItem } from '../../data/types';
import { generateEcg, generateRhythmEcg } from '../../engine/electrical';
import { paramsFor } from '../../engine/hemo/params';
import { steadyState } from '../../engine/hemo/simulator';
import { rng } from '../../engine/math';
import { useApp, writePref } from '../../store/app';
import { LevelBadge, Tabs } from '../common/controls';
import EcgPaper from '../ecg/EcgPaper';

type Scores = { cases: Record<string, { correct: number; total: number }>; ecg: { correct: number; total: number; streak: number } };
function loadScores(): Scores {
  try {
    const v = window.localStorage.getItem('cardiosim.scores');
    if (v) return { cases: {}, ecg: { correct: 0, total: 0, streak: 0 }, ...JSON.parse(v) };
  } catch { /* storage unavailable */ }
  return { cases: {}, ecg: { correct: 0, total: 0, streak: 0 } };
}

export default function CaseMode() {
  const [tab, setTab] = useState<'cases' | 'ecg' | 'rhythm'>('cases');
  const [scores, setScores] = useState<Scores>(loadScores);
  const save = (s: Scores) => { setScores(s); writePref('cardiosim.scores', s); };
  return (
    <div className="stack">
      <div className="row">
        <h2 style={{ margin: 0 }}>Cases & quiz</h2>
        <Tabs label="Quiz type" value={tab} onChange={setTab} tabs={[{ id: 'cases', label: 'Clinical vignettes' }, { id: 'ecg', label: 'ECG interpretation drill' }, { id: 'rhythm', label: 'Rhythm strip drill' }]} />
        <span className="spacer" />
        <span className="small muted">Scores are stored only in this browser.</span>
        <button className="btn small" onClick={() => save({ cases: {}, ecg: { correct: 0, total: 0, streak: 0 } })}>Reset scores</button>
      </div>
      {tab === 'cases' && <Vignettes scores={scores} save={save} />}
      {tab === 'ecg' && <Drill kind="ecg" scores={scores} save={save} />}
      {tab === 'rhythm' && <Drill kind="rhythm" scores={scores} save={save} />}
      <p className="small muted">Teach mode shortcuts: <span className="kbd">1</span>–<span className="kbd">4</span> answer · <span className="kbd">N</span> next · <span className="kbd">R</span> reveal.</p>
    </div>
  );
}

function Vignettes({ scores, save }: { scores: Scores; save: (s: Scores) => void }) {
  const { level } = useApp();
  const list = CASES.filter((c) => level === 'clinician' || c.level === 'student');
  const [idx, setIdx] = useState(0);
  const c = list[idx % list.length];
  return (
    <div className="grid cols-sidebar">
      <aside className="panel" aria-label="Cases">
        <ul className="list">
          {list.map((x, i) => {
            const s = scores.cases[x.id];
            return (
              <li key={x.id}><button aria-current={i === idx} onClick={() => setIdx(i)}>
                <span style={{ flex: 1 }}>{x.title}</span>
                {s && <span className="badge">{s.correct}/{s.total}</span>}
              </button></li>
            );
          })}
        </ul>
      </aside>
      <CaseView key={c.id} c={c} onNext={() => setIdx((i) => (i + 1) % list.length)}
        onScore={(correct) => {
          const prev = scores.cases[c.id] ?? { correct: 0, total: 0 };
          save({ ...scores, cases: { ...scores.cases, [c.id]: { correct: prev.correct + (correct ? 1 : 0), total: prev.total + 1 } } });
        }} />
    </div>
  );
}

function CaseView({ c, onNext, onScore }: { c: CaseItem; onNext: () => void; onScore: (correct: boolean) => void }) {
  const { openCondition, openPreset, openRhythm, setMode } = useApp();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [qi, setQi] = useState(0);
  const [hemo, setHemo] = useState<null | ReturnType<typeof steadyState>['summary']>(null);
  const ecg = useMemo(() => {
    if (c.media.rhythm) return generateRhythmEcg(c.media.rhythm, c.media.condition ? conditionById(c.media.condition)?.model ?? {} : {}, { durationMs: 10600, leads: ['II', 'V1'] });
    if (c.media.condition) {
      const cond = conditionById(c.media.condition);
      const model = cond?.stages?.find((s) => s.id === c.media.stage)?.model ?? cond?.model ?? {};
      return generateEcg(model, { durationMs: 10600, heartRate: c.media.heartRate, leads: ['I', 'II', 'III', 'aVR', 'aVL', 'aVF', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V4R', 'V5R', 'V6R', 'V7', 'V8', 'V9'] });
    }
    return null;
  }, [c]);
  useEffect(() => {
    if (!c.media.showHemo || !c.media.preset) return;
    const id = window.setTimeout(() => setHemo(steadyState(paramsFor(c.media.preset), 16, 6).summary), 20);
    return () => window.clearTimeout(id);
  }, [c]);
  const q = c.questions[qi];
  const answered = q && answers[q.id] !== undefined;
  const answer = (i: number) => {
    if (!q || answered) return;
    setAnswers((a) => ({ ...a, [q.id]: i }));
    onScore(i === q.answer);
  };
  const next = () => (qi < c.questions.length - 1 ? setQi(qi + 1) : onNext());
  useShortcuts(answer, next, () => q && !answered && answer(q.answer));

  const linkFor = (id: string) => {
    const cond = conditionById(id); if (cond) return { name: cond.name, go: () => openCondition(id) };
    const p = presetById(id); if (p) return { name: `${p.name} (hemodynamics)`, go: () => openPreset(id) };
    const r = rhythmById(id); if (r) return { name: `${r.name} (rhythm)`, go: () => openRhythm(id) };
    return { name: `Equation: ${id}`, go: () => setMode('equations') };
  };

  return (
    <section className="stack">
      <div className="panel">
        <div className="panel-title"><h2>{c.title}</h2><LevelBadge level={c.level} /></div>
        <p style={{ fontSize: '1.05em' }}>{c.vignette}</p>
        {ecg && <EcgPaper ecg={ecg.ecg} layout={c.media.rhythm ? 'strip' : c.media.layout ?? '3x4'} stripLeads={['II', 'V1']} startMs={500} durationMs={10000} ariaLabel="Case ECG" />}
        {c.media.showHemo && (hemo ? (
          <dl className="kv" style={{ marginTop: 8, gridTemplateColumns: 'repeat(4, auto 1fr)' }}>
            <dt>BP</dt><dd>{Math.round(hemo.sbp)}/{Math.round(hemo.dbp)}</dd>
            <dt>HR</dt><dd>{Math.round(hemo.hr)}</dd>
            <dt>CVP</dt><dd>{Math.round(hemo.cvp)}</dd>
            <dt>PCWP</dt><dd>{Math.round(hemo.pcwp)}</dd>
            <dt>CO</dt><dd>{hemo.co.toFixed(1)} L/min</dd>
            <dt>EF</dt><dd>{Math.round(hemo.ef * 100)}%</dd>
            <dt>SvO₂</dt><dd>{Math.round(hemo.svo2 * 100)}%</dd>
            <dt>PA</dt><dd>{Math.round(hemo.paSys)}/{Math.round(hemo.paDia)}</dd>
          </dl>
        ) : <p className="small muted">Simulating hemodynamics…</p>)}
      </div>
      {q && (
        <div className="panel">
          <h3>Question {qi + 1} of {c.questions.length}</h3>
          <p>{q.prompt}</p>
          <div role="group" aria-label="Answer options">
            {q.options.map((o, i) => (
              <button key={i} className={`option ${answered ? (i === q.answer ? 'correct' : i === answers[q.id] ? 'wrong' : '') : ''}`} onClick={() => answer(i)} disabled={answered}>
                <span className="kbd">{i + 1}</span> {o} {answered && i === q.answer ? ' ✓' : answered && i === answers[q.id] ? ' ✗' : ''}
              </button>
            ))}
          </div>
          {answered && (
            <div className="callout" aria-live="polite" style={{ marginTop: 8 }}>
              <strong>{answers[q.id] === q.answer ? 'Correct.' : 'Not quite.'}</strong> {q.explanation}
              <div style={{ marginTop: 8 }}><button className="btn primary" onClick={next}>{qi < c.questions.length - 1 ? 'Next question' : 'Next case'} (N)</button></div>
            </div>
          )}
          {answered && qi === c.questions.length - 1 && (
            <>
              <h3 style={{ marginTop: 10 }}>Teaching points</h3>
              <ul className="pearls">{c.teachingPoints.map((t, i) => <li key={i}>{t}</li>)}</ul>
              <div className="chips" style={{ marginTop: 6 }}>{c.links.map((id) => { const l = linkFor(id); return <button key={id} className="chip" onClick={l.go}>{l.name} →</button>; })}</div>
            </>
          )}
        </div>
      )}
    </section>
  );
}

function useShortcuts(answer: (i: number) => void, next: () => void, reveal: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
      if (/^[1-4]$/.test(e.key)) answer(Number(e.key) - 1);
      else if (e.key === 'n' || e.key === 'N') next();
      else if (e.key === 'r' || e.key === 'R') reveal();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
}

/** Random ECG / rhythm with four diagnoses to choose from. Distractors come from the same category when possible. */
function Drill({ kind, scores, save }: { kind: 'ecg' | 'rhythm'; scores: Scores; save: (s: Scores) => void }) {
  const { level } = useApp();
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e6));
  const [picked, setPicked] = useState<number | null>(null);
  const pool = useMemo(() => kind === 'ecg'
    ? CONDITIONS.filter((c) => c.category !== 'artefact' && (level === 'clinician' || c.level === 'student')).map((c) => ({ id: c.id, name: c.name, group: c.category as string }))
    : RHYTHMS.filter((r) => r.id !== 'pea' && (level === 'clinician' || r.level === 'student')).map((r) => ({ id: r.id, name: r.name, group: r.group as string })), [kind, level]);
  const item = useMemo(() => {
    const r = rng(seed);
    const target = pool[Math.floor(r() * pool.length)];
    const same = pool.filter((p) => p.id !== target.id && p.group === target.group);
    const other = pool.filter((p) => p.id !== target.id && p.group !== target.group);
    const shuffle = <T,>(a: T[]) => a.map((x) => [r(), x] as const).sort((p, q) => p[0] - q[0]).map((x) => x[1]);
    const opts = shuffle([target, ...shuffle(same).slice(0, 2), ...shuffle(other)].slice(0, 4));
    const ecg = kind === 'ecg' ? generateEcg(conditionById(target.id)!.model, { durationMs: 10600, seed }) : generateRhythmEcg(target.id, {}, { durationMs: 10600, leads: ['II', 'V1'], seed });
    return { target, opts, ecg };
  }, [seed, pool, kind]);
  const answer = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    const ok = item.opts[i].id === item.target.id;
    save({ ...scores, ecg: { correct: scores.ecg.correct + (ok ? 1 : 0), total: scores.ecg.total + 1, streak: ok ? scores.ecg.streak + 1 : 0 } });
  };
  const next = () => { setPicked(null); setSeed((s) => s + 7919); };
  useShortcuts(answer, next, () => answer(item.opts.findIndex((o) => o.id === item.target.id)));
  return (
    <div className="panel">
      <div className="panel-title">
        <h3>What is the diagnosis?</h3>
        <span className="spacer" />
        <span className="small">Score {scores.ecg.correct}/{scores.ecg.total} · streak {scores.ecg.streak}</span>
      </div>
      <EcgPaper ecg={item.ecg.ecg} layout={kind === 'ecg' ? '3x4' : 'strip'} stripLeads={['II', 'V1']} startMs={500} durationMs={10000} calipers ariaLabel="Quiz ECG" />
      <div className="grid cols-2" style={{ marginTop: 8 }}>
        {item.opts.map((o, i) => (
          <button key={o.id} className={`option ${picked !== null ? (o.id === item.target.id ? 'correct' : i === picked ? 'wrong' : '') : ''}`} onClick={() => answer(i)} disabled={picked !== null}>
            <span className="kbd">{i + 1}</span> {o.name}
          </button>
        ))}
      </div>
      {picked !== null && (
        <div className="callout" style={{ marginTop: 8 }} aria-live="polite">
          <strong>{item.opts[picked].id === item.target.id ? 'Correct!' : `Answer: ${item.target.name}.`}</strong>{' '}
          {kind === 'ecg' ? conditionById(item.target.id)?.mechanism : rhythmById(item.target.id)?.mechanismText}
          <div style={{ marginTop: 8 }}><button className="btn primary" onClick={next}>Next (N)</button></div>
        </div>
      )}
      <p className="note">Drag on the ECG to use calipers. Simulated textbook patterns – real tracings are noisier and more variable.</p>
    </div>
  );
}

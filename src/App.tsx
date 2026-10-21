import { lazy, Suspense, useEffect, useState } from 'react';
import { useApp, type Mode } from './store/app';

const ExploreMode = lazy(() => import('./ui/explore/ExploreMode'));
const EcgLab = lazy(() => import('./ui/ecg/EcgLab'));
const ArrhythmiaLab = lazy(() => import('./ui/arrhythmia/ArrhythmiaLab'));
const CoronaryLab = lazy(() => import('./ui/coronary/CoronaryLab'));
const HemoLab = lazy(() => import('./ui/hemo/HemoLab'));
const EquationsLab = lazy(() => import('./ui/equations/EquationsLab'));
const CaseMode = lazy(() => import('./ui/cases/CaseMode'));

const NAV: Array<{ id: Mode; label: string; key: string }> = [
  { id: 'explore', label: 'Explore', key: '1' },
  { id: 'ecg', label: 'ECG lab', key: '2' },
  { id: 'arrhythmia', label: 'Arrhythmia lab', key: '3' },
  { id: 'coronary', label: 'Coronary lab', key: '4' },
  { id: 'hemo', label: 'Hemodynamics lab', key: '5' },
  { id: 'equations', label: 'Equations', key: '6' },
  { id: 'cases', label: 'Cases & quiz', key: '7' },
];

function HeartLogo() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path d="M16 28 C4 19 2 13 5 8 C8 3 14 4 16 9 C18 4 24 3 27 8 C30 13 28 19 16 28Z" fill="#d1453b" />
      <polyline points="5,16 11,16 13,12 15,21 17,10 19,16 27,16" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

export default function App() {
  const { mode, setMode, level, setLevel, teach, setTeach, theme, setTheme } = useApp();
  const [help, setHelp] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
    root.setAttribute('data-teach', String(teach));
  }, [theme, teach]);

  useEffect(() => {
    const onHash = () => {
      const m = window.location.hash.replace(/^#\/?/, '').split('/')[0] as Mode;
      if (NAV.some((n) => n.id === m) && m !== useApp.getState().mode) useApp.setState({ mode: m });
    };
    window.addEventListener('hashchange', onHash);
    const onKey = (e: KeyboardEvent) => {
      const tg = e.target as HTMLElement;
      const typing = tg && (tg.tagName === 'INPUT' || tg.tagName === 'SELECT' || tg.tagName === 'TEXTAREA');
      if (!e.altKey && !e.ctrlKey && !e.metaKey && !typing) {
        if (e.key === 't' || e.key === 'T') { useApp.getState().setTeach(!useApp.getState().teach); return; }
        if (e.key === '?') { setHelp((h) => !h); return; }
        if (e.key === 'Escape') { setHelp(false); return; }
      }
      if (!e.altKey) return;
      const n = NAV.find((x) => x.key === e.key);
      if (n) { setMode(n.id); e.preventDefault(); }
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('hashchange', onHash); window.removeEventListener('keydown', onKey); };
  }, [setMode]);

  return (
    <div className="app">
      <header className="header">
        <div className="brand"><HeartLogo /> CardioSim</div>
        <nav className="nav" aria-label="Modes">
          {NAV.map((n) => (
            <button key={n.id} aria-current={mode === n.id ? 'page' : undefined} onClick={() => setMode(n.id)} title={`Alt+${n.key}`}>
              {n.label}
            </button>
          ))}
        </nav>
        <div className="header-tools">
          <div className="seg" role="group" aria-label="Audience level">
            <button aria-pressed={level === 'student'} onClick={() => setLevel('student')}>Student</button>
            <button aria-pressed={level === 'clinician'} onClick={() => setLevel('clinician')}>Clinician</button>
          </div>
          <button className="icon-btn" aria-pressed={teach} onClick={() => setTeach(!teach)} title="Teach mode: large fonts, hidden answers, presenter shortcuts">
            {teach ? 'Teach mode ✓' : 'Teach mode'}
          </button>
          <select aria-label="Theme" value={theme} onChange={(e) => setTheme(e.target.value as typeof theme)} className="icon-btn" style={{ background: 'transparent' }}>
            <option value="system">Auto theme</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>
      </header>
      <main className="main" id="main">
        <Suspense fallback={<div className="panel">Loading…</div>}>
          {mode === 'explore' && <ExploreMode />}
          {mode === 'ecg' && <EcgLab />}
          {mode === 'arrhythmia' && <ArrhythmiaLab />}
          {mode === 'coronary' && <CoronaryLab />}
          {mode === 'hemo' && <HemoLab />}
          {mode === 'equations' && <EquationsLab />}
          {mode === 'cases' && <CaseMode />}
        </Suspense>
      </main>
      {help && (
        <div role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" className="modal" onClick={() => setHelp(false)}>
          <div className="panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <h2>Keyboard shortcuts</h2>
            <table className="table"><tbody>
              <tr><th><span className="kbd">Alt</span>+<span className="kbd">1</span>…<span className="kbd">7</span></th><td>Switch mode</td></tr>
              <tr><th><span className="kbd">T</span></th><td>Teach mode on/off (large fonts, answers hidden until clicked)</td></tr>
              <tr><th><span className="kbd">1</span>–<span className="kbd">4</span></th><td>Answer a quiz question</td></tr>
              <tr><th><span className="kbd">R</span></th><td>Reveal the answer (quiz)</td></tr>
              <tr><th><span className="kbd">N</span></th><td>Next question / case</td></tr>
              <tr><th><span className="kbd">Tab</span> / arrows</th><td>Move between controls; arrows move a focused electrode in the lead builder</td></tr>
              <tr><th><span className="kbd">?</span> / <span className="kbd">Esc</span></th><td>Show / hide this help</td></tr>
            </tbody></table>
            <button className="btn primary" style={{ marginTop: 10 }} onClick={() => setHelp(false)}>Close</button>
          </div>
        </div>
      )}
      <footer className="footer">
        <span><strong>Educational tool. Not for clinical diagnosis or management.</strong> Typical textbook patterns are shown – real ECGs and patients vary.</span>
        <button className="no-print btn small" onClick={() => setHelp(true)}>Keyboard shortcuts (?)</button>
      </footer>
    </div>
  );
}

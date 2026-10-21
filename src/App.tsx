import { lazy, Suspense, useEffect } from 'react';
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
      <footer className="footer">
        <span><strong>Educational tool. Not for clinical diagnosis or management.</strong> Typical textbook patterns are shown – real ECGs and patients vary.</span>
        <span className="no-print">Keyboard: Alt+1…7 switch modes</span>
      </footer>
    </div>
  );
}

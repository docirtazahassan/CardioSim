import { useState, type ReactNode } from 'react';
import { useApp } from '../../store/app';

export function Tabs<T extends string>({ tabs, value, onChange, label }: { tabs: Array<{ id: T; label: string }>; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div className="chips" role="tablist" aria-label={label}>
      {tabs.map((t) => (
        <button key={t.id} role="tab" className="chip" aria-selected={value === t.id} aria-pressed={value === t.id} onClick={() => onChange(t.id)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Slider({ label, value, min, max, step = 1, onChange, unit = '', format }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; unit?: string; format?: (v: number) => string }) {
  return (
    <label className="slider">
      <span>{label}</span>
      <span className="val">{format ? format(value) : value}{unit}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label={label} />
    </label>
  );
}

export function Toggle({ label, value, onChange, title }: { label: string; value: boolean; onChange: (v: boolean) => void; title?: string }) {
  return (
    <button className="btn small" aria-pressed={value} onClick={() => onChange(!value)} title={title}>
      {label}
    </button>
  );
}

export function LevelBadge({ level }: { level: 'student' | 'clinician' }) {
  return level === 'clinician' ? <span className="badge clin" title="Clinician-level content">Clinician</span> : null;
}

/** In teach mode, content is hidden until clicked (so a presenter can reveal it). */
export function Reveal({ children, label = 'Click to reveal' }: { children: ReactNode; label?: string }) {
  const teach = useApp((s) => s.teach);
  const [shown, setShown] = useState(false);
  if (!teach || shown) return <>{children}</>;
  return (
    <div className="teach-hidden" role="button" tabIndex={0} onClick={() => setShown(true)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setShown(true)} aria-label={label} title={label}>
      {children}
    </div>
  );
}

export function Pearls({ items, title = 'High-yield pearls' }: { items: string[]; title?: string }) {
  if (!items.length) return null;
  return (
    <div>
      <h3>{title}</h3>
      <ul className="pearls">{items.map((p, i) => <li key={i}>{p}</li>)}</ul>
    </div>
  );
}

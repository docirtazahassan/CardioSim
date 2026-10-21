/** Auscultation: chest map, bell/diaphragm, synthesized heart sounds and murmurs, phonocardiogram. */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { HemoParams } from '../../data/types';
import { describeMurmurs, SITES, synthPhono, type AuscSite, type ChestPiece, type PhonoResult } from '../../engine/audio/phono';
import Chart from '../common/Chart';
import { lastFullBeat, type HemoView } from './useHemoSim';

export default function Auscultation({ view, params }: { view: HemoView; params: HemoParams }) {
  const [site, setSite] = useState<AuscSite>('aortic');
  const [piece, setPiece] = useState<ChestPiece>('diaphragm');
  const [playing, setPlaying] = useState(false);
  const [rec, setRec] = useState<PhonoResult | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const srcRef = useRef<AudioBufferSourceNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const [volume, setVolume] = useState(0.8);

  const recent = useMemo(() => {
    const b = lastFullBeat(view);
    return b ? view.beats.filter((x) => x.tEnd <= b.tEnd && x.tStart >= (view.samples[0]?.t ?? 0)) : [];
  }, [view]);
  const description = useMemo(() => describeMurmurs(recent.slice(-6)), [recent]);

  // (Re)record ~6 s whenever the listening position, chest piece or physiology changes.
  const [take, setTake] = useState(0);
  const key = `${site}|${piece}|${JSON.stringify(params)}|${view.epoch}|${take}`;
  const lastKey = useRef('');
  useEffect(() => {
    if (recent.length < 4) return;
    if (lastKey.current === key && rec) return;
    lastKey.current = key;
    const r = synthPhono({ samples: view.samples, beats: recent, params, site, piece, seconds: 6 });
    setRec(r);
    if (playing) start(r);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, recent.length > 4]);

  function stop() {
    try { srcRef.current?.stop(); } catch { /* already stopped */ }
    srcRef.current = null;
  }
  function start(r: PhonoResult) {
    stop();
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!ctxRef.current) ctxRef.current = new Ctx();
      const ctx = ctxRef.current;
      void ctx.resume();
      const buf = ctx.createBuffer(1, r.audio.length, r.fs);
      buf.copyToChannel(r.audio, 0);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      if (!gainRef.current) { gainRef.current = ctx.createGain(); gainRef.current.connect(ctx.destination); }
      gainRef.current.gain.value = volume;
      src.connect(gainRef.current);
      src.start();
      srcRef.current = src;
    } catch {
      setPlaying(false);
    }
  }
  useEffect(() => { if (gainRef.current) gainRef.current.gain.value = volume; }, [volume]);
  useEffect(() => () => { stop(); void ctxRef.current?.close(); }, []);

  const toggle = () => {
    if (playing) { stop(); setPlaying(false); }
    else if (rec) { start(rec); setPlaying(true); }
  };

  // phonocardiogram (10 ms envelope)
  const phono = useMemo(() => {
    if (!rec) return null;
    const step = Math.round(rec.fs * 0.004);
    const x: number[] = [], y: number[] = [], yn: number[] = [];
    for (let i = 0; i < rec.audio.length; i += step) {
      let mx = 0, mn = 0;
      for (let k = i; k < Math.min(rec.audio.length, i + step); k++) { mx = Math.max(mx, rec.audio[k]); mn = Math.min(mn, rec.audio[k]); }
      x.push(i / rec.fs); y.push(mx); yn.push(mn);
    }
    return { x, y, yn };
  }, [rec]);

  return (
    <div className="grid cols-2">
      <div>
        <div className="row" style={{ marginBottom: 8 }}>
          <button className="btn primary" onClick={toggle} disabled={!rec} aria-pressed={playing}>{playing ? '■ Stop' : '▶ Listen'}</button>
          <div className="chips" role="group" aria-label="Chest piece">
            {(['diaphragm', 'bell'] as ChestPiece[]).map((p) => (
              <button key={p} className="chip" aria-pressed={piece === p} onClick={() => setPiece(p)}>{p === 'bell' ? 'Bell (low pitch)' : 'Diaphragm (high pitch)'}</button>
            ))}
          </div>
          <button className="btn small" onClick={() => setTake((t) => t + 1)} title="After a maneuver, wait a few beats and record again">Record latest beats</button>
          <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>Volume
            <input type="range" min={0} max={1.5} step={0.05} value={volume} onChange={(e) => setVolume(Number(e.target.value))} aria-label="Volume" />
          </label>
        </div>
        <ChestMap site={site} onPick={setSite} />
        <p className="small"><strong>{SITES[site].label}:</strong> {SITES[site].where}.</p>
        <p className="note">Use headphones – heart sounds are mostly below 200 Hz and small speakers cannot reproduce S3, S4 or a mitral rumble. Sounds are synthesised from the simulated valve events and jet flows (not recordings).</p>
      </div>
      <div className="stack">
        {!rec && <p className="muted">Collecting beats…</p>}
        {phono && rec && (
          <Chart height={180} legend={false} yDomain={[-1, 1]} xDomain={[0, phono.x[phono.x.length - 1]]} title={`Phonocardiogram – ${SITES[site].label}, ${piece}`} xLabel="s"
            series={[{ label: 'sound', x: phono.x, y: phono.y, color: 'var(--c-blue)', width: 1 }, { label: 'sound−', x: phono.x, y: phono.yn, color: 'var(--c-blue)', width: 1, ghost: true }]}
            vmarks={(() => { const s1 = rec.events.filter((e) => e.id === 'S1'); const a = s1[0]?.t ?? 0, b = s1[1]?.t ?? a + 1; return rec.events.filter((e) => e.t >= a - 0.25 && e.t < b - 0.01).map((e) => ({ x: e.t, label: e.id })); })()}
            formatX={(v) => v.toFixed(1)} formatY={(v) => v.toFixed(1)} crosshair={false} />
        )}
        <div>
          <h3>What you should hear</h3>
          {description.length === 0 ? <p>No pathological murmur – normal S1 and S2{params.rhythm === 'sinus' ? ' (S2 splits on inspiration at the pulmonic area)' : ''}.</p> : (
            <table className="table"><thead><tr><th>Murmur</th><th>Timing</th><th>Best heard</th><th>Grade*</th></tr></thead><tbody>
              {description.map((d) => (
                <tr key={d.key}><td><strong>{d.name}</strong><div className="small muted">{d.pitch}; radiates {d.radiation}</div></td><td>{d.timing}</td><td>{d.site}</td><td>{d.grade}/6</td></tr>
              ))}
            </tbody></table>
          )}
          {rec && rec.events.length > 0 && <p className="small">Extra sounds this preset: {[...new Set(rec.events.map((e) => e.id))].filter((x) => !['S1', 'A2', 'P2'].includes(x)).join(', ') || 'none'}.</p>}
          <p className="note">*Grade estimated from simulated jet power (Levine scale; thrills not modelled). Murmur shape follows the pressure gradient: try maneuvers above to see/hear dynamic changes.</p>
        </div>
      </div>
    </div>
  );
}

function ChestMap({ site, onPick }: { site: AuscSite; onPick: (s: AuscSite) => void }) {
  const X = (x: number) => 170 + x * 28, Y = (y: number) => 30 + y * 34;
  return (
    <svg viewBox="0 0 340 260" width="100%" style={{ maxWidth: 420 }} role="group" aria-label="Chest auscultation map">
      <path d="M40,10 Q170,-10 300,10 L320,250 L20,250 Z" fill="var(--panel-2)" stroke="var(--border)" strokeWidth={2} />
      <rect x={160} y={20} width={20} height={190} rx={8} fill="none" stroke="var(--muted)" strokeDasharray="4 3" />
      {[1, 2, 3, 4, 5, 6].map((i) => <path key={i} d={`M40,${Y(i) - 8} Q170,${Y(i) - 26} 300,${Y(i) - 8}`} fill="none" stroke="var(--border)" />)}
      <text x={6} y={14} fontSize={10} fill="var(--muted)">patient's right</text>
      <text x={262} y={14} fontSize={10} fill="var(--muted)">patient's left</text>
      {(Object.keys(SITES) as AuscSite[]).map((k) => {
        const s = SITES[k];
        const on = site === k;
        return (
          <g key={k} role="button" tabIndex={0} aria-pressed={on} aria-label={`${s.label}: ${s.where}`} style={{ cursor: 'pointer' }}
            onClick={() => onPick(k)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(k); } }}>
            <circle cx={X(s.x)} cy={Y(s.y)} r={on ? 15 : 11} fill={on ? 'var(--accent)' : 'var(--panel)'} stroke="var(--accent)" strokeWidth={2} />
            <text x={X(s.x)} y={Y(s.y) + 4} textAnchor="middle" fontSize={10} fontWeight={700} fill={on ? '#fff' : 'var(--text)'}>{k === 'erb' ? 'E' : k[0].toUpperCase()}</text>
            <text x={k === 'mitral' ? X(s.x) : X(s.x) + (s.x < 0 ? -18 : 18)} y={k === 'mitral' ? Y(s.y) + 30 : Y(s.y) + 4} textAnchor={k === 'mitral' ? 'middle' : s.x < 0 ? 'end' : 'start'} fontSize={10} fill="var(--text)">{s.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

/**
 * Ladder (Lewis) diagram: atrium, AV junction and ventricle as three tiers; each impulse is a line,
 * slope = conduction time. Uses the same horizontal scale as an EcgPaper strip (8 mm calibration
 * margin, `speed` mm/s), so it lines up underneath the ECG.
 */
import type { RhythmOutput } from '../../engine/rhythm/types';

const CAL = 8;
const TIER = 8;

const PATH_STYLE: Record<string, { color: string; dash?: string; label: string }> = {
  av: { color: 'var(--c-blue)', label: 'AV node' },
  fast: { color: 'var(--c-blue)', label: 'fast pathway' },
  slow: { color: 'var(--c-orange)', dash: '3 2', label: 'slow pathway' },
  accessory: { color: 'var(--c-purple)', dash: '1.2 1.2', label: 'accessory pathway' },
};

export default function Ladder({ rhythm, startMs, durationMs, speed = 25, cursorMs, onPick }: {
  rhythm: RhythmOutput; startMs: number; durationMs: number; speed?: number; cursorMs?: number | null; onPick?: (t: number) => void;
}) {
  const widthMm = CAL + (durationMs / 1000) * speed + 2;
  const H = TIER * 3 + 8;
  const X = (t: number) => CAL + ((t - startMs) / 1000) * speed;
  const yA = [2, 2 + TIER], yAV = [2 + TIER, 2 + 2 * TIER], yV = [2 + 2 * TIER, 2 + 3 * TIER];
  const inWin = (t?: number) => t !== undefined && t >= startMs - 400 && t <= startMs + durationMs + 400;
  const ladderA = new Set(rhythm.ladder.map((l) => (l.a !== undefined ? Math.round(l.a) : -1)));
  const lines: JSX.Element[] = [];

  rhythm.ladder.forEach((l, i) => {
    if (![l.a, l.avIn, l.avOut, l.v].some(inWin)) return;
    const st = PATH_STYLE[l.pathway ?? 'av'] ?? PATH_STYLE.av;
    const common = { stroke: st.color, strokeWidth: 0.55, strokeDasharray: st.dash, fill: 'none' };
    // atrium
    if (l.a !== undefined && l.avIn !== undefined) lines.push(<line key={`a${i}`} x1={X(l.a)} y1={yA[0]} x2={X(l.avIn)} y2={yA[1]} stroke="var(--text)" strokeWidth={0.55} />);
    // AV junction
    if (l.avIn !== undefined) {
      if (l.avOut !== undefined) {
        lines.push(<line key={`n${i}`} x1={X(l.avIn)} y1={yAV[0]} x2={X(l.avOut)} y2={yAV[1]} {...common} />);
        if (l.blocked === 'his') lines.push(<line key={`bh${i}`} x1={X(l.avOut) - 1.2} x2={X(l.avOut) + 1.2} y1={yAV[1]} y2={yAV[1]} stroke="var(--c-vermillion)" strokeWidth={0.9} />);
      } else if (l.blocked === 'av') {
        const xe = X(l.avIn) + 1.5, ye = (yAV[0] + yAV[1]) / 2;
        lines.push(<line key={`n${i}`} x1={X(l.avIn)} y1={yAV[0]} x2={xe} y2={ye} {...common} />);
        lines.push(<line key={`b${i}`} x1={xe - 1.2} x2={xe + 1.2} y1={ye} y2={ye} stroke="var(--c-vermillion)" strokeWidth={0.9} />);
      }
    }
    // ventricle
    if (l.v !== undefined) {
      if (l.avOut !== undefined && !l.retrograde && !l.blocked) {
        lines.push(<line key={`v${i}`} x1={X(l.avOut)} y1={yV[0]} x2={X(l.v)} y2={yV[1]} stroke="var(--text)" strokeWidth={0.55} />);
      } else if (l.avOut === undefined) {
        // ectopic ventricular origin: dot plus spread
        const x = X(l.v), y = (yV[0] + yV[1]) / 2 + 2;
        lines.push(
          <g key={`e${i}`}>
            <circle cx={x} cy={y} r={0.9} fill="var(--c-vermillion)" />
            <line x1={x} y1={y} x2={x + 2} y2={yV[1]} stroke="var(--text)" strokeWidth={0.5} />
            <line x1={x} y1={y} x2={x + 2.2} y2={yV[0]} stroke="var(--text)" strokeWidth={0.5} />
          </g>,
        );
        if (l.label) lines.push(<text key={`l${i}`} x={x + 1.4} y={yV[1] + 3.4} fontSize={2.6} style={{ fill: 'var(--muted)' }}>{l.label}</text>);
      }
    }
  });
  // atrial events not represented in the ladder entries (retrograde P, flutter/fibrillation wavelets)
  rhythm.atrial.forEach((a, i) => {
    if (!inWin(a.t) || ladderA.has(Math.round(a.t))) return;
    if (a.origin.kind === 'retrograde') {
      lines.push(<line key={`ra${i}`} x1={X(a.t)} y1={yA[1]} x2={X(a.t) + 1.4} y2={yA[0]} stroke="var(--c-green)" strokeWidth={0.55} />);
    } else {
      lines.push(<line key={`aa${i}`} x1={X(a.t)} y1={yA[0]} x2={X(a.t) + 1} y2={yA[1]} stroke="var(--text)" strokeWidth={0.4} opacity={0.7} />);
    }
  });

  return (
    <div>
      <svg viewBox={`0 0 ${widthMm} ${H}`} width="100%" style={{ display: 'block', background: 'var(--panel)', minWidth: widthMm * 2.4, cursor: onPick ? 'crosshair' : 'default' }}
        role="img" aria-label="Ladder diagram: atrium, AV junction and ventricle tiers"
        onClick={(e) => {
          if (!onPick) return;
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const mm = ((e.clientX - r.left) / r.width) * widthMm;
          onPick(startMs + ((mm - CAL) / speed) * 1000);
        }}>
        {[yA, yAV, yV].map((y, i) => (
          <g key={i}>
            <rect x={CAL} y={y[0]} width={widthMm - CAL - 2} height={TIER} fill={i === 1 ? 'var(--panel-2)' : 'transparent'} stroke="var(--border)" strokeWidth={0.25} />
            <text x={1} y={y[0] + TIER / 2 + 1.2} fontSize={3.2} style={{ fill: 'var(--text)', fontWeight: 700 }}>{['A', 'AV', 'V'][i]}</text>
          </g>
        ))}
        {lines}
        {cursorMs != null && <line x1={X(cursorMs)} x2={X(cursorMs)} y1={0} y2={H} stroke="var(--c-orange)" strokeWidth={0.5} />}
      </svg>
      <div className="legend" style={{ marginTop: 4 }}>
        <span style={{ color: 'var(--c-blue)' }}><i />AV node / fast pathway</span>
        <span style={{ color: 'var(--c-orange)' }}><i style={{ borderTopStyle: 'dashed' }} />slow pathway</span>
        <span style={{ color: 'var(--c-purple)' }}><i style={{ borderTopStyle: 'dotted' }} />accessory pathway</span>
        <span style={{ color: 'var(--c-green)' }}><i />retrograde atrial activation</span>
        <span style={{ color: 'var(--c-vermillion)' }}>▬ block · ● ectopic ventricular focus</span>
      </div>
    </div>
  );
}

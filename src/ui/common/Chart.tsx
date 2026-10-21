/**
 * Minimal SVG line chart: one y-axis, recessive grid, legend + direct end labels, hover crosshair.
 * Series colours come from the Okabe–Ito palette (colour-blind safe); identity is also given
 * by label and dash pattern, never colour alone.
 */
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';

export interface Series {
  label: string;
  x: ArrayLike<number>;
  y: ArrayLike<number>;
  color: string;
  dash?: string;
  width?: number;
  /** Hide from legend/tooltip (e.g. ghost reference curves still get a legend entry if labelled). */
  ghost?: boolean;
  /** Draw a label at the end of the line. */
  endLabel?: boolean;
}

export interface VBand { x0: number; x1: number; label?: string; fill?: string }
export interface VMark { x: number; label?: string; color?: string }
export interface PointMark { x: number; y: number; label?: string; color?: string }

export interface ChartProps {
  series: Series[];
  xDomain?: [number, number];
  yDomain?: [number, number];
  xLabel?: string;
  yLabel?: string;
  height?: number;
  width?: number;
  bands?: VBand[];
  vmarks?: VMark[];
  points?: PointMark[];
  title?: string;
  xTicks?: number[];
  yTicks?: number[];
  formatX?: (x: number) => string;
  formatY?: (y: number) => string;
  /** Tooltip reads every series at the hovered x (true for time series; false for loops). */
  crosshair?: boolean;
  legend?: boolean;
  children?: (sx: (x: number) => number, sy: (y: number) => number) => ReactNode;
  ariaLabel?: string;
}

function niceTicks(a: number, b: number, n = 5) {
  const span = b - a || 1;
  const step0 = span / n;
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= n + 0.5) ?? mag * 10;
  const out: number[] = [];
  for (let v = Math.ceil(a / step) * step; v <= b + 1e-9; v += step) out.push(Math.round(v * 1e6) / 1e6);
  return out;
}

function extent(series: Series[], key: 'x' | 'y'): [number, number] {
  let lo = Infinity, hi = -Infinity;
  for (const s of series) {
    const arr = s[key];
    for (let i = 0; i < arr.length; i++) {
      const v = arr[i];
      if (Number.isFinite(v)) { if (v < lo) lo = v; if (v > hi) hi = v; }
    }
  }
  if (!Number.isFinite(lo)) return [0, 1];
  if (lo === hi) return [lo - 1, hi + 1];
  return [lo, hi];
}

export default function Chart(props: ChartProps) {
  const { series, height = 220, crosshair = true, legend = true } = props;
  const wrapRef = useRef<HTMLElement>(null);
  const [width, setWidth] = useState(props.width ?? 520);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((e) => setWidth(Math.max(240, Math.round(e[0].contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const clipId = `clip${useId().replace(/:/g, '')}`;
  const M = { l: 46, r: 64, t: props.title ? 22 : 10, b: props.xLabel ? 36 : 24 };
  const xd = props.xDomain ?? extent(series, 'x');
  const yd0 = props.yDomain ?? extent(series, 'y');
  const yd: [number, number] = props.yDomain ? yd0 : [yd0[0] - (yd0[1] - yd0[0]) * 0.05, yd0[1] + (yd0[1] - yd0[0]) * 0.08];
  const sx = (x: number) => M.l + ((x - xd[0]) / (xd[1] - xd[0] || 1)) * (width - M.l - M.r);
  const sy = (y: number) => height - M.b - ((y - yd[0]) / (yd[1] - yd[0] || 1)) * (height - M.t - M.b);
  const xt = props.xTicks ?? niceTicks(xd[0], xd[1], 6);
  const yt = props.yTicks ?? niceTicks(yd[0], yd[1], 4);
  const fx = props.formatX ?? ((x: number) => String(Math.round(x * 100) / 100));
  const fy = props.formatY ?? ((y: number) => String(Math.round(y * 10) / 10));
  const [hover, setHover] = useState<{ px: number; py: number; x: number } | null>(null);
  const ref = useRef<SVGSVGElement>(null);

  const paths = useMemo(() => series.map((s) => {
    const n = s.x.length;
    const stride = Math.max(1, Math.floor(n / 900));
    let d = '';
    let pen = false;
    for (let i = 0; i < n; i += stride) {
      const x = s.x[i], y = s.y[i];
      if (!Number.isFinite(x) || !Number.isFinite(y)) { pen = false; continue; }
      const X = sx(x), Y = sy(Math.max(yd[0] - (yd[1] - yd[0]), Math.min(yd[1] + (yd[1] - yd[0]), y)));
      d += `${pen ? 'L' : 'M'}${X.toFixed(1)},${Y.toFixed(1)}`;
      pen = true;
    }
    return d;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [series, xd[0], xd[1], yd[0], yd[1], width, height]);

  const readAt = (s: Series, x: number) => {
    // nearest sample (assumes x sorted for crosshair series)
    let lo = 0, hi = s.x.length - 1;
    if (hi < 0) return NaN;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (s.x[mid] < x) lo = mid; else hi = mid; }
    return Math.abs(s.x[lo] - x) < Math.abs(s.x[hi] - x) ? s.y[lo] : s.y[hi];
  };

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = ref.current!.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * width;
    const py = ((e.clientY - r.top) / r.height) * height;
    if (px < M.l || px > width - M.r) return setHover(null);
    setHover({ px, py, x: xd[0] + ((px - M.l) / (width - M.l - M.r)) * (xd[1] - xd[0]) });
  };

  const visible = series.filter((s) => !s.ghost || s.label);
  return (
    <figure style={{ margin: 0 }} ref={wrapRef}>
      {legend && visible.length > 1 && (
        <div className="legend" aria-hidden="true" style={{ marginBottom: 2 }}>
          {visible.map((s) => (
            <span key={s.label}><svg width="20" height="8"><line x1="0" x2="20" y1="4" y2="4" stroke={s.color} strokeWidth={s.width ?? 2} strokeDasharray={s.dash} /></svg>{s.label}</span>
          ))}
        </div>
      )}
      <svg ref={ref} className="chart" viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label={props.ariaLabel ?? props.title ?? 'chart'}
        onPointerMove={onMove} onPointerLeave={() => setHover(null)} style={{ display: 'block', touchAction: 'pan-y' }}>
        {props.title && <text x={M.l} y={14} className="label">{props.title}</text>}
        {(props.bands ?? []).map((b, i) => (
          <g key={i}>
            <rect x={sx(b.x0)} y={M.t} width={Math.max(0, sx(b.x1) - sx(b.x0))} height={height - M.t - M.b} fill={b.fill ?? 'var(--panel-2)'} opacity={0.8} />
            {b.label && <text x={(sx(b.x0) + sx(b.x1)) / 2} y={M.t + 10} textAnchor="middle" fontSize={9}>{b.label}</text>}
          </g>
        ))}
        {yt.map((v) => (
          <g key={`y${v}`}>
            <line className="gridline" x1={M.l} x2={width - M.r} y1={sy(v)} y2={sy(v)} />
            <text x={M.l - 5} y={sy(v) + 4} textAnchor="end">{fy(v)}</text>
          </g>
        ))}
        {xt.map((v) => <text key={`x${v}`} x={sx(v)} y={height - M.b + 14} textAnchor="middle">{fx(v)}</text>)}
        <line x1={M.l} x2={width - M.r} y1={height - M.b} y2={height - M.b} stroke="var(--border)" />
        {props.xLabel && <text x={(M.l + width - M.r) / 2} y={height - 4} textAnchor="middle">{props.xLabel}</text>}
        {props.yLabel && <text transform={`translate(11 ${(M.t + height - M.b) / 2}) rotate(-90)`} textAnchor="middle">{props.yLabel}</text>}
        {(props.vmarks ?? []).map((m, i) => (
          <g key={`m${i}`}>
            <line x1={sx(m.x)} x2={sx(m.x)} y1={M.t} y2={height - M.b} stroke={m.color ?? 'var(--muted)'} strokeDasharray="3 3" />
            {m.label && <text x={sx(m.x) + 2} y={M.t + 20 + (i % 3) * 10} fontSize={9}>{m.label}</text>}
          </g>
        ))}
        <clipPath id={clipId}><rect x={M.l} y={M.t - 2} width={width - M.l - M.r} height={height - M.t - M.b + 4} /></clipPath>
        {series.map((s, i) => (
          <path key={s.label + i} clipPath={`url(#${clipId})`} d={paths[i]} fill="none" stroke={s.color} strokeWidth={s.width ?? 2} strokeDasharray={s.dash} strokeLinejoin="round" strokeLinecap="round" opacity={s.ghost ? 0.55 : 1} />
        ))}
        {series.filter((s) => s.endLabel).map((s) => {
          const n = s.x.length - 1;
          if (n < 0) return null;
          return <text key={`e${s.label}`} x={Math.min(width - 2, sx(s.x[n]) + 4)} y={sy(s.y[n]) + 4} fontSize={10} style={{ fill: 'var(--text)' }}>{s.label}</text>;
        })}
        {(props.points ?? []).map((p, i) => (
          <g key={`p${i}`}>
            <circle cx={sx(p.x)} cy={sy(p.y)} r={4.5} fill={p.color ?? 'var(--c-vermillion)'} stroke="var(--panel)" strokeWidth={2} />
            {p.label && <text x={sx(p.x) + 7} y={sy(p.y) - 6} fontSize={10} style={{ fill: 'var(--text)' }}>{p.label}</text>}
          </g>
        ))}
        {props.children?.(sx, sy)}
        {hover && crosshair && (
          <g pointerEvents="none">
            <line x1={hover.px} x2={hover.px} y1={M.t} y2={height - M.b} stroke="var(--muted)" />
            {(() => {
              const rows = series.filter((s) => !s.ghost).map((s) => ({ s, v: readAt(s, hover.x) })).filter((r) => Number.isFinite(r.v));
              const bw = 132, bh = 16 + rows.length * 14;
              const bx = hover.px + bw + 10 > width ? hover.px - bw - 8 : hover.px + 8;
              return (
                <g>
                  <rect x={bx} y={M.t} width={bw} height={bh} rx={6} fill="var(--panel)" stroke="var(--border)" />
                  <text x={bx + 6} y={M.t + 12} fontSize={10} style={{ fill: 'var(--muted)' }}>{fx(hover.x)}</text>
                  {rows.map((r, i) => (
                    <g key={r.s.label}>
                      <line x1={bx + 6} x2={bx + 16} y1={M.t + 22 + i * 14} y2={M.t + 22 + i * 14} stroke={r.s.color} strokeWidth={2} strokeDasharray={r.s.dash} />
                      <text x={bx + 20} y={M.t + 26 + i * 14} fontSize={10} style={{ fill: 'var(--text)' }}>{r.s.label}: {fy(r.v)}</text>
                    </g>
                  ))}
                </g>
              );
            })()}
          </g>
        )}
      </svg>
    </figure>
  );
}

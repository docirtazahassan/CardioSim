/** Small SVG waveform plot (used for single-beat lead traces and mini charts). */
export function MiniTrace({ data, t0, t1, width = 160, height = 70, mvRange = 1.6, cursor, label, color = 'var(--trace)', highlight }: {
  data: Float32Array; t0: number; t1: number; width?: number; height?: number; mvRange?: number; cursor?: number | null; label?: string; color?: string; highlight?: boolean;
}) {
  const n = Math.max(2, Math.round(t1 - t0));
  const step = Math.max(1, Math.floor(n / width));
  const pts: string[] = [];
  for (let i = 0; i <= n; i += step) {
    const v = data[Math.round(t0 + i)] ?? 0;
    pts.push(`${((i / n) * width).toFixed(1)},${(height / 2 - (v / mvRange) * (height / 2)).toFixed(1)}`);
  }
  const cx = cursor != null ? ((cursor - t0) / n) * width : null;
  const cv = cursor != null ? data[Math.round(cursor)] ?? 0 : 0;
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label ? `Lead ${label} trace` : 'trace'} style={{ background: 'var(--paper)', borderRadius: 6, border: `1px solid ${highlight ? 'var(--accent-2)' : 'var(--border)'}` }}>
      <line x1={0} x2={width} y1={height / 2} y2={height / 2} stroke="var(--grid-major)" strokeWidth={0.6} />
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth={1.4} strokeLinejoin="round" />
      {cx != null && (
        <>
          <line x1={cx} x2={cx} y1={0} y2={height} stroke="var(--c-orange)" strokeWidth={1} />
          <circle cx={cx} cy={height / 2 - (cv / mvRange) * (height / 2)} r={3} fill="var(--c-orange)" />
        </>
      )}
      {label && <text x={4} y={12} fontSize={11} fontWeight={700} fill="var(--text)">{label}</text>}
    </svg>
  );
}

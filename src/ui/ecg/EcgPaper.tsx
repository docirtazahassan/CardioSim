/**
 * Standard ECG paper: 25 mm/s, 10 mm/mV, 1 mm small boxes and 5 mm large boxes, 1 mV
 * calibration pulse. Layouts: 3×4 + lead II rhythm strip, 6×2, 15-lead, 18-lead, custom strips.
 * Calipers (drag on the paper) and a 300-150-100 rate ruler are optional.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { LeadId } from '../../data/types';
import type { EcgOutput } from '../../engine/electrical/synth';

export type EcgLayout = '3x4' | '6x2' | '15' | '18' | 'strip';

interface Cell { lead: LeadId; col: number; row: number; t0: number; t1: number }

const LAYOUT_CELLS: Record<Exclude<EcgLayout, 'strip'>, { cols: number; rows: string[][]; rhythm?: LeadId }> = {
  '3x4': { cols: 4, rows: [['I', 'aVR', 'V1', 'V4'], ['II', 'aVL', 'V2', 'V5'], ['III', 'aVF', 'V3', 'V6']], rhythm: 'II' },
  '6x2': { cols: 2, rows: [['I', 'V1'], ['II', 'V2'], ['III', 'V3'], ['aVR', 'V4'], ['aVL', 'V5'], ['aVF', 'V6']] },
  '15': { cols: 5, rows: [['I', 'aVR', 'V1', 'V4', 'V4R'], ['II', 'aVL', 'V2', 'V5', 'V8'], ['III', 'aVF', 'V3', 'V6', 'V9']], rhythm: 'II' },
  '18': { cols: 6, rows: [['I', 'aVR', 'V1', 'V4', 'V4R', 'V7'], ['II', 'aVL', 'V2', 'V5', 'V5R', 'V8'], ['III', 'aVF', 'V3', 'V6', 'V6R', 'V9']], rhythm: 'II' },
};

export const LEADS_FOR_LAYOUT: Record<EcgLayout, LeadId[]> = {
  '3x4': ['I', 'II', 'III', 'aVR', 'aVL', 'aVF', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6'],
  '6x2': ['I', 'II', 'III', 'aVR', 'aVL', 'aVF', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6'],
  '15': ['I', 'II', 'III', 'aVR', 'aVL', 'aVF', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V4R', 'V8', 'V9'],
  '18': ['I', 'II', 'III', 'aVR', 'aVL', 'aVF', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V4R', 'V5R', 'V6R', 'V7', 'V8', 'V9'],
  strip: [],
};

export interface EcgPaperProps {
  ecg: EcgOutput;
  layout: EcgLayout;
  /** For layout 'strip': the leads to show as full-width strips. */
  stripLeads?: LeadId[];
  startMs?: number;
  durationMs?: number;
  speed?: number; // mm/s
  gain?: number; // mm/mV
  rowMm?: number;
  calipers?: boolean;
  rateRuler?: boolean;
  highlightLeads?: string[];
  /** Vertical markers (e.g. ladder-synced cursor). */
  cursorMs?: number | null;
  ariaLabel?: string;
  minPxPerMm?: number;
}

function cssVar(name: string, fallback: string) {
  try {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  } catch {
    return fallback;
  }
}

export default function EcgPaper(props: EcgPaperProps) {
  const { ecg, layout, startMs = 0, speed = 25, gain = 10, calipers = false, rateRuler = false } = props;
  const durationMs = props.durationMs ?? Math.min(10000, ecg.duration - startMs);
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(900);
  const [cal, setCal] = useState<[number, number] | null>(null);
  const dragRef = useRef<{ which: 0 | 1 | 'new' } | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => setWidth(Math.max(320, entries[0].contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // geometry in mm
  const geo = useMemo(() => {
    const calMm = 8;
    const totalSecMm = (durationMs / 1000) * speed;
    const rowMm = props.rowMm ?? (layout === 'strip' ? 32 : layout === '6x2' ? 28 : 30);
    const cells: Cell[] = [];
    let rows = 0;
    let rhythmLead: LeadId | undefined;
    if (layout === 'strip') {
      (props.stripLeads ?? ['II']).forEach((lead, i) => cells.push({ lead, col: 0, row: i, t0: startMs, t1: startMs + durationMs }));
      rows = (props.stripLeads ?? ['II']).length;
    } else {
      const L = LAYOUT_CELLS[layout];
      const colDur = durationMs / L.cols;
      L.rows.forEach((r, ri) => r.forEach((lead, ci) => cells.push({ lead: lead as LeadId, col: ci, row: ri, t0: startMs + ci * colDur, t1: startMs + (ci + 1) * colDur })));
      rows = L.rows.length;
      if (L.rhythm) {
        rhythmLead = L.rhythm;
        cells.push({ lead: L.rhythm, col: 0, row: rows, t0: startMs, t1: startMs + durationMs });
        rows++;
      }
    }
    const minPx = props.minPxPerMm ?? 2.4;
    const pxPerMm = Math.max(minPx, width / (calMm + totalSecMm + 2));
    return { calMm, rowMm, rows, cells, pxPerMm, widthMm: calMm + totalSecMm + 2, heightMm: rows * rowMm + 4, rhythmLead };
  }, [layout, durationMs, speed, width, startMs, props.stripLeads, props.rowMm, props.minPxPerMm]);

  const xForT = (t: number) => (geo.calMm + ((t - startMs) / 1000) * speed) * geo.pxPerMm;
  const tForX = (x: number) => startMs + ((x / geo.pxPerMm - geo.calMm) / speed) * 1000;

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = geo.widthMm * geo.pxPerMm;
    const H = geo.heightMm * geo.pxPerMm;
    c.width = Math.round(W * dpr);
    c.height = Math.round(H * dpr);
    c.style.width = `${W}px`;
    c.style.height = `${H}px`;
    const g = c.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const P = geo.pxPerMm;
    g.fillStyle = cssVar('--paper', '#fffaf8');
    g.fillRect(0, 0, W, H);
    // grid
    const minor = cssVar('--grid-minor', '#f4c7c3');
    const major = cssVar('--grid-major', '#e48b84');
    if (P >= 2.2) {
      g.strokeStyle = minor;
      g.lineWidth = 0.5;
      g.beginPath();
      for (let x = 0; x <= geo.widthMm; x++) { if (x % 5) { g.moveTo(x * P + 0.25, 0); g.lineTo(x * P + 0.25, H); } }
      for (let y = 0; y <= geo.heightMm; y++) { if (y % 5) { g.moveTo(0, y * P + 0.25); g.lineTo(W, y * P + 0.25); } }
      g.stroke();
    }
    g.strokeStyle = major;
    g.lineWidth = 1;
    g.beginPath();
    for (let x = 0; x <= geo.widthMm; x += 5) { g.moveTo(x * P + 0.5, 0); g.lineTo(x * P + 0.5, H); }
    for (let y = 0; y <= geo.heightMm; y += 5) { g.moveTo(0, y * P + 0.5); g.lineTo(W, y * P + 0.5); }
    g.stroke();

    const traceColor = cssVar('--trace', '#111');
    const hl = new Set(props.highlightLeads ?? []);
    for (let row = 0; row < geo.rows; row++) {
      // calibration pulse (1 mV = 10 mm, 200 ms wide)
      const base = (row * geo.rowMm + geo.rowMm * 0.62) * P;
      g.strokeStyle = traceColor;
      g.lineWidth = 1.3;
      g.beginPath();
      g.moveTo(1 * P, base);
      g.lineTo(2 * P, base);
      g.lineTo(2 * P, base - gain * P);
      g.lineTo((2 + 0.2 * speed) * P, base - gain * P);
      g.lineTo((2 + 0.2 * speed) * P, base);
      g.lineTo(geo.calMm * P, base);
      g.stroke();
    }
    g.font = `${Math.max(10, 3.2 * P)}px system-ui, sans-serif`;
    for (const cell of geo.cells) {
      const x = ecg.leads[cell.lead];
      const base = (cell.row * geo.rowMm + geo.rowMm * 0.62) * P;
      if (!x) continue;
      const highlighted = hl.has(cell.lead);
      g.strokeStyle = highlighted ? cssVar('--accent-2', '#c0392b') : traceColor;
      g.lineWidth = highlighted ? 1.9 : 1.35;
      g.beginPath();
      const a = Math.max(0, Math.floor(cell.t0)), b = Math.min(x.length - 1, Math.ceil(cell.t1));
      const step = Math.max(1, Math.floor(1 / ((speed / 1000) * P))); // ~1 px per point
      for (let t = a; t <= b; t += step) {
        const px = xForT(t);
        const py = base - x[t] * gain * P;
        if (t === a) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.stroke();
      // lead label and column separator
      {
        const lx = xForT(cell.t0) + 1.5 * P, ly = (cell.row * geo.rowMm + 5) * P;
        const tw = g.measureText(cell.lead).width;
        g.fillStyle = cssVar('--paper', '#fffaf8');
        g.globalAlpha = 0.85;
        g.fillRect(lx - 2, ly - 11, tw + 4, 14);
        g.globalAlpha = 1;
        g.fillStyle = highlighted ? cssVar('--accent-2', '#c0392b') : traceColor;
        g.fillText(cell.lead, lx, ly);
      }
      if (cell.col > 0) {
        g.strokeStyle = traceColor;
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(xForT(cell.t0), base - 3 * P);
        g.lineTo(xForT(cell.t0), base + 3 * P);
        g.stroke();
      }
    }
    // rate ruler from the first QRS in view on the bottom strip
    if (rateRuler && ecg.beats.length) {
      const b = ecg.beats.find((x) => x.qrsOn >= startMs + 100);
      if (b) {
        const y0 = (geo.rows - 1) * geo.rowMm * P + 2 * P;
        const labels = [300, 150, 100, 75, 60, 50];
        g.fillStyle = cssVar('--c-blue', '#0072b2');
        g.strokeStyle = cssVar('--c-blue', '#0072b2');
        g.lineWidth = 1.5;
        labels.forEach((lab, i) => {
          const t = b.qrsOn + (i + 1) * 200;
          const xx = xForT(t);
          g.beginPath();
          g.moveTo(xx, y0);
          g.lineTo(xx, y0 + 4 * P);
          g.stroke();
          g.fillText(String(lab), xx + 1, y0 + 7 * P);
        });
        const xx0 = xForT(b.qrsOn);
        g.beginPath(); g.moveTo(xx0, y0); g.lineTo(xx0, y0 + 4 * P); g.stroke();
        // 6-second bracket
        const s6 = xForT(startMs + 6000);
        g.setLineDash([4, 3]);
        g.beginPath(); g.moveTo(xForT(startMs), H - 2 * P); g.lineTo(s6, H - 2 * P); g.stroke();
        g.setLineDash([]);
        const n6 = ecg.beats.filter((x) => x.qrsOn >= startMs && x.qrsOn < startMs + 6000).length;
        g.fillText(`6 s: ${n6} QRS × 10 ≈ ${n6 * 10}/min`, xForT(startMs) + 2, H - 3 * P);
      }
    }
    // cursor
    if (props.cursorMs !== undefined && props.cursorMs !== null) {
      g.strokeStyle = cssVar('--c-orange', '#e69f00');
      g.lineWidth = 2;
      g.beginPath(); g.moveTo(xForT(props.cursorMs), 0); g.lineTo(xForT(props.cursorMs), H); g.stroke();
    }
    // calipers
    if (calipers && cal) {
      const col = cssVar('--c-blue', '#0072b2');
      g.strokeStyle = col;
      g.fillStyle = col;
      g.lineWidth = 1.5;
      const [x1, x2] = [xForT(cal[0]), xForT(cal[1])];
      for (const xx of [x1, x2]) { g.beginPath(); g.moveTo(xx, 0); g.lineTo(xx, H); g.stroke(); }
      const ms = Math.abs(cal[1] - cal[0]);
      const label = `${Math.round(ms)} ms · ${(ms / 40).toFixed(1)} small boxes · rate ${Math.round(60000 / Math.max(1, ms))}/min`;
      g.font = `bold ${Math.max(11, 3.4 * P)}px system-ui, sans-serif`;
      const tw = g.measureText(label).width;
      const lx = Math.min(W - tw - 6, Math.min(x1, x2) + 4);
      g.fillStyle = cssVar('--panel', '#fff');
      g.fillRect(lx - 3, 2, tw + 6, 5 * P);
      g.fillStyle = col;
      g.fillText(label, lx, 4 * P);
    }
  }, [ecg, geo, gain, speed, startMs, calipers, cal, rateRuler, props.highlightLeads, props.cursorMs]);

  const onPointer = (e: React.PointerEvent<HTMLCanvasElement>, kind: 'down' | 'move' | 'up') => {
    if (!calipers) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const t = tForX(e.clientX - rect.left);
    if (kind === 'down') {
      e.currentTarget.setPointerCapture(e.pointerId);
      if (cal) {
        const d0 = Math.abs(xForT(cal[0]) - (e.clientX - rect.left));
        const d1 = Math.abs(xForT(cal[1]) - (e.clientX - rect.left));
        if (Math.min(d0, d1) < 12) { dragRef.current = { which: d0 < d1 ? 0 : 1 }; return; }
      }
      setCal([t, t]);
      dragRef.current = { which: 1 };
    } else if (kind === 'move' && dragRef.current && cal) {
      const w = dragRef.current.which;
      setCal(w === 0 ? [t, cal[1]] : [cal[0], t]);
    } else if (kind === 'up') dragRef.current = null;
  };

  return (
    <div className="ecg-wrap" ref={wrapRef}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={props.ariaLabel ?? `ECG, ${layout} layout`}
        onPointerDown={(e) => onPointer(e, 'down')}
        onPointerMove={(e) => onPointer(e, 'move')}
        onPointerUp={(e) => onPointer(e, 'up')}
        style={{ cursor: calipers ? 'crosshair' : 'default' }}
      />
    </div>
  );
}

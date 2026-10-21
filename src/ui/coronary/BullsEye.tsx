/** AHA 17-segment bull's-eye (polar) map. Anterior at the top, septum left, lateral right. */
import { SEGMENTS } from '../../data/coronaries';
import type { Dominance, VentricularRegionId } from '../../data/types';

const RINGS = { basal: [96, 128], mid: [64, 96], apical: [32, 64] } as const;
const WALL_PHI: Record<string, number> = { anterior: 0, anteroseptal: 60, inferoseptal: 120, inferior: 180, inferolateral: 240, anterolateral: 300, septal: 90, lateral: 270 };
const ABBR: Record<string, string> = { LAD: 'LAD', LCX: 'Cx', RCA: 'RCA' };

function sector(r0: number, r1: number, a0: number, a1: number) {
  // angles: degrees clockwise from 12 o'clock
  const p = (r: number, a: number) => [140 + r * Math.sin((a * Math.PI) / 180), 140 - r * Math.cos((a * Math.PI) / 180)];
  const large = a1 - a0 > 180 ? 1 : 0;
  const [x0, y0] = p(r1, a0), [x1, y1] = p(r1, a1), [x2, y2] = p(r0, a1), [x3, y3] = p(r0, a0);
  return `M${x0},${y0} A${r1},${r1} 0 ${large} 1 ${x1},${y1} L${x2},${y2} A${r0},${r0} 0 ${large} 0 ${x3},${y3} Z`;
}

export default function BullsEye({ values, dominance, mode, onPick, selected }: {
  values?: Partial<Record<VentricularRegionId, number>>;
  dominance: Dominance;
  mode: 'territory' | 'supply';
  onPick?: (seg: number) => void;
  selected?: number | null;
}) {
  const fill = (id: number) => {
    if (mode === 'supply') {
      const a = SEGMENTS.find((s) => s.id === id)!.supply[dominance][0];
      return a === 'LAD' ? '#0072b2' : a === 'LCX' ? '#e69f00' : '#009e73';
    }
    const v = Math.min(1, values?.[`seg${id}` as VentricularRegionId] ?? 0);
    // sequential: neutral → vermillion
    const lerp = (a: number, b: number) => Math.round(a + (b - a) * v);
    return `rgb(${lerp(226, 213)},${lerp(220, 94)},${lerp(216, 0)})`;
  };
  return (
    <svg viewBox="0 0 280 300" width="100%" style={{ maxWidth: 320 }} role="img" aria-label="17-segment bull's-eye map">
      {SEGMENTS.map((s) => {
        let path: string, tx: number, ty: number;
        if (s.level === 'apex') { path = ''; tx = 140; ty = 140; }
        else {
          const [r0, r1] = RINGS[s.level as keyof typeof RINGS];
          const width = s.level === 'apical' ? 90 : 60;
          const c = -WALL_PHI[s.wall];
          path = sector(r0, r1, c - width / 2, c + width / 2);
          const rm = (r0 + r1) / 2;
          tx = 140 + rm * Math.sin((c * Math.PI) / 180);
          ty = 140 - rm * Math.cos((c * Math.PI) / 180);
        }
        const v = values?.[`seg${s.id}` as VentricularRegionId] ?? 0;
        const dark = mode === 'supply' || v > 0.55;
        const supply = s.supply[dominance].map((a) => ABBR[a] ?? a).join('/');
        return (
          <g key={s.id} style={{ cursor: onPick ? 'pointer' : 'default' }} onClick={() => onPick?.(s.id)}>
            <title>{`${s.id}. ${s.name} – ${s.supply[dominance].join(' / ')}${mode === 'territory' ? ` – ${Math.round(v * 100)}% at risk` : ''}`}</title>
            {s.level === 'apex'
              ? <circle cx={140} cy={140} r={32} fill={fill(s.id)} stroke={selected === s.id ? 'var(--text)' : 'var(--panel)'} strokeWidth={selected === s.id ? 3 : 2} />
              : <path d={path} fill={fill(s.id)} stroke={selected === s.id ? 'var(--text)' : 'var(--panel)'} strokeWidth={selected === s.id ? 3 : 2} />}
            <text x={tx} y={ty - 1} textAnchor="middle" fontSize={12} fontWeight={700} fill={dark ? '#fff' : '#222'}>{s.id}</text>
            <text x={tx} y={ty + 11} textAnchor="middle" fontSize={8} fill={dark ? '#fff' : '#444'}>{supply}</text>
          </g>
        );
      })}
      <text x={140} y={8} textAnchor="middle" fontSize={10} fill="var(--muted)">anterior</text>
      <text x={140} y={280} textAnchor="middle" fontSize={10} fill="var(--muted)">inferior</text>
      <text x={4} y={144} fontSize={10} fill="var(--muted)">septal</text>
      <text x={276} y={144} textAnchor="end" fontSize={10} fill="var(--muted)">lateral</text>
      <text x={140} y={296} textAnchor="middle" fontSize={9} fill="var(--muted)">outer ring basal · middle mid · inner apical · centre apex</text>
    </svg>
  );
}

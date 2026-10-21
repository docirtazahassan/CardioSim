/**
 * Procedural, animated 3D heart (three.js via @react-three/fiber). No downloaded models:
 * every surface is generated from the parametric anatomy in anatomy.ts.
 *
 * Colour modes: anatomy · activation (isochrones + travelling wavefront) · territory (ischemic
 * fraction) · supply (artery supplying each segment).
 */
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import { useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { SEGMENTS } from '../../data/coronaries';
import type { ArteryId, Dominance, OcclusionSite, VentricularRegionId } from '../../data/types';
import { AV_NODE_POS, HEART_CENTRE, LV_AXIS, LV_BASE, LV_LENGTH, LV_RADIUS, SA_NODE_POS, U_ANT, U_SEP, circ } from '../../engine/electrical/geometry';
import { ELECTRODES } from '../../engine/electrical/leads';
import { add, scale, type V3 } from '../../engine/math';
import {
  ATRIAL_RADIUS, CONDUCTION, LA_CENTRE, LIMB_ELECTRODES, LV_WALL, RA_CENTRE, RV_PHI, VALVES, VESSELS,
  coronaryTree, lvSegmentAt, rvBulge, rvRegionAt, toThree,
} from './anatomy';

export interface HeartState {
  /** Volumes relative to end-diastole-ish reference (1 = normal EDV). */
  lv: number; rv: number; la: number; ra: number;
  valves: { mitral: number; aortic: number; tricuspid: number; pulmonic: number }; // 0 closed … 1 open
  /** Time since ventricular activation onset (ms) – drives the activation colouring. */
  actT: number;
  /** Time since atrial activation (ms). */
  atrT: number;
}

export type ColorMode = 'anatomy' | 'activation' | 'territory' | 'supply';
export type SliceMode = 'none' | 'short' | 'four' | 'two';

export interface Heart3DProps {
  stateRef?: MutableRefObject<HeartState>;
  colorMode?: ColorMode;
  activation?: Partial<Record<VentricularRegionId, { t: number; transit: number }>>;
  territory?: Partial<Record<VentricularRegionId, number>>;
  /** 0..1 loss of contraction per region (wall-motion abnormality). */
  akinesia?: Partial<Record<VentricularRegionId, number>>;
  dominance?: Dominance;
  showCoronaries?: boolean;
  showConduction?: boolean;
  showTorso?: boolean;
  showLabels?: boolean;
  slice?: SliceMode;
  slicePos?: number;
  occlusion?: { artery: ArteryId; site: OcclusionSite } | null;
  onPickArtery?: (artery: ArteryId, site: OcclusionSite | null) => void;
  onPickStructure?: (id: string) => void;
  onPickRegion?: (id: VentricularRegionId) => void;
  highlight?: string | null;
  height?: number | string;
  ariaLabel?: string;
}

const COL = {
  lv: new THREE.Color('#b8433d'), rv: new THREE.Color('#c96a5f'), endo: new THREE.Color('#7a2522'),
  la: new THREE.Color('#a85a74'), ra: new THREE.Color('#9e6a8a'), aorta: new THREE.Color('#c0392b'), pa: new THREE.Color('#5577aa'),
  vein: new THREE.Color('#4a5f9e'), conduction: new THREE.Color('#f2c84b'), rest: new THREE.Color('#c99a94'),
  wave: new THREE.Color('#ffb000'), ischemic: new THREE.Color('#d55e00'), neutral: new THREE.Color('#d9c4c1'),
  early: new THREE.Color('#c6dbef'), late: new THREE.Color('#08306b'),
  LAD: new THREE.Color('#0072b2'), LCX: new THREE.Color('#e69f00'), RCA: new THREE.Color('#009e73'),
};
export const ARTERY_COLORS: Record<string, string> = { LAD: '#0072b2', LCX: '#e69f00', RCA: '#009e73' };

const T = (p: V3) => new THREE.Vector3(...toThree(p));
const CENTRE = T(HEART_CENTRE);

// ---------------------------------------------------------------- default heartbeat (no simulation attached)
function syntheticState(t: number): HeartState {
  const rr = 0.83; // 72/min
  const ph = (t % rr) / rr; // 0 = start of ventricular contraction
  const sys = ph < 0.36 ? Math.sin((Math.PI * ph) / 0.36) : 0;
  const ej = ph > 0.06 && ph < 0.36 ? (ph - 0.06) / 0.3 : ph >= 0.36 ? 1 - Math.min(1, (ph - 0.36) / 0.25) : 0;
  const lv = 1 - 0.55 * ej;
  const atrialPh = (ph + 0.2) % 1; // atria contract ~160 ms before the ventricles
  const atr = atrialPh < 0.15 ? Math.sin((Math.PI * atrialPh) / 0.15) : 0;
  return {
    lv: lv + 0.08 * atr, rv: lv + 0.06 * atr, la: 1 - 0.25 * atr + 0.3 * ej * 0.6, ra: 1 - 0.25 * atr + 0.25 * ej * 0.6,
    valves: { mitral: ph > 0.45 ? 1 : 0, tricuspid: ph > 0.43 ? 1 : 0, aortic: ph > 0.06 && ph < 0.36 ? 1 : 0, pulmonic: ph > 0.05 && ph < 0.37 ? 1 : 0 },
    actT: ph * rr * 1000, atrT: atrialPh * rr * 1000,
  };
  void sys;
}

// ---------------------------------------------------------------- ventricles (rebuilt every frame)
const NS = 30, NP = 64;

interface VentGeo { geo: THREE.BufferGeometry; region: VentricularRegionId[]; s: Float32Array; phi: Float32Array }

function gridGeometry(ns: number, np: number, sRange: [number, number], pRange: [number, number], regionAt: (s: number, p: number) => VentricularRegionId): VentGeo {
  const n = (ns + 1) * (np + 1);
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  const sArr = new Float32Array(n), pArr = new Float32Array(n);
  const region: VentricularRegionId[] = [];
  for (let i = 0; i <= ns; i++) for (let j = 0; j <= np; j++) {
    const k = i * (np + 1) + j;
    sArr[k] = sRange[0] + ((sRange[1] - sRange[0]) * i) / ns;
    pArr[k] = pRange[0] + ((pRange[1] - pRange[0]) * j) / np;
    region.push(regionAt(sArr[k], pArr[k]));
  }
  const idx: number[] = [];
  for (let i = 0; i < ns; i++) for (let j = 0; j < np; j++) {
    const a = i * (np + 1) + j, b = a + np + 1;
    idx.push(a, a + 1, b, b, a + 1, b + 1); // winding chosen for the y-flipped (three.js) frame
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(idx);
  return { geo, region, s: sArr, phi: pArr };
}

function Ventricles(props: Heart3DProps & { clip: THREE.Plane[]; state: () => HeartState }) {
  const { colorMode = 'anatomy', activation, territory, akinesia, dominance = 'right', clip } = props;
  const lvEpi = useMemo(() => gridGeometry(NS, NP, [0, 1], [0, 360], lvSegmentAt), []);
  const lvEndo = useMemo(() => gridGeometry(NS, NP, [0, 1], [0, 360], lvSegmentAt), []);
  const rvEpi = useMemo(() => gridGeometry(24, 36, [-0.14, 0.86], RV_PHI, rvRegionAt), []);
  const supply = useMemo(() => {
    const m: Record<string, THREE.Color> = {};
    for (const s of SEGMENTS) m[`seg${s.id}`] = COL[(s.supply[dominance][0] as 'LAD' | 'LCX' | 'RCA')] ?? COL.neutral;
    for (const r of ['rvAnt', 'rvLat', 'rvInf', 'rvot']) m[r] = COL.RCA;
    m.rvApex = COL.LAD;
    return m;
  }, [dominance]);

  const tmp = new THREE.Color();
  const colorFor = (r: VentricularRegionId, base: THREE.Color, actT: number): THREE.Color => {
    if (colorMode === 'activation' && activation?.[r]) {
      const a = activation[r]!;
      if (actT < a.t) return tmp.copy(COL.rest);
      if (actT < a.t + a.transit) return tmp.copy(COL.wave);
      return tmp.copy(COL.early).lerp(COL.late, Math.min(1, a.t / 85));
    }
    if (colorMode === 'territory') return tmp.copy(COL.neutral).lerp(COL.ischemic, Math.min(1, territory?.[r] ?? 0));
    if (colorMode === 'supply') return tmp.copy(supply[r] ?? COL.neutral);
    if (props.highlight && ((props.highlight === 'lv' && r.startsWith('seg')) || (props.highlight === 'rv' && r.startsWith('rv')) || (props.highlight === 'ivs' && ['seg2', 'seg3', 'seg8', 'seg9', 'seg14'].includes(r)))) return tmp.copy(base).offsetHSL(0, 0.1, 0.18);
    return tmp.copy(base);
  };

  useFrame(() => {
    const st = props.state();
    const radLv = Math.pow(Math.max(0.2, st.lv), 0.4), axLv = Math.pow(Math.max(0.2, st.lv), 0.18);
    const radRv = Math.pow(Math.max(0.2, st.rv), 0.8);
    const write = (g: VentGeo, layer: 'epi' | 'endo' | 'rv') => {
      const pos = g.geo.attributes.position as THREE.BufferAttribute;
      const col = g.geo.attributes.color as THREE.BufferAttribute;
      for (let k = 0; k < g.region.length; k++) {
        const r = g.region[k];
        const ak = akinesia?.[r] ?? 0;
        const rad = 1 + (radLv - 1) * (1 - ak), ax = 1 + (axLv - 1) * (1 - ak);
        const thick = Math.pow(1 / rad, 0.7);
        const s = g.s[k], phi = g.phi[k];
        let R: number, L: number;
        if (layer === 'endo') { R = LV_RADIUS * rad; L = LV_LENGTH * ax; }
        else { R = LV_RADIUS * rad + LV_WALL * thick; L = LV_LENGTH * ax + 0.75 * thick; }
        if (layer === 'rv') R += rvBulge(s, phi) * (1 + (radRv - 1) * (1 - ak));
        const rr = R * Math.sqrt(Math.max(0, 1 - s * s));
        const c = circ(phi);
        const p: V3 = add(add(LV_BASE, scale(LV_AXIS, L * s)), scale(c, rr));
        pos.setXYZ(k, p[0], -p[1], p[2]);
        const cc = layer === 'endo' && colorMode === 'anatomy' ? COL.endo : colorFor(r, layer === 'rv' ? COL.rv : COL.lv, st.actT);
        col.setXYZ(k, cc.r, cc.g, cc.b);
      }
      pos.needsUpdate = true;
      col.needsUpdate = true;
      g.geo.computeVertexNormals();
      g.geo.computeBoundingSphere();
    };
    write(lvEpi, 'epi');
    write(lvEndo, 'endo');
    write(rvEpi, 'rv');
  });

  const pick = (g: VentGeo, structure: string) => (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const f = e.face;
    if (f && props.onPickRegion) props.onPickRegion(g.region[f.a]);
    props.onPickStructure?.(structure);
  };
  return (
    <group>
      <mesh geometry={lvEpi.geo} onClick={pick(lvEpi, 'lv')}>
        <meshStandardMaterial vertexColors roughness={0.55} metalness={0.05} side={THREE.FrontSide} clippingPlanes={clip} />
      </mesh>
      <mesh geometry={lvEndo.geo}>
        <meshStandardMaterial vertexColors roughness={0.8} side={THREE.BackSide} clippingPlanes={clip} />
      </mesh>
      <mesh geometry={rvEpi.geo} onClick={pick(rvEpi, 'rv')}>
        <meshStandardMaterial vertexColors roughness={0.6} side={THREE.DoubleSide} clippingPlanes={clip} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------- atria, vessels, valves
function Atrium({ which, state, clip, onPick, highlight }: { which: 'la' | 'ra'; state: () => HeartState; clip: THREE.Plane[]; onPick?: (id: string) => void; highlight?: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  const base = which === 'la' ? ATRIAL_RADIUS.la : ATRIAL_RADIUS.ra;
  useFrame(() => {
    const st = state();
    const k = Math.cbrt(Math.max(0.3, which === 'la' ? st.la : st.ra));
    ref.current?.scale.setScalar(base * k);
  });
  return (
    <mesh ref={ref} position={toThree(which === 'la' ? LA_CENTRE : RA_CENTRE)} onClick={(e) => { e.stopPropagation(); onPick?.(which); }}>
      <sphereGeometry args={[1, 32, 24]} />
      <meshStandardMaterial color={which === 'la' ? COL.la : COL.ra} emissive={highlight ? '#553300' : '#000'} roughness={0.6} side={THREE.DoubleSide} clippingPlanes={clip} />
    </mesh>
  );
}

function Tube({ pts, r, color, clip, onClick, emissive, opacity = 1, segments = 48 }: { pts: V3[]; r: number; color: THREE.Color | string; clip?: THREE.Plane[]; onClick?: (e: ThreeEvent<MouseEvent>) => void; emissive?: string; opacity?: number; segments?: number }) {
  const geo = useMemo(() => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(T)), segments, r, 12, false), [pts, r, segments]);
  return (
    <mesh geometry={geo} onClick={onClick} onPointerOver={onClick ? () => (document.body.style.cursor = 'pointer') : undefined} onPointerOut={onClick ? () => (document.body.style.cursor = '') : undefined}>
      <meshStandardMaterial color={color} emissive={emissive ?? '#000'} roughness={0.5} clippingPlanes={clip} transparent={opacity < 1} opacity={opacity} />
    </mesh>
  );
}

function Valve({ id, state, clip, onPick, highlight }: { id: keyof typeof VALVES; state: () => HeartState; clip: THREE.Plane[]; onPick?: (id: string) => void; highlight?: boolean }) {
  const v = VALVES[id];
  const q = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), T(v.normal).normalize()), [v]);
  const l1 = useRef<THREE.Mesh>(null), l2 = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const open = state().valves[id];
    const ang = open * 1.2;
    if (l1.current) l1.current.rotation.x = -ang;
    if (l2.current) l2.current.rotation.x = ang;
  });
  const leafletColor = id === 'aortic' || id === 'pulmonic' ? '#f3e6c8' : '#efe0d0';
  return (
    <group position={toThree(v.pos)} quaternion={q} onClick={(e) => { e.stopPropagation(); onPick?.(id); }}>
      <mesh>
        <torusGeometry args={[v.r, 0.14, 10, 40]} />
        <meshStandardMaterial color={highlight ? '#ffd27a' : '#e8d9b0'} roughness={0.4} clippingPlanes={clip} />
      </mesh>
      <group position={[0, 0.0, 0]}>
        <mesh ref={l1} position={[0, 0, 0]}>
          <circleGeometry args={[v.r * 0.98, 24, 0, Math.PI]} />
          <meshStandardMaterial color={leafletColor} side={THREE.DoubleSide} roughness={0.7} clippingPlanes={clip} />
        </mesh>
        <mesh ref={l2} rotation={[0, 0, Math.PI]}>
          <circleGeometry args={[v.r * 0.98, 24, 0, Math.PI]} />
          <meshStandardMaterial color={leafletColor} side={THREE.DoubleSide} roughness={0.7} clippingPlanes={clip} />
        </mesh>
      </group>
    </group>
  );
}

// ---------------------------------------------------------------- conduction system
function Conduction({ state, onPick, highlight }: { state: () => HeartState; onPick?: (id: string) => void; highlight?: string | null }) {
  const sa = useRef<THREE.MeshStandardMaterial>(null), av = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    const st = state();
    const flashA = st.atrT < 60 ? 1 : 0;
    const flashV = st.actT > -60 && st.actT < 20 ? 1 : 0;
    sa.current?.emissive.setRGB(flashA, flashA * 0.7, 0);
    av.current?.emissive.setRGB(flashV * 0.9, flashV * 0.6, 0);
  });
  const ids: Array<[keyof typeof CONDUCTION, string]> = [['internodal', 'internodal'], ['bachmann', 'bachmann'], ['his', 'his'], ['lbb', 'lbb'], ['laf', 'laf'], ['lpf', 'lpf'], ['rbb', 'rbb']];
  return (
    <group>
      <mesh position={toThree(SA_NODE_POS)} onClick={(e) => { e.stopPropagation(); onPick?.('sa-node'); }}>
        <sphereGeometry args={[0.45, 16, 12]} />
        <meshStandardMaterial ref={sa} color="#ffd34d" />
      </mesh>
      <mesh position={toThree(AV_NODE_POS)} onClick={(e) => { e.stopPropagation(); onPick?.('av-node'); }}>
        <sphereGeometry args={[0.38, 16, 12]} />
        <meshStandardMaterial ref={av} color="#ffd34d" />
      </mesh>
      {ids.map(([k, id]) => (
        <Tube key={k} pts={CONDUCTION[k]} r={k === 'his' ? 0.14 : 0.1} color={highlight === id ? '#fff2a8' : COL.conduction} emissive={highlight === id ? '#665500' : '#332200'}
          onClick={(e) => { e.stopPropagation(); onPick?.(id); }} segments={32} />
      ))}
    </group>
  );
}

// ---------------------------------------------------------------- coronaries
function Coronaries({ dominance, occlusion, onPick, clip }: { dominance: Dominance; occlusion?: Heart3DProps['occlusion']; onPick?: Heart3DProps['onPickArtery']; clip: THREE.Plane[] }) {
  const tree = useMemo(() => coronaryTree(dominance), [dominance]);
  const order: Record<string, number> = { proximal: 0, mid: 1, distal: 2 };
  const downstream = (a: ArteryId, site: OcclusionSite | null) => {
    if (!occlusion) return false;
    if (occlusion.artery === 'LMCA') return a !== 'RCA' && a !== 'AM' && a !== 'CONUS' && !(a === 'PDA' && dominance !== 'left') && a !== 'PLB';
    if (a === occlusion.artery) return (order[site ?? 'distal'] ?? 2) >= order[occlusion.site];
    const children: Record<string, ArteryId[]> = {
      LAD: occlusion.site === 'proximal' ? ['D1', 'D2'] : occlusion.site === 'mid' ? ['D2'] : [],
      LCX: occlusion.site === 'proximal' ? ['OM1', 'OM2', ...(dominance === 'left' ? (['PDA'] as ArteryId[]) : [])] : dominance === 'left' ? ['OM2', 'PDA'] : ['OM2'],
      RCA: occlusion.site === 'proximal' ? ['AM', ...(dominance !== 'left' ? (['PDA', 'PLB'] as ArteryId[]) : [])] : occlusion.site === 'mid' ? (dominance !== 'left' ? ['PDA', 'PLB'] : []) : dominance !== 'left' ? ['PDA', 'PLB'] : [],
    };
    return (children[occlusion.artery] ?? []).includes(a);
  };
  return (
    <group>
      {tree.map((s, i) => {
        const dead = downstream(s.artery, s.site);
        const isOcc = occlusion && s.artery === occlusion.artery && s.site === occlusion.site;
        return (
          <group key={i}>
            <Tube pts={s.pts} r={s.r} color={dead ? '#5b4a4a' : '#e0392e'} emissive={isOcc ? '#400000' : '#200000'} clip={clip}
              onClick={(e) => { e.stopPropagation(); onPick?.(s.artery, s.site); }} />
            {isOcc && (
              <mesh position={T(s.pts[0])}>
                <sphereGeometry args={[s.r * 2.4, 16, 12]} />
                <meshStandardMaterial color="#111" />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}

// ---------------------------------------------------------------- torso + electrodes
function Torso() {
  const chest = useMemo(() => {
    const g = new THREE.CylinderGeometry(1, 1, 30, 48, 1, true);
    g.scale(12.9, 1, 10.3);
    return g;
  }, []);
  return (
    <group>
      <mesh geometry={chest} position={[0, -1, -2.4]}>
        <meshStandardMaterial color="#9fb6cc" transparent opacity={0.1} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      {Object.entries({ ...ELECTRODES, ...LIMB_ELECTRODES }).filter(([k]) => !/^V[1-3]R$/.test(k)).map(([k, p]) => (
        <group key={k} position={toThree(p as V3)}>
          <mesh><sphereGeometry args={[0.55, 12, 10]} /><meshStandardMaterial color={k.endsWith('R') && k.startsWith('V') ? '#009e73' : /V[7-9]/.test(k) ? '#cc79a7' : '#0072b2'} /></mesh>
          <Html center distanceFactor={40} style={{ pointerEvents: 'none' }}>
            <span style={{ font: '600 11px system-ui', color: '#fff', background: 'rgba(0,0,0,0.55)', padding: '0 3px', borderRadius: 3, whiteSpace: 'nowrap' }}>{k}</span>
          </Html>
        </group>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------- scene
function Scene(props: Heart3DProps) {
  const internal = useRef(syntheticState(0));
  const clock = useRef(0);
  useFrame((_, dt) => {
    clock.current += Math.min(dt, 0.05);
    if (!props.stateRef) internal.current = syntheticState(clock.current);
  });
  const state = () => (props.stateRef ? props.stateRef.current : internal.current);

  const planes = useMemo(() => [new THREE.Plane(new THREE.Vector3(0, 0, -1), 1e6)], []);
  const slice = props.slice ?? 'none';
  const pos = props.slicePos ?? 0.5;
  useMemo(() => {
    const p = planes[0];
    if (slice === 'none') { p.set(new THREE.Vector3(0, 0, -1), 1e6); return; }
    let n: V3, pt: V3;
    if (slice === 'short') { n = LV_AXIS; pt = add(LV_BASE, scale(LV_AXIS, LV_LENGTH * pos)); }
    else if (slice === 'four') { n = scale(U_ANT, -1); pt = add(add(LV_BASE, scale(LV_AXIS, 3)), scale(U_ANT, (pos - 0.5) * 6)); }
    else { n = scale(U_SEP, 1); pt = add(add(LV_BASE, scale(LV_AXIS, 3)), scale(U_SEP, (pos - 0.5) * 6)); }
    p.setFromNormalAndCoplanarPoint(T(n).normalize(), T(pt));
  }, [slice, pos, planes]);
  const clip = planes;
  const hl = props.highlight ?? null;
  const pickS = props.onPickStructure;

  return (
    <group position={[-CENTRE.x, -CENTRE.y - 2.2, -CENTRE.z]}>
      <Ventricles {...props} clip={clip} state={state} />
      <Atrium which="la" state={state} clip={clip} onPick={pickS} highlight={hl === 'la'} />
      <Atrium which="ra" state={state} clip={clip} onPick={pickS} highlight={hl === 'ra'} />
      <Tube pts={VESSELS.aorta.pts} r={VESSELS.aorta.r} color={hl === 'aorta' ? '#ff6b5b' : COL.aorta} clip={clip} onClick={(e) => { e.stopPropagation(); pickS?.('aorta'); }} />
      {(['pa', 'lpa', 'rpa'] as const).map((k) => <Tube key={k} pts={VESSELS[k].pts} r={VESSELS[k].r} color={hl === 'pa' ? '#8fb0ff' : COL.pa} clip={clip} onClick={(e) => { e.stopPropagation(); pickS?.('pa'); }} />)}
      {(['svc', 'ivc'] as const).map((k) => <Tube key={k} pts={VESSELS[k].pts} r={VESSELS[k].r} color={hl === 'svc-ivc' ? '#8fa0ff' : COL.vein} clip={clip} onClick={(e) => { e.stopPropagation(); pickS?.('svc-ivc'); }} />)}
      {(['pvLeftSup', 'pvLeftInf', 'pvRightSup', 'pvRightInf'] as const).map((k) => <Tube key={k} pts={VESSELS[k].pts} r={VESSELS[k].r} color={hl === 'pulm-veins' ? '#ff9a9a' : '#c4625a'} clip={clip} onClick={(e) => { e.stopPropagation(); pickS?.('pulm-veins'); }} />)}
      {(['mitral', 'aortic', 'tricuspid', 'pulmonic'] as const).map((k) => <Valve key={k} id={k} state={state} clip={clip} onPick={pickS} highlight={hl === k} />)}
      {props.showConduction && <Conduction state={state} onPick={pickS} highlight={hl} />}
      {props.showCoronaries && <Coronaries dominance={props.dominance ?? 'right'} occlusion={props.occlusion} onPick={props.onPickArtery} clip={clip} />}
      {props.showTorso && <Torso />}
      {props.showLabels && <Labels />}
    </group>
  );
}

function Labels() {
  const items: Array<[string, V3]> = [
    ['LV', add(LV_BASE, add(scale(LV_AXIS, 4), scale(circ(270), LV_RADIUS + 1.6)))],
    ['RV', add(LV_BASE, add(scale(LV_AXIS, 2.6), scale(circ(80), LV_RADIUS + 3.6)))],
    ['LA', add(LA_CENTRE, [1.6, -1.4, -0.5])], ['RA', add(RA_CENTRE, [-2.4, 0, 0.4])],
    ['Aorta', [-0.8, -10.2, -1.2]], ['PA', [2.2, -7.6, 1.2]], ['SVC', [-4.8, -9.5, -0.6]], ['IVC', [-3.6, 3.6, -2]],
  ];
  return (
    <>
      {items.map(([k, p]) => (
        <Html key={k} position={toThree(p)} center distanceFactor={36} style={{ pointerEvents: 'none' }}>
          <span style={{ font: '700 12px system-ui', color: '#fff', textShadow: '0 0 3px #000, 0 0 2px #000', whiteSpace: 'nowrap' }}>{k}</span>
        </Html>
      ))}
    </>
  );
}

export default function Heart3D(props: Heart3DProps) {
  return (
    <div className="canvas3d" style={{ height: props.height ?? 520 }} role="img" aria-label={props.ariaLabel ?? '3D heart model – drag to rotate, scroll to zoom'}>
      <Canvas camera={{ position: [4, 3, props.showTorso ? 48 : 30], fov: 35 }} dpr={[1, 2]} onCreated={({ gl }) => { gl.localClippingEnabled = true; }}>
        <ambientLight intensity={0.55} />
        <directionalLight position={[10, 14, 22]} intensity={1.15} />
        <directionalLight position={[-12, -6, -14]} intensity={0.45} />
        <Scene {...props} />
        <OrbitControls enablePan={false} minDistance={10} maxDistance={90} />
      </Canvas>
    </div>
  );
}

/** Convert simulation samples to the 3D state (volumes relative to typical end-diastolic values). */
export function heartStateFromSample(s: { vLV: number; vRV: number; vLA: number; vRA: number; qMV: number; qAV: number; qTV: number; qPV: number }, actT: number, atrT: number): HeartState {
  return {
    lv: s.vLV / 125, rv: s.vRV / 135, la: s.vLA / 60, ra: s.vRA / 60,
    valves: { mitral: s.qMV > 2 ? 1 : 0, aortic: s.qAV > 2 ? 1 : 0, tricuspid: s.qTV > 2 ? 1 : 0, pulmonic: s.qPV > 2 ? 1 : 0 },
    actT, atrT,
  };
}

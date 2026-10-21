/** Small vector helpers. Body frame: x = patient's left, y = inferior (down), z = anterior. Units: cm. */
export type V3 = [number, number, number];

export const v3 = (x: number, y: number, z: number): V3 => [x, y, z];
export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
export const norm = (a: V3): V3 => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
export const dist = (a: V3, b: V3) => len(sub(a, b));
/** Remove the component of `a` along unit vector `u` and normalise. */
export const orthoNorm = (a: V3, u: V3): V3 => norm(sub(a, scale(u, dot(a, u))));

/** Rotate in the frontal (x–y) plane by deg (positive = towards +y = clockwise on the hexaxial wheel). */
export const rotFrontal = (a: V3, deg: number): V3 => {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r), s = Math.sin(r);
  return [a[0] * c - a[1] * s, a[0] * s + a[1] * c, a[2]];
};
/** Rotate in the horizontal (x–z) plane by deg (positive = towards +z, anterior). */
export const rotHorizontal = (a: V3, deg: number): V3 => {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r), s = Math.sin(r);
  return [a[0] * c - a[2] * s, a[1], a[0] * s + a[2] * c];
};

export const clamp = (x: number, lo: number, hi: number) => (x < lo ? lo : x > hi ? hi : x);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Deterministic PRNG (mulberry32) so simulations are reproducible in tests. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const deg = (rad: number) => (rad * 180) / Math.PI;
export const rad = (d: number) => (d * Math.PI) / 180;
/** Wrap angle to (-180, 180]. */
export const wrapDeg = (d: number) => {
  let x = ((d + 180) % 360 + 360) % 360 - 180;
  if (x === -180) x = 180;
  return x;
};

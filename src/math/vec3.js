// 3D vector helpers. Vectors are plain arrays [x, y, z].

/** a + b */
export function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }

/** a − b */
export function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }

/** a · s  (s is a number) */
export function scale(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }

/** dot product a · b (a number) */
export function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }

/** cross product a × b (right-handed) */
export function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

/** Euclidean length |a| */
export function length(a) { return Math.hypot(a[0], a[1], a[2]); }

/** a / |a|; return [0, 0, 0] for the zero vector instead of NaN */
export function normalize(a) {
  const len = length(a);
  if (len === 0) return [0, 0, 0];
  return [a[0] / len, a[1] / len, a[2] / len];
}

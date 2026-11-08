// Curve maths. Points are 2D arrays [x, y] in normalised painting coordinates
// (x right, y up, (0,0) = bottom-left corner of the painting, (1,1) = top-right).
//
// A piecewise cubic Bézier with n segments is stored as 3n + 1 points:
//   knots (on the curve) at indices 0, 3, 6, …, handles in between.
//
function lerp(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/** Cubic Bézier B(t) with the Bernstein basis, t ∈ [0, 1] */
export function bezier(p0, p1, p2, p3, t) {
  const u = 1 - t;
  const b0 = u ** 3, b1 = 3 * u * u * t, b2 = 3 * u * t * t, b3 = t ** 3;
  return [0, 1].map(i => b0 * p0[i] + b1 * p1[i] + b2 * p2[i] + b3 * p3[i]);
}

/** Derivative B'(t) (the tangent, not normalised) */
export function bezierDerivative(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return [0, 1].map(i => 3 * (
    u * u * (p1[i] - p0[i]) + 2 * u * t * (p2[i] - p1[i]) + t * t * (p3[i] - p2[i])
  ));
}

/**
 * de Casteljau construction for the 4 control points `ctrl` at parameter t.
 * Return every level: [[P0,P1,P2,P3], [3 points], [2 points], [1 point = B(t)]].
 */
export function deCasteljau(ctrl, t) {
  const levels = [ctrl];
  while (levels[levels.length - 1].length > 1) {
    const previous = levels[levels.length - 1];
    const next = [];
    for (let i = 0; i < previous.length - 1; i++) next.push(lerp(previous[i], previous[i + 1], t));
    levels.push(next);
  }
  return levels;
}

/**
 * Uniform Catmull–Rom segment between p1 and p2 (p0 and p3 are the neighbours).
 * Must give p1 at t = 0 and p2 at t = 1.
 */
export function catmullRom(p0, p1, p2, p3, t) {
  return [0, 1].map(i => 0.5 * (
    2 * p1[i] + (-p0[i] + p2[i]) * t
    + (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * t * t
    + (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * t * t * t
  ));
}

/**
 * Enforce C¹ continuity on a piecewise Bézier (array of 3n+1 points, modified in place).
 * `moved` is the index of the point the user just dragged.
 * At an interior knot K = points[k] (k = 3, 6, …) the handles must satisfy
 *   points[k+1] − K = K − points[k−1].
 * If the user moved points[k−1], fix points[k+1]; if they moved points[k+1], fix points[k−1].
 */
export function enforceC1(points, moved) {
  for (let k = 3; k < points.length - 1; k += 3) {
    const K = points[k];
    if (moved === k - 1) {
      points[k + 1] = [2 * K[0] - points[k - 1][0], 2 * K[1] - points[k - 1][1]];
    } else if (moved === k + 1) {
      points[k - 1] = [2 * K[0] - points[k + 1][0], 2 * K[1] - points[k + 1][1]];
    }
  }
}

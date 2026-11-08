// Curve state + evaluation on top of the curve maths in src/math/curves.js.
// Points are [x, y] in normalised painting coordinates, (0,0) bottom-left, (1,1) top-right.
import * as curves from '../math/curves.js';

// Traces the lower rim of the cut melon slice. 3 segments → 10 points (knots at 0, 3, 6, 9).
// Picked in image pixels (720 × 502) and converted with x / 720, 1 − y / 502.
const px = (x, y) => [x / 720, 1 - y / 502];
export const DEFAULT_POINTS = [
  px(135, 318), px(150, 352), px(196, 384),
  px(262, 397), px(328, 410), px(388, 414),
  px(446, 406), px(504, 398), px(560, 378),
  px(592, 340),
];

export class CurveModel {
  constructor() { this.mode = 'bezier'; this.reset(); }

  reset() { this.points = DEFAULT_POINTS.map(p => [...p]); }

  get segments() { return this.mode === 'bezier' ? (this.points.length - 1) / 3 : this.knotIndices().length - 1; }

  knotIndices() { return this.points.map((_, i) => i).filter(i => i % 3 === 0); }

  /** Global parameter t ∈ [0,1] → segment index and local parameter u ∈ [0,1]. */
  locate(t) {
    const n = this.segments, s = Math.min(n - 1e-9, Math.max(0, t) * n), i = Math.floor(s);
    return { i, u: s - i };
  }

  /** Control points of Bézier segment i. */
  bezierSegment(i) { return this.points.slice(3 * i, 3 * i + 4); }

  /** Neighbourhood for Catmull–Rom segment i (end points duplicated). */
  crSegment(i) {
    const K = this.knotIndices().map(k => this.points[k]), c = j => K[Math.max(0, Math.min(K.length - 1, j))];
    return [c(i - 1), c(i), c(i + 1), c(i + 2)];
  }

  at(t) {
    const { i, u } = this.locate(t);
    return this.mode === 'bezier' ? curves.bezier(...this.bezierSegment(i), u) : curves.catmullRom(...this.crSegment(i), u);
  }

  /** Tangent dC/dt (normalised painting units). Bézier: analytic; Catmull–Rom: central difference. */
  tangent(t) {
    if (this.mode === 'bezier') { const { i, u } = this.locate(t); return curves.bezierDerivative(...this.bezierSegment(i), u); }
    const h = 1e-3, a = this.at(Math.max(0, t - h)), b = this.at(Math.min(1, t + h));
    return [b[0] - a[0], b[1] - a[1]];
  }

  sample(n = 300) { const out = []; for (let k = 0; k <= n; k++) out.push(this.at(k / n)); return out; }

  /** Points the user can drag in the current mode. */
  editable() { return this.mode === 'bezier' ? this.points.map((_, i) => i) : this.knotIndices(); }

  /** Drag point `index` to `p`. A knot carries its two handles; a handle triggers C¹ enforcement. */
  drag(index, p) {
    const q = this.points[index], dx = p[0] - q[0], dy = p[1] - q[1];
    if (index % 3 === 0 && this.mode === 'bezier') {
      for (const j of [index - 1, index + 1]) if (this.points[j]) this.points[j] = [this.points[j][0] + dx, this.points[j][1] + dy];
    }
    this.points[index] = [p[0], p[1]];
    if (this.mode === 'bezier') curves.enforceC1(this.points, index);
  }

  /** Append a segment that continues the curve C¹-smoothly. */
  addSegment() {
    const n = this.points.length, K = this.points[n - 1], H = this.points[n - 2];
    const d = [K[0] - H[0], K[1] - H[1]], clamp = v => Math.min(0.98, Math.max(0.02, v));
    const h1 = [clamp(K[0] + d[0]), clamp(K[1] + d[1])];
    const k2 = [clamp(K[0] + 3 * d[0]), clamp(K[1] + 3 * d[1] - 0.05)];
    const h2 = [(h1[0] + k2[0]) / 2, (h1[1] + k2[1]) / 2 + 0.03];
    this.points.push(h1, h2, k2);
    curves.enforceC1(this.points, n - 2);
  }

  removeSegment() { if (this.points.length > 10) this.points.length -= 3; }

  toJSON() {
    const r = v => +v.toFixed(5);
    return {
      painting: { artist: 'Şeker Ahmed Paşa', title: 'Kavunlu Natürmort', collection: 'Sakıp Sabancı Museum' },
      shape: 'lower rim of the cut melon slice',
      coordinates: 'normalised painting coordinates: x right, y up, (0,0) = bottom-left, (1,1) = top-right',
      type: this.mode === 'bezier' ? 'piecewise cubic Bezier (C1)' : 'uniform Catmull-Rom (clamped ends)',
      segments: this.segments,
      controlPoints: this.points.map(([x, y], i) => ({ index: i, role: i % 3 === 0 ? 'knot' : 'handle', x: r(x), y: r(y) })),
      knots: this.knotIndices().map(i => ({ x: r(this.points[i][0]), y: r(this.points[i][1]) })),
    };
  }
}

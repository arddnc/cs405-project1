import { test } from 'node:test';
import * as c from '../camera.js';
import * as m from '../mat4.js';
import { close, num } from './helpers.js';

const ndc = (P, p) => { const q = m.transformPoint(P, p); return [q[0] / q[3], q[1] / q[3], q[2] / q[3]]; };
const row = (M, r) => [M[r], M[4 + r], M[8 + r]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

test('lookAt: camera on +z looking at the origin is a pure translation', () => {
  close(c.lookAt([0, 0, 5], [0, 0, 0], [0, 1, 0]), m.translate(0, 0, -5));
});
test('lookAt: target ends up on the −z axis at distance |target − eye|', () => {
  const V = c.lookAt([3, 4, 5], [1, 1, 1], [0, 1, 0]);
  const d = Math.hypot(2, 3, 4);
  close(m.transformPoint(V, [1, 1, 1]), [0, 0, -d, 1], 1e-5);
  close(m.transformPoint(V, [3, 4, 5]), [0, 0, 0, 1], 1e-5);   // eye → origin
});
test('lookAt: rows form an orthonormal basis', () => {
  const V = c.lookAt([2, 1, -3], [0, 0.5, 0], [0, 1, 0]);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) num(dot(row(V, i), row(V, j)), i === j ? 1 : 0, 1e-5);
});
test('lookAt: degenerate up (parallel to the view direction) gives no NaN', () => {
  const V = c.lookAt([0, 5, 0], [0, 0, 0], [0, 1, 0]);
  Array.from(V).forEach(x => { if (!Number.isFinite(x)) throw new Error('lookAt returned NaN/Infinity for up ∥ view direction'); });
  for (let i = 0; i < 3; i++) num(dot(row(V, i), row(V, i)), 1, 1e-5);
  close(m.transformPoint(V, [0, 0, 0]), [0, 0, -5, 1], 1e-5);
});
test('perspective: depth in [0, 1] (WebGPU)', () => {
  const n = 0.5, f = 20, P = c.perspective(Math.PI / 2, 2, n, f);
  num(ndc(P, [0, 0, -n])[2], 0); num(ndc(P, [0, 0, -f])[2], 1, 1e-5);
  close(ndc(P, [2, 1, -1]), [1, 1, ndc(P, [0, 0, -1])[2]]);   // fov 90°, aspect 2 → edge of the image
  num(P[11], -1);                                              // w_clip = −z_view
});
test('orthographic: maps the box to [−1,1]² × [0,1]', () => {
  const P = c.orthographic(-4, 2, -1, 3, 1, 11);
  close(ndc(P, [-4, -1, -1]), [-1, -1, 0]);
  close(ndc(P, [2, 3, -11]), [1, 1, 1]);
  close(ndc(P, [-1, 1, -6]), [0, 0, 0.5]);
});
test('orbitEye', () => {
  close(c.orbitEye([0, 0, 0], 0, 0, 5), [0, 0, 5]);
  close(c.orbitEye([1, 2, 3], Math.PI / 2, 0, 2), [3, 2, 3]);
  close(c.orbitEye([0, 0, 0], 0, Math.PI / 2, 4), [0, 4, 0]);
});
test('frustumCorners: perspective', () => {
  const k = c.frustumCorners({ projection: 'perspective', fovY: Math.PI / 2, aspect: 2, near: 1, far: 3 });
  close(k.flat(), [-2,-1,-1, 2,-1,-1, 2,1,-1, -2,1,-1,  -6,-3,-3, 6,-3,-3, 6,3,-3, -6,3,-3]);
});
test('frustumCorners: orthographic', () => {
  const k = c.frustumCorners({ projection: 'orthographic', aspect: 1.5, near: 1, far: 4, orthoHalfHeight: 2 });
  close(k.flat(), [-3,-2,-1, 3,-2,-1, 3,2,-1, -3,2,-1,  -3,-2,-4, 3,-2,-4, 3,2,-4, -3,2,-4]);
});

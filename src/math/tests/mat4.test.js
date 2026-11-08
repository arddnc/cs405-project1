import { test } from 'node:test';
import * as m from '../mat4.js';
import { close } from './helpers.js';

const I = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
const H = Math.PI / 2;
const apply = (M, p) => Array.from(m.transformPoint(M, p)).slice(0, 3);

test('identity', () => close(m.identity(), I));
test('translate stores the offset in elements 12, 13, 14 (column-major)', () => {
  close(m.translate(2, 3, 4), [1,0,0,0, 0,1,0,0, 0,0,1,0, 2,3,4,1]);
});
test('scale', () => close(m.scale(2, 3, 4), [2,0,0,0, 0,3,0,0, 0,0,4,0, 0,0,0,1]));
test('transformPoint returns 4 components', () => {
  close(m.transformPoint(m.translate(1, 2, 3), [1, 1, 1]), [2, 3, 4, 1]);
});
test('rotations are right-handed', () => {
  close(apply(m.rotateZ(H), [1, 0, 0]), [0, 1, 0]);   // x → y
  close(apply(m.rotateX(H), [0, 1, 0]), [0, 0, 1]);   // y → z
  close(apply(m.rotateY(H), [0, 0, 1]), [1, 0, 0]);   // z → x
  close(apply(m.rotateY(H), [1, 0, 0]), [0, 0, -1]);
});
test('multiply: identity is neutral, order matters', () => {
  const T = m.translate(1, 2, 3), R = m.rotateZ(0.7);
  close(m.multiply(I, T), T); close(m.multiply(T, I), T);
  // (T·R)·p rotates first, then translates
  close(apply(m.multiply(m.translate(5, 0, 0), m.rotateZ(H)), [1, 0, 0]), [5, 1, 0]);
  close(apply(m.multiply(m.rotateZ(H), m.translate(5, 0, 0)), [1, 0, 0]), [0, 6, 0]);
  close(m.multiplyAll(T, R, I), m.multiply(T, R));
});
test('T·R·S vs S·R·T', () => {
  const T = m.translate(2, 0, 0), S = m.scale(3, 3, 3);
  close(apply(m.multiplyAll(T, I, S), [0, 0, 0]), [2, 0, 0]);
  close(apply(m.multiplyAll(S, I, T), [0, 0, 0]), [6, 0, 0]);   // the translation is scaled too
});
test('transpose', () => {
  const A = Array.from({ length: 16 }, (_, i) => i);
  close(m.transpose(A), [0,4,8,12, 1,5,9,13, 2,6,10,14, 3,7,11,15]);
});
test('invertRigid: M · M⁻¹ = I', () => {
  const M = m.multiplyAll(m.translate(1, -2, 3), m.rotateX(0.4), m.rotateY(-1.1), m.rotateZ(2.0));
  close(m.multiply(M, m.invertRigid(M)), I, 1e-5);
  close(m.multiply(m.invertRigid(M), M), I, 1e-5);
});

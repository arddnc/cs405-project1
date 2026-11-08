import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as cv from '../curves.js';
import { close } from './helpers.js';

const P = [[0, 0], [1, 2], [3, 3], [4, 0]];

test('bezier: interpolates the end points', () => {
  close(cv.bezier(...P, 0), [0, 0]);
  close(cv.bezier(...P, 1), [4, 0]);
});
test('bezier: value at t = 0.5', () => close(cv.bezier(...P, 0.5), [2, 1.875]));
test('bezierDerivative: B\'(0) = 3(P1−P0), B\'(1) = 3(P3−P2)', () => {
  close(cv.bezierDerivative(...P, 0), [3, 6]);
  close(cv.bezierDerivative(...P, 1), [3, -9]);
  close(cv.bezierDerivative(...P, 0.5), [4.5, 0.75]);
});
test('deCasteljau: 4 levels, last point equals bezier(t)', () => {
  const L = cv.deCasteljau(P, 0.3);
  assert.deepEqual(L.map(l => l.length), [4, 3, 2, 1]);
  close(L[1][0], [0.3, 0.6]);
  close(L[3][0], cv.bezier(...P, 0.3));
});
test('catmullRom: passes through p1 and p2, tangent (p2−p0)/2', () => {
  const Q = [[0, 0], [1, 1], [3, 1], [4, 0]];
  close(cv.catmullRom(...Q, 0), [1, 1]);
  close(cv.catmullRom(...Q, 1), [3, 1]);
  const h = 1e-4, a = cv.catmullRom(...Q, h), b = cv.catmullRom(...Q, 0);
  close([(a[0] - b[0]) / h, (a[1] - b[1]) / h], [1.5, 0.5], 1e-3);
  close(cv.catmullRom(...Q, 0.5), [2, 1.125]);
});
test('enforceC1 mirrors the opposite handle', () => {
  const pts = [[0,0],[1,1],[2,1],[3,0],[9,9],[5,1],[6,0]];
  cv.enforceC1(pts, 2);                 // moved the handle before knot 3
  close(pts[4], [4, -1]);
  pts[4] = [3.5, -2]; cv.enforceC1(pts, 4); // moved the handle after knot 3
  close(pts[2], [2.5, 2]);
  close(pts[0], [0, 0]); close(pts[6], [6, 0]);
});

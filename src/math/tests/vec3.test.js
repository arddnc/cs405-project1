import { test } from 'node:test';
import * as v from '../vec3.js';
import { close, num } from './helpers.js';

test('add / sub / scale', () => {
  close(v.add([1, 2, 3], [4, 5, 6]), [5, 7, 9]);
  close(v.sub([1, 2, 3], [4, 5, 6]), [-3, -3, -3]);
  close(v.scale([1, -2, 3], 2), [2, -4, 6]);
});
test('dot / length', () => {
  num(v.dot([1, 2, 3], [4, 5, 6]), 32);
  num(v.length([3, 4, 12]), 13);
});
test('cross is right-handed', () => {
  close(v.cross([1, 0, 0], [0, 1, 0]), [0, 0, 1]);
  close(v.cross([0, 1, 0], [0, 0, 1]), [1, 0, 0]);
  close(v.cross([2, 3, 4], [5, 6, 7]), [-3, 6, -3]);
});
test('normalize', () => {
  close(v.normalize([0, 3, 4]), [0, 0.6, 0.8]);
  close(v.normalize([0, 0, 0]), [0, 0, 0]);
});

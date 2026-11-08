import assert from 'node:assert/strict';
export const EPS = 1e-5;
export function close(actual, expected, eps = EPS, msg = '') {
  const a = Array.from(actual), e = Array.from(expected);
  assert.equal(a.length, e.length, `${msg} length ${a.length} vs ${e.length}`);
  a.forEach((v, i) => assert.ok(Number.isFinite(v) && Math.abs(v - e[i]) <= eps,
    `${msg} index ${i}: got ${v}, expected ${e[i]}\n  got:      [${a.map(x => +x.toFixed(4))}]\n  expected: [${e.map(x => +x.toFixed(4))}]`));
}
export const num = (a, e, eps = EPS, msg = '') => assert.ok(Math.abs(a - e) <= eps, `${msg} got ${a}, expected ${e}`);

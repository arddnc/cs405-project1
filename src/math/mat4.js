// 4×4 matrices, COLUMN-MAJOR, exactly as WebGPU reads them from a uniform buffer.
// A matrix is a Float32Array(16) (a plain Array of 16 numbers is also accepted).
// Element (row r, column c) lives at index  c * 4 + r.
// The translation of an affine matrix is therefore at indices 12, 13, 14.
//
// Convention used everywhere in the project: column vectors, p' = M · p,
// so in M = T · R · S the scale is applied first and the translation last.
//

/** 4×4 identity */
export function identity() {
  return new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ]);
}

/** a · b  (a applied after b) */
export function multiply(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += a[k * 4 + r] * b[c * 4 + k];
      o[c * 4 + r] = sum;
    }
  }
  return o;
}

/** convenience: multiplyAll(A, B, C) === multiply(multiply(A, B), C) */
export function multiplyAll(...ms) { return ms.reduce((acc, m) => multiply(acc, m)); }

/** translation by (x, y, z) */
export function translate(x, y, z) {
  return new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    x, y, z, 1,
  ]);
}

/** rotation by `rad` radians about the +x axis (right-handed, counter-clockwise looking down −x) */
export function rotateX(rad) {
  const c = Math.cos(rad), s = Math.sin(rad);
  return new Float32Array([
    1, 0, 0, 0,
    0, c, s, 0,
    0, -s, c, 0,
    0, 0, 0, 1,
  ]);
}

/** rotation by `rad` radians about the +y axis */
export function rotateY(rad) {
  const c = Math.cos(rad), s = Math.sin(rad);
  return new Float32Array([
    c, 0, -s, 0,
    0, 1, 0, 0,
    s, 0, c, 0,
    0, 0, 0, 1,
  ]);
}

/** rotation by `rad` radians about the +z axis */
export function rotateZ(rad) {
  const c = Math.cos(rad), s = Math.sin(rad);
  return new Float32Array([
    c, s, 0, 0,
    -s, c, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ]);
}

/** non-uniform scale */
export function scale(x, y, z) {
  return new Float32Array([
    x, 0, 0, 0,
    0, y, 0, 0,
    0, 0, z, 0,
    0, 0, 0, 1,
  ]);
}

/** transpose */
export function transpose(m) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) o[c * 4 + r] = m[r * 4 + c];
  }
  return o;
}

/**
 * Inverse of a RIGID transform M = T · R (rotation + translation only, no scale).
 * Do not write a general 4×4 inverse: use  M⁻¹ = [Rᵀ | −Rᵀ t].
 */
export function invertRigid(m) {
  const o = new Float32Array(16);
  for (let c = 0; c < 3; c++) {
    for (let r = 0; r < 3; r++) o[c * 4 + r] = m[r * 4 + c];
  }
  for (let r = 0; r < 3; r++) {
    o[12 + r] = -(o[r] * m[12] + o[4 + r] * m[13] + o[8 + r] * m[14]);
  }
  o[15] = 1;
  return o;
}

/**
 * m · [x, y, z, 1]ᵀ  → returns [x', y', z', w'] (4 numbers, no perspective divide).
 */
export function transformPoint(m, p) {
  const [x, y, z] = p;
  const o = new Array(4);
  for (let r = 0; r < 4; r++) {
    o[r] = m[r] * x + m[4 + r] * y + m[8 + r] * z + m[12 + r];
  }
  return o;
}

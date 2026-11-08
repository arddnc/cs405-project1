// Mesh generators. Every mesh is { positions, normals, uvs, indices } (flat typed arrays).

export function cube() {
  // 6 faces × 4 vertices so every face gets its own normal; unit cube centred at the origin
  const faces = [
    { n: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0] }, { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },
    { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1] }, { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] },
    { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] }, { n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0] },
  ];
  const P = [], N = [], UV = [], I = [];
  faces.forEach(({ n, u, v }, f) => {
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      P.push(0.5 * (n[0] + a * u[0] + b * v[0]), 0.5 * (n[1] + a * u[1] + b * v[1]), 0.5 * (n[2] + a * u[2] + b * v[2]));
      N.push(...n); UV.push((a + 1) / 2, (1 - b) / 2);
    }
    const o = f * 4; I.push(o, o + 1, o + 2, o, o + 2, o + 3);
  });
  return pack(P, N, UV, I);
}

export function sphere(seg = 20, rings = 14) {
  const P = [], N = [], UV = [], I = [];
  for (let r = 0; r <= rings; r++) {
    const th = (r / rings) * Math.PI;
    for (let s = 0; s <= seg; s++) {
      const ph = (s / seg) * 2 * Math.PI;
      const n = [Math.sin(th) * Math.sin(ph), Math.cos(th), Math.sin(th) * Math.cos(ph)];
      P.push(n[0] * 0.5, n[1] * 0.5, n[2] * 0.5); N.push(...n); UV.push(s / seg, r / rings);
    }
  }
  for (let r = 0; r < rings; r++) for (let s = 0; s < seg; s++) {
    const a = r * (seg + 1) + s, b = a + seg + 1;
    I.push(a, b, a + 1, a + 1, b, b + 1);
  }
  return pack(P, N, UV, I);
}

/** Square pyramid, base on y = −0.5, apex at y = +0.5 */
export function pyramid() {
  const P = [], N = [], UV = [], I = [];
  const apex = [0, 0.5, 0], base = [[-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0.5, -0.5, -0.5], [-0.5, -0.5, -0.5]];
  const tri = (a, b, c) => {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    const l = Math.hypot(...n); n = n.map(x => x / l);
    const o = P.length / 3; [a, b, c].forEach(p => { P.push(...p); N.push(...n); UV.push(0, 0); }); I.push(o, o + 1, o + 2);
  };
  for (let i = 0; i < 4; i++) tri(base[i], base[(i + 1) % 4], apex);
  tri(base[0], base[2], base[1]); tri(base[0], base[3], base[2]);
  return pack(P, N, UV, I);
}

/** Unit quad in the xy plane facing +z; uv (0,0) is the image's top-left corner */
export function quad() {
  return pack([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0],
    [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], [0, 1, 1, 1, 1, 0, 0, 0], [0, 1, 2, 0, 2, 3]);
}

function pack(P, N, UV, I) {
  return { positions: new Float32Array(P), normals: new Float32Array(N), uvs: new Float32Array(UV), indices: new Uint32Array(I) };
}

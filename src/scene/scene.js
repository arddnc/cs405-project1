// Builds the scene graph in front of the painting and animates it.
import * as mat4 from '../math/mat4.js';
import { Node } from './node.js';

/** '#rrggbb' (sRGB) → linear RGBA, because the render target encodes to sRGB. */
export function color(hex, a = 1) {
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  return new Float32Array([...c.map(v => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)), a]);
}

export const PAINTING_WIDTH = 6;          // world units
export const PAINTING_CENTER_Y = 3.25;

export function createScene(meshes, imageAspect) {
  const PW = PAINTING_WIDTH, PH = PW / imageAspect;
  const { cube, sphere, pyramid, quad } = meshes;
  const S = mat4.scale, T = mat4.translate, M = mat4.multiplyAll;

  const root = new Node('root');

  // the painting hangs in the plane z = 0 (local painting space: x right, y up, origin at its centre)
  const painting = root.add(new Node('painting', { local: T(0, PAINTING_CENTER_Y, 0),
    shape: { kind: 'painting', mesh: quad, matrix: S(PW, PH, 1) } }));
  painting.add(new Node('frame', { local: T(0, 0, -0.06),
    shape: { mesh: cube, color: color('#3a2414'), matrix: S(PW + 0.32, PH + 0.32, 0.1) } }));
  const follower = painting.add(new Node('curve follower', {
    shape: { mesh: pyramid, color: color('#ff3b30'), matrix: M(mat4.rotateZ(-Math.PI / 2), S(0.16, 0.42, 0.08)) } }));

  // a table in front of the painting, echoing the painted table top
  const table = root.add(new Node('table', { local: T(0, 0.85, 1.9),
    shape: { mesh: cube, color: color('#9aa3a6'), matrix: S(5.2, 0.1, 2.4) } }));
  for (const [x, z] of [[-2.4, -1], [2.4, -1], [2.4, 1], [-2.4, 1]])
    table.add(new Node(`leg ${x > 0 ? 'R' : 'L'}${z > 0 ? 'F' : 'B'}`, { local: T(x, -0.45, z),
      shape: { mesh: cube, color: color('#4a3626'), matrix: S(0.12, 0.85, 0.12) } }));

  // articulated lamp: table → base → arm 1 → arm 2 → head → bulb
  const lampBase = table.add(new Node('lamp base', { shape: { mesh: cube, color: color('#2b2b2e'), matrix: S(0.6, 0.12, 0.6) } }));
  const arm1 = lampBase.add(new Node('arm 1', { shape: { mesh: cube, color: color('#c9a227'), matrix: M(T(0, 0.55, 0), S(0.08, 1.1, 0.08)) } }));
  const arm2 = arm1.add(new Node('arm 2', { shape: { mesh: cube, color: color('#c9a227'), matrix: M(T(0, 0.45, 0), S(0.07, 0.9, 0.07)) } }));
  const head = arm2.add(new Node('head', { shape: { mesh: pyramid, color: color('#1f5f8b'), matrix: M(T(0, -0.1, 0), S(0.42, 0.36, 0.42)) } }));
  const bulb = head.add(new Node('bulb', { local: T(0, -0.32, 0), shape: { mesh: sphere, color: color('#fff2a8'), matrix: S(0.16, 0.16, 0.16) } }));

  // Part A objects
  const melon = table.add(new Node('melon', { local: M(T(0.25, 0.3, -0.35), mat4.rotateZ(0.15)),
    shape: { mesh: sphere, color: color('#c8b13a'), matrix: S(0.85, 0.5, 0.5) } }));
  const box = table.add(new Node('box', { local: M(T(1.9, 0.25, -0.55), mat4.rotateY(0.6)),
    shape: { mesh: cube, color: color('#3c7a3a'), matrix: S(0.5, 0.4, 0.5) } }));
  const controlled = root.add(new Node('controlled object', { shape: { mesh: cube, color: color('#b4441c'), matrix: S(0.55, 0.55, 0.55) } }));

  const nodes = { root, painting, follower, table, lampBase, arm1, arm2, head, bulb, melon, box, controlled };

  /** Per-frame update of the animated and UI-driven local transforms. */
  function update(time, p) {
    const t = p.animate ? time * p.speed : p.frozenTime;
    lampBase.local = M(T(-1.85, 0.11, -0.45), mat4.rotateY(0.6 * Math.sin(0.5 * t)));
    arm1.local = M(T(0, 0.06, 0), mat4.rotateZ(-0.35 + 0.3 * Math.sin(1.1 * t)));
    arm2.local = M(T(0, 1.1, 0), mat4.rotateZ(-1.9 + 0.35 * Math.sin(0.9 * t + 1)));
    head.local = M(T(0, 0.9, 0), mat4.rotateZ(-0.9 + 0.25 * Math.sin(1.7 * t)));

    const a = p.partA;
    const Tm = T(a.tx, a.ty, a.tz), Rm = mat4.rotateY(a.rotY * Math.PI / 180), Sm = S(a.scale, a.scale, a.scale);
    const TRS = M(Tm, Rm, Sm), SRT = M(Sm, Rm, Tm);
    controlled.local = a.order === 'T·R·S' ? TRS : SRT;
    return { TRS, SRT };
  }

  return { root, nodes, PW, PH, update };
}

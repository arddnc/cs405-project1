// Mouse handling: orbit the main camera, zoom, and pick/drag curve control points
// in the plane of the painting.
import * as mat4 from '../math/mat4.js';

/**
 * app must provide:
 *   viewAt(x, y)   → { name, rect:[x,y,w,h] (CSS px) } or null
 *   mainFrame      → last frame's main camera { V, VP, frustum }
 *   painting       → { node, PW, PH }
 *   curve          → CurveModel
 *   cam            → main camera state (yaw, pitch, dist)
 *   settings.editCurve
 */
export function attachInput(canvas, app) {
  let mode = null, last = null, dragIndex = -1;

  const local = e => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const toNDC = (p, rect) => [((p[0] - rect[0]) / rect[2]) * 2 - 1, 1 - ((p[1] - rect[1]) / rect[3]) * 2];

  /** Normalised painting coords → world position (slightly in front of the canvas). */
  const paintingToWorld = (uv, z = 0.03) => {
    const { node, PW, PH } = app.painting;
    return mat4.transformPoint(node.world, [(uv[0] - 0.5) * PW, (uv[1] - 0.5) * PH, z]).slice(0, 3);
  };

  /** Screen point → ray from the main camera → intersection with the painting plane (normalised coords). */
  function screenToPainting(p, rect) {
    const f = app.mainFrame, [nx, ny] = toNDC(p, rect), fr = f.frustum;
    let o, d;
    if (fr.projection === 'perspective') {
      const th = Math.tan(fr.fovY / 2);
      o = [0, 0, 0]; d = [nx * th * fr.aspect, ny * th, -1];
    } else {
      o = [nx * fr.orthoHalfHeight * fr.aspect, ny * fr.orthoHalfHeight, 0]; d = [0, 0, -1];
    }
    // camera space → painting space: (painting.world)⁻¹ · V⁻¹, both rigid
    const toPainting = mat4.multiply(mat4.invertRigid(app.painting.node.world), mat4.invertRigid(f.V));
    const O = mat4.transformPoint(toPainting, o), E = mat4.transformPoint(toPainting, [o[0] + d[0], o[1] + d[1], o[2] + d[2]]);
    const D = [E[0] - O[0], E[1] - O[1], E[2] - O[2]];
    if (Math.abs(D[2]) < 1e-8) return null;
    const s = -O[2] / D[2];
    if (s < 0) return null;
    const { PW, PH } = app.painting;
    const clamp = v => Math.min(1, Math.max(0, v));
    return [clamp((O[0] + s * D[0]) / PW + 0.5), clamp((O[1] + s * D[1]) / PH + 0.5)];
  }

  /** Index of the control point within 14 px of the cursor, or −1. */
  function pick(p, rect) {
    let best = -1, bestD = 14 * 14;
    for (const i of app.curve.editable()) {
      const c = mat4.transformPoint(app.mainFrame.VP, paintingToWorld(app.curve.points[i]));
      if (c[3] <= 0) continue;
      const sx = rect[0] + (c[0] / c[3] * 0.5 + 0.5) * rect[2], sy = rect[1] + (0.5 - c[1] / c[3] * 0.5) * rect[3];
      const d2 = (sx - p[0]) ** 2 + (sy - p[1]) ** 2;
      if (d2 < bestD) { bestD = d2; best = i; }
    }
    return best;
  }

  canvas.addEventListener('pointerdown', e => {
    const p = local(e), v = app.viewAt(p[0], p[1]);
    if (!v || v.name !== 'main') return;
    canvas.setPointerCapture(e.pointerId);
    last = p;
    dragIndex = app.settings.editCurve && e.button === 0 ? pick(p, v.rect) : -1;
    mode = dragIndex >= 0 ? 'drag' : 'orbit';
    canvas.style.cursor = mode === 'drag' ? 'grabbing' : 'move';
  });

  canvas.addEventListener('pointermove', e => {
    const p = local(e);
    if (!mode) {
      const v = app.viewAt(p[0], p[1]);
      canvas.style.cursor = v && v.name === 'main' && app.settings.editCurve && pick(p, v.rect) >= 0 ? 'grab' : 'default';
      return;
    }
    if (mode === 'orbit') {
      const cam = app.cam;
      cam.yaw -= (p[0] - last[0]) * 0.008;
      cam.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, cam.pitch + (p[1] - last[1]) * 0.008));
    } else if (mode === 'drag') {
      const v = app.viewAt(p[0], p[1]) || app.viewAt(last[0], last[1]);
      const uv = v && v.name === 'main' ? screenToPainting(p, v.rect) : null;
      if (uv) app.curve.drag(dragIndex, uv);
    }
    last = p;
  });

  const end = () => { mode = null; dragIndex = -1; canvas.style.cursor = 'default'; };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  canvas.addEventListener('wheel', e => {
    const p = local(e), v = app.viewAt(p[0], p[1]);
    if (!v || v.name !== 'main') return;
    e.preventDefault();
    app.cam.dist = Math.max(2, Math.min(35, app.cam.dist * Math.exp(e.deltaY * 0.001)));
  }, { passive: false });

  return { paintingToWorld };
}

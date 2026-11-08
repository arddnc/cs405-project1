// Control panel (lil-gui) and on-screen read-outs.
import GUI from 'lil-gui';

export function buildGUI(app) {
  const s = app.settings, gui = new GUI({ title: 'CS405 · Project 1' });

  const fv = gui.addFolder('View & camera (C)');
  fv.add(s, 'view', ['split', 'main', 'inspection']).name('view [1/2/3]');
  fv.add(app.cam, 'projection', ['perspective', 'orthographic']).name('projection [P]').listen();
  fv.add(app.cam, 'fovYDeg', 15, 100, 1).name('fov (°)').listen();
  fv.add(app.cam, 'near', 0.05, 5, 0.05).name('near').listen();
  fv.add(app.cam, 'far', 5, 120, 1).name('far').listen();
  fv.add(app.cam, 'dist', 2, 35, 0.1).name('orbit distance').listen();
  fv.add({ top: () => { app.cam.pitch = Math.PI / 2; } }, 'top').name('top view (up ∥ view dir test)');
  fv.add({ reset: () => app.resetCamera() }, 'reset').name('reset camera');

  const fa = gui.addFolder('Part A · transformations');
  fa.add(s.partA, 'order', ['T·R·S', 'S·R·T']).name('composition order').listen();
  fa.add(s.partA, 'tx', -4, 4, 0.05).name('translate x').listen();
  fa.add(s.partA, 'ty', -1, 4, 0.05).name('translate y').listen();
  fa.add(s.partA, 'tz', -2, 5, 0.05).name('translate z').listen();
  fa.add(s.partA, 'rotY', -180, 180, 1).name('rotate y (°)').listen();
  fa.add(s.partA, 'scale', 0.2, 3, 0.05).name('scale').listen();

  const fb = gui.addFolder('Part B · scene graph');
  fb.add(s, 'animate').name('animate lamp').listen();
  fb.add(s, 'speed', 0, 3, 0.05).name('speed');

  const fd = gui.addFolder('Part D · curves');
  fd.add(app.curve, 'mode', { 'Bézier (piecewise, C¹)': 'bezier', 'Catmull–Rom': 'cr' }).name('curve family').listen();
  fd.add(s, 'editCurve').name('drag control points');
  fd.add(s, 't', 0, 1, 0.001).name('parameter t').listen();
  fd.add(s, 'animateFollower').name('animate along curve').listen();
  fd.add(s, 'followerSpeed', 0.02, 0.5, 0.01).name('follower speed');
  fd.add({ add: () => app.curve.addSegment() }, 'add').name('add segment');
  fd.add({ rem: () => app.curve.removeSegment() }, 'rem').name('remove last segment');
  fd.add({ reset: () => app.curve.reset() }, 'reset').name('reset curve');
  fd.add({ exp: () => app.exportJSON() }, 'exp').name('export JSON');

  const fg = gui.addFolder('Debug drawings');
  fg.add(s, 'showNodeAxes').name('node axes [X]').listen();
  fg.add(s, 'showDeCasteljau').name('de Casteljau').listen();
  fg.add(s, 'showPolygon').name('control polygon').listen();
  fg.add(s, 'showGrid').name('floor grid').listen();
  fg.add(s, 'showFrustum').name('frustum (inspection)').listen();

  gui.add({ reset: () => app.resetScene() }, 'reset').name('⟲ reset scene [R]');
  return gui;
}

/** Row-major text of a column-major matrix. */
export function fmtMat(m) {
  let out = '';
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) { const v = m[c * 4 + r]; out += (Math.abs(v) < 5e-4 ? 0 : v).toFixed(2).padStart(7); }
    out += '\n';
  }
  return out;
}

export const fmtVec = v => `(${Array.from(v).map(x => x.toFixed(2)).join(', ')})`;

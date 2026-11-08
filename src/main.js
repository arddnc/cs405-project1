// Application entry: wires maths, scene, rendering and UI together and runs the frame loop.
import * as mat4 from './math/mat4.js';
import * as curves from './math/curves.js';
import { Renderer, LineBatch } from './render/renderer.js';
import * as geo from './scene/geometry.js';
import { createScene, color } from './scene/scene.js';
import { CurveModel } from './scene/curve.js';
import { defaultMainCamera, mainCameraFrame, inspectionFrame, frustumWorld } from './scene/cameras.js';
import { buildGUI, fmtMat, fmtVec } from './ui/gui.js';
import { attachInput } from './ui/input.js';

const $ = id => document.getElementById(id);
const defaultPartA = () => ({ order: 'T·R·S', tx: 1.0, ty: 1.25, tz: 2.75, rotY: 30, scale: 1 });

const COL = {
  grid: [0.35, 0.36, 0.4, 0.45], curve: [1, 0.84, 0.29, 1], poly: [1, 1, 1, 0.75],
  cast: [[0.44, 0.7, 0.88, 1], [0.49, 0.77, 0.47, 1], [0.94, 0.48, 0.29, 1]],
  frustum: [0.94, 0.48, 0.29, 1], ray: [0.94, 0.48, 0.29, 0.45],
  x: [0.9, 0.25, 0.2, 1], y: [0.3, 0.8, 0.35, 1], z: [0.3, 0.55, 0.95, 1],
};

function showError(e) {
  const msg = String(e && e.message || e);
  $('errorText').textContent = msg + (msg.includes('TODO(student)')
    ? '\n\nThe maths module is not finished yet. Run `npm test` to see which functions still fail.'
    : '\n\n' + (e && e.stack || ''));
  $('error').style.display = 'flex';
  console.error(e);
}
window.addEventListener('error', ev => showError(ev.error || ev.message));
window.addEventListener('unhandledrejection', ev => showError(ev.reason));

async function main() {
  const canvas = $('gfx');
  const renderer = await Renderer.create(canvas);
  const img = await renderer.loadTexture(`${import.meta.env.BASE_URL}kavunlu.jpg`);
  const meshes = { cube: renderer.createMesh(geo.cube()), sphere: renderer.createMesh(geo.sphere()),
    pyramid: renderer.createMesh(geo.pyramid()), quad: renderer.createMesh(geo.quad()) };
  const scene = createScene(meshes, img.width / img.height);
  const { nodes, PW, PH } = scene;

  const settings = {
    view: 'split', animate: true, speed: 1, frozenTime: 0, partA: defaultPartA(),
    editCurve: true, t: 0.3, animateFollower: true, followerSpeed: 0.12,
    showNodeAxes: false, showDeCasteljau: true, showPolygon: true, showGrid: true, showFrustum: true,
  };
  const app = {
    settings, cam: defaultMainCamera(), curve: new CurveModel(), painting: { node: nodes.painting, PW, PH },
    mainFrame: null, views: [],
    viewAt(x, y) { return this.views.find(v => x >= v.rect[0] && x < v.rect[0] + v.rect[2] && y >= v.rect[1] && y < v.rect[1] + v.rect[3]) || null; },
    resetCamera() { Object.assign(app.cam, defaultMainCamera()); },
    resetScene() {
      Object.assign(settings.partA, defaultPartA()); app.resetCamera(); app.curve.reset(); app.curve.mode = 'bezier';
      Object.assign(settings, { t: 0.3, animate: true, animateFollower: true, view: settings.view });
    },
    exportJSON() {
      const json = JSON.stringify(app.curve.toJSON(), null, 2);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      a.download = 'curve.json'; a.click(); URL.revokeObjectURL(a.href);
      console.log(json);
    },
  };
  const { paintingToWorld } = attachInput(canvas, app);
  buildGUI(app);

  window.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    const k = e.key.toLowerCase();
    if (k === '1') settings.view = 'split';
    else if (k === '2') settings.view = 'main';
    else if (k === '3') settings.view = 'inspection';
    else if (k === 'p') app.cam.projection = app.cam.projection === 'perspective' ? 'orthographic' : 'perspective';
    else if (k === 'x') settings.showNodeAxes = !settings.showNodeAxes;
    else if (k === 'r') app.resetScene();
    else if (k === 'i') { const el = $('info'); el.style.display = el.style.display === 'none' ? '' : 'none'; }
    else if (k === ' ') { settings.animateFollower = !settings.animateFollower; e.preventDefault(); }
  });

  const lines = new LineBatch(), extra = new LineBatch();
  const perf = { last: performance.now(), interval: 16.7, cpu: 0, lastText: 0 };
  let animTime = 0;

  function frame(now) {
    const t0 = performance.now();
    const dt = Math.min(0.1, (now - perf.last) / 1000);
    perf.interval = perf.interval * 0.95 + (now - perf.last) * 0.05; perf.last = now;
    renderer.resize();

    // ---- animation & UI state → local transforms
    if (settings.animate) animTime += dt;
    if (settings.animateFollower) settings.t = (settings.t + dt * settings.followerSpeed) % 1;
    const { TRS, SRT } = scene.update(animTime, { animate: true, speed: settings.speed, frozenTime: animTime, partA: settings.partA });

    // object on the curve, oriented by the tangent (tangent converted to world units first)
    const curve = app.curve, c = curve.at(settings.t), tan = curve.tangent(settings.t);
    const angle = Math.atan2(tan[1] * PH, tan[0] * PW);
    nodes.follower.local = mat4.multiply(mat4.translate((c[0] - 0.5) * PW, (c[1] - 0.5) * PH, 0.09), mat4.rotateZ(angle));

    scene.root.updateWorld(mat4.identity());

    // ---- layout
    const W = canvas.width, H = canvas.height, dpr = W / canvas.clientWidth;
    const rects = settings.view === 'split' ? { main: [0, 0, Math.floor(W / 2), H], inspection: [Math.floor(W / 2), 0, W - Math.floor(W / 2), H] }
      : settings.view === 'main' ? { main: [0, 0, W, H] } : { inspection: [0, 0, W, H] };
    const mainRect = rects.main || [0, 0, W, H];
    const mainFrame = mainCameraFrame(app.cam, mainRect[2] / mainRect[3]);
    app.mainFrame = mainFrame;

    // ---- geometry shared by both views
    const items = [];
    scene.root.traverse(n => {
      if (!n.shape) return;
      items.push({ kind: n.shape.kind || 'mesh', mesh: n.shape.mesh, model: mat4.multiply(n.world, n.shape.matrix), color: n.shape.color });
    });
    const ptCol = color('#b4441c'), hCol = color('#f4f1ea');
    for (const i of curve.editable()) {
      const p = paintingToWorld(curve.points[i], 0.03), knot = i % 3 === 0;
      items.push({ kind: 'mesh', mesh: knot ? meshes.sphere : meshes.cube, color: knot ? ptCol : hCol,
        model: mat4.multiply(mat4.translate(...p), knot ? mat4.scale(0.14, 0.14, 0.14) : mat4.scale(0.1, 0.1, 0.03)) });
    }

    lines.clear();
    if (settings.showGrid) for (let i = -12; i <= 12; i++) { lines.seg([i, 0, -12], [i, 0, 12], COL.grid); lines.seg([-12, 0, i], [12, 0, i], COL.grid); }
    lines.seg([0, 0.001, 0], [1.5, 0.001, 0], COL.x); lines.seg([0, 0.001, 0], [0, 1.5, 0], COL.y); lines.seg([0, 0.001, 0], [0, 0.001, 1.5], COL.z);
    if (settings.showNodeAxes) scene.root.traverse(n => {
      const o = mat4.transformPoint(n.world, [0, 0, 0]), L = 0.4;
      lines.seg(o, mat4.transformPoint(n.world, [L, 0, 0]), COL.x);
      lines.seg(o, mat4.transformPoint(n.world, [0, L, 0]), COL.y);
      lines.seg(o, mat4.transformPoint(n.world, [0, 0, L]), COL.z);
    });
    lines.strip(curve.sample(300).map(p => paintingToWorld(p, 0.02)), COL.curve);
    if (settings.showPolygon) {
      const idx = curve.editable();
      lines.strip(idx.map(i => paintingToWorld(curve.points[i], 0.025)), COL.poly);
    }
    let castPoint = null;
    if (settings.showDeCasteljau && curve.mode === 'bezier') {
      const { i, u } = curve.locate(settings.t);
      const levels = curves.deCasteljau(curve.bezierSegment(i), u);
      for (let d = 1; d < levels.length - 1; d++) lines.strip(levels[d].map(p => paintingToWorld(p, 0.03)), COL.cast[d - 1]);
      castPoint = levels[levels.length - 1][0];
      for (let d = 1; d < levels.length; d++) for (const p of levels[d])
        items.push({ kind: 'mesh', mesh: meshes.sphere, color: d === levels.length - 1 ? color('#ffd54a') : color('#6fb3e0'),
          model: mat4.multiply(mat4.translate(...paintingToWorld(p, 0.035)), mat4.scale(0.07, 0.07, 0.07)) });
    }

    // ---- inspection-only: main camera body + frustum
    const inspItems = items.slice();
    extra.clear();
    if (settings.showFrustum) {
      const k = frustumWorld(mainFrame), e = mainFrame.eye;
      for (let i = 0; i < 4; i++) {
        extra.seg(k[i], k[(i + 1) % 4], COL.frustum); extra.seg(k[4 + i], k[4 + (i + 1) % 4], COL.frustum);
        extra.seg(k[i], k[4 + i], COL.frustum); extra.seg(e, k[i], COL.ray);
      }
      extra.seg(e, app.cam.target, [1, 1, 1, 0.5]);
      inspItems.push({ kind: 'mesh', mesh: meshes.cube, color: color('#f07a4a'),
        model: mat4.multiply(mat4.invertRigid(mainFrame.V), mat4.scale(0.35, 0.28, 0.5)) });
    }
    const inspLines = new LineBatch(lines.count + extra.count);
    inspLines.data.set(lines.data.subarray(0, lines.count * 7)); inspLines.data.set(extra.data.subarray(0, extra.count * 7), lines.count * 7);
    inspLines.count = lines.count + extra.count;

    const views = [];
    if (rects.main) views.push({ name: 'main', viewport: rects.main, viewProj: mainFrame.VP, items, lines });
    if (rects.inspection) {
      const f = inspectionFrame(rects.inspection[2] / rects.inspection[3]);
      views.push({ name: 'inspection', viewport: rects.inspection, viewProj: f.VP, items: inspItems, lines: inspLines });
    }
    app.views = views.map(v => ({ name: v.name, rect: v.viewport.map(x => x / dpr) }));
    renderer.render(views, { r: 0.012, g: 0.013, b: 0.016, a: 1 });
    perf.cpu = perf.cpu * 0.95 + (performance.now() - t0) * 0.05;

    // ---- text read-outs (throttled)
    if (now - perf.lastText > 120) {
      perf.lastText = now;
      updateText({ TRS, SRT, mainFrame, c, castPoint });
      placeLabels();
    }
    requestAnimationFrame(guarded);
  }

  function updateText({ TRS, SRT, mainFrame, c }) {
    const s = settings, cam = app.cam, st = renderer.stats;
    $('statsText').textContent =
`frame interval ${perf.interval.toFixed(2)} ms  (${(1000 / perf.interval).toFixed(0)} fps)
CPU per frame  ${perf.cpu.toFixed(2)} ms
vertices/frame ${st.vertices}   draw calls ${st.drawCalls}
GPU            ${renderer.gpuName}`;
    const mark = o => (s.partA.order === o ? '▶ ' : '  ');
    const bulb = nodes.bulb;
    $('infoText').textContent =
`CAMERA (main) · ${cam.projection}
eye    ${fmtVec(mainFrame.eye)}
target ${fmtVec(cam.target)}
fov ${cam.fovYDeg.toFixed(0)}°  near ${cam.near.toFixed(2)}  far ${cam.far.toFixed(1)}
yaw ${cam.yaw.toFixed(2)}  pitch ${cam.pitch.toFixed(2)}

PART A · controlled object (local = world)
${mark('T·R·S')}M = T·R·S
${fmtMat(TRS)}${mark('S·R·T')}M = S·R·T
${fmtMat(SRT)}
PART B · world(bulb) =
 ${bulb.path().slice(1).map(n => n.name).join(' · ')}
${fmtMat(bulb.world)}
PART D · ${app.curve.mode === 'bezier' ? 'piecewise Bézier, C¹' : 'Catmull–Rom'} · ${app.curve.segments} segments
t = ${s.t.toFixed(3)}   C(t) = (${c[0].toFixed(3)}, ${c[1].toFixed(3)}) normalised`;
  }

  function placeLabels() {
    const show = (id, v) => { const el = $(id); el.style.display = v ? 'block' : 'none';
      if (v) { el.style.left = (v.rect[0] + v.rect[2] / 2 - el.offsetWidth / 2) + 'px'; el.style.top = '10px'; } };
    show('labelMain', app.views.find(v => v.name === 'main'));
    show('labelInsp', app.views.find(v => v.name === 'inspection'));
  }

  function guarded(now) { try { frame(now); } catch (e) { showError(e); } }
  requestAnimationFrame(guarded);
}

main().catch(showError);

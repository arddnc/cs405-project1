# CS405 Project 1 — Transformations, Projection & Curves from Paintings

**Painting:** Şeker Ahmed Paşa — *Kavunlu Natürmort* (Still Life with Melon), Sakıp Sabancı Museum.

One WebGPU application (no Three.js / gl-matrix; own maths in `src/math/`) that hangs the painting in a 3D scene,
places a small scene graph in front of it, orbits a camera around it, shows that camera's frustum from a second
camera, and traces a curve over the cut melon slice.

## Run

```bash
npm install
npm run dev      # open the printed URL in Chrome / Edge (WebGPU)
npm test         # unit tests for src/math
```

If the page shows a black canvas on a software renderer, open it with `?nomsaa` (disables 4× MSAA).

## Controls

| Input | Action |
|---|---|
| Left-drag on the main view | orbit the main camera |
| Mouse wheel on the main view | zoom (orbit distance) |
| Left-drag a red sphere / white square | move a curve knot / Bézier handle in the plane of the painting |
| `1` / `2` / `3` | split view / main camera only / inspection camera only |
| `P` | perspective ↔ orthographic |
| `X` | toggle the local axes of every scene-graph node |
| `I` | show / hide the information panel |
| `R` | reset the scene |
| `Space` | play / pause the object moving along the curve |

Panel (top right):

- **View & camera** — view mode, projection, fov, near, far, orbit distance, *top view* (puts `up` parallel to the
  viewing direction to exercise the degenerate case of `lookAt`), reset camera.
- **Part A** — composition order `T·R·S` / `S·R·T`, translation, rotation about y and scale of the red cube. Both
  matrices are printed in the information panel; `▶` marks the one in use.
- **Part B** — animate the lamp (table → lamp base → arm 1 → arm 2 → head → bulb), animation speed. The information
  panel prints the world matrix of the leaf node `bulb`.
- **Part D** — curve family (piecewise C¹ Bézier / Catmull–Rom), parameter `t`, animate the follower along the curve,
  add / remove a segment, reset the curve, **export JSON** (downloads `curve.json`, normalised coordinates).
- **Debug drawings** — node axes, de Casteljau construction, control polygon, floor grid, frustum.
- **Reset scene**.

Top-left read-outs: frame interval and FPS, CPU time per frame, vertices submitted per frame, draw calls, GPU name.

## Code structure

```
src/math/     vec3.js, mat4.js (column-major), camera.js (lookAt, perspective, orthographic, orbit, frustum),
              curves.js (Bézier, de Casteljau, Catmull–Rom, C¹), tests/ (node:test)
src/scene/    node.js (scene-graph node), scene.js (the tree), cameras.js, curve.js (curve state), geometry.js
src/render/   renderer.js (WebGPU device, pipelines, dynamic-offset uniforms, line batches), shaders.js (WGSL)
src/ui/       gui.js (lil-gui panel, matrix formatting), input.js (orbit, picking, dragging in the painting plane)
src/main.js   frame loop: animation → world matrices → views → render → read-outs
```

Conventions: column vectors (`p' = M p`), column-major storage (element (r, c) at `c*4 + r`), right-handed world,
camera looks down −z, WebGPU clip depth `z ∈ [0, 1]`, model matrices composed as `T·R·S`.

## Deliverables

- `report.pdf` — the report (also uploaded to SUCourse)
- `curve.json` — exported curve
- tag `project1-final`

# CS405 Project 1 — Report
**Name:** Arda Dinç · **Painting:** Şeker Ahmed Paşa — *Kavunlu Natürmort* (Sakıp Sabancı Museum) · **Repo:** <link> (tag `project1-final`)

> 3–5 pages. Replace every `[ ]` item. Export to `report.pdf`.

## 1. Painting and scene
[ ] Why this painting: strong organic contours (melon, cut slice) for curve tracing; the painted table top suggested the
3D table placed in front of it. Screenshot of the whole scene (split view).

## 2. Part A — Transformations
[ ] Screenshot with `T·R·S` and the two matrices visible; screenshot with `S·R·T`.
[ ] Paragraph: with column vectors, `M p = T(R(S p))` applies scale first, so the object is scaled about its own
centre and then moved. In `S·R·T` the translation is applied first and then rotated and scaled, so the offset itself is
rotated and multiplied by the scale (compare the last columns of the two printed matrices: (tx, ty, tz) vs
s·R·(tx, ty, tz)). State the convention: `T·R·S`, column-major, column vectors.

## 3. Part B — Scene graph
[ ] Tree diagram: root → {painting → {frame, curve follower}, table → {4 legs, lamp base → arm 1 → arm 2 → head → bulb,
melon, box}, controlled object}. (≥ 3 levels, ≥ 5 nodes; animated joints: lamp base, arm 1, arm 2, head.)
[ ] Write world(bulb) = M_table · M_base · M_arm1 · M_arm2 · M_head · M_bulb with the numbers at one paused frame
(Part B → untick *animate lamp*), multiply by hand (or at least the translation column) and compare with the matrix in the
information panel.
[ ] Screenshot with node axes (`X`).

## 4. Part C — Camera and projection
[ ] Derivation of `lookAt`: w = normalize(eye − target), u = normalize(up × w), v = w × u; V = [R | −R·eye] with rows
u, v, w. Degenerate case (up ∥ w) and how you handled it (button *top view*).
[ ] Perspective matrix for z ∈ [0, 1]: derive A, B in z_ndc = (A z + B)/(−z) from z = −n → 0, z = −f → 1.
Orthographic matrix.
[ ] Screenshots: perspective vs orthographic (same viewpoint); inspection view showing the frustum.
[ ] Near/far discussion: chosen near = 0.5, far = 20. Depth is ∝ 1/z, so precision is concentrated near the near plane;
try near = 0.05 with far = 120 and describe/show z-fighting or the loss of precision.

## 5. Part D — Curves
[ ] Bernstein basis: B0 = (1−t)³, B1 = 3t(1−t)², B2 = 3t²(1−t), B3 = t³ (plot or table).
[ ] Proof that B(0) = P0 and B(1) = P3.
[ ] C¹ condition at a joint K between segments (…, P2, K) and (K, Q1, …): B'(1) = 3(K − P2) = 3(Q1 − K) = C'(0)
⇒ Q1 = 2K − P2.
[ ] Second family: Catmull–Rom (passes through the knots; tangent at p_i = (p_{i+1} − p_{i−1})/2).
[ ] Screenshot of the traced shape over the painting (with the de Casteljau construction visible).

## 6. What went wrong and how I found it
[ ] Honest, specific (e.g. a row/column-major mix-up found by a failing unit test, OpenGL depth range, NaN in lookAt…).

## 7. Performance
[ ] GPU: <from the read-out>. Frame interval / CPU time / vertices per frame in split view and single view.

## Appendix A — AI use
| Tool | What I asked | What I kept |
|---|---|---|
| Claude (Anthropic), 8 Nov 2026 | Explanation of the assignment requirements and of the maths behind each function. | Explanations only; I wrote all of `src/math/*` and `Node.updateWorld` myself. |
| Claude (Anthropic), 8 Nov 2026 | Generate the application scaffolding (I did not have the starter repository): WebGPU renderer and WGSL shaders, mesh generators, scene layout, camera/curve state classes, mouse picking and dragging, lil-gui panel and read-outs, unit tests for the maths module, README and this report's outline. | Kept as generated, with my edits: <list>. |
| … | … | … |

## Appendix B — Exported curve (`curve.json`)
[ ] Paste the file.

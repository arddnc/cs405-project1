// Camera maths: view matrix, projections, orbit position and the view frustum.
// Right-handed world, the camera looks down its own −z axis, +y is up.
// WebGPU clip space: x, y ∈ [−1, 1] and depth z ∈ [0, 1] (NOT OpenGL's [−1, 1]).
//
import * as v from './vec3.js';
import { invertRigid } from './mat4.js';

/**
 * View matrix V that maps world space to camera space.
 * Build the camera basis with TWO cross products. If `up` is (nearly) parallel
 * to the viewing direction, pick another up vector instead of returning NaNs.
 * @param {number[]} eye    camera position
 * @param {number[]} target point the camera looks at
 * @param {number[]} up     approximate up direction
 */
export function lookAt(eye, target, up) {
  const w = v.normalize(v.sub(eye, target));
  let right = v.cross(up, w);
  if (v.length(right) < 1e-6) {
    right = v.cross([0, 0, 1], w);
    if (v.length(right) < 1e-6) right = v.cross([1, 0, 0], w);
  }
  const u = v.normalize(right);
  const cameraUp = v.cross(w, u);
  const cameraToWorld = new Float32Array([
    u[0], u[1], u[2], 0,
    cameraUp[0], cameraUp[1], cameraUp[2], 0,
    w[0], w[1], w[2], 0,
    eye[0], eye[1], eye[2], 1,
  ]);
  return invertRigid(cameraToWorld);
}

/**
 * Perspective projection, depth mapped to [0, 1]:
 *   a point at z_view = −near must end at z_ndc = 0, at z_view = −far at z_ndc = 1.
 * @param {number} fovY vertical field of view in RADIANS
 */
export function perspective(fovY, aspect, near, far) {
  const f = 1 / Math.tan(fovY / 2);
  const m = new Float32Array(16);
  m[0] = f / aspect;
  m[5] = f;
  m[10] = far / (near - far);
  m[11] = -1;
  m[14] = near * far / (near - far);
  return m;
}

/**
 * Orthographic projection of the box [left,right]×[bottom,top]×[−near,−far],
 * with the same depth convention as perspective(): −near → 0, −far → 1.
 */
export function orthographic(left, right, bottom, top, near, far) {
  const m = new Float32Array(16);
  m[0] = 2 / (right - left);
  m[5] = 2 / (top - bottom);
  m[10] = 1 / (near - far);
  m[12] = -(right + left) / (right - left);
  m[13] = -(top + bottom) / (top - bottom);
  m[14] = near / (near - far);
  m[15] = 1;
  return m;
}

/**
 * Orbit camera position on a sphere around `target`.
 *   yaw   = angle around the world y axis (yaw = 0 puts the eye on +z)
 *   pitch = elevation above the xz plane (pitch = +π/2 is straight above)
 * Expected: x = d·cos(pitch)·sin(yaw), y = d·sin(pitch), z = d·cos(pitch)·cos(yaw), plus target.
 */
export function orbitEye(target, yaw, pitch, dist) {
  return [
    target[0] + dist * Math.cos(pitch) * Math.sin(yaw),
    target[1] + dist * Math.sin(pitch),
    target[2] + dist * Math.cos(pitch) * Math.cos(yaw),
  ];
}

/**
 * The 8 corners of the view volume in CAMERA space, in this order:
 *   near: bottom-left, bottom-right, top-right, top-left,
 *   far:  bottom-left, bottom-right, top-right, top-left.
 * cam = { projection: 'perspective' | 'orthographic', fovY, aspect, near, far, orthoHalfHeight }
 * (for orthographic, half width = orthoHalfHeight · aspect)
 */
export function frustumCorners(cam) {
  const corners = [];
  for (const d of [cam.near, cam.far]) {
    const h = cam.projection === 'perspective'
      ? Math.tan(cam.fovY / 2) * d
      : cam.orthoHalfHeight;
    const hw = h * cam.aspect;
    corners.push([-hw, -h, -d], [hw, -h, -d], [hw, h, -d], [-hw, h, -d]);
  }
  return corners;
}

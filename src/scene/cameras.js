// Camera state (orbit "main" camera + fixed inspection camera) → view/projection matrices.
import * as mat4 from '../math/mat4.js';
import * as camera from '../math/camera.js';

export const UP = [0, 1, 0];

export function defaultMainCamera() {
  return { target: [0, 2.3, 0.8], yaw: 0.42, pitch: 0.2, dist: 10.5, fovYDeg: 50, near: 0.5, far: 20, projection: 'perspective' };
}

export const INSPECTION = { eye: [16, 10.5, 17], target: [0, 2.2, 2], fovYDeg: 42, near: 1, far: 200 };

/** Main (orbit) camera matrices for a viewport of the given aspect ratio. */
export function mainCameraFrame(cam, aspect) {
  const eye = camera.orbitEye(cam.target, cam.yaw, cam.pitch, cam.dist);
  const V = camera.lookAt(eye, cam.target, UP);
  const fovY = cam.fovYDeg * Math.PI / 180;
  // orthographic box sized so the target plane looks the same size as in perspective
  const hh = cam.dist * Math.tan(fovY / 2);
  const P = cam.projection === 'perspective'
    ? camera.perspective(fovY, aspect, cam.near, cam.far)
    : camera.orthographic(-hh * aspect, hh * aspect, -hh, hh, cam.near, cam.far);
  return { eye, V, P, VP: mat4.multiply(P, V),
    frustum: { projection: cam.projection, fovY, aspect, near: cam.near, far: cam.far, orthoHalfHeight: hh } };
}

export function inspectionFrame(aspect) {
  const V = camera.lookAt(INSPECTION.eye, INSPECTION.target, UP);
  const P = camera.perspective(INSPECTION.fovYDeg * Math.PI / 180, aspect, INSPECTION.near, INSPECTION.far);
  return { eye: INSPECTION.eye, V, P, VP: mat4.multiply(P, V) };
}

/** Frustum corners of the main camera in WORLD space (camera-space corners · V⁻¹). */
export function frustumWorld(frame) {
  const Vinv = mat4.invertRigid(frame.V);
  return camera.frustumCorners(frame.frustum).map(c => mat4.transformPoint(Vinv, c).slice(0, 3));
}

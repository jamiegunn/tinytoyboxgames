/**
 * CameraDescriptor — one camera convention for every scene and game.
 *
 * See architecture-standards.md#cameradescriptor. The codebase had three camera
 * conventions: the fixed shell camera, the orbit scene camera (three.js
 * `Spherical` with a Babylon `θ+π` carry-over applied at every use), and
 * `createGameCamera` (Babylon `beta/radius/alpha` with a hand-negated Z and fov
 * in radians). This module is the single source of truth:
 *
 * - **One spherical convention**, the plain three.js `Spherical` one
 *   (`setFromSphericalCoords`): with `target`, azimuth `θ`, polar `φ` (from +Y),
 *   distance `r`,
 *     `position = target + ( r·sinφ·sinθ,  r·cosφ,  r·sinφ·cosθ )`
 *   so `θ = 0` looks from **+Z** and `θ = π` from **−Z**. The old scene code's
 *   `θ += π` and the game camera's hand-negated Z are folded into the descriptor's
 *   stored `azimuth` — no consumer applies an ad-hoc offset any more.
 * - **fov is stored in degrees** (three.js native). The Babylon radians→degrees
 *   conversion lives only in the builder that ports legacy game presets
 *   ({@link fovRadiansToDegrees}).
 */

import { PerspectiveCamera, Vector3 } from 'three';

/** Shared near/far planes — every camera in the app used 0.1 / 100. */
export const CAMERA_NEAR = 0.1;
export const CAMERA_FAR = 100;

/** A fixed camera at an explicit position looking at a target. */
export interface FixedCameraDescriptor {
  kind: 'fixed';
  /** World-space camera position. */
  position: Vector3;
  /** World-space look-at target. */
  target: Vector3;
  /** Vertical field of view, **degrees**. */
  fov: number;
}

/** An orbit camera placed by spherical coordinates around a target. */
export interface OrbitCameraDescriptor {
  kind: 'orbit';
  /** World-space look-at target (orbit centre). */
  target: Vector3;
  /** Azimuth θ, radians. `0` → +Z, `π` → −Z (three.js `Spherical` convention). */
  azimuth: number;
  /** Polar φ from +Y, radians. */
  polar: number;
  /** Distance from the target. */
  distance: number;
  /** Vertical field of view, **degrees**. */
  fov: number;
}

/** The unified camera description. */
export type CameraDescriptor = FixedCameraDescriptor | OrbitCameraDescriptor;

/** The default mini-game camera: the fixed shell view at (0, 2, 5). */
export const DEFAULT_GAME_CAMERA: FixedCameraDescriptor = {
  kind: 'fixed',
  position: new Vector3(0, 2, 5),
  target: new Vector3(0, 0, 0),
  fov: 60,
};

/**
 * Converts a Babylon-style vertical fov in radians to three.js degrees.
 *
 * @param radians - Vertical fov in radians.
 * @returns The equivalent fov in degrees.
 */
export function fovRadiansToDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

/**
 * Writes the spherical orbit position into `out` — the ONE convention.
 *
 * Matches three.js `Vector3.setFromSphericalCoords(r, φ, θ)` exactly, offset by
 * the target. See the module header for the formula.
 *
 * @param target - Orbit centre.
 * @param azimuth - Azimuth θ, radians (0 → +Z).
 * @param polar - Polar φ from +Y, radians.
 * @param distance - Distance r from the target.
 * @param out - Vector to write into (defaults to a fresh Vector3).
 * @returns `out`, set to the world-space camera position.
 */
export function sphericalPosition(target: Vector3, azimuth: number, polar: number, distance: number, out: Vector3 = new Vector3()): Vector3 {
  const sinPhiRadius = Math.sin(polar) * distance;
  out.set(target.x + sinPhiRadius * Math.sin(azimuth), target.y + Math.cos(polar) * distance, target.z + sinPhiRadius * Math.cos(azimuth));
  return out;
}

/**
 * Builds a positioned {@link PerspectiveCamera} from a descriptor.
 *
 * The camera is placed and aimed but owns no controls — interactive scene
 * controllers (pan/pinch/zoom) wrap the camera separately.
 *
 * @param d - The camera descriptor.
 * @param aspect - Viewport aspect ratio (width / height).
 * @returns The positioned camera.
 */
export function createCamera(d: CameraDescriptor, aspect: number): PerspectiveCamera {
  const camera = new PerspectiveCamera(d.fov, aspect, CAMERA_NEAR, CAMERA_FAR);
  if (d.kind === 'fixed') {
    camera.position.copy(d.position);
  } else {
    sphericalPosition(d.target, d.azimuth, d.polar, d.distance, camera.position);
  }
  camera.lookAt(d.target);
  return camera;
}

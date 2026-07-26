/**
 * Small pure helpers for the generated minigame.
 *
 * This file deliberately avoids owning gameplay state. Its job is to host the
 * tiny math and coordinate helpers that multiple modules need without forcing
 * those modules to depend on each other.
 */

import type { PerspectiveCamera, Vector3 } from 'three';
import type { CanvasRect } from './types';

/**
 * Returns a random number in the inclusive-exclusive range `[min, max)`.
 *
 * @param min - Lower bound.
 * @param max - Upper bound.
 * @returns A pseudo-random value between the two bounds.
 */
export function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/**
 * Clamps a number into the normalized range `[0, 1]`.
 *
 * @param value - Candidate value.
 * @returns The clamped result.
 */
export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * Clamps a number into an arbitrary range.
 *
 * @param value - Candidate value.
 * @param min - Lower bound.
 * @param max - Upper bound.
 * @returns The clamped result.
 */
export function clampRange(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Smoothstep easing on a normalized input, used to keep authored gradients free
 * of the Mach bands a linear ramp produces across a low-poly plane.
 *
 * @param t - Normalized input, expected in `[0, 1]`.
 * @returns The eased value.
 */
export function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/**
 * Projects a world position into the tap coordinate space the shell reports.
 *
 * `InputDispatcher` hands games raw `PointerEvent.clientX/clientY`, and its own
 * raycast un-maps them with `canvas.getBoundingClientRect()`. This is the exact
 * inverse of that mapping, so a projected star and an incoming tap are directly
 * comparable in pixels — which is what the proximity forgiveness in `rules/`
 * and the night-sky twinkle acknowledgement both need (defects 3 and 4).
 *
 * @param world - World-space position to project.
 * @param camera - The shell camera.
 * @param rect - The canvas bounding rectangle.
 * @param out - Caller-owned scratch vector; receives x/y in pixels and z in NDC.
 * @returns `out`. A `z` above 1 means the point is behind the camera or beyond
 *   the far plane and must be ignored by callers.
 */
export function projectToScreen(world: Vector3, camera: PerspectiveCamera, rect: CanvasRect, out: Vector3): Vector3 {
  out.copy(world).project(camera);
  const x = rect.left + (out.x * 0.5 + 0.5) * rect.width;
  const y = rect.top + (out.y * -0.5 + 0.5) * rect.height;
  out.x = x;
  out.y = y;
  return out;
}

/**
 * Converts a tap into the world point where its ray crosses a vertical plane.
 *
 * The miss pulse used to be placed by mapping the tap's normalized screen
 * position linearly onto the authored XZ spawn box, which is only correct for a
 * top-down camera — this game's camera is tilted 23 degrees, so the ring landed
 * nowhere near the finger. Unprojecting against the plane the stars actually
 * fall through puts it under the finger instead.
 *
 * @param camera - The shell camera.
 * @param rect - The canvas bounding rectangle.
 * @param tapX - Tap X in the shell's tap coordinate space (pixels).
 * @param tapY - Tap Y in the shell's tap coordinate space (pixels).
 * @param planeZ - World Z of the vertical plane to intersect.
 * @param out - Caller-owned scratch vector that receives the world point.
 * @returns `out`, set to the intersection point.
 */
export function unprojectTapToPlane(camera: PerspectiveCamera, rect: CanvasRect, tapX: number, tapY: number, planeZ: number, out: Vector3): Vector3 {
  const ndcX = ((tapX - rect.left) / (rect.width || 1)) * 2 - 1;
  const ndcY = -(((tapY - rect.top) / (rect.height || 1)) * 2 - 1);

  out.set(ndcX, ndcY, 0.5).unproject(camera).sub(camera.position).normalize();

  // Guard the grazing case so a degenerate ray can never fling the effect to
  // infinity; the authored camera looks along +Z, so `out.z` is ~0.92 in practice.
  const denominator = Math.abs(out.z) > 1e-4 ? out.z : 1e-4;
  const distance = clampRange((planeZ - camera.position.z) / denominator, 0.5, 60);

  return out.multiplyScalar(distance).add(camera.position);
}

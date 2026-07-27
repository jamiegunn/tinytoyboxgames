/**
 * Camera-derived play-space metrics for Star Catcher.
 *
 * Every other module used to place things with authored world-space magic
 * numbers (`minX: -3.3`, `y: 4.4`, `TARGET_FLOOR_Y: 0.25`). Those numbers were
 * never checked against the frustum, and the two that mattered most were wrong:
 * the retirement floor at y = 0.25 projects to screen row 446 of 810, so the
 * bottom 45% of the frame could not hold a catchable star at all, and the
 * horizontal span covered only 67% of the frame width.
 *
 * This module replaces all of that with closed-form frustum math evaluated
 * against the live camera, so the play field is *defined* in the coordinate
 * space the child actually sees: "spawn just above the top edge", "land on the
 * hill at this screen row". Aspect-ratio and fov changes then take care of
 * themselves and `onResize` genuinely has nothing to do.
 */

import { Vector3, type PerspectiveCamera } from 'three';
import type { CanvasRect } from './types';

/**
 * Radius of the sphere whose crown is the hilltop play surface.
 *
 * The ground is not a finite slab — it never was — so the "flat surface that
 * drops off on the sides" is this sphere's own silhouette. At radius 30 the
 * limb crossed the frame at screen rows 317 (centre) / 346 / 428 (edge), a
 * visibly bowed cut-out. At radius 42 it flattens to 293 / 317 / 383, and the
 * distant ridges in `environment/` are placed to sit in front of what remains.
 */
export const HILL_RADIUS = 42;

/** Scratch ray direction, so placement queries allocate nothing per spawn. */
const rayDirection = new Vector3();

/** Scratch vector for the camera's forward axis. */
const forward = new Vector3();

/**
 * Intersects the camera ray through a normalized device coordinate with a
 * vertical world plane.
 *
 * @param camera - The shell camera.
 * @param ndcX - Horizontal NDC, -1 at the left edge and +1 at the right edge.
 * @param ndcY - Vertical NDC, -1 at the bottom edge and +1 at the top edge.
 * @param planeZ - World Z of the plane to intersect.
 * @param out - Caller-owned scratch vector that receives the intersection.
 * @returns `out`, set to the intersection point.
 */
export function unprojectNdcToPlaneZ(camera: PerspectiveCamera, ndcX: number, ndcY: number, planeZ: number, out: Vector3): Vector3 {
  rayDirection.set(ndcX, ndcY, 0.5).unproject(camera).sub(camera.position).normalize();
  // The authored camera looks along +Z (direction z ~= 0.917), so this is never
  // near-parallel; the guard only stops a degenerate camera flinging the point
  // to infinity.
  const denominator = Math.abs(rayDirection.z) > 1e-4 ? rayDirection.z : 1e-4;
  const distance = (planeZ - camera.position.z) / denominator;
  return out.copy(rayDirection).multiplyScalar(distance).add(camera.position);
}

/**
 * Intersects the camera ray through a normalized device coordinate with the
 * hilltop sphere — i.e. answers "which patch of ground is under this pixel?".
 *
 * This is what lets a star be told to land on a *screen row* rather than at an
 * authored world height. The row is the thing that has to be right; the world
 * height is whatever the hill happens to be there.
 *
 * @param camera - The shell camera.
 * @param ndcX - Horizontal NDC, -1 at the left edge and +1 at the right edge.
 * @param ndcY - Vertical NDC, -1 at the bottom edge and +1 at the top edge.
 * @param out - Caller-owned scratch vector that receives the ground point.
 * @returns `out`. Rays that clear the horizon fall back to the hill crown plane
 *   so the caller always gets a usable point.
 */
export function unprojectNdcToHill(camera: PerspectiveCamera, ndcX: number, ndcY: number, out: Vector3): Vector3 {
  rayDirection.set(ndcX, ndcY, 0.5).unproject(camera).sub(camera.position).normalize();

  // Sphere centred at (0, -HILL_RADIUS, 0); solve |origin + t*dir - centre|^2 = R^2.
  const ocX = camera.position.x;
  const ocY = camera.position.y + HILL_RADIUS;
  const ocZ = camera.position.z;
  const b = 2 * (ocX * rayDirection.x + ocY * rayDirection.y + ocZ * rayDirection.z);
  const c = ocX * ocX + ocY * ocY + ocZ * ocZ - HILL_RADIUS * HILL_RADIUS;
  const discriminant = b * b - 4 * c;

  if (discriminant >= 0) {
    const distance = (-b - Math.sqrt(discriminant)) / 2;
    if (distance > 0) {
      return out.copy(rayDirection).multiplyScalar(distance).add(camera.position);
    }
  }

  // Above the horizon: no ground under this pixel. Use the crown plane instead.
  return unprojectNdcToPlaneZ(camera, ndcX, ndcY, 0, out);
}

/**
 * Fractions of the frame's height covered by one world unit at a world point.
 *
 * A perspective camera maps a world length `L` perpendicular to the view axis
 * onto `L / (2 * tan(fov/2) * d)` frame heights, where `d` is the point's
 * distance measured *along* the view axis. Expressed in frame heights rather
 * than pixels this is resolution-independent, which is what spawn-time fall
 * speeds need: they are chosen at a moment when reading the canvas rectangle
 * would be a pointless layout flush.
 *
 * @param camera - The shell camera.
 * @param world - World point to measure at.
 * @returns Frame heights per world unit, or 0 when the point is behind the camera.
 */
export function frameHeightsPerWorldUnit(camera: PerspectiveCamera, world: Vector3): number {
  camera.getWorldDirection(forward);
  const viewDepth = (world.x - camera.position.x) * forward.x + (world.y - camera.position.y) * forward.y + (world.z - camera.position.z) * forward.z;
  if (viewDepth <= 1e-3) return 0;
  const tanHalfV = Math.tan((camera.fov * Math.PI) / 360);
  return 1 / (2 * tanHalfV * viewDepth);
}

/**
 * Screen pixels per world unit at a given world point, for this camera.
 *
 * Used to size the catch forgiveness radius per star: a star near the top of
 * the frame is up to 2.4x closer than one about to land, so a single flat pixel
 * radius is wrong at both ends.
 *
 * @param camera - The shell camera.
 * @param world - World point to measure at.
 * @param rect - The canvas bounding rectangle.
 * @returns Pixels per world unit, or 0 when the point is behind the camera.
 */
export function pixelsPerWorldUnit(camera: PerspectiveCamera, world: Vector3, rect: CanvasRect): number {
  return rect.height * frameHeightsPerWorldUnit(camera, world);
}

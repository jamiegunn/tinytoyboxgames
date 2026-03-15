import type { Object3D } from 'three';

type ScatterY = number | ((rand: () => number) => number);

/**
 * This module intentionally extracts only the shared scatter math.
 * The patch-style props still own their own instance creation because
 * their geometry, local child layout, and per-instance variation differ
 * enough that a generic "scatter everything" factory would hide more
 * than it helps.
 */

/**
 * Places an object at a uniformly distributed random point inside an ellipse.
 * The `Math.sqrt(rand())` step avoids over-populating the center.
 *
 * @param target - Object whose position will be updated in place.
 * @param rand - Deterministic or runtime RNG returning values in [0, 1).
 * @param radiusX - Ellipse radius on the X axis.
 * @param radiusZ - Ellipse radius on the Z axis.
 * @param y - Fixed Y value or function for randomized vertical offset.
 */
export function setEllipticalScatterPosition(target: Object3D, rand: () => number, radiusX: number, radiusZ: number, y: ScatterY = 0): void {
  const angle = rand() * Math.PI * 2;
  const distance = Math.sqrt(rand());
  const yValue = typeof y === 'function' ? y(rand) : y;

  target.position.set(Math.cos(angle) * radiusX * distance, yValue, Math.sin(angle) * radiusZ * distance);
}

/**
 * Returns a random angle in radians across a full 360-degree turn.
 *
 * @param rand - Deterministic or runtime RNG returning values in [0, 1).
 * @returns A random rotation in radians.
 */
export function randomFullRotation(rand: () => number): number {
  return rand() * Math.PI * 2;
}

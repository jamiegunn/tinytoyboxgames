/**
 * Small pure helpers for the generated minigame.
 *
 * This file deliberately avoids owning gameplay state. Its job is to host the
 * tiny math and coordinate helpers that multiple modules need without forcing
 * those modules to depend on each other.
 */

import { Vector3 } from 'three';
import type { RuntimeViewportSnapshot, SpawnBounds } from './types';

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
 * Converts a screen-space miss tap into a rough world-space point above the
 * play field so the local fallback effect has somewhere consistent to render.
 *
 * The template does not need perfect reprojection here. It just needs a stable
 * authored approximation that keeps the effect visibly inside the play area.
 *
 * @param screenX - Horizontal tap coordinate in pixels.
 * @param screenY - Vertical tap coordinate in pixels.
 * @param viewport - Current viewport snapshot.
 * @param bounds - Authored spawn bounds used as a safe in-world envelope.
 * @returns A world-space position for the miss feedback effect.
 */
export function approximateMissWorldPoint(screenX: number, screenY: number, viewport: RuntimeViewportSnapshot, bounds: SpawnBounds): Vector3 {
  const normalizedX = clamp01(screenX / viewport.width);
  const normalizedY = clamp01(screenY / viewport.height);

  const worldX = bounds.minX + (bounds.maxX - bounds.minX) * normalizedX;
  const worldZ = bounds.maxZ - (bounds.maxZ - bounds.minZ) * normalizedY;

  return new Vector3(worldX, bounds.y, worldZ);
}

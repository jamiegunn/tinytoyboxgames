/**
 * Pool-facing entity lifecycle helpers for the Star Catcher minigame.
 *
 * These helpers sit between the object pool and the higher-level rules so the
 * rules do not need to know the details of how targets are activated or
 * released. This is also where a star's whole trajectory is solved, in screen
 * space, against the live camera.
 */

import { Vector3, type PerspectiveCamera } from 'three';
import type { EntityPool } from '../../../framework/types';
import { randomRange } from '../helpers';
import { SCREEN_SPEED_VARIANCE, SPAWN_ALTITUDE_JITTER, TARGET_SCREEN_SPEED } from '../rules/spawning';
import type { PlayFieldBounds, TemplateTargetKind, TemplateTargetState } from '../types';
import { frameHeightsPerWorldUnit, unprojectNdcToHill, unprojectNdcToPlaneZ } from '../view';
import { activateTarget } from './index';

/** NDC row a star enters from when it drops in from above the frame. */
const ENTRY_FROM_ABOVE = 1;

/**
 * Minimum NDC gap between where a star enters and where it lands.
 *
 * Only bites when `start()` seeds stars part-way down the frame: a star seeded
 * at NDC -0.6 must not be handed a landing row above itself.
 */
const MIN_ENTRY_TO_LANDING_NDC = 0.3;

/** Scratch vectors, so a spawn allocates nothing. */
const landingPoint = new Vector3();
const entryPoint = new Vector3();
const midPoint = new Vector3();
const spawnPoint = new Vector3();

/**
 * Acquires a target from the pool, solves its flight path from the camera, and
 * appends it to the active-target list.
 *
 * The path is chosen in screen space and converted to world space, never the
 * other way round:
 *
 * 1. Pick a screen column (`ndcX`) and a landing row (`landingNdcY`).
 * 2. Raycast that landing pixel onto the hill to get the world point the star
 *    is aimed at — and, with it, the depth `z` the whole flight happens at.
 * 3. Intersect the entry row at that same depth to get where the star appears.
 * 4. Solve `driftX` so the star holds its screen column all the way down. For
 *    this camera a fixed world X does *not* hold a fixed column: view depth
 *    grows as a point descends, so an undrifted star slides toward the centre.
 * 5. Solve `fallSpeed` from the target *apparent* speed, so a near star and a
 *    far star cross the frame at the same rate.
 *
 * @param pool - Shared entity pool for targets.
 * @param activeTargets - Mutable active-target array.
 * @param kind - Kind of target to spawn.
 * @param camera - The shell camera.
 * @param field - The play field, in normalized device coordinates.
 * @param entryNdcY - NDC row the star enters at; defaults to the top edge.
 * @returns The newly activated target state.
 */
export function spawnTargetFromPool(
  pool: EntityPool<TemplateTargetState>,
  activeTargets: TemplateTargetState[],
  kind: TemplateTargetKind,
  camera: PerspectiveCamera,
  field: PlayFieldBounds,
  entryNdcY: number = ENTRY_FROM_ABOVE,
): TemplateTargetState {
  const target = pool.acquire();

  const ndcX = randomRange(-field.ndcHalfWidth, field.ndcHalfWidth);
  const landingCeiling = Math.min(field.landingNdcMax, entryNdcY - MIN_ENTRY_TO_LANDING_NDC);
  const landingNdcY = randomRange(field.landingNdcMin, Math.max(field.landingNdcMin, landingCeiling));

  unprojectNdcToHill(camera, ndcX, landingNdcY, landingPoint);
  const depthZ = landingPoint.z;
  unprojectNdcToPlaneZ(camera, ndcX, entryNdcY, depthZ, entryPoint);

  const drop = entryPoint.y - landingPoint.y;
  const driftX = drop > 1e-3 ? (landingPoint.x - entryPoint.x) / drop : 0;

  // Only a star arriving from off-screen needs clearance; a seeded star is
  // already where it should be.
  const clearance = entryNdcY >= ENTRY_FROM_ABOVE ? field.spawnClearance + randomRange(0, SPAWN_ALTITUDE_JITTER) : 0;
  spawnPoint.set(entryPoint.x - clearance * driftX, entryPoint.y + clearance, depthZ);

  midPoint.set((spawnPoint.x + landingPoint.x) * 0.5, (spawnPoint.y + landingPoint.y) * 0.5, depthZ);
  const heightsPerUnit = frameHeightsPerWorldUnit(camera, midPoint);
  const screenSpeed = TARGET_SCREEN_SPEED[kind] * randomRange(1 - SCREEN_SPEED_VARIANCE, 1 + SCREEN_SPEED_VARIANCE);
  const fallSpeed = heightsPerUnit > 1e-4 ? screenSpeed / heightsPerUnit : 0.6;

  activateTarget(target, kind, spawnPoint, driftX, landingPoint.y, fallSpeed);
  activeTargets.push(target);
  return target;
}

/**
 * Releases one active target back into the pool using swap-remove so removal
 * stays O(1) even when many entities are active.
 *
 * @param pool - Shared entity pool for targets.
 * @param activeTargets - Mutable active-target array.
 * @param index - Index of the target being recycled.
 */
export function recycleTargetAtIndex(pool: EntityPool<TemplateTargetState>, activeTargets: TemplateTargetState[], index: number): void {
  const target = activeTargets[index];
  const lastIndex = activeTargets.length - 1;

  if (index !== lastIndex) {
    activeTargets[index] = activeTargets[lastIndex];
  }

  activeTargets.pop();
  pool.release(target);
}

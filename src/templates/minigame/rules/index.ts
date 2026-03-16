/**
 * High-level gameplay rule helpers for the generated minigame.
 *
 * This module sits above the entity layer and below the root lifecycle file.
 * It gives the generated game a readable place for "gameplay glue" that is not
 * pure spawning config and not raw mesh creation.
 */

import type { EntityPool } from '../../../framework/types';
import { recycleTargetAtIndex, spawnTargetFromPool } from '../entities/lifecycle';
import { updateTargetMotion } from '../entities';
import { chooseTargetKind } from './spawning';
import type { SpawnBounds, TemplateTargetState } from '../types';

/**
 * Spawns the next target into the active set if the pool and authored bounds
 * allow it.
 *
 * @param pool - Shared entity pool for targets.
 * @param activeTargets - Mutable active-target array.
 * @param bounds - Authored spawn bounds.
 * @param difficultyLevel - Current normalized difficulty level.
 */
export function spawnNextTarget(
  pool: EntityPool<TemplateTargetState>,
  activeTargets: TemplateTargetState[],
  bounds: SpawnBounds,
  difficultyLevel: number,
): void {
  spawnTargetFromPool(pool, activeTargets, chooseTargetKind(difficultyLevel), bounds);
}

/**
 * Advances every active target and recycles any target that has timed out or
 * drifted beyond the safe authored presentation area.
 *
 * @param pool - Shared entity pool for targets.
 * @param activeTargets - Mutable active-target array.
 * @param elapsedTime - Seconds since the run started.
 * @param deltaTime - Frame delta in seconds.
 */
export function updateActiveTargets(pool: EntityPool<TemplateTargetState>, activeTargets: TemplateTargetState[], elapsedTime: number, deltaTime: number): void {
  for (let index = activeTargets.length - 1; index >= 0; index -= 1) {
    const target = activeTargets[index];
    updateTargetMotion(target, elapsedTime, deltaTime);

    if (target.lifetimeRemaining <= 0 || target.mesh.position.y > 2.8) {
      recycleTargetAtIndex(pool, activeTargets, index);
    }
  }
}

/**
 * Returns the active-target index for a picked mesh, or -1 when the tap missed.
 *
 * @param activeTargets - Current active targets.
 * @param pickedMesh - Mesh returned by the shell's raycaster.
 * @returns Matching active-target index or -1.
 */
export function findTappedTargetIndex(activeTargets: TemplateTargetState[], pickedMesh: unknown): number {
  return activeTargets.findIndex((target) => target.mesh === pickedMesh);
}

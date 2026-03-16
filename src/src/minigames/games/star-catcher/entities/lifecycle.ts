/**
 * Pool-facing entity lifecycle helpers for the generated minigame.
 *
 * These helpers sit between the object pool and the higher-level rules so the
 * rules do not need to know the details of how targets are activated or
 * released.
 */

import type { EntityPool } from '../../../framework/types';
import { randomRange } from '../helpers';
import type { SpawnBounds, TemplateTargetKind, TemplateTargetState } from '../types';
import { activateTarget } from './index';

/**
 * Acquires a target from the pool, places it inside the authored play area,
 * and appends it to the active-target list.
 *
 * @param pool - Shared entity pool for targets.
 * @param activeTargets - Mutable active-target array.
 * @param kind - Kind of target to spawn.
 * @param bounds - Authored spawn bounds.
 * @returns The newly activated target state.
 */
export function spawnTargetFromPool(
  pool: EntityPool<TemplateTargetState>,
  activeTargets: TemplateTargetState[],
  kind: TemplateTargetKind,
  bounds: SpawnBounds,
): TemplateTargetState {
  const target = pool.acquire();
  activateTarget(target, kind, randomRange(bounds.minX, bounds.maxX), bounds.y, randomRange(bounds.minZ, bounds.maxZ));
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

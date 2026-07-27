/**
 * High-level gameplay rule helpers for the Star Catcher minigame.
 *
 * This module sits above the entity layer and below the root lifecycle file.
 * It gives the game a readable place for "gameplay glue" that is not pure
 * spawning config and not raw mesh creation.
 */

import { Vector3, type PerspectiveCamera } from 'three';
import { PROXIMITY_PX } from '@app/utils/interaction/gestureRules';
import type { EntityPool } from '../../../framework/types';
import { recycleTargetAtIndex, spawnTargetFromPool } from '../entities/lifecycle';
import { beginFadeOut, beginRest, isCatchable, isDespawnComplete, REST_DURATION_SECONDS, STAR_OUTER_RADIUS, updateTargetMotion } from '../entities';
import { projectToScreen } from '../helpers';
import { pixelsPerWorldUnit } from '../view';
import { chooseTargetKind } from './spawning';
import type { CanvasRect, PlayFieldBounds, TemplateTargetState } from '../types';

/**
 * Screen-space slack added around a star's own silhouette, in CSS pixels.
 *
 * Defect 3: catching a star required an exact raycast identity match on a
 * tumbling target, which is finer aim than a three-year-old has. The previous
 * fix was a flat 105 px radius for every star — but the play field spans a 2.4x
 * depth range, so the same star is 172 px across at the top of the frame and
 * 96 px across as it lands. A flat radius is simultaneously stingy on the near
 * ones (whose points stick out further than the radius reached) and grabby on
 * the far ones. The radius is now the star's *projected* radius plus this pad,
 * so the forgiveness is a constant ring of slack around what the child sees.
 * {@link PROXIMITY_PX} (70) is the shared small-target tolerance the scene
 * interaction controller already applies elsewhere in the repo.
 */
export const CATCH_FORGIVENESS_PAD_PX = PROXIMITY_PX;

/** Reused across taps so the forgiveness search allocates nothing per frame. */
const projectedPoint = new Vector3();

/**
 * Spawns the next target into the active set.
 *
 * @param pool - Shared entity pool for targets.
 * @param activeTargets - Mutable active-target array.
 * @param camera - The shell camera.
 * @param field - The play field, in normalized device coordinates.
 * @param difficultyLevel - Current normalized difficulty level.
 * @param entryNdcY - Optional NDC row to enter at; defaults to the top edge.
 */
export function spawnNextTarget(
  pool: EntityPool<TemplateTargetState>,
  activeTargets: TemplateTargetState[],
  camera: PerspectiveCamera,
  field: PlayFieldBounds,
  difficultyLevel: number,
  entryNdcY?: number,
): void {
  spawnTargetFromPool(pool, activeTargets, chooseTargetKind(difficultyLevel), camera, field, entryNdcY);
}

/**
 * Advances every active target, settles the ones that have landed, retires the
 * ones that have waited long enough, and recycles the ones whose despawn
 * animation has finished.
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

    if (target.phase === 'falling') {
      // The end of a fall used to be a shared world height, `TARGET_FLOOR_Y =
      // 0.25`, which projects to screen row 446 of 810 — every star in the game
      // vanished at the halfway line and the bottom of the frame held nothing.
      // Each star now has its own landing height, taken from the patch of
      // hillside its screen column and landing row actually point at.
      if (target.mesh.position.y <= target.landingY) {
        beginRest(target);
      } else if (target.lifetimeRemaining <= 0) {
        beginFadeOut(target);
      }
      continue;
    }

    if (target.phase === 'resting') {
      if (target.phaseTime >= REST_DURATION_SECONDS) {
        beginFadeOut(target);
      }
      continue;
    }

    if (isDespawnComplete(target)) {
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
  return activeTargets.findIndex((target) => isCatchable(target) && target.mesh === pickedMesh);
}

/**
 * Finds the catchable star nearest a tap in screen space, inside that star's
 * own silhouette plus {@link CATCH_FORGIVENESS_PAD_PX}.
 *
 * This is the proximity forgiveness for defect 3. It lives here, in the game's
 * own rules, rather than in the shared `InputDispatcher`: the dispatcher has no
 * idea which meshes are targets, and generalising it would change input for
 * every other minigame at once.
 *
 * Candidates are ranked by distance *relative to their own reach*, not by raw
 * pixels, so a tap that lands dead centre on a small distant star is not stolen
 * by a huge near one whose centre happens to be marginally closer.
 *
 * @param activeTargets - Current active targets.
 * @param camera - The shell camera.
 * @param rect - The canvas bounding rectangle.
 * @param tapX - Tap X in the shell's tap coordinate space (pixels).
 * @param tapY - Tap Y in the shell's tap coordinate space (pixels).
 * @returns Index of the nearest catchable target, or -1 when none is close enough.
 */
export function findNearestCatchableTargetIndex(
  activeTargets: TemplateTargetState[],
  camera: PerspectiveCamera,
  rect: CanvasRect,
  tapX: number,
  tapY: number,
): number {
  let bestIndex = -1;
  let bestRelativeDistance = Infinity;

  for (let index = 0; index < activeTargets.length; index += 1) {
    const target = activeTargets[index];
    if (!isCatchable(target)) continue;

    projectToScreen(target.mesh.position, camera, rect, projectedPoint);
    // Behind the camera or past the far plane: not a thing the child can see.
    if (projectedPoint.z > 1) continue;

    const starRadiusPx = STAR_OUTER_RADIUS * target.mesh.scale.x * pixelsPerWorldUnit(camera, target.mesh.position, rect);
    const reach = starRadiusPx + CATCH_FORGIVENESS_PAD_PX;
    if (reach <= 0) continue;

    const dx = projectedPoint.x - tapX;
    const dy = projectedPoint.y - tapY;
    const relativeDistance = Math.hypot(dx, dy) / reach;

    if (relativeDistance <= 1 && relativeDistance < bestRelativeDistance) {
      bestRelativeDistance = relativeDistance;
      bestIndex = index;
    }
  }

  return bestIndex;
}

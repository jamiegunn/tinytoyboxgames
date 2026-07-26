/**
 * High-level gameplay rule helpers for the generated minigame.
 *
 * This module sits above the entity layer and below the root lifecycle file.
 * It gives the generated game a readable place for "gameplay glue" that is not
 * pure spawning config and not raw mesh creation.
 */

import { Vector3, type PerspectiveCamera } from 'three';
import { nearestPointWithin, PROXIMITY_PX, type ScreenPoint } from '@app/utils/interaction/gestureRules';
import type { EntityPool } from '../../../framework/types';
import { recycleTargetAtIndex, spawnTargetFromPool } from '../entities/lifecycle';
import { beginFadeOut, isDespawnComplete, updateTargetMotion } from '../entities';
import { projectToScreen } from '../helpers';
import { chooseTargetKind, TARGET_FLOOR_Y } from './spawning';
import type { CanvasRect, SpawnBounds, TemplateTargetState } from '../types';

/**
 * Screen-space catch forgiveness radius, in CSS pixels.
 *
 * Defect 3: catching a star required an exact raycast identity match on a
 * 0.68-unit target that is simultaneously falling and tumbling. That is a
 * finer aim than a 3-year-old has, and a missed tap on a game whose whole
 * premise is "catch the star" reads as the game being broken.
 * {@link PROXIMITY_PX} (70) is the shared small-target fallback the scene
 * interaction controller already applies to static props; a moving target
 * deserves more, so this game widens it by half again.
 */
export const CATCH_FORGIVENESS_PX = PROXIMITY_PX * 1.5;

/** Reused across taps so the forgiveness search allocates nothing per frame. */
const projectedPoint = new Vector3();

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
 * Advances every active target, retires any that has landed or timed out, and
 * recycles the ones whose despawn animation has finished.
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
      // Defect 1: this escape test used to read `position.y > 2.8` on a star
      // that rose from y = 0.55 and topped out around y = 1.26 — unreachable
      // dead code, so the only thing that ever retired a star was its timer.
      // Stars fall now, so the escape is the floor.
      if (target.mesh.position.y <= TARGET_FLOOR_Y || target.lifetimeRemaining <= 0) {
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
 * Only a falling star answers: a star already playing its catch or fade
 * animation still has a mesh in the scene, and letting it score twice would
 * award points for a star that is visibly gone.
 *
 * @param activeTargets - Current active targets.
 * @param pickedMesh - Mesh returned by the shell's raycaster.
 * @returns Matching active-target index or -1.
 */
export function findTappedTargetIndex(activeTargets: TemplateTargetState[], pickedMesh: unknown): number {
  return activeTargets.findIndex((target) => target.phase === 'falling' && target.mesh === pickedMesh);
}

/**
 * Finds the catchable star nearest a tap in screen space, within
 * {@link CATCH_FORGIVENESS_PX}.
 *
 * This is the proximity forgiveness for defect 3. It lives here, in the game's
 * own rules, rather than in the shared `InputDispatcher`: the dispatcher has no
 * idea which meshes are targets, and generalising it would change input for
 * every other minigame at once.
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
  const points: ScreenPoint[] = [];
  const sourceIndices: number[] = [];

  for (let index = 0; index < activeTargets.length; index += 1) {
    const target = activeTargets[index];
    if (target.phase !== 'falling') continue;

    projectToScreen(target.mesh.position, camera, rect, projectedPoint);
    // Behind the camera or past the far plane: not a thing the child can see.
    if (projectedPoint.z > 1) continue;

    points.push({ x: projectedPoint.x, y: projectedPoint.y });
    sourceIndices.push(index);
  }

  const nearest = nearestPointWithin(tapX, tapY, points, CATCH_FORGIVENESS_PX);
  return nearest === -1 ? -1 : sourceIndices[nearest];
}

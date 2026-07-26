/**
 * Tap resolution and chain reaction logic for Cannonball Splash.
 */

import { Mesh, Plane, Raycaster, Vector2, Vector3 } from 'three';
import type { PerspectiveCamera } from 'three';
import type { MiniGameTapEvent } from '../../../framework/types';
import type { Target } from '../types';
import { C } from '../types';
import { nearestTarget } from '../helpers';
import { collectTargetMeshes } from '../entities/targets';

/**
 * Resolves a tap event into the world point the cannon should shoot at.
 *
 * 1. Check pick result for a direct target mesh hit
 * 2. If no direct hit, snap to a target inside the grace radius (1.0 unit)
 * 3. Otherwise aim at the water where the tap ray meets the surface
 *
 * The tap no longer decides whether anything is *hit*: it only chooses where the
 * ball is thrown. Whether that lands on a target is settled when the ball
 * arrives, so a wild tap really does splash into empty water.
 * @param event - The framework tap event with screen coordinates and pick result.
 * @param targets - The pool of targets to test against.
 * @param camera - Camera used for the ocean-plane raycast.
 * @param canvas - Canvas element used to normalize screen coordinates.
 * @returns The world point to aim at, always on the water inside the play area.
 */
export function resolveTap(event: MiniGameTapEvent, targets: Target[], camera: PerspectiveCamera, canvas: HTMLCanvasElement): Vector3 {
  // Direct mesh hit check
  if (event.pickResult?.hit && event.pickResult.pickedMesh) {
    const pickedMesh = event.pickResult.pickedMesh as Mesh;
    for (let i = 0; i < targets.length; i++) {
      if (targets[i].state !== 'active') continue;
      const meshes = collectTargetMeshes(targets[i].root);
      if (meshes.some((m) => m === pickedMesh)) {
        return targets[i].root.position.clone();
      }
    }
  }

  // Raycast to ocean plane to get world point
  const ndc = new Vector2((event.screenX / canvas.clientWidth) * 2 - 1, -(event.screenY / canvas.clientHeight) * 2 + 1);
  const raycaster = new Raycaster();
  raycaster.setFromCamera(ndc, camera);

  const oceanPlane = new Plane(new Vector3(0, 1, 0), 0);
  const worldPoint = new Vector3();
  const hitWater = raycaster.ray.intersectPlane(oceanPlane, worldPoint) !== null;

  if (!hitWater) {
    // The tap was above the horizon — the ray never meets the water. It used to
    // land on a hardcoded (0, 0, -8) because the old check only looked at x and
    // z, so a tap on the sky silently fired dead ahead. Fire a long shot along
    // the direction the child actually pointed instead: the cannon swings the
    // right way and the ball arcs out to the far edge of the play area, which
    // is what "shoot over there" should look like.
    const dir = raycaster.ray.direction;
    const horizontal = Math.max(1e-4, Math.hypot(dir.x, dir.z));
    const reach = Math.abs(C.PLAY_Z_MIN - camera.position.z);
    worldPoint.set(camera.position.x + (dir.x / horizontal) * reach, 0, camera.position.z + (dir.z / horizontal) * reach);
  }

  // Keep every shot inside the water the child can see, whether it came from a
  // sky tap, the horizon haze, or a tap past the edge of the play area.
  worldPoint.x = Math.max(C.PLAY_X_MIN, Math.min(C.PLAY_X_MAX, worldPoint.x));
  worldPoint.z = Math.max(C.PLAY_Z_MIN, Math.min(C.PLAY_Z_MAX, worldPoint.z));
  worldPoint.y = 0;

  // Grace radius check — a tap just beside a target still aims at the target.
  const graceIndex = nearestTarget(targets, worldPoint, C.GRACE_RADIUS);
  if (graceIndex !== null) {
    return targets[graceIndex].root.position.clone();
  }

  return worldPoint;
}

/**
 * Resolves chain reaction targets for a rainbow bottle hit.
 * Returns an array of { target, delay } sorted by distance.
 * @param source - The rainbow bottle target that triggered the chain.
 * @param targets - The pool of targets to search for chain candidates.
 * @returns Chained targets with staggered delays, nearest first.
 */
export function resolveChainReaction(source: Target, targets: Target[]): Array<{ target: Target; delay: number }> {
  const sourcePos = source.root.position;
  const results: Array<{ target: Target; distance: number }> = [];

  for (let i = 0; i < targets.length; i++) {
    if (targets[i] === source) continue;
    if (targets[i].state !== 'active') continue;

    const dx = targets[i].root.position.x - sourcePos.x;
    const dz = targets[i].root.position.z - sourcePos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist <= C.CHAIN_RADIUS) {
      results.push({ target: targets[i], distance: dist });
    }
  }

  // Sort by distance (nearest first)
  results.sort((a, b) => a.distance - b.distance);

  return results.map((r, idx) => ({
    target: r.target,
    delay: (idx + 1) * C.CHAIN_STAGGER,
  }));
}

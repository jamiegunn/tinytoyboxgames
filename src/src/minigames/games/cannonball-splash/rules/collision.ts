/**
 * Tap resolution and chain reaction logic for Cannonball Splash.
 */

import { Mesh, Plane, Raycaster, Vector2, Vector3 } from 'three';
import type { PerspectiveCamera } from 'three';
import type { MiniGameTapEvent } from '../../../framework/types';
import type { Target } from '../types';
import { C } from '../types';
import { nearestTargetOnScreen, playHalfWidthAt } from '../helpers';
import { collectTargetMeshes } from '../entities/targets';

/**
 * Resolves a tap event into the world point the cannon should shoot at.
 *
 * 1. Direct target mesh hit from the framework's pick result.
 * 2. Otherwise, the nearest target within a screen-space snap radius.
 * 3. Otherwise, the water where the tap ray meets the surface, clamped into the
 *    frustum-derived play area.
 *
 * The tap no longer decides whether anything is *hit*: it only chooses where the
 * ball is thrown. Whether that lands on a target is settled when the ball
 * arrives, so a wild tap really does splash into empty water.
 * @param event - The framework tap event with screen coordinates and pick result.
 * @param targets - The pool of targets to test against.
 * @param camera - Camera used for projection and the ocean-plane raycast.
 * @param canvas - Canvas element used to normalize screen coordinates.
 * @returns The world point to aim at, always on the water inside the play area.
 */
export function resolveTap(event: MiniGameTapEvent, targets: Target[], camera: PerspectiveCamera, canvas: HTMLCanvasElement): Vector3 {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;

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

  // Screen-space snap — a tap beside a target still aims at that target, by the
  // same number of pixels wherever on the water it happens.
  const snapPixels = C.TAP_SNAP_SCREEN_FRACTION * Math.min(width, height);
  const snapIndex = nearestTargetOnScreen(targets, camera, event.screenX, event.screenY, width, height, snapPixels);
  if (snapIndex !== null) {
    return targets[snapIndex].root.position.clone();
  }

  // Raycast to ocean plane to get world point
  const ndc = new Vector2((event.screenX / width) * 2 - 1, -(event.screenY / height) * 2 + 1);
  const raycaster = new Raycaster();
  raycaster.setFromCamera(ndc, camera);

  const oceanPlane = new Plane(new Vector3(0, 1, 0), 0);
  const worldPoint = new Vector3();
  const hitWater = raycaster.ray.intersectPlane(oceanPlane, worldPoint) !== null;
  const inBand = hitWater && worldPoint.z >= C.PLAY_Z_MIN && worldPoint.z <= C.PLAY_Z_MAX;

  if (inBand) {
    // The tap landed on water the child can shoot at. Take the ray's own
    // intersection and only pull it in from the frame edge, so the shot goes
    // exactly where the finger was.
    const halfWidth = playHalfWidthAt(camera, worldPoint.z);
    worldPoint.x = Math.max(-halfWidth, Math.min(halfWidth, worldPoint.x));
  } else {
    // Everything else — the sky, the far water past the play band, and the ship
    // itself — is mapped proportionally onto the nearest edge of the band.
    //
    // Clamping z and x independently, which is what this used to do, saturates.
    // A 6x4 probe sweep found the taps at screen x = 100 and x = 300 on the
    // y = 304 row both aiming at x = -11.01: the ray meets the water out around
    // z = -25 where the frame is 22 units wide, so both intersections were past
    // the 11.01-unit bound at z = -12 and the clamp flattened them onto the same
    // point. Two taps 200 px apart firing the identical shot is exactly the
    // "nothing I do changes anything" the measurements describe. Scaling the
    // tap's own NDC x across the edge's half-width is monotone in screenX by
    // construction, so every column of the sweep aims somewhere different.
    const edgeZ = hitWater && worldPoint.z > C.PLAY_Z_MAX ? C.PLAY_Z_MAX : C.PLAY_Z_MIN;
    worldPoint.set(ndc.x * playHalfWidthAt(camera, edgeZ), 0, edgeZ);
  }

  worldPoint.y = 0;
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

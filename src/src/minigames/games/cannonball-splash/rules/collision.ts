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

export interface TapResolution {
  target: Target | null;
  worldPoint: Vector3;
}

/**
 * Resolves a tap event to either a target hit or a water miss.
 *
 * 1. Check pick result for direct target mesh hit
 * 2. If no direct hit, check grace radius (1.0 unit)
 * 3. If still no hit, use the ocean plane intersection as miss point
 */
export function resolveTap(event: MiniGameTapEvent, targets: Target[], camera: PerspectiveCamera, canvas: HTMLCanvasElement): TapResolution {
  // Direct mesh hit check
  if (event.pickResult?.hit && event.pickResult.pickedMesh) {
    const pickedMesh = event.pickResult.pickedMesh as Mesh;
    for (let i = 0; i < targets.length; i++) {
      if (targets[i].state !== 'active') continue;
      const meshes = collectTargetMeshes(targets[i].root);
      if (meshes.some((m) => m === pickedMesh)) {
        const worldPoint = targets[i].root.position.clone();
        return { target: targets[i], worldPoint };
      }
    }
  }

  // Raycast to ocean plane to get world point
  const ndc = new Vector2((event.screenX / canvas.clientWidth) * 2 - 1, -(event.screenY / canvas.clientHeight) * 2 + 1);
  const raycaster = new Raycaster();
  raycaster.setFromCamera(ndc, camera);

  const oceanPlane = new Plane(new Vector3(0, 1, 0), 0);
  const worldPoint = new Vector3();
  raycaster.ray.intersectPlane(oceanPlane, worldPoint);

  if (!worldPoint.x && !worldPoint.z) {
    // Fallback if raycast fails
    worldPoint.set(0, 0, -8);
  }

  // Grace radius check
  const graceIndex = nearestTarget(targets, worldPoint, C.GRACE_RADIUS);
  if (graceIndex !== null) {
    const snappedPoint = targets[graceIndex].root.position.clone();
    return { target: targets[graceIndex], worldPoint: snappedPoint };
  }

  return { target: null, worldPoint };
}

/**
 * Resolves chain reaction targets for a rainbow bottle hit.
 * Returns an array of { target, delay } sorted by distance.
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

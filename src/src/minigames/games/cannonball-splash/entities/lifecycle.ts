/**
 * Pool integration and spawn/recycle helpers for Cannonball Splash.
 */

import { Scene, Vector3 } from 'three';
import type { Cannonball, Target, TargetKind } from '../types';
import { randomRange, scoreForKind, getTargetScale } from '../helpers';
import { createTargetByKind, collectTargetMeshes } from './targets';
import { createCannonballMesh, createCannonballShadow } from './cannonball';

/**
 * Spawns a target, adds it to the scene and active list.
 * @param kind - The target kind to build.
 * @param position - World-space spawn position.
 * @param driftVx - Initial drift velocity along x.
 * @param driftVz - Initial drift velocity along z.
 * @param scene - Scene to add the target's root to.
 * @param activeTargets - Active-target list the new target is pushed onto.
 * @param difficulty - Normalized difficulty in [0, 1], used for target scale.
 * @returns The newly created target state (in 'spawning' state).
 */
export function spawnTarget(
  kind: TargetKind,
  position: Vector3,
  driftVx: number,
  driftVz: number,
  scene: Scene,
  activeTargets: Target[],
  difficulty: number = 0,
): Target {
  const root = createTargetByKind(kind);
  root.position.copy(position);
  root.visible = true;
  scene.add(root);

  const target: Target = {
    root,
    kind,
    state: 'spawning',
    stateTimer: 0,
    bobPhase: randomRange(0, Math.PI * 2),
    bobSpeed: randomRange(0.8, 1.2),
    driftVx,
    driftVz,
    baseY: position.y,
    scoreValue: scoreForKind(kind),
  };

  // Apply difficulty-scaled target size, then start spawning animation (scale from 0)
  root.userData.targetScale = getTargetScale(difficulty);
  root.scale.setScalar(0);

  activeTargets.push(target);
  return target;
}

/**
 * Recycles a target at the given index using swap-remove.
 * @param activeTargets
 * @param index
 */
export function recycleTarget(activeTargets: Target[], index: number): void {
  const target = activeTargets[index];
  // Dispose geometry and materials
  target.root.traverse((child) => {
    const mesh = child as import('three').Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    if (mesh.material) {
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((m) => m.dispose());
      } else {
        (mesh.material as import('three').MeshStandardMaterial).dispose();
      }
    }
  });
  target.root.removeFromParent();

  const last = activeTargets.length - 1;
  if (index !== last) activeTargets[index] = activeTargets[last];
  activeTargets.pop();
}

/**
 * Spawns a cannonball and adds it to the scene and active list.
 * @param startPos - World-space launch position (cannon mouth).
 * @param endPos - World-space impact position.
 * @param flightDuration - Total flight time in seconds.
 * @param arcHeight - Peak height of the flight arc.
 * @param target - The locked-on target, or null for a water shot.
 * @param scene - Scene to add the ball and shadow meshes to.
 * @param activeCannonballs - Active-cannonball list the new ball is pushed onto.
 * @returns The newly created cannonball state.
 */
export function spawnCannonball(
  startPos: Vector3,
  endPos: Vector3,
  flightDuration: number,
  arcHeight: number,
  target: Target | null,
  scene: Scene,
  activeCannonballs: Cannonball[],
): Cannonball {
  const mesh = createCannonballMesh();
  mesh.position.copy(startPos);
  mesh.visible = true;
  scene.add(mesh);

  const shadow = createCannonballShadow();
  shadow.position.set(startPos.x, 0.02, startPos.z);
  shadow.visible = true;
  scene.add(shadow);

  const ball: Cannonball = {
    mesh,
    shadow,
    startPos: startPos.clone(),
    endPos: endPos.clone(),
    flightDuration,
    elapsed: 0,
    arcHeight,
    target,
    trailTimer: 0,
  };

  activeCannonballs.push(ball);
  return ball;
}

/**
 * Recycles a cannonball at the given index using swap-remove.
 * @param activeCannonballs
 * @param index
 */
export function recycleCannonball(activeCannonballs: Cannonball[], index: number): void {
  const ball = activeCannonballs[index];
  ball.mesh.geometry.dispose();
  // Note: cannonballMat is a shared module-level material — do NOT dispose it here
  ball.mesh.removeFromParent();

  if (ball.shadow) {
    ball.shadow.geometry.dispose();
    // Note: shadowMat is shared — do NOT dispose it here
    ball.shadow.removeFromParent();
  }

  const last = activeCannonballs.length - 1;
  if (index !== last) activeCannonballs[index] = activeCannonballs[last];
  activeCannonballs.pop();
}

/**
 * Returns all tappable meshes from all active targets.
 * @param targets - The pool of targets to collect from.
 * @returns A flat array of raycast-tappable meshes from active targets.
 */
export function getAllTargetMeshes(targets: Target[]): import('three').Mesh[] {
  const meshes: import('three').Mesh[] = [];
  for (const t of targets) {
    if (t.state === 'active') {
      meshes.push(...collectTargetMeshes(t.root));
    }
  }
  return meshes;
}

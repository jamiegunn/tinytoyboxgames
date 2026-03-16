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

/**
 * Pool integration and spawn/recycle helpers for Cannonball Splash.
 */

import { Mesh, Scene, Vector3 } from 'three';
import type { Cannonball, Target, TargetKind } from '../types';
import { floatOffsetForKind, randomRange, scoreForKind } from '../helpers';
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
 * @returns The newly created target state (in 'spawning' state).
 */
export function spawnTarget(kind: TargetKind, position: Vector3, driftVx: number, driftVz: number, scene: Scene, activeTargets: Target[]): Target {
  const { root, materials } = createTargetByKind(kind);
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
    // How high this kind rides is a property of the kind, not of wherever it
    // happened to spawn. This used to be `position.y` — a flat -0.3 for every
    // kind, which silently overrode the per-kind offsets the builders were
    // setting and left every target about three-quarters submerged.
    baseY: floatOffsetForKind(kind),
    scoreValue: scoreForKind(kind),
    materials,
  };

  // Every target is the same size at every difficulty; start the pop-in from 0.
  root.scale.setScalar(0);

  activeTargets.push(target);
  return target;
}

/**
 * Recycles a target at the given index using swap-remove.
 * @param activeTargets - The active-target list to remove from.
 * @param index - Index of the target to recycle.
 */
export function recycleTarget(activeTargets: Target[], index: number): void {
  const target = activeTargets[index];
  // Geometry is per-instance, so it is disposed here. Materials are disposed
  // from the target's own `materials` list rather than by walking the meshes:
  // walking used to hit shared module-level materials and free them out from
  // under every other target still on screen.
  target.root.traverse((child) => {
    if (child instanceof Mesh) child.geometry.dispose();
  });
  for (const m of target.materials) m.dispose();
  target.root.removeFromParent();

  const last = activeTargets.length - 1;
  if (index !== last) activeTargets[index] = activeTargets[last];
  activeTargets.pop();
}

/**
 * Spawns a cannonball and adds it to the scene and active list.
 * The ball no longer carries a reference to a "locked-on" target: it is given a
 * launch velocity and flies. Whether it hits anything is decided by where it
 * actually lands, so a badly aimed tap really does splash into the water.
 * @param startPos - World-space launch position (cannon mouth).
 * @param velocity - World-space launch velocity in units per second.
 * @param flightDuration - Expected time to reach the water, in seconds.
 * @param scene - Scene to add the ball and shadow meshes to.
 * @param activeCannonballs - Active-cannonball list the new ball is pushed onto.
 * @returns The newly created cannonball state.
 */
export function spawnCannonball(startPos: Vector3, velocity: Vector3, flightDuration: number, scene: Scene, activeCannonballs: Cannonball[]): Cannonball {
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
    velocity: velocity.clone(),
    flightDuration,
    elapsed: 0,
    trailTimer: 0,
  };

  activeCannonballs.push(ball);
  return ball;
}

/**
 * Recycles a cannonball at the given index using swap-remove.
 * @param activeCannonballs - The active-cannonball list to remove from.
 * @param index - Index of the ball to recycle.
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

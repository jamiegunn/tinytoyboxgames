/**
 * Cannon rig control for Cannonball Splash.
 *
 * Provides aiming, fire animation, and idle breathing.
 */

import { Vector3 } from 'three';
import type { CannonRig } from '../types';
import { C } from '../types';
import { computeCannonAim } from '../helpers';

const aimScratch = new Vector3();

/**
 * Points the barrel along a world-space direction, immediately.
 *
 * The aim used to be written to `aimYaw`/`aimPitch` and lerped onto the barrel a
 * frame later, while the fire code read the muzzle position on the same frame —
 * so every ball left the barrel's *previous* orientation and visibly squirted
 * out of the cannon's side. Applying the rotation (and refreshing the world
 * matrix) here means `getCannonMouthPosition` returns the mouth of the barrel
 * the child is actually looking at. Snapping also reads as more responsive than
 * a lerp for a three-year-old: the cannon points where they touched, at once.
 * @param rig - The cannon rig to aim.
 * @param direction - World-space direction the barrel should point.
 */
export function aimCannonAlong(rig: CannonRig, direction: Vector3): void {
  const { yaw, pitch } = computeCannonAim(direction);
  rig.aimYaw = yaw;
  rig.aimPitch = pitch;
  rig.barrelGroup.rotation.set(pitch, yaw, 0);
  rig.barrelGroup.updateMatrixWorld(true);
}

/**
 * Points the barrel at a world position.
 * @param rig - The cannon rig to aim.
 * @param targetWorldPos - The world point to aim at.
 */
export function aimCannon(rig: CannonRig, targetWorldPos: Vector3): void {
  aimCannonAlong(rig, aimScratch.copy(targetWorldPos).sub(rig.root.position));
}

/**
 * Triggers the fire recoil animation.
 * @param rig - The cannon rig to recoil.
 */
export function fireCannonAnimation(rig: CannonRig): void {
  rig.recoilTimer = C.RECOIL_DURATION;
}

/**
 * Updates the cannon's idle breathing and recoil recovery.
 * @param rig - The cannon rig to animate.
 * @param dt - Frame delta time in seconds.
 * @param elapsedTime - Total elapsed game time in seconds.
 */
export function updateCannonIdle(rig: CannonRig, dt: number, elapsedTime: number): void {
  rig.idlePhase = elapsedTime;

  // Breathing is applied *relative to the stored aim* rather than to whatever
  // rotation.x currently holds, so the offset cannot accumulate frame over frame
  // and drift the barrel away from where it was aimed.
  rig.barrelGroup.rotation.y = rig.aimYaw;
  rig.barrelGroup.rotation.x = rig.aimPitch;

  // Recoil animation
  if (rig.recoilTimer > 0) {
    rig.recoilTimer -= dt;
    const total = C.RECOIL_DURATION;
    const elapsed = total - rig.recoilTimer;
    const frameTime = 1 / 30;

    let offsetZ = 0;
    if (elapsed < frameTime * 2) {
      // Recoil backward
      const t = elapsed / (frameTime * 2);
      offsetZ = 0.2 * (1 - (1 - t) * (1 - t)); // ease-out
    } else if (elapsed < frameTime * 4) {
      // Hold
      offsetZ = 0.2;
    } else if (elapsed < frameTime * 6) {
      // Overshoot forward
      const t = (elapsed - frameTime * 4) / (frameTime * 2);
      offsetZ = 0.2 - 0.25 * t;
    } else {
      // Settle back
      const t = Math.min(1, (elapsed - frameTime * 6) / (frameTime * 8));
      const ease = t * t * (3 - 2 * t); // ease-in-out
      offsetZ = -0.05 * (1 - ease);
    }

    rig.barrelGroup.position.z = offsetZ;
  } else {
    rig.barrelGroup.position.z = 0;
    rig.barrelGroup.rotation.x = rig.aimPitch + 0.01 * Math.sin(elapsedTime * 1.5);
  }
}

/**
 * Returns the world position of the cannon barrel mouth (fire point).
 * @param rig - The cannon rig whose barrel to sample.
 * @returns A new world-space position at the barrel mouth.
 */
export function getCannonMouthPosition(rig: CannonRig): Vector3 {
  const worldPos = new Vector3(0, 0, -1.2);
  rig.barrelGroup.localToWorld(worldPos);
  return worldPos;
}

/**
 * Cannon rig control for Cannonball Splash.
 *
 * Provides aiming, fire animation, and idle breathing.
 */

import { Vector3 } from 'three';
import type { CannonRig } from '../types';
import { C } from '../types';
import { computeCannonAim, lerp } from '../helpers';

/** Aim the cannon barrel toward a world point (sets target for smooth lerp). */
export function aimCannon(rig: CannonRig, targetWorldPos: Vector3): void {
  const cannonPos = new Vector3(C.CANNON_X, C.CANNON_Y, C.CANNON_Z);
  const { rotY, rotX } = computeCannonAim(cannonPos, targetWorldPos);
  rig.aimYaw = rotY;
  rig.aimPitch = rotX;
}

/** Triggers the fire recoil animation. */
export function fireCannonAnimation(rig: CannonRig): void {
  rig.recoilTimer = C.RECOIL_DURATION;
}

/** Updates the cannon's idle breathing and recoil recovery. */
export function updateCannonIdle(rig: CannonRig, dt: number, elapsedTime: number): void {
  rig.idlePhase = elapsedTime;

  // Smooth lerp toward aim targets
  const lerpRate = Math.min(1, 15 * dt);
  rig.barrelGroup.rotation.y = lerp(rig.barrelGroup.rotation.y, rig.aimYaw, lerpRate);
  rig.barrelGroup.rotation.x = lerp(rig.barrelGroup.rotation.x, rig.aimPitch, lerpRate);

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
  }

  // Idle breathing
  const baseRotX = rig.barrelGroup.rotation.x;
  // Only apply breathing if not in recoil
  if (rig.recoilTimer <= 0) {
    rig.barrelGroup.rotation.x = baseRotX + 0.01 * Math.sin(elapsedTime * 1.5);
  }
}

/** Returns the world position of the cannon barrel mouth (fire point). */
export function getCannonMouthPosition(rig: CannonRig): Vector3 {
  const worldPos = new Vector3(0, 0, -1.2);
  rig.barrelGroup.localToWorld(worldPos);
  return worldPos;
}

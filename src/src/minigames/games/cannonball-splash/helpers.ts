/**
 * Pure utility helpers for Cannonball Splash.
 *
 * No gameplay state, no Three.js scene mutation — just math.
 */

import { Vector3 } from 'three';
import { C, type Target, type TargetKind } from './types';

/** Random number in [min, max). */
export function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** Clamps value to [0, 1]. */
export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/** Linear interpolation. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Evaluates the parametric arc position at time t ∈ [0, 1].
 */
export function computeArcPosition(start: Vector3, end: Vector3, arcHeight: number, t: number): Vector3 {
  return new Vector3(lerp(start.x, end.x, t), lerp(start.y, end.y, t) + arcHeight * 4 * t * (1 - t), lerp(start.z, end.z, t));
}

/**
 * Maps target z-depth to flight duration.
 * Near (z > -8) → 0.6s, Far (z < -14) → 1.0s, interpolated between.
 */
export function computeFlightDuration(targetZ: number): number {
  const t = clamp01((targetZ - -8) / (-14 - -8));
  return lerp(C.FLIGHT_DURATION_NEAR, C.FLIGHT_DURATION_FAR, t);
}

/**
 * Maps target z-depth to arc height.
 * Near → 1.5, Far → 4.0.
 */
export function computeArcHeight(targetZ: number): number {
  const t = clamp01((targetZ - -8) / (-14 - -8));
  return lerp(C.ARC_HEIGHT_NEAR, C.ARC_HEIGHT_FAR, t);
}

/**
 * Computes cannon aim angles toward a world point, with clamping.
 */
export function computeCannonAim(cannonPos: Vector3, targetPos: Vector3): { rotY: number; rotX: number } {
  const dx = targetPos.x - cannonPos.x;
  const dz = targetPos.z - cannonPos.z;

  let rotY = Math.atan2(dx, dz);
  rotY = Math.max(-C.AIM_MAX_YAW, Math.min(C.AIM_MAX_YAW, rotY));

  const dist = Math.sqrt(dx * dx + dz * dz);
  let rotX = -Math.atan2(1.5, dist);
  rotX = Math.max(C.AIM_MAX_PITCH, Math.min(C.AIM_MIN_PITCH, rotX));

  return { rotY, rotX };
}

/** Returns true if the point is inside the play area. */
export function isInsidePlayArea(x: number, z: number): boolean {
  return x >= C.PLAY_X_MIN && x <= C.PLAY_X_MAX && z >= C.PLAY_Z_MIN && z <= C.PLAY_Z_MAX;
}

/**
 * Generates a drift velocity for a newly spawned target.
 * Targets from the left drift right, and vice versa.
 */
export function randomDriftVector(spawnSide: 'left' | 'right', difficulty: number): { vx: number; vz: number } {
  const speed = lerp(C.DRIFT_SPEED_MIN, C.DRIFT_SPEED_MAX, difficulty);
  const vx = spawnSide === 'left' ? speed : -speed;
  const vz = randomRange(-0.05, 0.05);
  return { vx, vz };
}

/**
 * Weighted random target kind selection based on difficulty.
 */
export function selectTargetKind(difficulty: number): TargetKind {
  const barrelWeight = lerp(80, 40, difficulty);
  const bottleWeight = lerp(15, 30, difficulty);
  // duck weight is the remainder

  const roll = Math.random() * 100;
  if (roll < barrelWeight) return 'barrel';
  if (roll < barrelWeight + bottleWeight) return 'bottle';
  return 'duck';
}

/**
 * Finds the nearest active target within maxDist of a world point.
 * Returns the index into the targets array, or null if none found.
 */
export function nearestTarget(targets: Target[], worldPoint: Vector3, maxDist: number): number | null {
  let bestIndex: number | null = null;
  let bestDist = maxDist;

  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    if (t.state !== 'active') continue;

    const dx = t.root.position.x - worldPoint.x;
    const dz = t.root.position.z - worldPoint.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < bestDist) {
      bestDist = dist;
      bestIndex = i;
    }
  }

  return bestIndex;
}

/**
 * Computes the score value for a target kind.
 */
export function scoreForKind(kind: TargetKind): number {
  switch (kind) {
    case 'barrel':
      return C.SCORE_BARREL;
    case 'bottle':
      return C.SCORE_BOTTLE;
    case 'duck':
      return C.SCORE_DUCK;
    case 'golden-barrel':
      return C.SCORE_GOLDEN;
    case 'rainbow-bottle':
      return C.SCORE_RAINBOW;
  }
}

/**
 * Returns interpolated values for difficulty-scaled parameters.
 */
export function getSpawnCapacity(difficulty: number): number {
  return Math.round(lerp(C.MAX_TARGETS_MIN, C.MAX_TARGETS_MAX, difficulty));
}

export function getSpawnInterval(difficulty: number): number {
  return lerp(C.SPAWN_INTERVAL_MAX, C.SPAWN_INTERVAL_MIN, difficulty);
}

export function getDriftSpeed(difficulty: number): number {
  return lerp(C.DRIFT_SPEED_MIN, C.DRIFT_SPEED_MAX, difficulty);
}

export function getTargetScale(difficulty: number): number {
  return lerp(C.TARGET_SCALE_MAX, C.TARGET_SCALE_MIN, difficulty);
}

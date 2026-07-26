/**
 * Pure utility helpers for Cannonball Splash.
 *
 * No gameplay state, no Three.js scene mutation — just math.
 */

import { Vector3 } from 'three';
import { C, type Target, type TargetKind } from './types';

/**
 * Random number in [min, max).
 * @param min - Inclusive lower bound.
 * @param max - Exclusive upper bound.
 * @returns A pseudo-random value between the two bounds.
 */
export function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/**
 * Clamps value to [0, 1].
 * @param value - The value to clamp.
 * @returns The value clamped to the [0, 1] range.
 */
export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * Linear interpolation.
 * @param a - Start value at t = 0.
 * @param b - End value at t = 1.
 * @param t - Interpolation factor.
 * @returns The interpolated value between a and b.
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Maps target z-depth to flight duration.
 * Near (z > -8) → FLIGHT_DURATION_NEAR, far (z < -14) → FLIGHT_DURATION_FAR.
 * @param targetZ - The target's world z coordinate.
 * @returns Flight duration in seconds.
 */
export function computeFlightDuration(targetZ: number): number {
  const t = clamp01((targetZ - -8) / (-14 - -8));
  return lerp(C.FLIGHT_DURATION_NEAR, C.FLIGHT_DURATION_FAR, t);
}

/**
 * Solves the launch velocity that carries a ball from `start` to `end` in
 * exactly `duration` seconds under constant gravity.
 *
 * The ball used to travel a parametric quadratic with a hand-tuned "arc height"
 * while GRAVITY existed but was spent only on particles, so the flight never
 * read as physical. Horizontal speed is constant; the vertical component is
 * whatever makes y(duration) land on the aim point.
 * @param start - Launch position (barrel mouth).
 * @param end - Desired impact position.
 * @param duration - Time of flight in seconds.
 * @param out - Vector to write the velocity into.
 * @returns The `out` vector, holding world units per second.
 */
export function solveBallisticVelocity(start: Vector3, end: Vector3, duration: number, out: Vector3): Vector3 {
  const t = Math.max(0.05, duration);
  out.x = (end.x - start.x) / t;
  out.z = (end.z - start.z) / t;
  out.y = (end.y - start.y - 0.5 * C.GRAVITY * t * t) / t;
  return out;
}

/**
 * Evaluates a ballistic trajectory at time t.
 * @param start - Launch position.
 * @param velocity - Launch velocity.
 * @param t - Seconds since launch.
 * @param out - Vector to write the position into.
 * @returns The `out` vector, holding the world position at time t.
 */
export function ballisticPosition(start: Vector3, velocity: Vector3, t: number, out: Vector3): Vector3 {
  out.x = start.x + velocity.x * t;
  out.y = start.y + velocity.y * t + 0.5 * C.GRAVITY * t * t;
  out.z = start.z + velocity.z * t;
  return out;
}

/**
 * Converts a world-space direction into clamped barrel angles.
 *
 * The barrel's rest axis is its local -Z and its rotation order is YXZ, so a
 * direction d is produced by yaw = atan2(-d.x, -d.z) and pitch = asin(d.y). The
 * previous atan2(dx, dz) was exactly a half-turn out, which the ±60° clamp then
 * pinned to one side — the visible "ball leaves the side of the cannon".
 * @param direction - Direction the barrel should point (need not be normalized).
 * @returns Clamped yaw and pitch in radians.
 */
export function computeCannonAim(direction: Vector3): { yaw: number; pitch: number } {
  const length = Math.max(1e-6, direction.length());
  const dx = direction.x / length;
  const dy = direction.y / length;
  const dz = direction.z / length;

  const yaw = Math.max(-C.AIM_MAX_YAW, Math.min(C.AIM_MAX_YAW, Math.atan2(-dx, -dz)));
  const pitch = Math.max(C.AIM_MIN_PITCH, Math.min(C.AIM_MAX_PITCH, Math.asin(Math.max(-1, Math.min(1, dy)))));

  return { yaw, pitch };
}

/**
 * Generates a drift velocity for a newly spawned target.
 * Targets from the left drift right, and vice versa.
 * @param spawnSide - Which edge the target spawned from.
 * @param difficulty - Normalized difficulty in [0, 1].
 * @returns Drift velocity components (vx toward the opposite side, small random vz).
 */
export function randomDriftVector(spawnSide: 'left' | 'right', difficulty: number): { vx: number; vz: number } {
  const speed = lerp(C.DRIFT_SPEED_MIN, C.DRIFT_SPEED_MAX, difficulty);
  const vx = spawnSide === 'left' ? speed : -speed;
  const vz = randomRange(-0.05, 0.05);
  return { vx, vz };
}

/**
 * Weighted random target kind selection based on difficulty.
 * @param difficulty - Normalized difficulty in [0, 1].
 * @returns A randomly chosen target kind ('barrel', 'bottle', or 'duck').
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
 * @param targets - The pool of targets to search.
 * @param worldPoint - The world point to measure from.
 * @param maxDist - Maximum horizontal distance to consider.
 * @returns Index of the nearest active target, or null when none is in range.
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
 * @param kind - The target kind to look up.
 * @returns The point value awarded for hitting that kind.
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
 * @param difficulty - Normalized difficulty in [0, 1].
 * @returns Maximum number of simultaneously active targets.
 */
export function getSpawnCapacity(difficulty: number): number {
  return Math.round(lerp(C.MAX_TARGETS_MIN, C.MAX_TARGETS_MAX, difficulty));
}

/**
 * Difficulty-scaled spawn interval.
 * @param difficulty - Normalized difficulty in [0, 1].
 * @returns Seconds between spawn attempts (shorter at higher difficulty).
 */
export function getSpawnInterval(difficulty: number): number {
  return lerp(C.SPAWN_INTERVAL_MAX, C.SPAWN_INTERVAL_MIN, difficulty);
}

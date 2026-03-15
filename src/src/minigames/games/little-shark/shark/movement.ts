import type { Mesh } from 'three';
import { clamp, wrapAngle } from '../helpers';
import { BOUNDS } from '../types';

/** Swim phase: rotating toward target, then swimming to it. */
type SwimPhase = 'idle' | 'rotating' | 'swimming';

/** Mutable state for shark movement, stored in the game factory closure. */
export interface SharkMoveState {
  posX: number;
  posZ: number;
  velX: number;
  velZ: number;
  targetX: number;
  targetZ: number;
  rotY: number;
  isBeingDragged: boolean;
  /** Current swim phase. */
  swimPhase: SwimPhase;
  /** Destination coordinates (after 10% overshoot applied). */
  swimDestX: number;
  swimDestZ: number;
  /** Swim speed in units/second. */
  swimSpeed: number;
  /** Idle drift phase (used when idle). */
  idleDriftPhase: number;
  /** Center point for idle drift orbit (updated on lunge arrival). */
  driftCenterX: number;
  driftCenterZ: number;
  /** Rest timer — shark stays put after arriving at a lunge destination. */
  restTimer: number;

  /** @deprecated Use swimPhase !== 'idle' instead. Kept for animation compatibility. */
  isLunging: boolean;
}

/**
 * Creates initial shark movement state.
 * @returns Fresh SharkMoveState.
 */
export function createSharkMoveState(): SharkMoveState {
  return {
    posX: 0,
    posZ: 0,
    velX: 0,
    velZ: 0,
    targetX: 0,
    targetZ: 0,
    rotY: 0,
    isBeingDragged: false,
    swimPhase: 'idle',
    swimDestX: 0,
    swimDestZ: 0,
    swimSpeed: 4.0,
    idleDriftPhase: Math.random() * Math.PI * 2,
    driftCenterX: 0,
    driftCenterZ: 0,
    restTimer: 0,
    isLunging: false,
  };
}

/**
 * Spring-damped follower when dragged. Critically damped for smooth feel.
 * @param state - Shark movement state.
 * @param dt - Frame delta time.
 */
export function updateSpringFollow(state: SharkMoveState, dt: number): void {
  const stiffness = 4.0;
  const damping = 2.0 * Math.sqrt(stiffness);
  const dx = state.targetX - state.posX;
  const dz = state.targetZ - state.posZ;
  const ax = stiffness * dx - damping * state.velX;
  const az = stiffness * dz - damping * state.velZ;
  state.velX += ax * dt;
  state.velZ += az * dt;
  state.posX += state.velX * dt;
  state.posZ += state.velZ * dt;
  state.posX = clamp(state.posX, -BOUNDS, BOUNDS);
  state.posZ = clamp(state.posZ, -BOUNDS, BOUNDS);
}

/**
 * Drifts the shark in a figure-eight when idle (not dragged, not lunging).
 * @param state - Shark movement state.
 * @param dt - Frame delta time.
 */
export function updateIdleDrift(state: SharkMoveState, dt: number): void {
  // Rest after arriving at a lunge destination — shark stays put
  if (state.restTimer > 0) {
    state.restTimer -= dt;
    // Dampen any residual velocity
    state.velX *= Math.max(0, 1 - 5 * dt);
    state.velZ *= Math.max(0, 1 - 5 * dt);
    state.posX += state.velX * dt;
    state.posZ += state.velZ * dt;
    return;
  }

  state.idleDriftPhase += dt * 0.4;
  // Drift in a figure-eight centered on driftCenter (not origin)
  state.targetX = state.driftCenterX + Math.sin(state.idleDriftPhase) * 1.5;
  state.targetZ = state.driftCenterZ + Math.sin(state.idleDriftPhase * 2) * 1.5;
  // Clamp drift target to bounds
  state.targetX = clamp(state.targetX, -BOUNDS, BOUNDS);
  state.targetZ = clamp(state.targetZ, -BOUNDS, BOUNDS);

  // Gentle spring toward target
  const stiffness = 2.0;
  const damping = 2.0 * Math.sqrt(stiffness);
  const dx = state.targetX - state.posX;
  const dz = state.targetZ - state.posZ;
  const ax = stiffness * dx - damping * state.velX;
  const az = stiffness * dz - damping * state.velZ;
  state.velX += ax * dt;
  state.velZ += az * dt;
  state.posX += state.velX * dt;
  state.posZ += state.velZ * dt;
  state.posX = clamp(state.posX, -BOUNDS, BOUNDS);
  state.posZ = clamp(state.posZ, -BOUNDS, BOUNDS);
}

/**
 * Starts a swim toward a target position.
 * @param state - Shark movement state.
 * @param toX - Target X.
 * @param toZ - Target Z.
 * @param maxDist - Maximum swim distance.
 */
export function startLunge(state: SharkMoveState, toX: number, toZ: number, maxDist: number): void {
  let dx = toX - state.posX;
  let dz = toZ - state.posZ;
  let dist = Math.sqrt(dx * dx + dz * dz);

  if (dist < 0.05) return;

  if (dist > maxDist) {
    const scale = maxDist / dist;
    toX = state.posX + dx * scale;
    toZ = state.posZ + dz * scale;
    dist = maxDist;
  }

  dx = toX - state.posX;
  dz = toZ - state.posZ;
  toX = state.posX + dx * 1.1;
  toZ = state.posZ + dz * 1.1;
  toX = clamp(toX, -BOUNDS, BOUNDS);
  toZ = clamp(toZ, -BOUNDS, BOUNDS);

  state.velX = 0;
  state.velZ = 0;

  state.swimDestX = toX;
  state.swimDestZ = toZ;
  state.targetX = toX;
  state.targetZ = toZ;
  state.swimPhase = 'rotating';
  state.isLunging = true;

  state.swimSpeed = Math.max(dist / 0.6, 3.0);
}

/** Rotation speed during active turning toward a target (radians/sec). */
const TURN_SPEED = Math.PI * 2.5;

/**
 * Updates the rotate-then-swim sequence each frame.
 * @param state - Shark movement state.
 * @param dt - Frame delta time.
 * @returns True while the shark is actively rotating or swimming.
 */
export function updateSwim(state: SharkMoveState, dt: number): boolean {
  if (state.swimPhase === 'idle') return false;

  const dx = state.swimDestX - state.posX;
  const dz = state.swimDestZ - state.posZ;
  // Shark mesh head faces +X; Three.js rotY maps +X to (cosθ, 0, -sinθ)
  const targetAngle = Math.atan2(-dz, dx);

  if (state.swimPhase === 'rotating') {
    let angleDiff = wrapAngle(targetAngle - state.rotY);
    const maxRot = TURN_SPEED * dt;

    if (Math.abs(angleDiff) <= maxRot) {
      state.rotY += angleDiff;
      state.swimPhase = 'swimming';
    } else {
      angleDiff = clamp(angleDiff, -maxRot, maxRot);
      state.rotY += angleDiff;
    }
    return true;
  }

  if (state.swimPhase === 'swimming') {
    const dist = Math.sqrt(dx * dx + dz * dz);
    const step = state.swimSpeed * dt;

    if (dist <= step || dist < 0.05) {
      state.posX = state.swimDestX;
      state.posZ = state.swimDestZ;
      state.velX = 0;
      state.velZ = 0;
      state.swimPhase = 'idle';
      state.isLunging = false;
      // Anchor idle drift around the arrival point and rest briefly
      state.driftCenterX = state.posX;
      state.driftCenterZ = state.posZ;
      state.restTimer = 2.5;
      return false;
    }

    const nx = dx / dist;
    const nz = dz / dist;
    state.posX += nx * step;
    state.posZ += nz * step;
    state.posX = clamp(state.posX, -BOUNDS, BOUNDS);
    state.posZ = clamp(state.posZ, -BOUNDS, BOUNDS);

    state.velX = nx * state.swimSpeed;
    state.velZ = nz * state.swimSpeed;

    const newDx = state.swimDestX - state.posX;
    const newDz = state.swimDestZ - state.posZ;
    if (Math.abs(newDx) > 0.01 || Math.abs(newDz) > 0.01) {
      state.rotY = Math.atan2(-newDz, newDx);
    }

    return true;
  }

  return false;
}

/**
 * Rotates shark to face movement direction with smooth limited rotation speed.
 * @param state - Shark movement state.
 * @param dt - Frame delta time.
 */
export function updateRotation(state: SharkMoveState, dt: number): void {
  if (state.swimPhase !== 'idle') return;

  let targetAngle: number;

  // Shark mesh head faces +X; Three.js rotY maps +X to (cosθ, 0, -sinθ)
  if (Math.abs(state.velX) > 0.01 || Math.abs(state.velZ) > 0.01) {
    targetAngle = Math.atan2(-state.velZ, state.velX);
  } else {
    const dx = state.targetX - state.posX;
    const dz = state.targetZ - state.posZ;
    if (Math.abs(dx) > 0.01 || Math.abs(dz) > 0.01) {
      targetAngle = Math.atan2(-dz, dx);
    } else {
      return;
    }
  }

  let angleDiff = wrapAngle(targetAngle - state.rotY);
  const maxRot = Math.PI * 0.335 * dt;
  angleDiff = clamp(angleDiff, -maxRot, maxRot);
  state.rotY += angleDiff;
}

/**
 * Returns the current speed magnitude.
 * @param state - Shark movement state.
 * @returns Speed in units/second.
 */
export function getSpeed(state: SharkMoveState): number {
  return Math.sqrt(state.velX * state.velX + state.velZ * state.velZ);
}

/**
 * Applies movement state to the shark mesh.
 * @param state - Shark movement state.
 * @param sharkRoot - The shark root mesh.
 */
export function applyToMesh(state: SharkMoveState, sharkRoot: Mesh): void {
  sharkRoot.position.x = state.posX;
  sharkRoot.position.y = 0;
  sharkRoot.position.z = state.posZ;
  sharkRoot.rotation.y = state.rotY;
}

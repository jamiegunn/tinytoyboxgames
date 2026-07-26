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
  /** Remaining time the shark may stand still turning before it must start moving. */
  rotateHold: number;

  /** @deprecated Use swimPhase !== 'idle' instead. Kept for animation compatibility. */
  isLunging: boolean;
}

// ── Turn rates ──────────────────────────────────────────────────────
//
// Defect 6: turning used to be instant during hunt (index.ts snapped rotY),
// 1.052 rad/s when idle or dragged, and 7.854 rad/s during the lunge rotate
// phase — a 7.5x spread that made the shark read as three different animals.
// One creature, two gears: a relaxed cruise turn and a committed chase turn.

/** Turn rate while cruising, drifting, or following a finger (radians/second). */
export const TURN_RATE_CRUISE = Math.PI * 1.2;

/** Turn rate while hunting or lunging — committed, but still the same animal. */
export const TURN_RATE_HUNT = Math.PI * 2.0;

/**
 * Rotates an angle toward a target at a bounded rate, taking the short way round.
 * @param current - Current angle in radians.
 * @param targetAngle - Desired angle in radians.
 * @param rate - Maximum turn rate in radians per second.
 * @param dt - Frame delta time in seconds.
 * @returns The new angle in radians.
 */
export function steerTowardAngle(current: number, targetAngle: number, rate: number, dt: number): number {
  const maxRot = rate * dt;
  const angleDiff = clamp(wrapAngle(targetAngle - current), -maxRot, maxRot);
  return current + angleDiff;
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
    rotateHold: 0,
    isLunging: false,
  };
}

// ── Drag feel ───────────────────────────────────────────────────────
//
// Defect 7: the drag spring was stiffness 4.0 critically damped, which takes
// 1.5–2s to settle — the shark lagged so far behind the finger that dragging
// felt disconnected. 60 rad^2/s^2 with a slightly under-damped ratio gives a
// ~0.14s time constant, so the shark sits under the fingertip and still banks.

/** Spring stiffness for finger-follow. */
const DRAG_STIFFNESS = 60.0;

/** Damping ratio just under 1 — a hint of overshoot reads as a living animal. */
const DRAG_DAMPING_RATIO = 0.9;

/** Spring damping coefficient for finger-follow. */
const DRAG_DAMPING = 2.0 * DRAG_DAMPING_RATIO * Math.sqrt(DRAG_STIFFNESS);

/** Velocity multiplier applied on release so the shark coasts out of a drag. */
const DRAG_RELEASE_BOOST = 1.35;

/** Upper bound on release speed so a fast flick cannot rocket the shark away. */
const DRAG_RELEASE_MAX_SPEED = 9.0;

/** How far ahead of the release point the idle drift re-anchors (seconds of glide). */
const DRAG_RELEASE_GLIDE_TIME = 0.4;

/**
 * Spring-damped follower when dragged. Slightly under-damped so the shark
 * tracks the finger closely instead of trailing it.
 * @param state - Shark movement state.
 * @param dt - Frame delta time.
 */
export function updateSpringFollow(state: SharkMoveState, dt: number): void {
  const stiffness = DRAG_STIFFNESS;
  const damping = DRAG_DAMPING;
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
 * Ends a drag, carrying the finger's momentum into a short glide.
 *
 * Defect 7: `onDragEnd` used to only clear `isBeingDragged`, so the shark
 * stopped dead the instant the finger lifted. Now the release keeps (and
 * slightly amplifies) the drag velocity and re-anchors the idle drift ahead
 * of the shark, so letting go reads as "and… glide" instead of a hard stop.
 *
 * @param state - Shark movement state.
 */
export function releaseDrag(state: SharkMoveState): void {
  state.isBeingDragged = false;

  const speed = Math.sqrt(state.velX * state.velX + state.velZ * state.velZ);
  if (speed > 0.1) {
    const boosted = Math.min(speed * DRAG_RELEASE_BOOST, DRAG_RELEASE_MAX_SPEED);
    const scale = boosted / speed;
    state.velX *= scale;
    state.velZ *= scale;
  }

  // Anchor the figure-eight where the glide will end, not where the finger was.
  state.driftCenterX = clamp(state.posX + state.velX * DRAG_RELEASE_GLIDE_TIME, -BOUNDS, BOUNDS);
  state.driftCenterZ = clamp(state.posZ + state.velZ * DRAG_RELEASE_GLIDE_TIME, -BOUNDS, BOUNDS);
  // A release is the child asking for motion — never answer it with a rest.
  state.restTimer = 0;
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
  state.rotateHold = ROTATE_MAX_HOLD;
  state.isLunging = true;

  state.swimSpeed = Math.max(dist / 0.6, 3.0);
}

/**
 * Angular error (radians) at which the shark stops turning in place and starts
 * swimming — it finishes the turn while already under way.
 */
const ROTATE_RELEASE = 0.7;

/**
 * Hard cap on standing-still turn time (seconds).
 *
 * Defect 1: the rotate phase used to block all translation until the shark was
 * perfectly aligned, adding up to ~0.4s of dead air to every water tap. Now a
 * tap always produces motion within 0.1s, worst case.
 */
const ROTATE_MAX_HOLD = 0.1;

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
    state.rotY = steerTowardAngle(state.rotY, targetAngle, TURN_RATE_HUNT, dt);
    state.rotateHold -= dt;
    // Release into the swim as soon as we are roughly pointed the right way,
    // or when the hold expires — whichever comes first (see ROTATE_MAX_HOLD).
    if (Math.abs(wrapAngle(targetAngle - state.rotY)) <= ROTATE_RELEASE || state.rotateHold <= 0) {
      state.swimPhase = 'swimming';
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
      // Anchor idle drift around the arrival point and rest briefly.
      // Defect 1: this used to be 2.5s. A 3-year-old taps again long before
      // that, and the shark reads as ignoring them. A quarter second is just
      // enough to punctuate the arrival.
      state.driftCenterX = state.posX;
      state.driftCenterZ = state.posZ;
      state.restTimer = 0.25;
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
      // Defect 6: this used to snap rotY straight to the travel angle. Steer at
      // the shared hunt rate so the tail-end of the turn is continuous with the
      // rotate phase that preceded it.
      state.rotY = steerTowardAngle(state.rotY, Math.atan2(-newDz, newDx), TURN_RATE_HUNT, dt);
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

  // Defect 6: was Math.PI * 0.335 (1.052 rad/s), 7.5x slower than the lunge
  // turn. Cruise and hunt now share one scheme (see TURN_RATE_CRUISE).
  state.rotY = steerTowardAngle(state.rotY, targetAngle, TURN_RATE_CRUISE, dt);
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

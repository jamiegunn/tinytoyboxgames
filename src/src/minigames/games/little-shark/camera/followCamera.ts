import type { PerspectiveCamera } from 'three';

/** Mutable state for the spring-follow camera system. */
export interface CameraState {
  /** Camera offset from default position. */
  offsetX: number;
  offsetZ: number;
  /** Spring velocity for smooth follow. */
  velX: number;
  velZ: number;
  /** FOV offset for catch zoom effect. */
  fovOffset: number;
  /** FOV spring velocity. */
  fovVel: number;
  /** Wave breathing phase. */
  breathPhase: number;
  /** Base camera position (set during setup). */
  basePosX: number;
  basePosY: number;
  basePosZ: number;
  /** Base FOV (set during setup). */
  baseFov: number;
  /** Screen shake remaining time. */
  shakeTimer: number;
  /** Screen shake intensity. */
  shakeIntensity: number;
  /** Smoothed world-space point the camera is aiming at. */
  lookAtX: number;
  lookAtZ: number;
  /** False until the first frame has snapped the look target onto the shark. */
  lookInitialized: boolean;
}

/** Dead zone radius — camera ignores shark movement within this distance. */
const DEAD_ZONE = 1.5;

/** Spring stiffness for positional follow. */
const POS_STIFFNESS = 3.0;

/** Spring damping for positional follow (critically damped). */
const POS_DAMPING = 2.0 * Math.sqrt(POS_STIFFNESS);

/** Lead offset — camera target sits slightly ahead of the shark. */
const LEAD_OFFSET = 0.3;

/** Breathing amplitude in world units (Y axis). */
const BREATH_AMPLITUDE = 0.05;

/** Breathing speed in radians per second. */
const BREATH_SPEED = 0.4;

/** Spring stiffness for FOV recovery. */
const FOV_STIFFNESS = 8.0;

/** Spring damping for FOV recovery (over-damped for snappy return). */
const FOV_DAMPING = 2.0 * Math.sqrt(FOV_STIFFNESS);

/** Threshold below which FOV changes skip the projection matrix update. */
const FOV_EPSILON = 0.01;

// ── Look-at ─────────────────────────────────────────────────────────
//
// Defect 2: `updateFollowCamera` moved the camera every frame but never called
// `lookAt`, so the view direction was frozen at whatever the manifest camera
// descriptor produced at mount. The shark could swim to the edge of a ±50 unit
// reef and the camera would still be staring at the origin.

/** Exponential smoothing rate for the aim point (1/seconds). Higher = tighter. */
const LOOK_SMOOTH_RATE = 5.0;

/** Height above the reef floor the camera aims at — roughly the shark's back. */
const LOOK_TARGET_Y = 0.35;

/**
 * Create an initial camera state by capturing the camera's current position and FOV.
 *
 * @param camera - The Three.js perspective camera to track.
 * @returns A fresh CameraState with all offsets and velocities at zero.
 */
export function createCameraState(camera: PerspectiveCamera): CameraState {
  return {
    offsetX: 0,
    offsetZ: 0,
    velX: 0,
    velZ: 0,
    fovOffset: 0,
    fovVel: 0,
    breathPhase: 0,
    basePosX: camera.position.x,
    basePosY: camera.position.y,
    basePosZ: camera.position.z,
    baseFov: camera.fov,
    shakeTimer: 0,
    shakeIntensity: 0,
    lookAtX: 0,
    lookAtZ: 0,
    lookInitialized: false,
  };
}

/**
 * Advance the follow-camera system by one frame.
 *
 * Applies dead-zone gating, spring-based positional follow, wave breathing,
 * screen shake, and FOV spring recovery.
 *
 * @param state - Mutable camera state to update in place.
 * @param camera - The Three.js perspective camera to drive.
 * @param sharkPosX - Current shark X position in world space.
 * @param sharkPosZ - Current shark Z position in world space.
 * @param dt - Delta time in seconds since last frame.
 */
export function updateFollowCamera(state: CameraState, camera: PerspectiveCamera, sharkPosX: number, sharkPosZ: number, dt: number): void {
  // --- Dead zone + spring follow (XZ) ---
  const targetX = sharkPosX + LEAD_OFFSET;
  const targetZ = sharkPosZ + LEAD_OFFSET;

  const dx = targetX - state.offsetX;
  const dz = targetZ - state.offsetZ;
  const dist = Math.sqrt(dx * dx + dz * dz);

  if (dist > DEAD_ZONE) {
    // Spring acceleration: F = -k * displacement - c * velocity
    // Displacement is measured from the current offset toward the target.
    const accelX = POS_STIFFNESS * dx - POS_DAMPING * state.velX;
    const accelZ = POS_STIFFNESS * dz - POS_DAMPING * state.velZ;

    state.velX += accelX * dt;
    state.velZ += accelZ * dt;
    state.offsetX += state.velX * dt;
    state.offsetZ += state.velZ * dt;
  } else {
    // Inside dead zone — dampen existing velocity to settle
    state.velX *= Math.max(0, 1 - POS_DAMPING * dt);
    state.velZ *= Math.max(0, 1 - POS_DAMPING * dt);
    state.offsetX += state.velX * dt;
    state.offsetZ += state.velZ * dt;
  }

  // --- Wave breathing (Y axis) ---
  state.breathPhase += BREATH_SPEED * dt;
  const breathOffset = Math.sin(state.breathPhase) * BREATH_AMPLITUDE;

  // --- Compose camera position ---
  let posX = state.basePosX + state.offsetX;
  let posY = state.basePosY + breathOffset;
  const posZ = state.basePosZ + state.offsetZ;

  // --- Screen shake ---
  if (state.shakeTimer > 0) {
    // Intensity fades linearly over the shake duration
    const initialDuration = state.shakeIntensity > 0 ? state.shakeTimer + dt : 0;
    const fade = initialDuration > 0 ? state.shakeTimer / initialDuration : 0;
    const magnitude = state.shakeIntensity * fade;

    posX += (Math.random() * 2 - 1) * magnitude;
    posY += (Math.random() * 2 - 1) * magnitude;

    state.shakeTimer = Math.max(0, state.shakeTimer - dt);
  }

  camera.position.set(posX, posY, posZ);

  // --- Look-at (defect 2) ---
  // Snap on the first frame so the session does not open with a whip pan, then
  // ease toward the shark. The easing is frame-rate independent, and it is
  // applied to the *aim point* rather than the camera rotation so a screen shake
  // jitters the eye without smearing where the child is looking.
  if (!state.lookInitialized) {
    state.lookAtX = sharkPosX;
    state.lookAtZ = sharkPosZ;
    state.lookInitialized = true;
  } else {
    const t = 1 - Math.exp(-LOOK_SMOOTH_RATE * dt);
    state.lookAtX += (sharkPosX - state.lookAtX) * t;
    state.lookAtZ += (sharkPosZ - state.lookAtZ) * t;
  }
  camera.lookAt(state.lookAtX, LOOK_TARGET_Y, state.lookAtZ);

  // --- FOV spring ---
  const prevFovOffset = state.fovOffset;
  const fovAccel = -FOV_STIFFNESS * state.fovOffset - FOV_DAMPING * state.fovVel;
  state.fovVel += fovAccel * dt;
  state.fovOffset += state.fovVel * dt;

  // Snap to zero when negligible
  if (Math.abs(state.fovOffset) < FOV_EPSILON && Math.abs(state.fovVel) < FOV_EPSILON) {
    state.fovOffset = 0;
    state.fovVel = 0;
  }

  camera.fov = state.baseFov + state.fovOffset;

  // Only rebuild projection matrix when FOV actually changed meaningfully
  if (Math.abs(state.fovOffset - prevFovOffset) > FOV_EPSILON) {
    camera.updateProjectionMatrix();
  }
}

/**
 * Trigger a brief FOV narrowing effect (catch zoom).
 *
 * The spring in {@link updateFollowCamera} will smoothly return the FOV to its base value.
 *
 * @param state - Camera state to mutate.
 * @param intensity - FOV decrease in degrees. Defaults to 3.0.
 */
export function triggerCatchZoom(state: CameraState, intensity?: number): void {
  state.fovOffset = -(intensity ?? 3.0);
}

/**
 * Trigger a screen shake effect.
 *
 * The shake decays linearly over the given duration.
 *
 * @param state - Camera state to mutate.
 * @param duration - Shake duration in seconds. Defaults to 0.15.
 * @param intensity - Maximum positional offset in world units. Defaults to 0.03.
 */
export function triggerScreenShake(state: CameraState, duration?: number, intensity?: number): void {
  state.shakeTimer = duration ?? 0.15;
  state.shakeIntensity = intensity ?? 0.03;
}

/**
 * Reset the camera to its base position and FOV, clearing all offsets and velocities.
 *
 * @param state - Camera state to reset in place.
 * @param camera - The Three.js perspective camera to restore.
 */
export function resetCamera(state: CameraState, camera: PerspectiveCamera): void {
  state.offsetX = 0;
  state.offsetZ = 0;
  state.velX = 0;
  state.velZ = 0;
  state.fovOffset = 0;
  state.fovVel = 0;
  state.breathPhase = 0;
  state.shakeTimer = 0;
  state.shakeIntensity = 0;
  state.lookAtX = 0;
  state.lookAtZ = 0;
  // Re-arm the snap so the next frame aims straight at the shark's start point.
  state.lookInitialized = false;

  camera.position.set(state.basePosX, state.basePosY, state.basePosZ);
  camera.lookAt(0, LOOK_TARGET_Y, 0);
  camera.fov = state.baseFov;
  camera.updateProjectionMatrix();
}

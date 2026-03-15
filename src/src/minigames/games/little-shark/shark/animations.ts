import type { Object3D, Mesh } from 'three';

// ── Animation state ──────────────────────────────────────────────

/** Mutable state for shark animations, stored in the game factory closure. */
export interface SharkAnimState {
  /** Current tail wag phase (radians). */
  tailPhase: number;
  /** Time until next random blink. */
  blinkTimer: number;
  /** Remaining blink duration (eye scaled down). -1 = not blinking. */
  blinkDuration: number;
  /** Whether the current blink is a happy squint (longer, partial close). */
  isHappySquint: boolean;
  /** Barrel roll progress (0 = not rolling, 0→1 = in progress). */
  barrelRollT: number;
  /** Cooldown timer preventing barrel roll spam. */
  barrelRollCooldown: number;
  /** Head look animation progress. -1 = not looking. 0→1 = in progress. */
  headLookT: number;
}

/**
 * Returns initial animation state with zeroed phases and random blink timer.
 * @returns Fresh SharkAnimState.
 */
export function createSharkAnimState(): SharkAnimState {
  return {
    tailPhase: 0,
    blinkTimer: 3 + Math.random() * 4,
    blinkDuration: -1,
    isHappySquint: false,
    barrelRollT: 0,
    barrelRollCooldown: 0,
    headLookT: -1,
  };
}

/**
 * Advances tail wag animation. Frequency and amplitude scale with speed.
 * @param tailMeshes - Tail fin meshes to rotate.
 * @param state - Shark animation state.
 * @param speed - Current shark speed (0 = idle).
 * @param dt - Frame delta time.
 */
export function updateTailWag(tailMeshes: Object3D[], state: SharkAnimState, speed: number, dt: number): void {
  const frequency = Math.min(2.0 + speed * 3.0, 5.0);
  const amplitude = Math.min(0.25 + speed * 0.35, 0.6);
  state.tailPhase += dt * frequency;
  const angle = Math.sin(state.tailPhase) * amplitude;
  for (const tail of tailMeshes) {
    tail.rotation.y = angle;
  }
}

/**
 * Applies a very subtle lateral body wobble that scales with speed.
 * @param bodyMesh - The shark body mesh.
 * @param elapsedTime - Total elapsed game time.
 * @param speed - Current shark speed.
 */
export function updateBodyWobble(bodyMesh: Object3D, elapsedTime: number, speed: number): void {
  bodyMesh.rotation.z = Math.sin(elapsedTime * (2.0 + speed * 0.5)) * (0.02 + speed * 0.015);
}

/**
 * Applies a gentle breathing pulse via Y scaling.
 * @param bodyMesh - The shark body mesh.
 * @param elapsedTime - Total elapsed game time.
 */
export function updateBreathing(bodyMesh: Object3D, elapsedTime: number): void {
  bodyMesh.scale.y = 0.88 + Math.sin(elapsedTime * 1.2) * 0.012;
}

/**
 * Updates eye blink animation with random intervals.
 * @param eyeMeshes - Eye sclera meshes to scale.
 * @param state - Shark animation state.
 * @param dt - Frame delta time.
 */
export function updateEyeBlink(eyeMeshes: Object3D[], state: SharkAnimState, dt: number): void {
  if (state.blinkDuration > 0) {
    // Currently blinking
    state.blinkDuration -= dt;
    const targetY = state.isHappySquint ? 0.3 : 0.1;
    for (const eye of eyeMeshes) {
      eye.scale.y = targetY;
    }
    if (state.blinkDuration <= 0) {
      // Blink complete
      for (const eye of eyeMeshes) {
        eye.scale.y = 1.0;
      }
      state.blinkTimer = 3 + Math.random() * 4;
      state.isHappySquint = false;
      state.blinkDuration = -1;
    }
  } else {
    state.blinkTimer -= dt;
    if (state.blinkTimer <= 0) {
      state.blinkDuration = state.isHappySquint ? 0.3 : 0.1;
    }
  }
}

/**
 * Forces an immediate happy squint blink.
 * @param state - Shark animation state.
 */
export function triggerHappySquint(state: SharkAnimState): void {
  state.isHappySquint = true;
  state.blinkTimer = 0;
}

/**
 * Updates happy wiggle animation if active.
 * @param sharkRoot - The shark root mesh.
 * @param state - Shark animation state.
 * @param dt - Frame delta time.
 * @returns True while wiggling (suppresses lower-priority animations).
 */
export function updateBarrelRoll(sharkRoot: Mesh, state: SharkAnimState, dt: number): boolean {
  if (state.barrelRollT <= 0) {
    if (state.barrelRollCooldown > 0) state.barrelRollCooldown -= dt;
    return false;
  }

  state.barrelRollT += dt / 0.5;

  // Gentle side-to-side wiggle instead of full 360° roll
  const t = Math.min(state.barrelRollT, 1.0);
  const decay = 1 - t;
  sharkRoot.rotation.z = Math.sin(t * Math.PI * 4) * 0.15 * decay;
  // Slight vertical bounce
  sharkRoot.position.y = Math.sin(t * Math.PI * 2) * 0.08 * decay;

  if (state.barrelRollT >= 1.0) {
    sharkRoot.rotation.z = 0;
    sharkRoot.position.y = 0;
    state.barrelRollCooldown = 0.8;
    state.barrelRollT = 0;
  }

  return true;
}

/**
 * Triggers a barrel roll if not on cooldown.
 * @param state - Shark animation state.
 * @returns True if the roll was started.
 */
export function triggerBarrelRoll(state: SharkAnimState): boolean {
  if (state.barrelRollCooldown > 0) return false;
  state.barrelRollT = 0.001;
  return true;
}

/**
 * Updates head-look animation (gentle curiosity look, non-additive).
 * @param sharkRoot - The shark root mesh.
 * @param state - Shark animation state.
 * @param _dt - Frame delta time.
 */
export function updateHeadLook(sharkRoot: Mesh, state: SharkAnimState, _dt: number): void {
  if (state.headLookT < 0) return;

  const lookOffset = Math.sin(state.headLookT * Math.PI * 2) * 0.12;
  sharkRoot.rotation.y += lookOffset;

  state.headLookT += _dt / 0.6;
  if (state.headLookT >= 1.0) {
    state.headLookT = -1;
  }
}

/**
 * Starts a curious head-look animation.
 * @param state - Shark animation state.
 */
export function triggerHeadLook(state: SharkAnimState): void {
  state.headLookT = 0;
}

import type { Object3D } from 'three';
import type { SharkMoveState } from './movement';

// ── Hunt phase constants ────────────────────────────────────────────
//
// Defect 1 — latency budget.
//
// The old cycle was notice 0.3 + strike 0.2 + celebrate 0.6 + recovery 1.0 =
// 2.1s during which `triggerHunt` refused every new tap, and the notice beat
// held velocity at exactly zero, so the shark STOPPED the instant the child
// asked it to move. Round trips of 3s were routine.
//
// New budget: `triggerHunt` now re-targets from any phase except `strike`, so
// the worst case between a tap and the shark moving toward the new fish is one
// in-flight strike (0.20s) plus the notice turn (0.06s) = 0.26s, and the notice
// keeps the shark gliding rather than freezing it. A full uninterrupted catch
// cycle is 0.06 + 0.20 + 0.25 + 0.20 = 0.71s plus pursuit travel.

const NOTICE_DURATION = 0.06;
const STRIKE_DURATION = 0.2;
const CELEBRATE_DURATION = 0.25;
const RECOVERY_DURATION = 0.2;

const PURSUIT_SPEED_MIN = 3.0;
const PURSUIT_SPEED_MAX = 8.0;
const PURSUIT_ACCEL_TIME = 1.0;
const STRIKE_SPEED = 12.0;
const STRIKE_RANGE = 1.5;

/** Phases a fresh tap is allowed to interrupt — everything but the strike commitment. */
const INTERRUPTIBLE_PHASES: readonly HuntPhase[] = ['idle', 'notice', 'pursuit', 'celebrate', 'recovery'];

// ── Types ───────────────────────────────────────────────────────────

/** Phases of the shark hunt finite state machine. */
export type HuntPhase = 'idle' | 'notice' | 'pursuit' | 'strike' | 'celebrate' | 'recovery';

/** Mutable state for the hunt FSM, stored in the game factory closure. */
export interface HuntFSMState {
  /** Current phase of the hunt. */
  phase: HuntPhase;
  /** Timer counting down within the current phase (seconds). */
  phaseTimer: number;
  /** The root Object3D of the target fish, or null when not hunting. */
  targetFishRoot: Object3D | null;
  /** Current pursuit speed (units/second). */
  pursuitSpeed: number;
  /** Time spent accelerating during pursuit (seconds). */
  pursuitAccelTime: number;
}

/** Callbacks invoked by the FSM at phase transitions. */
export interface HuntFSMCallbacks {
  /** Called when the strike phase begins (shark lunges at fish). */
  onStrike: () => void;
  /** Called when the celebrate phase begins (post-catch celebration). */
  onCelebrate: () => void;
}

// ── Factory ─────────────────────────────────────────────────────────

/**
 * Creates initial hunt FSM state in the idle phase.
 * @returns Fresh HuntFSMState with no active target.
 */
export function createHuntFSMState(): HuntFSMState {
  return {
    phase: 'idle',
    phaseTimer: 0,
    targetFishRoot: null,
    pursuitSpeed: PURSUIT_SPEED_MIN,
    pursuitAccelTime: 0,
  };
}

// ── External triggers ───────────────────────────────────────────────

/**
 * Triggers (or re-targets) the hunt when a fish is tapped.
 *
 * Defect 1: this used to bail out unless the shark was fully idle, so every tap
 * landed during the 2.1s celebrate/recovery tail was silently dropped. A tap now
 * re-targets from any phase except `strike`, which is a 0.2s commitment we keep
 * so the lunge itself still reads as a decisive movement.
 *
 * @param state - The hunt FSM state to mutate.
 * @param fishRoot - The root Object3D of the tapped fish.
 * @returns True when the hunt accepted this target.
 */
export function triggerHunt(state: HuntFSMState, fishRoot: Object3D): boolean {
  if (!INTERRUPTIBLE_PHASES.includes(state.phase)) return false;
  state.phase = 'notice';
  state.phaseTimer = NOTICE_DURATION;
  state.targetFishRoot = fishRoot;
  // Keep whatever pursuit speed was already built up so a re-target reads as a
  // course correction mid-swim, not a fresh standing start.
  state.pursuitSpeed = Math.max(state.pursuitSpeed, PURSUIT_SPEED_MIN);
  state.pursuitAccelTime = Math.min(state.pursuitAccelTime, PURSUIT_ACCEL_TIME);
  return true;
}

/**
 * Cancels an active hunt and returns the shark to idle. Use when the target fish
 * despawns or is eaten by other means.
 * @param state - The hunt FSM state to mutate.
 */
export function cancelHunt(state: HuntFSMState): void {
  state.phase = 'idle';
  state.phaseTimer = 0;
  state.targetFishRoot = null;
  state.pursuitSpeed = PURSUIT_SPEED_MIN;
  state.pursuitAccelTime = 0;
}

// ── Getter ──────────────────────────────────────────────────────────

/**
 * Returns the current hunt phase.
 * @param state - The hunt FSM state.
 * @returns The active HuntPhase.
 */
export function getHuntPhase(state: HuntFSMState): HuntPhase {
  return state.phase;
}

// ── Per-frame update ────────────────────────────────────────────────

/**
 * Ticks the hunt FSM forward by one frame. Drives shark movement state and
 * fires callbacks at phase transitions.
 * @param state - The hunt FSM state to mutate.
 * @param sharkMove - The shark movement state (velocity and position are mutated).
 * @param dt - Frame delta time in seconds.
 * @param callbacks - Callbacks for strike and celebrate phase transitions.
 */
export function updateHuntFSM(state: HuntFSMState, sharkMove: SharkMoveState, dt: number, callbacks: HuntFSMCallbacks): void {
  switch (state.phase) {
    case 'idle':
      // Nothing to do — movement handled externally by idle drift
      break;

    case 'notice': {
      // Defect 1: this used to hard-zero velocity for 0.3s — the shark came to a
      // dead stop the instant the child asked it to move. The notice beat is now
      // an immediate turn-toward WITH continued motion: the shark commits to the
      // new heading on the very first frame and never drops below cruise speed.
      // The "I saw that" read is carried by the expression/mood change instead.
      if (!state.targetFishRoot) {
        cancelHunt(state);
        break;
      }
      const fishPos = state.targetFishRoot.position;
      sharkMove.targetX = fishPos.x;
      sharkMove.targetZ = fishPos.z;
      const dx = fishPos.x - sharkMove.posX;
      const dz = fishPos.z - sharkMove.posZ;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > 0.01) {
        const speed = Math.max(Math.sqrt(sharkMove.velX * sharkMove.velX + sharkMove.velZ * sharkMove.velZ), PURSUIT_SPEED_MIN);
        sharkMove.velX = (dx / dist) * speed;
        sharkMove.velZ = (dz / dist) * speed;
        sharkMove.posX += sharkMove.velX * dt;
        sharkMove.posZ += sharkMove.velZ * dt;
      }
      state.phaseTimer -= dt;
      if (state.phaseTimer <= 0) {
        state.phase = 'pursuit';
      }
      break;
    }

    case 'pursuit': {
      // If target disappeared, cancel hunt
      if (!state.targetFishRoot) {
        cancelHunt(state);
        break;
      }

      // Accelerate over time
      state.pursuitAccelTime = Math.min(state.pursuitAccelTime + dt, PURSUIT_ACCEL_TIME);
      const t = state.pursuitAccelTime / PURSUIT_ACCEL_TIME;
      state.pursuitSpeed = PURSUIT_SPEED_MIN + (PURSUIT_SPEED_MAX - PURSUIT_SPEED_MIN) * t;

      // Compute direction to target fish
      const fishPos = state.targetFishRoot.position;
      const dx = fishPos.x - sharkMove.posX;
      const dz = fishPos.z - sharkMove.posZ;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < STRIKE_RANGE) {
        // Close enough — transition to strike
        state.phase = 'strike';
        state.phaseTimer = STRIKE_DURATION;
        callbacks.onStrike();
        break;
      }

      // Move toward fish
      if (dist > 0.01) {
        const nx = dx / dist;
        const nz = dz / dist;
        sharkMove.velX = nx * state.pursuitSpeed;
        sharkMove.velZ = nz * state.pursuitSpeed;
        sharkMove.posX += sharkMove.velX * dt;
        sharkMove.posZ += sharkMove.velZ * dt;

        // Update movement target so rotation follows
        sharkMove.targetX = fishPos.x;
        sharkMove.targetZ = fishPos.z;
      }
      break;
    }

    case 'strike': {
      // Burst speed toward last known direction
      const vDist = Math.sqrt(sharkMove.velX * sharkMove.velX + sharkMove.velZ * sharkMove.velZ);
      if (vDist > 0.01) {
        const nx = sharkMove.velX / vDist;
        const nz = sharkMove.velZ / vDist;
        sharkMove.velX = nx * STRIKE_SPEED;
        sharkMove.velZ = nz * STRIKE_SPEED;
        sharkMove.posX += nx * STRIKE_SPEED * dt;
        sharkMove.posZ += nz * STRIKE_SPEED * dt;
      }

      state.phaseTimer -= dt;
      if (state.phaseTimer <= 0) {
        state.phase = 'celebrate';
        state.phaseTimer = CELEBRATE_DURATION;
        callbacks.onCelebrate();
      }
      break;
    }

    case 'celebrate':
      // Decelerate gently during celebration
      sharkMove.velX *= 0.9;
      sharkMove.velZ *= 0.9;
      state.phaseTimer -= dt;
      if (state.phaseTimer <= 0) {
        state.phase = 'recovery';
        state.phaseTimer = RECOVERY_DURATION;
      }
      break;

    case 'recovery': {
      // Fade speed to zero over the recovery duration
      const fade = Math.max(state.phaseTimer / RECOVERY_DURATION, 0);
      sharkMove.velX *= fade;
      sharkMove.velZ *= fade;
      state.phaseTimer -= dt;
      if (state.phaseTimer <= 0) {
        // Hand back to idle drift around where the hunt actually ended. Without
        // this the drift centre is still wherever the last lunge landed, and the
        // shark would swim all the way back there for no reason the child can see.
        sharkMove.driftCenterX = sharkMove.posX;
        sharkMove.driftCenterZ = sharkMove.posZ;
        sharkMove.restTimer = 0;
        cancelHunt(state);
      }
      break;
    }
  }
}

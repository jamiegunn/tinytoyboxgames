import { clamp, lerp } from '@app/minigames/shared/mathUtils';
import type { GamePhase } from './types';

/**
 * Player profiling and adaptive difficulty.
 * Infers a `playerProfile` (0.0 = youngest/least skilled, 1.0 = oldest/most skilled)
 * from tap behavior, then modulates the score-based difficulty into an
 * `effectiveDifficulty` that downstream systems use.
 */

/** State for the player profile inference system. */
export interface PlayerProfileState {
  /** Inferred profile value (0.0–1.0). */
  value: number;
  /** Rolling window of tap timestamps for cadence calculation. */
  tapTimestamps: number[];
  /** Total taps in current window. */
  totalTaps: number;
  /** Taps that hit a bubble in current window. */
  hitTaps: number;
  /** Rolling window duration in seconds. */
  windowDuration: number;
}

/**
 * Creates a new player profile state, starting at neutral (0.5).
 * @returns Fresh PlayerProfileState.
 */
export function createPlayerProfile(): PlayerProfileState {
  return {
    value: 0.5,
    tapTimestamps: [],
    totalTaps: 0,
    hitTaps: 0,
    windowDuration: 30,
  };
}

/**
 * Records a tap event for profile inference.
 * @param state - The profile state.
 * @param elapsedTime - Current game elapsed time.
 * @param hit - Whether the tap hit a bubble.
 */
export function recordTap(state: PlayerProfileState, elapsedTime: number, hit: boolean): void {
  state.tapTimestamps.push(elapsedTime);
  state.totalTaps++;
  if (hit) state.hitTaps++;
}

/**
 * Updates the player profile based on accumulated tap data.
 * Should be called once per frame or once per second.
 * @param state - The profile state to update.
 * @param elapsedTime - Current game elapsed time.
 */
export function updatePlayerProfile(state: PlayerProfileState, elapsedTime: number): void {
  // Trim old timestamps outside the rolling window
  const windowStart = elapsedTime - state.windowDuration;
  while (state.tapTimestamps.length > 0 && state.tapTimestamps[0] < windowStart) {
    state.tapTimestamps.shift();
  }

  // Need at least 3 taps to infer anything meaningful
  if (state.tapTimestamps.length < 3) return;

  // Signal 1: Tap accuracy (hits / total taps) — weight 0.5
  const accuracy = state.totalTaps > 0 ? clamp(state.hitTaps / state.totalTaps, 0, 1) : 0.5;
  // Map: 40% accuracy → 0.0, 95% → 1.0
  const accuracySignal = clamp((accuracy - 0.4) / 0.55, 0, 1);

  // Signal 2: Tap cadence (median inter-tap interval)
  const intervals: number[] = [];
  for (let i = 1; i < state.tapTimestamps.length; i++) {
    intervals.push(state.tapTimestamps[i] - state.tapTimestamps[i - 1]);
  }
  intervals.sort((a, b) => a - b);
  const medianInterval = intervals[Math.floor(intervals.length / 2)] ?? 2.0;
  // Map: 3.0s interval → 0.0, 0.15s → 1.0
  const cadenceSignal = clamp(1 - (medianInterval - 0.15) / 2.85, 0, 1);

  // Weighted sum
  const rawProfile = accuracySignal * 0.5 + cadenceSignal * 0.5;

  // Exponential moving average for smooth adaptation
  const alpha = 0.05;
  state.value = state.value + alpha * (rawProfile - state.value);
  state.value = clamp(state.value, 0, 1);
}

/**
 * Computes the effective difficulty by modulating the score-based difficulty
 * with the player profile.
 * @param scoreDifficulty - Raw score-based difficulty level (0–1).
 * @param playerProfile - Inferred player profile (0–1).
 * @returns Effective difficulty (0–1).
 */
export function computeEffectiveDifficulty(scoreDifficulty: number, playerProfile: number): number {
  return scoreDifficulty * (0.5 + 0.5 * playerProfile);
}

// ── Session flow arc ──────────────────────────────────────────────────

/** Session act for the three-act flow. */
export type SessionAct = 'warmup' | 'engagement' | 'cooldown';

/** Duration of the warm-up act in seconds. */
export const WARMUP_DURATION = 30;

/** Idle duration before transitioning to cool-down. */
export const COOLDOWN_IDLE_THRESHOLD = 15;

// ── Energy-based phase system ─────────────────────────────────────────

/** State for the energy-driven phase system. */
export interface PhaseState {
  current: GamePhase;
  timer: number;
  crescendoEnergy: number;
  recentPops: number;
  popWindowTimer: number;
}

/**
 * Creates a new phase state starting in calm.
 * @returns Fresh PhaseState.
 */
export function createPhaseState(): PhaseState {
  return {
    current: 'calm',
    timer: 0,
    crescendoEnergy: 0,
    recentPops: 0,
    popWindowTimer: 0,
  };
}

/**
 * Records a pop event for energy tracking.
 * @param state - The phase state.
 */
export function recordPopForEnergy(state: PhaseState): void {
  state.recentPops++;
}

/**
 * Updates the energy-driven phase system.
 * @param state - Phase state (mutated in-place).
 * @param dt - Frame delta time.
 * @param effectiveDifficulty - Current effective difficulty.
 */
export function updatePhaseEnergy(state: PhaseState, dt: number, effectiveDifficulty: number): void {
  state.timer += dt;
  state.popWindowTimer += dt;

  // Compute pops-per-second from recent window (reset every second)
  let popsPerSecond = 0;
  if (state.popWindowTimer >= 1) {
    popsPerSecond = state.recentPops / state.popWindowTimer;
    state.recentPops = 0;
    state.popWindowTimer = 0;
  }

  // Energy builds with pops and decays naturally
  const energyGain = popsPerSecond * 0.1 * (1 + effectiveDifficulty);
  const energyDecay = 0.03 * dt;
  state.crescendoEnergy = clamp(state.crescendoEnergy + energyGain * dt - energyDecay, 0, 1);

  const calmDur = lerp(20, 8, effectiveDifficulty);
  const crescendoDur = lerp(8, 15, effectiveDifficulty);

  switch (state.current) {
    case 'calm':
      if (state.timer > calmDur && state.crescendoEnergy > 0.2) {
        state.current = 'building';
        state.timer = 0;
      }
      break;
    case 'building':
      if (state.crescendoEnergy > 0.7 && state.timer > 5) {
        state.current = 'crescendo';
        state.timer = 0;
      }
      if (state.crescendoEnergy < 0.1 && state.timer > 8) {
        state.current = 'calm';
        state.timer = 0;
      }
      break;
    case 'crescendo':
      if (state.timer > crescendoDur) {
        state.current = 'calm';
        state.timer = 0;
        state.crescendoEnergy = 0;
      }
      break;
  }
}

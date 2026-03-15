import { lerp } from '@app/minigames/shared/mathUtils';
import type { BubbleKind, GamePhase } from './types';

/**
 * Parameterized gameplay functions that replace static constants.
 * All functions take `effectiveDifficulty` (0–1) and optionally `phase`
 * to produce difficulty-scaled values.
 */

/**
 * Target active bubble count, scaled by effective difficulty.
 * @param ed - Effective difficulty (0–1).
 * @returns Target bubble count (5–20).
 */
export function targetBubbleCount(ed: number): number {
  if (ed < 0.3) return Math.round(lerp(20, 32, ed / 0.3));
  if (ed < 0.6) return Math.round(lerp(32, 56, (ed - 0.3) / 0.3));
  return Math.round(lerp(56, 80, (ed - 0.6) / 0.4));
}

/**
 * Spawn interval in seconds, scaled by effective difficulty.
 * @param ed - Effective difficulty (0–1).
 * @returns Spawn interval in seconds (1.2–0.5).
 */
export function spawnInterval(ed: number): number {
  return lerp(0.3, 0.12, ed);
}

/**
 * Bubble speed range for a given difficulty and phase.
 * @param ed - Effective difficulty (0–1).
 * @param phase - Current game phase.
 * @returns [min, max] speed in units/second.
 */
export function bubbleSpeedRange(ed: number, phase: GamePhase): [number, number] {
  const phaseMultiplier = phase === 'calm' ? 0.6 : phase === 'building' ? 0.85 : 1.0;
  const min = 0.15;
  const max = lerp(0.35, 1.0, ed) * phaseMultiplier;
  return [min, Math.max(min + 0.05, max)];
}

/**
 * Sway amplitude scaled by difficulty.
 * @param ed - Effective difficulty (0–1).
 * @returns Sway amplitude (0.3–0.8).
 */
export function swayAmplitude(ed: number): number {
  return lerp(0.3, 0.8, ed);
}

/**
 * Sway frequency scaled by difficulty.
 * @param ed - Effective difficulty (0–1).
 * @returns Sway frequency multiplier (0.8–1.6).
 */
export function swayFrequency(ed: number): number {
  return lerp(0.8, 1.6, ed);
}

/**
 * Chain pop radius scaled by difficulty and bubble density.
 * @param ed - Effective difficulty (0–1).
 * @param activeBubbleCount - Current active bubble count.
 * @returns Chain pop radius in world units.
 */
export function chainPopRadius(ed: number, activeBubbleCount: number): number {
  const baseRadius = lerp(2.0, 3.0, ed);
  const densityFactor = activeBubbleCount < 8 ? 1.3 : 1.0;
  return baseRadius * densityFactor;
}

/**
 * Giant bubble tap count scaled by player profile.
 * @param playerProfile - Player profile (0–1).
 * @returns Number of taps required (1–5).
 */
export function giantTapsRequired(playerProfile: number): number {
  if (playerProfile < 0.2) return 1;
  if (playerProfile < 0.4) return 2;
  if (playerProfile < 0.6) return 3;
  if (playerProfile < 0.8) return 4;
  return 5;
}

/**
 * Shower event interval (pops between showers).
 * @param ed - Effective difficulty (0–1).
 * @returns Number of pops between showers.
 */
export function showerInterval(ed: number): number {
  return Math.round(lerp(30, 15, ed));
}

/**
 * Shower bubble count, capped by headroom above target.
 * @param ed - Effective difficulty (0–1).
 * @param currentActive - Current active bubble count.
 * @param target - Target bubble count.
 * @returns Number of bubbles to spawn in the shower.
 */
export function showerCount(ed: number, currentActive: number, target: number): number {
  const headroom = Math.max(0, target + 4 - currentActive);
  const baseCount = Math.round(lerp(3, 10, ed));
  return Math.min(baseCount, headroom);
}

/**
 * Shower spawn stagger interval.
 * @param ed - Effective difficulty (0–1).
 * @returns Stagger interval in seconds (0.15–0.06).
 */
export function showerSpawnStagger(ed: number): number {
  return lerp(0.15, 0.06, ed);
}

// ── Phase-aware bubble kind probability tables ──────────────────────

interface KindProbabilities {
  giant: number;
  rainbow: number;
  golden: number;
}

const KIND_TABLES: Record<GamePhase, (ed: number) => KindProbabilities> = {
  calm: (ed) => ({
    giant: ed < 0.5 ? 0 : lerp(0, 0.02, (ed - 0.5) / 0.5),
    rainbow: ed < 0.25 ? 0 : lerp(0, 0.04, (ed - 0.25) / 0.75),
    golden: ed < 0.1 ? 0 : lerp(0.03, 0.08, (ed - 0.1) / 0.9),
  }),
  building: (ed) => ({
    giant: ed < 0.5 ? 0 : lerp(0, 0.04, (ed - 0.5) / 0.5),
    rainbow: ed < 0.2 ? 0 : lerp(0.02, 0.1, (ed - 0.2) / 0.8),
    golden: ed < 0.08 ? 0 : lerp(0.05, 0.15, (ed - 0.08) / 0.92),
  }),
  crescendo: (ed) => ({
    giant: ed < 0.4 ? 0 : lerp(0.02, 0.06, (ed - 0.4) / 0.6),
    rainbow: ed < 0.15 ? 0 : lerp(0.05, 0.15, (ed - 0.15) / 0.85),
    golden: lerp(0.08, 0.2, ed),
  }),
};

/**
 * Picks a bubble kind using phase-aware probability tables.
 * @param ed - Effective difficulty (0–1).
 * @param phase - Current game phase.
 * @returns The BubbleKind to spawn.
 */
export function pickBubbleKindBalanced(ed: number, phase: GamePhase): BubbleKind {
  const probs = KIND_TABLES[phase](ed);
  const roll = Math.random();
  let cumulative = 0;
  cumulative += probs.giant;
  if (roll < cumulative) return 'giant';
  cumulative += probs.rainbow;
  if (roll < cumulative) return 'rainbow';
  cumulative += probs.golden;
  if (roll < cumulative) return 'golden';
  return 'normal';
}

// ── Escalating milestone schedule ───────────────────────────────────

/** Milestone score thresholds — escalating to maintain excitement. */
const MILESTONE_SCHEDULE = [100, 300, 600, 1000, 1500];

/**
 * Returns the next milestone score threshold.
 * @param currentMilestoneIndex - How many milestones have been reached.
 * @param lastMilestoneScore - Score of the last reached milestone.
 * @returns The next milestone score.
 */
export function nextMilestoneScore(currentMilestoneIndex: number, lastMilestoneScore: number): number {
  if (currentMilestoneIndex < MILESTONE_SCHEDULE.length) {
    return MILESTONE_SCHEDULE[currentMilestoneIndex];
  }
  return lastMilestoneScore + 500;
}

import { lerp } from '@app/minigames/shared/mathUtils';
import type { BubbleKind, GamePhase } from './types';
import { MAX_FLOAT_SPEED, MIN_FLOAT_SPEED, VISIBLE_LIFE_FRACTION } from './types';

/**
 * Parameterized gameplay functions that replace static constants.
 * All functions take `effectiveDifficulty` (0–1) and optionally `phase`
 * to produce difficulty-scaled values.
 */

/**
 * Target active bubble count, scaled by effective difficulty.
 *
 * Sized from how many bubbles a child should *see*, then converted to the
 * active count the spawner and pool deal in. Only VISIBLE_LIFE_FRACTION = 0.77
 * of an active bubble's life is spent on screen (see types.ts for that
 * derivation — side-edge spawns start off the horizontal frame edge and only
 * drift inward some of the time).
 *
 *   easy (ed = 0): 10 on screen / 0.77 = 12.99 -> 13 active
 *   hard (ed = 1): 16 on screen / 0.77 = 20.78 -> 21 active
 *
 * It used to run 20 -> 80. `spawnBubble` short-circuits on this number, so the
 * cap (not the spawn rate) decided the crowd size, and 80 bubbles on a
 * 7-unit-tall frame is a wall, not a playfield.
 *
 * @param ed - Effective difficulty (0–1).
 * @returns Target active bubble count (13–21).
 */
export function targetBubbleCount(ed: number): number {
  return Math.round(lerp(10, 16, ed) / VISIBLE_LIFE_FRACTION);
}

/**
 * Spawn interval in seconds, scaled by effective difficulty.
 *
 * Chosen so the *natural* steady state sits just above `targetBubbleCount`
 * rather than many times over it. At equilibrium, active bubbles = spawn rate
 * x bubble lifetime, where lifetime is MEAN_TRAVEL_DISTANCE (7.08) divided by
 * the mean speed `bubbleSpeedRange` hands out at that difficulty. A 1.25x
 * margin keeps the field topped up against recycles the target hasn't yet
 * accounted for:
 *
 *   ed = 0 (band [0.60, 0.80], mean 0.70), target 13:
 *     lifetime 7.08 / 0.70 = 10.11 s
 *     rate     13 / 10.11 * 1.25 = 1.607 /s  ->  1 / 1.607 = 0.622  -> 0.62
 *   ed = 1, crescendo (band [1.00, 1.20], mean 1.10), target 21:
 *     lifetime 7.08 / 1.10 =  6.44 s
 *     rate     21 /  6.44 * 1.25 = 4.078 /s  ->  1 / 4.078 = 0.245  -> 0.25
 *
 * (Sized for the fastest phase, so in calm the field fills faster than it
 * drains and `targetBubbleCount` trims the surplus — the safe direction, since
 * the cap can only make the crowd smaller than intended, never emptier.)
 *
 * It was lerp(0.3, 0.12, ed): 3.33 spawns a second against a 10-second
 * lifetime is a steady state of 34 bubbles, well past the target, so most
 * spawn ticks did nothing but re-arm the timer.
 *
 * @param ed - Effective difficulty (0–1).
 * @returns Spawn interval in seconds (0.62–0.25).
 */
export function spawnInterval(ed: number): number {
  return lerp(0.62, 0.25, ed);
}

/**
 * Bubble rise-speed band for a given difficulty and phase, in units/second.
 *
 * A fixed-width window that slides from the floor of [MIN_FLOAT_SPEED,
 * MAX_FLOAT_SPEED] up to its ceiling as difficulty and phase energy rise, so
 * every bubble — at every difficulty, in every phase — stays inside the 6-12
 * second crossing target that fixed those two bounds:
 *
 *   span  = MAX_FLOAT_SPEED - MIN_FLOAT_SPEED = 1.2 - 0.6 = 0.6
 *   width = span / 3                                      = 0.2
 *   slide = span - width                                  = 0.4
 *
 *   ed 0, any phase: [0.60, 0.80] mean 0.70 -> 7.08 / 0.70 = 10.1 s to cross
 *   ed 1, calm:      [0.78, 0.98] mean 0.88 -> 7.08 / 0.88 =  8.0 s
 *   ed 1, building:  [0.90, 1.10] mean 1.00 -> 7.08 / 1.00 =  7.1 s
 *   ed 1, crescendo: [1.00, 1.20] mean 1.10 -> 7.08 / 1.10 =  6.4 s
 *
 * This used to hardcode its own `min = 0.15` and `max = lerp(0.35, 1.0, ed)`,
 * so MIN/MAX_FLOAT_SPEED never reached the speed a bubble actually got, and
 * the calm phase multiplied the max by 0.6 — a [0.15, 0.21] band at difficulty
 * 0, i.e. 34-39 seconds to cross the frame.
 *
 * @param ed - Effective difficulty (0–1).
 * @param phase - Current game phase.
 * @returns [min, max] speed in units/second.
 */
export function bubbleSpeedRange(ed: number, phase: GamePhase): [number, number] {
  // How far up the speed band each phase is allowed to reach at full
  // difficulty. Calm is still the slowest phase, but its floor is now
  // MIN_FLOAT_SPEED rather than a fraction of it.
  const phaseReach = phase === 'calm' ? 0.45 : phase === 'building' ? 0.75 : 1.0;
  const span = MAX_FLOAT_SPEED - MIN_FLOAT_SPEED;
  const width = span / 3;
  const min = MIN_FLOAT_SPEED + (span - width) * ed * phaseReach;
  return [min, min + width];
}

/**
 * NOT HERE, DELIBERATELY: sway and chain-pop reach are NOT difficulty-scaled.
 *
 * This file used to also export `swayAmplitude(ed)` (0.3 → 0.8),
 * `swayFrequency(ed)` (0.8 → 1.6) and `chainPopRadius(ed, n)` (2.0 → 3.0, x1.3
 * under 8 active). Nothing imported any of the three. The game ran, and still
 * runs, on three fixed constants — `SWAY_AMPLITUDE` 0.6, `SWAY_FREQUENCY` 1.2,
 * `CHAIN_POP_RADIUS` 2.5 — each sitting at or beside the midpoint of the curve
 * meant to replace it, which is what an unfinished swap looks like.
 *
 * That made them the exact defect the doctrine block in `types.ts` was written
 * to end, only pointing the other way. That block says balance questions are
 * answered by balance.ts — so a reader obeying it came here, found a documented
 * difficulty ramp for sway, and was wrong about the game.
 *
 * THE REPAIR WAS NOT TO WIRE THEM IN, AND THAT IS MEASURED, NOT ASSUMED.
 * `.probe/gameplay/r8-bubble-sway-lever.mjs` has the arithmetic:
 *
 *   - Sway is applied as a VELOCITY, not an offset — `updateBubbleMotion` does
 *     `x += sin(t*F + phase) * A * 0.3 * dt` — so the excursion is its integral,
 *     peak-to-peak `0.6 * A / F`, and it SHRINKS as frequency rises. The two
 *     curves raise A and F in lockstep, so A/F runs 0.375 → 0.5 → 0.5: the hard
 *     end of the ramp is arithmetically IDENTICAL to the constant already
 *     shipping, and the top half of the ramp changes nothing whatsoever.
 *   - The whole easy→hard ramp is worth 8.6 px of bubble travel at a phone
 *     portrait viewport. The smallest bubble is 46 px across, a tap already
 *     forgives 28 px of smear and reaches 70 px for proximity. The ramp is
 *     smaller than the slop, so no child can see it or act on it.
 *   - `chainPopRadius` IS perceptible — and points the wrong way. At ed = 0 with
 *     a normal 13-bubble field it returns 2.00 against today's 2.50, a 20% cut
 *     (57 px) in chain reach for the YOUNGEST player, which is backwards from
 *     every generosity rule this codebase holds.
 *
 * So one curve was a lever too small to feel and the other was a lever pulled
 * the wrong way. Both are gone rather than connected. Balance questions are
 * still answered here — but a curve that nothing imports answers nothing, and
 * is just the `types.ts` lie wearing this file's name.
 */

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

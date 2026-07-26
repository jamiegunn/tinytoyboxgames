/**
 * Turns a raw score into something a pre-reader can actually read.
 *
 * The HUD used to render the score as a bare Arabic numeral. The whole product
 * is aimed at a three-to-four-year-old who cannot read numbers, so the single
 * most prominent piece of feedback in every game was, to its actual audience,
 * a decorative squiggle that changed shape sometimes.
 *
 * The replacement is a counting display with no glyphs in it at all:
 *
 *   - a **pip** for each success (one popped bubble, one caught firefly);
 *   - every `PIPS_PER_BADGE` pips collapse into one **badge**;
 *   - every `BADGES_PER_CROWN` badges collapse into one **crown**.
 *
 * That is the same trick as tally marks or an abacus, and it works before
 * literacy: "my row is nearly full" and "I have three big ones" are both read
 * by shape, not by symbol. Three tiers cover 250 successes, well beyond a
 * sitting.
 *
 * This module is pure so the contract test can pin the arithmetic without a
 * DOM. See docs/reviews/minigame-teardown.md (defect 0.2).
 */

/** Pips shown in a full row before they collapse into a badge. */
export const PIPS_PER_BADGE = 5;

/** Badges shown before they collapse into a crown. */
export const BADGES_PER_CROWN = 10;

/** Crowns displayed before the display saturates. */
export const MAX_CROWNS = 5;

/**
 * How many points count as one success, derived from the game's difficulty
 * ramp rather than declared separately.
 *
 * `difficultyRamp.start` is defined in the manifest as "roughly six successes
 * in" — that is the rule used to pick every value there — so dividing by six
 * recovers the point value of one success without a second source of truth to
 * keep in sync. bubble-pop (start 60) yields 10, matching BUBBLE_POINTS.normal;
 * fireflies and star-catcher (start 5 and 4) yield 1, matching their per-catch
 * award.
 *
 * @param rampStart - The manifest's `difficultyRamp.start` for this game.
 * @returns Points per pip, always at least 1.
 */
export function pointsPerPip(rampStart: number): number {
  if (!Number.isFinite(rampStart) || rampStart <= 0) return 1;
  return Math.max(1, Math.round(rampStart / 6));
}

/** A score decomposed into the three visual tiers the HUD draws. */
export interface ScoreTally {
  /** Filled pips in the current, partial row (0 … PIPS_PER_BADGE - 1). */
  pips: number;
  /** Badges earned and not yet collapsed (0 … BADGES_PER_CROWN - 1). */
  badges: number;
  /** Crowns earned, capped at MAX_CROWNS. */
  crowns: number;
  /** True once the display has saturated and can no longer grow. */
  saturated: boolean;
}

/**
 * Decomposes a score into pips, badges, and crowns.
 *
 * @param score - The raw score from ScoreManager.
 * @param rampStart - The manifest's `difficultyRamp.start`, used for granularity.
 * @returns The tally the HUD renders.
 */
export function tallyScore(score: number, rampStart: number): ScoreTally {
  const successes = Math.max(0, Math.floor(score / pointsPerPip(rampStart)));

  const totalBadges = Math.floor(successes / PIPS_PER_BADGE);
  const crowns = Math.floor(totalBadges / BADGES_PER_CROWN);

  if (crowns >= MAX_CROWNS) {
    // Saturated: freeze at a full display rather than silently wrapping back to
    // an empty row, which would read to a child as losing everything.
    return { pips: PIPS_PER_BADGE, badges: BADGES_PER_CROWN, crowns: MAX_CROWNS, saturated: true };
  }

  return {
    pips: successes % PIPS_PER_BADGE,
    badges: totalBadges % BADGES_PER_CROWN,
    crowns,
    saturated: false,
  };
}

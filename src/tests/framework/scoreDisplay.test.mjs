/**
 * Score display contract test.
 *
 * The HUD used to show the score as a bare Arabic numeral to an audience that
 * cannot read numerals. `scoreDisplay.ts` replaces it with a three-tier
 * counting display (pips → badges → crowns). This suite pins the arithmetic,
 * because the failure mode is silent: a wrong divisor still renders a tidy row
 * of dots, it just counts the wrong thing.
 *
 * See docs/reviews/minigame-teardown.md (defect 0.2).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './_tsload.mjs';

const sd = await loadTs('src/minigames/framework/scoreDisplay.ts');
const { PIPS_PER_BADGE, BADGES_PER_CROWN, MAX_CROWNS, pointsPerPip, tallyScore } = sd;

// ── Granularity is derived from the manifest ramp, not declared twice ────────

test('pointsPerPip recovers each shipped game point value from its ramp start', () => {
  // The manifest picks difficultyRamp.start as "about six successes in", so
  // dividing by six must land back on the game's own per-success award.
  assert.equal(pointsPerPip(60), 10, 'bubble-pop: BUBBLE_POINTS.normal is 10');
  assert.equal(pointsPerPip(5), 1, 'fireflies: 1 point a catch');
  assert.equal(pointsPerPip(4), 1, 'little-shark / star-catcher: 1 point a catch');
  assert.equal(pointsPerPip(60), 10, 'cannonball-splash: SCORE_BARREL is 10');
});

test('pointsPerPip never returns zero or a negative, whatever it is fed', () => {
  for (const bad of [0, -1, -1000, NaN, Infinity, -Infinity]) {
    const value = pointsPerPip(bad);
    assert.ok(Number.isFinite(value) && value >= 1, `pointsPerPip(${bad}) = ${value}`);
  }
});

// ── The tally counts successes, and only ever grows ─────────────────────────

test('a fresh game shows an empty display', () => {
  assert.deepEqual(tallyScore(0, 5), { pips: 0, badges: 0, crowns: 0, saturated: false });
});

test('one success fills exactly one pip, at both granularities', () => {
  assert.equal(tallyScore(1, 5).pips, 1, 'fireflies: 1 point is one catch');
  assert.equal(tallyScore(10, 60).pips, 1, 'bubble-pop: 10 points is one pop');
  assert.equal(tallyScore(9, 60).pips, 0, 'bubble-pop: a partial pop cannot exist, so no pip');
});

test('a full pip row collapses into one badge and the row empties', () => {
  const justBefore = tallyScore(PIPS_PER_BADGE - 1, 1);
  assert.deepEqual([justBefore.pips, justBefore.badges], [PIPS_PER_BADGE - 1, 0]);

  const atBadge = tallyScore(PIPS_PER_BADGE, 1);
  assert.deepEqual([atBadge.pips, atBadge.badges], [0, 1], 'the fifth pip becomes a badge');
});

test('a full badge row collapses into one crown', () => {
  const perCrown = PIPS_PER_BADGE * BADGES_PER_CROWN;
  const atCrown = tallyScore(perCrown, 1);
  assert.deepEqual([atCrown.pips, atCrown.badges, atCrown.crowns], [0, 0, 1]);

  const justBefore = tallyScore(perCrown - 1, 1);
  assert.deepEqual([justBefore.pips, justBefore.badges, justBefore.crowns], [PIPS_PER_BADGE - 1, BADGES_PER_CROWN - 1, 0]);
});

test('the display saturates full rather than wrapping back to empty', () => {
  // Wrapping would read to a child as having lost everything they collected.
  const cap = PIPS_PER_BADGE * BADGES_PER_CROWN * MAX_CROWNS;
  for (const score of [cap, cap + 1, cap * 3]) {
    const tally = tallyScore(score, 1);
    assert.equal(tally.saturated, true, `score ${score} must report saturation`);
    assert.deepEqual([tally.pips, tally.badges, tally.crowns], [PIPS_PER_BADGE, BADGES_PER_CROWN, MAX_CROWNS]);
  }
});

test('total tokens are monotonic in score — the display never goes backwards', () => {
  // The property that matters to a three-year-old: collecting more must never
  // make the display show less. A naive modulo scheme breaks exactly here.
  const weight = (t) => t.crowns * PIPS_PER_BADGE * BADGES_PER_CROWN + t.badges * PIPS_PER_BADGE + t.pips;
  let previous = -1;
  for (let score = 0; score <= PIPS_PER_BADGE * BADGES_PER_CROWN * MAX_CROWNS + 20; score += 1) {
    const value = weight(tallyScore(score, 1));
    assert.ok(value >= previous, `score ${score}: display shrank from ${previous} to ${value}`);
    previous = value;
  }
});

test('a negative score cannot produce a negative display', () => {
  const tally = tallyScore(-50, 1);
  assert.deepEqual([tally.pips, tally.badges, tally.crowns], [0, 0, 0]);
});

test('every tier stays within the number of slots the HUD draws', () => {
  for (let score = 0; score < 400; score += 7) {
    const t = tallyScore(score, 1);
    assert.ok(t.pips >= 0 && t.pips <= PIPS_PER_BADGE, `pips out of range at ${score}`);
    assert.ok(t.badges >= 0 && t.badges <= BADGES_PER_CROWN, `badges out of range at ${score}`);
    assert.ok(t.crowns >= 0 && t.crowns <= MAX_CROWNS, `crowns out of range at ${score}`);
  }
});

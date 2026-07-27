// Contract tests for the little-shark feeding-frenzy arc.
//
// The arc exists because .probe/session.mjs measured the shipped loop as having
// no temporal structure at all -- phase z of -0.1 against a shuffled null where
// a build-and-payoff cycle scores +27.9, and a first-third-to-last-third
// divergence of 0.010 out of a possible 0.693. These tests pin the properties
// that make the module a cycle rather than a decoration, so a later refactor
// cannot quietly flatten it back out.

import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from '../framework/_tsload.mjs';

const M = await loadTs('src/minigames/games/little-shark/frenzy.ts');

const catchesTo = (state, n) => {
  const events = [];
  for (let i = 0; i < n; i += 1) {
    const e = M.registerFrenzyCatch(state);
    if (e) events.push(e);
  }
  return events;
};

test('a fresh session starts calm with the starting goal', () => {
  const s = M.createFrenzyState();
  assert.equal(s.phase, 'calm');
  assert.equal(s.catches, 0);
  assert.equal(s.goal, M.FRENZY_GOAL_START);
  assert.equal(s.cycle, 0);
});

test('the first catch starts the build', () => {
  const s = M.createFrenzyState();
  const e = M.registerFrenzyCatch(s);
  assert.equal(e?.phase, 'building');
  assert.equal(s.catches, 1);
});

test('anticipation starts FRENZY_BREWING_LEAD catches before the goal', () => {
  const s = M.createFrenzyState();
  catchesTo(s, M.FRENZY_GOAL_START - M.FRENZY_BREWING_LEAD - 1);
  assert.equal(s.phase, 'building');
  const e = M.registerFrenzyCatch(s);
  assert.equal(e?.phase, 'brewing');
});

test('reaching the goal fires the frenzy exactly once', () => {
  const s = M.createFrenzyState();
  const events = catchesTo(s, M.FRENZY_GOAL_START);
  const frenzies = events.filter((e) => e.phase === 'frenzy');
  assert.equal(frenzies.length, 1);
  assert.equal(s.phase, 'frenzy');
  assert.equal(s.cycle, 1);
  assert.equal(M.isFrenzyActive(s), true);
});

// The load-bearing one. If catches during the frenzy counted toward the next
// goal, the frenzy -- which is the part of the cycle where catching is easiest
// -- would immediately refill the meter and the game would collapse into one
// permanent frenzy. That would score WELL on a naive variety metric while
// destroying the very structure this module exists to create.
test('catches during the frenzy do not feed the next goal', () => {
  const s = M.createFrenzyState();
  catchesTo(s, M.FRENZY_GOAL_START);
  const banked = s.catches;
  for (let i = 0; i < 50; i += 1) assert.equal(M.registerFrenzyCatch(s), null);
  assert.equal(s.catches, banked);
  assert.equal(s.cycle, 1);
});

test('the frenzy ends on its own and the goal grows', () => {
  const s = M.createFrenzyState();
  catchesTo(s, M.FRENZY_GOAL_START);
  let e = null;
  for (let t = 0; t < M.FRENZY_DURATION + 0.1; t += 1 / 30) e = M.updateFrenzy(s, 1 / 30) ?? e;
  assert.equal(s.phase, 'afterglow');
  for (let t = 0; t < M.FRENZY_AFTERGLOW + 0.1; t += 1 / 30) M.updateFrenzy(s, 1 / 30);
  assert.equal(s.phase, 'calm');
  assert.equal(s.catches, 0);
  assert.equal(s.goal, M.FRENZY_GOAL_START + M.FRENZY_GOAL_STEP);
});

test('the goal is capped so late cycles stay reachable in one sitting', () => {
  const s = M.createFrenzyState();
  for (let cycle = 0; cycle < 20; cycle += 1) {
    catchesTo(s, s.goal);
    for (let t = 0; t < M.FRENZY_DURATION + M.FRENZY_AFTERGLOW + 0.2; t += 1 / 30) M.updateFrenzy(s, 1 / 30);
  }
  assert.equal(s.goal, M.FRENZY_GOAL_MAX);
});

test('intensity rises to 1 across the build and drains across the afterglow', () => {
  const s = M.createFrenzyState();
  assert.equal(M.frenzyIntensity(s), 0);
  catchesTo(s, M.FRENZY_GOAL_START - 1);
  const mid = M.frenzyIntensity(s);
  assert.ok(mid > 0 && mid < 1, `expected a partial meter, got ${mid}`);
  M.registerFrenzyCatch(s);
  assert.equal(M.frenzyIntensity(s), 1);
  for (let t = 0; t < M.FRENZY_DURATION + 0.1; t += 1 / 30) M.updateFrenzy(s, 1 / 30);
  // Now in afterglow: the meter must fall rather than snap to empty.
  const a = M.frenzyIntensity(s);
  for (let t = 0; t < M.FRENZY_AFTERGLOW / 2; t += 1 / 30) M.updateFrenzy(s, 1 / 30);
  const b = M.frenzyIntensity(s);
  assert.ok(b < a, `expected the meter to drain, got ${a} then ${b}`);
  assert.ok(b >= 0);
});

// No fail state: the payoff must be reachable from any state by playing, with
// no timer that can expire and no way to lose banked progress.
test('progress is never lost by waiting', () => {
  const s = M.createFrenzyState();
  catchesTo(s, 3);
  const banked = s.catches;
  for (let t = 0; t < 600; t += 1 / 30) M.updateFrenzy(s, 1 / 30);
  assert.equal(s.catches, banked);
  assert.equal(M.isFrenzyActive(s), false);
});

// `frenzyGather` drives how hard the ambient reef converges on the shark, and
// .probe/session.mjs feeds it straight into the real `updateAmbientCreatures`.
// A value outside [0, 1] there does not throw — it silently overdrives the turn
// rate and speed gain, which is exactly the class of covert motion change that
// already cost this project one failed fix. Hence a range assertion on every
// reachable phase rather than only on the interesting ones.
test('gather stays inside [0, 1] through a whole cycle', () => {
  const s = M.createFrenzyState();
  const seen = new Set();
  for (let step = 0; step < 4000; step += 1) {
    seen.add(s.phase);
    const g = M.frenzyGather(s);
    assert.ok(g >= 0 && g <= 1, `gather ${g} out of range in phase ${s.phase}`);
    if (step % 37 === 0) M.registerFrenzyCatch(s);
    M.updateFrenzy(s, 1 / 30);
  }
  for (const phase of ['calm', 'building', 'brewing', 'frenzy', 'afterglow']) {
    assert.ok(seen.has(phase), `phase ${phase} never reached, so it was never range-checked`);
  }
});

// The whole point of the separate curve: the reef must stay visibly calm through
// the early catches so that closing in MEANS something. A linear gather would
// have the reef already half-converged at the halfway point, which is where the
// meter is supposed to be doing the talking.
test('gather is quieter than the meter during the build', () => {
  const s = M.createFrenzyState();
  M.registerFrenzyCatch(s);
  const half = Math.floor(M.FRENZY_GOAL_START / 2);
  catchesTo(s, half - 1);
  const i = M.frenzyIntensity(s);
  const g = M.frenzyGather(s);
  assert.ok(i > 0.3 && i < 0.7, `expected a mid-build meter, got ${i}`);
  assert.ok(g < i / 1.5, `expected the reef to lag the meter, got gather ${g} vs meter ${i}`);
});

test('gather reaches full only at the frenzy and drains with the afterglow', () => {
  const s = M.createFrenzyState();
  catchesTo(s, M.FRENZY_GOAL_START);
  assert.equal(s.phase, 'frenzy');
  assert.equal(M.frenzyGather(s), 1);
  for (let t = 0; t < M.FRENZY_DURATION + 0.1; t += 1 / 30) M.updateFrenzy(s, 1 / 30);
  const a = M.frenzyGather(s);
  for (let t = 0; t < M.FRENZY_AFTERGLOW / 2; t += 1 / 30) M.updateFrenzy(s, 1 / 30);
  assert.ok(M.frenzyGather(s) < a, 'the reef must disperse rather than snap back');
});

// A fresh session must not start with the reef already swirling: gather is the
// signal that the child caused something, so it has to read zero before they
// have done anything.
test('a fresh state gathers nothing', () => {
  assert.equal(M.frenzyGather(M.createFrenzyState()), 0);
});

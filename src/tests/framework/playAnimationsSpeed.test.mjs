/**
 * `PlayAnimationOptions.speed` must actually change the playback rate.
 *
 * THE DEFECT THIS EXISTS TO STOP, WHICH TYPE-CHECKED AND READ AS WORKING.
 * `playAnimations` built its timeline as
 *
 *   gsap.timeline({ repeat, timeScale: speed, onComplete })
 *
 * and gsap's timeline constructor does not read `timeScale` out of its config.
 * It drops it silently — no throw, no warning, no console noise. Measured:
 * `gsap.timeline({ timeScale: 4 }).timeScale()` returns 1, while the same
 * timeline after `tl.timeScale(4)` returns 4.
 *
 * So `speed` was a documented, exported, fully type-checked option on a helper
 * used across the scene layer, and it did nothing. Zero call sites passed it,
 * which is the only reason it had not yet shipped as a visible bug — the first
 * person to write `speed: 2` would have got a normal-speed animation, an
 * option name that says otherwise, a JSDoc line that says otherwise, and no
 * error anywhere to explain the disagreement.
 *
 * HOW SPEED IS OBSERVED HERE, AND WHY NOT VIA `totalDuration()`. A gsap
 * timeline's own `duration()` and `totalDuration()` are stated in its LOCAL
 * time and do not shrink when it is sped up; `timeScale` changes the mapping
 * from parent time to local time. So the honest measurement is to advance the
 * PARENT clock by a fixed amount and read how far the animated Object3D got.
 * That is what these tests do. An implementation that stored `speed` somewhere
 * without affecting playback would satisfy a `timeScale()` reading and still
 * fail here.
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { Object3D } from 'three';
import gsap from 'gsap';
import { bundleTs } from './_tsload.mjs';

const AH = await bundleTs('src/utils/animationHelpers.ts');

// The global timeline must only move when this file moves it, or the readings
// below race the ticker. `_tsload.mjs` keeps gsap external so this reaches the
// same ticker the helper's timelines are attached to.
gsap.ticker.sleep();

after(() => {
  gsap.globalTimeline.clear();
  gsap.ticker.sleep();
});

/** A one-second 0 → 1 ramp on `position.y`, at the helper's default 60fps. */
const RAMP = [
  { frame: 0, value: 0 },
  { frame: 60, value: 1 },
];

/**
 * Plays the ramp on a fresh target, advances the parent clock by `parentSecs`
 * of wall time, and returns how far the target actually travelled.
 *
 * The helper returns void, so nothing here can assert against a timeline the
 * test built — only against the real Object3D the real helper wrote to.
 */
function travelled(opts, parentSecs) {
  const target = new Object3D();
  AH.playAnimations(target, [{ property: 'position.y', keys: RAMP }], opts);
  const gt = gsap.globalTimeline;
  gt.time(gt.time() + parentSecs);
  const y = target.position.y;
  gt.clear();
  return y;
}

const near = (a, b) => Math.abs(a - b) < 1e-6;

test('speed: 2 puts the animated value twice as far along in the same wall time', () => {
  const normal = travelled({}, 0.25);
  const fast = travelled({ speed: 2 }, 0.25);

  assert.ok(near(normal, 0.25), `default speed should be a quarter through a 1s ramp after 0.25s, got ${normal}`);
  assert.ok(near(fast, 0.5), `speed 2 should be half through a 1s ramp after 0.25s, got ${fast} — the playback rate is unchanged`);
});

test('speed: 0.5 slows playback, so the fix is not a hardcoded doubling', () => {
  const slow = travelled({ speed: 0.5 }, 0.5);

  assert.ok(near(slow, 0.25), `speed 0.5 should be a quarter through a 1s ramp after 0.5s, got ${slow}`);
});

test('omitting speed leaves playback at 1, so the untouched default path still works', () => {
  assert.ok(near(travelled(undefined, 0.75), 0.75), 'a 1s ramp with no options should be three quarters done after 0.75s');
});

test('speed reaches the end of the animation early, not just the middle faster', () => {
  // Guards the case where a wrong fix scales the first segment only: after 0.6s
  // of wall clock a doubled 1s ramp is finished and clamped at its last key.
  const done = travelled({ speed: 2 }, 0.6);

  assert.ok(near(done, 1), `speed 2 should have finished a 1s ramp by 0.6s of wall clock, got ${done}`);
});

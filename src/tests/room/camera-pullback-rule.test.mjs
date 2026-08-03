/**
 * The portrait pull-back rule — properties, not a table of expected values.
 *
 * WHAT THE RULE IS FOR
 * --------------------
 * Every scene framing is authored at one aspect. On a narrower viewport the same
 * camera distance shows less of the world horizontally, so `createSceneCamera`
 * moves the camera back. `distanceMultiplierForAspect` is the single source of
 * that rule; `radiusForAspect`, `resolveSceneCameraPose`, the initial `Spherical`
 * and `recenter` all read it.
 *
 * WHY IT NEEDED A TEST OF ITS OWN
 * -------------------------------
 * The rule shipped as `aspect < 1 ? (1 / aspect) * 0.75 : 1` and was wrong over
 * a third of the domain it is called with. Nobody noticed, for two reasons that
 * are worth writing down because they will recur.
 *
 * First, every scene that could have exposed it was masked. A preset with
 * `maxDistance` equal to its own `distance` — pirate-cove has both at 10 —
 * clamps the pull-back to zero at every aspect, so the camera sits at exactly
 * the same radius no matter what the multiplier says. The rule was effectively
 * dead code in the one scene anybody screenshotted.
 *
 * Second, the test that came closest to covering it carried its own inline copy
 * of the expression, so it agreed with the bug.
 *
 * The three defects, all measured in `.probe/pullback-rule.mjs`:
 *
 *   aspect  |  old multiplier  |  what it did
 *   --------|------------------|---------------------------------
 *   0.7500  |  1.0000          |  nothing, on an iPad in portrait
 *   0.8000  |  0.9375          |  pushed the camera IN by 6.3%
 *   0.9900  |  0.7576          |  pushed the camera IN by 24.2%
 *   0.9990  |  0.7508          |  pushed the camera IN by 24.9%
 *   1.0000  |  1.0000          |  jumped 33.2% for a 0.1% aspect change
 *
 * A rule named "pull back on narrow viewports" that moves the camera closer on a
 * near-square viewport is not a tuning question. These assertions are stated as
 * properties so that the next person to adjust the constant cannot reintroduce
 * the shape of the bug while changing its numbers.
 *
 * THE RULE IS NOW INERT, AND THAT IS ASSERTED RATHER THAN ASSUMED
 * ---------------------------------------------------------------
 * Letterboxing the stage (see `src/utils/scene/stageRect.ts`) means the camera
 * is never given an aspect below 1.0, and the reference aspect is 0.75, so
 * `distanceMultiplierForAspect` returns exactly 1 for every aspect the app can
 * reach. It fires nowhere.
 *
 * Kept rather than deleted, for one reason: the stage band is a decision that
 * could be revisited — widening the set, or moving the living room's toyboxes
 * off the walls, would let the floor drop below 0.75 and wake this rule up. The
 * final test in this file pins the inertness, so that the day the band moves,
 * something says out loud that a dormant camera rule has started firing again
 * rather than leaving it to be discovered on a phone.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { bundleEntry } from '../framework/_tsload.mjs';

const { distanceMultiplierForAspect, PULLBACK_REFERENCE_ASPECT, MIN_STAGE_ASPECT, MAX_STAGE_ASPECT } = await bundleEntry(
  'camera-pullback-rule',
  `
  export { distanceMultiplierForAspect, PULLBACK_REFERENCE_ASPECT } from './src/utils/cameraPresets';
  export { MIN_STAGE_ASPECT, MAX_STAGE_ASPECT } from './src/utils/scene/stageRect';
`,
);

// 0.4 is the narrowest aspect any scene is asked to survive; 3.0 is wider than
// any real display. Sampled finely enough to catch a discontinuity the width of
// the one that used to sit at a = 1.
const SAMPLES = [];
for (let a = 0.4; a <= 3.0001; a += 0.001) {
  SAMPLES.push(Math.round(a * 1000) / 1000);
}

test('the pull-back never pulls the camera in', () => {
  // The whole purpose of the rule. The old version violated this for every
  // aspect in (0.75, 1), by up to 25%.
  let worst = null;
  for (const a of SAMPLES) {
    const m = distanceMultiplierForAspect(a);
    if (m < 1 - 1e-12 && (!worst || m < worst.m)) {
      worst = { a, m };
    }
  }
  assert.equal(
    worst,
    null,
    worst &&
      `aspect ${worst.a} yields multiplier ${worst.m.toFixed(4)} — the camera moves ${((1 - worst.m) * 100).toFixed(1)}% CLOSER on a viewport the rule exists to pull back from`,
  );
});

test('the pull-back is monotone non-increasing in aspect', () => {
  // A wider viewport must never need more pull-back than a narrower one. The old
  // rule broke this at a = 1, where the multiplier rose from 0.7508 to 1.0000.
  let worst = null;
  for (let i = 1; i < SAMPLES.length; i++) {
    const prev = distanceMultiplierForAspect(SAMPLES[i - 1]);
    const curr = distanceMultiplierForAspect(SAMPLES[i]);
    const rise = curr - prev;
    if (rise > 1e-12 && (!worst || rise > worst.rise)) {
      worst = { from: SAMPLES[i - 1], to: SAMPLES[i], prev, curr, rise };
    }
  }
  assert.equal(
    worst,
    null,
    worst &&
      `multiplier RISES from ${worst.prev.toFixed(4)} to ${worst.curr.toFixed(4)} as aspect widens from ${worst.from} to ${worst.to} — a wider viewport is being pulled back further than a narrower one`,
  );
});

test('the pull-back is continuous — no step change from an imperceptible resize', () => {
  // The old rule jumped 33.2% between a = 0.999 and a = 1.000: a window dragged
  // one pixel wider teleported the camera. A 0.1% change in aspect may not move
  // the camera more than 1%.
  let worst = null;
  for (let i = 1; i < SAMPLES.length; i++) {
    const prev = distanceMultiplierForAspect(SAMPLES[i - 1]);
    const curr = distanceMultiplierForAspect(SAMPLES[i]);
    const step = Math.abs(curr - prev) / prev;
    if (step > 0.01 && (!worst || step > worst.step)) {
      worst = { from: SAMPLES[i - 1], to: SAMPLES[i], step };
    }
  }
  assert.equal(worst, null, worst && `multiplier jumps ${(worst.step * 100).toFixed(1)}% between aspect ${worst.from} and ${worst.to}`);
});

test('the pull-back holds the authored world width on screen below the reference aspect', () => {
  // The rule's actual job, stated as the invariant it is derived from: the
  // visible world half-width `d * aspect * tan(fov/2)` must not shrink as the
  // viewport narrows past the reference. Expressed as `multiplier * aspect`,
  // which must stay at least the reference aspect.
  for (const a of SAMPLES.filter((s) => s <= PULLBACK_REFERENCE_ASPECT)) {
    const widthFactor = distanceMultiplierForAspect(a) * a;
    assert.ok(
      widthFactor >= PULLBACK_REFERENCE_ASPECT - 1e-9,
      `at aspect ${a} the visible world width factor is ${widthFactor.toFixed(4)}, below the authored ${PULLBACK_REFERENCE_ASPECT} — the scene is cropped`,
    );
  }
});

test('the pull-back is exactly 1 at and above the reference aspect', () => {
  // Landscape and tablet framings are authored directly; the rule must not touch
  // them. This is also what makes the reference constant meaningful rather than
  // a magic number.
  for (const a of SAMPLES.filter((s) => s >= PULLBACK_REFERENCE_ASPECT)) {
    assert.equal(distanceMultiplierForAspect(a), 1, `aspect ${a} is at or above the reference ${PULLBACK_REFERENCE_ASPECT} but is being scaled`);
  }
});

test('the pull-back agrees with the superseded rule on the half of the domain where it was right', () => {
  // The old expression was correct on (0, 0.75]: below the reference aspect it
  // is the same `0.75 / a` curve. Pinning that agreement documents that this
  // change is a repair of the broken half, not a re-tuning of the whole rule —
  // no shipping portrait device moved.
  for (const a of SAMPLES.filter((s) => s <= PULLBACK_REFERENCE_ASPECT)) {
    const superseded = (1.0 / a) * 0.75;
    assert.ok(
      Math.abs(distanceMultiplierForAspect(a) - superseded) < 1e-12,
      `at aspect ${a} the new rule gives ${distanceMultiplierForAspect(a)} where the old gave ${superseded} — portrait framing has moved, which this change was not meant to do`,
    );
  }
});

test('the reference aspect itself receives a pull-back at every narrower aspect', () => {
  // The old rule was the identity at exactly a = 0.75 and at a = 1, so an iPad
  // in portrait — the device class the rule exists for — got nothing. Anything
  // strictly narrower than the reference must move the camera strictly back.
  for (const a of [0.749, 0.7, 0.5625, 0.461, 0.45, 0.4]) {
    assert.ok(distanceMultiplierForAspect(a) > 1, `aspect ${a} is narrower than the reference but receives no pull-back`);
  }
  assert.equal(distanceMultiplierForAspect(PULLBACK_REFERENCE_ASPECT), 1);
});

test('the rule is inert across the whole stage band, and something says so if that changes', () => {
  // Not a claim that the pull-back is right; a claim that it currently does
  // NOTHING, because the letterbox never hands it an aspect below its reference.
  // If the stage floor is ever lowered past PULLBACK_REFERENCE_ASPECT this fails,
  // which is the moment to decide whether the rule should be revived or removed.
  assert.ok(
    MIN_STAGE_ASPECT >= PULLBACK_REFERENCE_ASPECT,
    `the stage floor ${MIN_STAGE_ASPECT} is now below the pull-back reference ${PULLBACK_REFERENCE_ASPECT}: a camera rule that has not run since letterboxing landed is live again, and no scene framing was solved with it running`,
  );
  for (let a = MIN_STAGE_ASPECT; a <= MAX_STAGE_ASPECT + 1e-9; a += 0.001) {
    assert.equal(distanceMultiplierForAspect(a), 1, `aspect ${a.toFixed(3)} inside the stage band still receives a pull-back`);
  }
});

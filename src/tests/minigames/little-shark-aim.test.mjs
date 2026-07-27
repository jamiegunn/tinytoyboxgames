/**
 * little-shark aiming contract test — a tap must mean something.
 *
 * Round 2 stopped the shark scoring while nobody was touching it. This pins the
 * next layer down: the shark must not score when the touch meant nothing.
 *
 * The defect. `findFishNearTap` projects every active fish to screen space and
 * returns the nearest within FISH_TAP_SNAP_RADIUS_PX; `chaseFish` then eats it
 * immediately. There is no physics in the tap path, so P(a tap scores) is purely
 * P(some fish projects within the snap radius of the tap point). At the old
 * 220 px — 18% of the canvas width — against the 14-18 fish round 1 introduced,
 * a probe tapping uniformly random points scored 70% (14/20), and a geometric
 * model built from measured fish centroids predicted 71.9% for that same
 * experiment. Model and game agree to two points, so the model is trustworthy.
 *
 * The rule learnable from a 72% random-tap rate is "touch the screen", not
 * "touch the fish".
 *
 * What the constants optimise is the GAP:
 *
 *     gap = P(hit | the child aimed at a fish) - P(hit | the child poked anywhere)
 *
 * with aiming error a Gaussian of sigma = 65 px (12 mm at 1200 px / 22 cm =
 * 5.45 px/mm, the accuracy preschool touch runs to). Sweep:
 *
 *     snap   aimed   random    gap
 *      220   0.999    0.719   0.280   <- was
 *      170   0.991    0.600   0.391
 *      140   0.965    0.474   0.481
 *      120   0.906    0.384   0.522   <- here
 *      100   0.818    0.302   0.515
 *       80   0.656    0.207   0.449
 *
 * The gap turns over just under 120, and 120 px is 22 mm of radius — at the
 * 23-25 mm ergonomic floor for a preschool hit target. So the band asserted
 * below is bounded above by the gap curve and below by the child's finger.
 *
 * STANDARD_FISH_SCALE ships with it because aiming is only worth doing if there
 * is something findable to aim at. Differential rendering — four arms, twelve
 * settled frames each, salience measured as connected regions >12 dE from a
 * 48 px box-median local background — decomposes the frame into 5,103 px of
 * decorative ambient life, 3,827 px of fish at 0.55, and 29,082 px of scenery.
 * The fish owned 10.1% of the salient pixels; 0.70 takes them to 27.4%.
 *
 * The gain is 3.37x rather than the 1.62x that scaling an area predicts, because
 * detected fish per frame rise 9.4 -> 15.9: at 0.55 roughly half the fish on
 * screen never cleared the detection floor at all. Scaling recruits them.
 *
 * These are contract tests, not behavioural ones: they exist so that a later
 * edit that quietly restores a wide snap radius, or re-forks the fish scale into
 * per-file literals, fails loudly with the reasoning attached.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadTs } from '../framework/_tsload.mjs';

const read = (rel) => readFileSync(new URL(`../../src/minigames/games/little-shark/${rel}`, import.meta.url), 'utf8');

const orchestrator = read('index.ts');
const types = await loadTs('src/minigames/games/little-shark/types.ts');

test('the tap snap radius stays inside the band the gap sweep and the finger allow', () => {
  const m = orchestrator.match(/const FISH_TAP_SNAP_RADIUS_PX = (\d+(?:\.\d+)?);/);
  assert.ok(m, 'FISH_TAP_SNAP_RADIUS_PX is no longer a plain numeric constant');
  const snap = Number(m[1]);

  assert.ok(
    snap <= 140,
    `snap radius ${snap} px exceeds 140. At 220 a random poke scored 72% and the learnable rule collapsed to "touch the screen"; above 140 the gap between aiming and poking falls below 0.48.`,
  );
  assert.ok(
    snap >= 100,
    `snap radius ${snap} px is below 100. At 1200 px / 22 cm that is under 18 mm, inside the 23-25 mm floor for a preschool hit target, and the gap curve has already turned over — aimed taps start failing faster than random ones do.`,
  );
});

test('the snap radius is justified in place, not just set', () => {
  // The number is only defensible with its sweep attached. If someone changes
  // it, they have to confront the table.
  const block = orchestrator.slice(0, orchestrator.indexOf('const FISH_TAP_SNAP_RADIUS_PX'));
  const comment = block.slice(block.lastIndexOf('\n\n'));
  assert.match(comment, /gap/i, 'the snap radius lost the gap rationale that chose it');
});

test('a standard fish is scaled to hold its share of the frame', () => {
  const s = types.STANDARD_FISH_SCALE;
  assert.equal(typeof s, 'number');
  assert.ok(
    s >= 0.66,
    `fish scale ${s} is below 0.66. At 0.55 only 9.4 fish per frame cleared the salience floor and they owned 10.1% of the frame's salient pixels — roughly half the fish on screen were not visible objects at all. The thing the child is now asked to aim at has to be findable.`,
  );
  assert.ok(
    s <= 0.8,
    `fish scale ${s} exceeds 0.80. Past ~0.85 the fish read as small sharks and the shark stops being the biggest thing in the reef, which is the toy's whole premise.`,
  );
});

test('every live fish-scale site reads the constant — the literal forked three ways once already', () => {
  // 0.55 was written in lifecycle.ts twice and effects.ts once. Any one of them
  // could have been changed alone, and a fish would have snapped size mid-
  // despawn with nothing failing.
  for (const rel of ['fish/lifecycle.ts', 'fish/effects.ts']) {
    const src = read(rel);
    assert.match(src, /STANDARD_FISH_SCALE/, `${rel} no longer references STANDARD_FISH_SCALE`);
    assert.doesNotMatch(
      src,
      /scale\.setScalar\(\s*0\.\d+\s*\)/,
      `${rel} sets a fish scale from a bare literal again — that is the three-copy drift this constant exists to prevent`,
    );
  }
});

test('the despawn animation shrinks from the same size the fish was spawned at', () => {
  // If these two ever disagree the fish visibly pops to a different size the
  // instant it is eaten, at exactly the moment the child is looking at it.
  const effects = read('fish/effects.ts');
  const base = effects.match(/const baseScale = [^;]+;/);
  assert.ok(base, 'updateDespawnAnimation no longer computes a baseScale');
  assert.match(
    base[0],
    /STANDARD_FISH_SCALE/,
    'the despawn base scale diverged from the spawn scale — an eaten fish will jump size on the first frame of its reward animation',
  );
});

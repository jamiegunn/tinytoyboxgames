/**
 * little-shark agency contract test — the child must be the cause.
 *
 * This pins the one invariant that, when it broke, made the whole game
 * meaningless without anything looking wrong: the shark scored on its own.
 *
 * The measurement that motivated it: a probe that loaded the game and then
 * touched nothing at all scored 24 out of 24 sampling slots, gaining 72 points
 * in 60 seconds and scoring in 49% of every one-second interval. The reef fed
 * the shark faster than a three-year-old could poke it, which means the poking
 * was decorative and the contingency a toddler is supposed to learn — I touch
 * it, it happens — was not there to learn.
 *
 * Two independent mechanisms fed it and the fix needs both halves, so both are
 * pinned here:
 *
 *   1. Idle drift. The shark orbits a 3x3 figure-eight while `spawnNearShark`
 *      aims every replacement fish 2-8 units from it — the same instruction as
 *      "aim at the middle of the screen", because the camera looks at the shark.
 *      Fish were delivered to a permanently open mouth.
 *   2. The auto-hunt. The shark picks its own target and lunges at it. This one
 *      defeated the first attempt at a fix, which asked whether the shark was
 *      moving fast enough to be under a finger: an auto-hunt has exactly the
 *      speed and animation of a player lunge, so the kinematic test passed and
 *      the idle score rate did not move (72 -> 81 points/min, i.e. noise).
 *
 * So the gate is `isPlayerDriven(state) && !autoHuntActive` — a kinematic test
 * AND a provenance test. Neither is sufficient alone, which is why the
 * structural assertions below insist on both terms rather than just on the
 * presence of some gate.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bundleTs } from '../framework/_tsload.mjs';

const m = await bundleTs('src/minigames/games/little-shark/shark/movement.ts');
const w = await bundleTs('src/minigames/games/little-shark/waves.ts');

const idle = () => m.createSharkMoveState();

test('a shark nobody is touching is not player-driven', () => {
  const s = idle();
  assert.equal(m.isPlayerDriven(s), false);
});

test('idle drift can never reach the speed threshold', () => {
  // The drift target is (cx + 1.5 sin p, cz + 1.5 sin 2p) at p' = 0.4 rad/s, so
  // its speed peaks at 1.5 * 0.4 * sqrt(5) = 1.3416. Run the real drift for a
  // full period and assert nothing ever crosses the gate.
  const s = idle();
  let peak = 0;
  for (let i = 0; i < 2000; i += 1) {
    m.updateIdleDrift(s, 1 / 60);
    peak = Math.max(peak, m.getSpeed(s));
    assert.equal(m.isPlayerDriven(s), false, `drift became player-driven at step ${i}`);
  }
  assert.ok(peak < 1.35, `idle drift peaked at ${peak.toFixed(3)}, above the analytic bound 1.342`);
  assert.ok(peak > 0.5, `drift barely moved (${peak.toFixed(3)}) — the test is not exercising anything`);
});

test('a dragged shark is player-driven', () => {
  const s = idle();
  s.isBeingDragged = true;
  assert.equal(m.isPlayerDriven(s), true);
});

test('a lunging shark is player-driven', () => {
  const s = idle();
  m.startLunge(s, 5, 5, 6);
  assert.notEqual(s.swimPhase, 'idle');
  assert.equal(m.isPlayerDriven(s), true);
});

test('the glide out of a release stays player-driven', () => {
  // A release hands the shark real velocity and clears the drag flag, so only
  // the speed term can catch it. If this regresses, a child who flicks the
  // shark at a fish gets nothing for it.
  const s = idle();
  s.isBeingDragged = true;
  s.velX = 5;
  s.velZ = 0;
  m.releaseDrag(s);
  assert.equal(s.isBeingDragged, false);
  assert.equal(s.swimPhase, 'idle', 'release does not start a swim — only the speed term can catch this');
  assert.equal(m.isPlayerDriven(s), true);
});

const fx = await bundleTs('src/minigames/games/little-shark/fish/effects.ts');

test('escapeFromShark puts real distance between fish and shark', () => {
  const fish = { root: { position: { x: 0.2, y: 0, z: -0.1 } }, driftCenterX: 0, driftCenterZ: 0 };
  fx.escapeFromShark(fish, 0, 0);
  const d = Math.hypot(fish.root.position.x, fish.root.position.z);
  assert.ok(d > 2.0, `fish escaped only ${d.toFixed(2)} units — still inside the hit radius region`);
  assert.equal(fish.driftCenterX, fish.root.position.x, 'drift centre must follow, or the spring reels it back in');
  assert.equal(fish.driftCenterZ, fish.root.position.z);
});

test('escapeFromShark survives a fish exactly on top of the shark', () => {
  // Degenerate case: zero separation gives no outward direction to normalise.
  const fish = { root: { position: { x: 0, y: 0, z: 0 } }, driftCenterX: 0, driftCenterZ: 0 };
  fx.escapeFromShark(fish, 0, 0);
  const d = Math.hypot(fish.root.position.x, fish.root.position.z);
  assert.ok(Number.isFinite(d) && d > 2.0, `degenerate case produced ${d}`);
});

const orchestrator = readFileSync(new URL('../../src/minigames/games/little-shark/index.ts', import.meta.url), 'utf8');

test('the harvest gate requires BOTH the kinematic and the provenance term', () => {
  const gate = orchestrator.match(/const canHarvest = ([^;]+);/);
  assert.ok(gate, 'the collision harvest is no longer gated by a `canHarvest` expression');
  assert.match(gate[1], /isPlayerDriven\(sharkMove\)/, 'lost the kinematic term — idle drift will harvest again');
  assert.match(gate[1], /!autoHuntActive/, 'lost the provenance term — the auto-hunt will harvest again');
});

test('the auto-hunt records that it, and not the child, started the hunt', () => {
  assert.match(orchestrator, /autoHuntActive = true;\s*\n\s*triggerHunt\(/, 'maintainAutoHunt must flag its own hunts before triggering them');
});

test('a tap hands ownership of the next catch back to the child', () => {
  const start = orchestrator.indexOf('function chaseFish(');
  assert.notEqual(start, -1, 'chaseFish not found');
  const body = orchestrator.slice(start, orchestrator.indexOf('function eatFishAction(', start));
  assert.ok(body.length > 0 && body.length < 2000, `chaseFish body sliced oddly (${body.length} chars)`);
  assert.match(body, /autoHuntActive = false/, 'a tap must clear the auto-hunt flag');
});

test('the flag drops whenever no hunt is in flight', () => {
  // Without this the flag latches true after the first auto-hunt and the child
  // permanently loses the drag-into-fish catch.
  //
  // Matched as a block rather than as one line: the idle branch now also arms
  // the inter-hunt cooldown, and pinning the exact one-line form made a test
  // that failed on a change it did not care about.
  const idle = orchestrator.match(/if \(getHuntPhase\(huntState\) === 'idle'\) \{([\s\S]*?)\n {4}\}/);
  assert.ok(idle, 'the idle branch of maintainAutoHunt is gone');
  assert.match(idle[1], /autoHuntActive = false;/);
});

test('the shark rests between its own hunts, and only its own', () => {
  // The cooldown must be armed inside the branch that knows the finished hunt
  // was the shark's idea. Armed unconditionally it would also delay the shark's
  // response to the child, which is the one thing the auto-hunt may never do.
  const idle = orchestrator.match(/if \(getHuntPhase\(huntState\) === 'idle'\) \{([\s\S]*?)\n {4}\}/);
  assert.ok(idle, 'the idle branch of maintainAutoHunt is gone');
  assert.match(idle[1], /if \(autoHuntActive\) autoHuntCooldown = AUTO_HUNT_COOLDOWN;/);
  assert.match(
    orchestrator,
    /if \(autoHuntCooldown > 0\) \{\s*\n\s*autoHuntCooldown -= dt;\s*\n\s*return;/,
    'the cooldown is armed but never gates acquisition',
  );
});

test('the auto-hunt refuses a target that is already under its nose', () => {
  // Measured on the shipped build: a mean acquisition distance of 1.56 units,
  // inside STRIKE_RANGE, which is a bump rather than a stalk. This gate is what
  // gives every auto-hunt an approach long enough to watch.
  assert.match(orchestrator, /const minRangeSq = AUTO_HUNT_MIN_RANGE \* AUTO_HUNT_MIN_RANGE;/);
  assert.match(orchestrator, /if \(d < minRangeSq\) return;/, 'the minimum acquisition range is declared but not enforced');
  const radius = Number(orchestrator.match(/const AUTO_HUNT_RADIUS = ([\d.]+);/)[1]);
  const minRange = Number(orchestrator.match(/const AUTO_HUNT_MIN_RANGE = ([\d.]+);/)[1]);
  assert.ok(minRange < radius, `the acquisition band is empty: min ${minRange} >= radius ${radius}`);
  assert.ok(radius - minRange >= 2.0, `the acquisition band is ${(radius - minRange).toFixed(1)}u wide; the shark will rarely find anything in it`);
});

test('contact no longer cancels the hunt, so the FSM can reach its own ending', () => {
  // STRIKE_RANGE (1.5) is larger than FISH_HIT_RADIUS (1.0), so contact always
  // precedes the strike timer expiring. While the squirt also cancelled, that
  // made the cancel the universal terminator: 2,471 of 2,472 measured hunts
  // ended there and `celebrate` had 0.0% frame occupancy.
  const squirt = orchestrator.match(/escapeFromShark\(fish, sharkPos\.x, sharkPos\.z\);([\s\S]{0,120})/);
  assert.ok(squirt, 'the standard-fish squirt is gone');
  assert.doesNotMatch(squirt[1], /cancelHunt/, 'contact cancels the hunt again — the shark can never finish one');
  const golden = orchestrator.match(/escapeFromShark\(goldenFish, sharkPos\.x, sharkPos\.z\);([\s\S]{0,120})/);
  assert.ok(golden, 'the golden squirt is gone');
  assert.doesNotMatch(golden[1], /cancelHunt/, 'contact with the golden cancels the hunt again');
});

test('the terminal beat tells a catch from a miss', () => {
  assert.match(orchestrator, /if \(huntState\.targetFishRoot === fish\.root\) notifyHuntCatch\(huntState\);/, 'nothing tells the FSM the hunt succeeded');
  assert.match(orchestrator, /onCelebrate: \(\) => \{\s*\n\s*triggerBarrelRoll\(sharkAnim\);/);
  assert.match(orchestrator, /onMiss: \(\) => \{[\s\S]{0,80}?triggerHeadLook\(sharkAnim\);/, 'a missed hunt must not borrow the celebration');
});

test('no fish carries a flag saying the child has claimed it', () => {
  // The flag had two writers meaning different things and one reader, and its
  // only reachable effect was the auto-hunt disarming the golden fish. If it
  // comes back, it comes back with a test saying which meaning it carries.
  const files = ['index.ts', 'types.ts', 'fish/effects.ts', 'fish/lifecycle.ts'];
  for (const f of files) {
    const src = readFileSync(new URL(`../../src/minigames/games/little-shark/${f}`, import.meta.url), 'utf8');
    for (const [i, line] of src.split('\n').entries()) {
      if (!line.includes('isTargeted')) continue;
      assert.ok(/^\s*(\/\/|\*)/.test(line), `${f}:${i + 1} uses isTargeted outside a comment: ${line.trim()}`);
    }
  }
});

/**
 * The body of a named function, brace-matched.
 *
 * `index.ts` holds TWO `consider(fish)` closures over a `best`/`bestDistSq`
 * pair — one in `maintainAutoHunt`, one in `findFishNearTap` — and they must
 * say opposite things about the golden. An unscoped regex matches the tap
 * picker and reports the wrong answer with total confidence, which is exactly
 * what it did when this check was first written.
 */
function functionBody(src, signature) {
  const start = src.indexOf(signature);
  assert.notEqual(start, -1, `${signature} is not in the source`);
  const open = src.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  throw new Error(`${signature} is not brace-balanced`);
}

test('the auto-hunt will not chase the golden fish', () => {
  // A deduction, not a tuning preference. `canHarvest` is
  // `isPlayerDriven(sharkMove) && !autoHuntActive`, and `autoHuntActive` is
  // true for every frame of an auto-hunt, so an auto-hunt on the golden cannot
  // end in a catch — not rarely, but never. What it CAN do is spend the fish:
  // `dodgeCount` is a lifetime budget capped at GOLDEN_MAX_DODGES, and a staged
  // encounter measured the shark burning both dodges before the child's finger
  // ever touched the screen (200/200 trials, 0.00 budget left at handover
  // against a control of 2.00). That is the golden's whole game handed to
  // nobody.
  const body = functionBody(orchestrator, 'function maintainAutoHunt(dt: number): void');
  assert.doesNotMatch(
    body,
    /consider\(goldenFish\)/,
    'the auto-hunt considers the golden again — it will spend the dodge budget on a hunt the rules forbid it from completing',
  );
});

test('the child can still tap the golden fish', () => {
  // The other half of the fix above: removing the golden from the AI's
  // acquisition list must not remove it from the child's. If this fails, the
  // prize fish became scenery.
  const body = functionBody(orchestrator, 'function findFishNearTap(');
  assert.match(body, /consider\(goldenFish\)/, 'the tap picker no longer offers the golden — the child cannot claim the prize fish');
});

test('a fish the shark was not entitled to eat is pushed clear, not left inside it', () => {
  assert.match(orchestrator, /escapeFromShark\(fish, sharkPos\.x, sharkPos\.z\)/);
  assert.match(orchestrator, /escapeFromShark\(goldenFish, sharkPos\.x, sharkPos\.z\)/);
});

/**
 * The surplus-retirement block, brace-matched out of updateSpawning.
 *
 * These three tests exist because the probe that justified the fix does NOT
 * execute this code. `r12-does-the-payoff-arrive.mjs` reimplements the session
 * loop and models the drain itself, so its numbers vouch for the DESIGN and
 * cannot vouch for the SHIPPED IMPLEMENTATION. Everything the design's safety
 * rests on has to be pinned here or it is not pinned anywhere.
 */
const surplusRetirement = (() => {
  const body = functionBody(orchestrator, 'function updateSpawning(dt: number): void');
  const start = body.indexOf('surplusRetireTimer -= dt;');
  assert.notEqual(start, -1, 'the surplus retirement is gone from updateSpawning — the reef is a ratchet again');
  const end = body.indexOf('// Recycle fish that have fallen behind the shark', start);
  assert.notEqual(end, -1, 'the retirement block no longer sits above the cull — this test can no longer find its bounds');
  return body.slice(start, end);
})();

test('a surplus fish is never retired from inside the band the child can see', () => {
  // The safety property the whole fix was shaped around, and the reason the
  // shipped drain is the WEAKER of the two that were measured.
  //
  // The direct version — retire the outermost fish inside the visible band —
  // scored better on every number (1.96x-2.04x realised payoff against this
  // one's 1.79x-1.91x; every frenzy perceptible rather than 165 of 170). It was
  // rejected because the nearest fish it was ever observed retiring sat 4.5
  // units from the shark against a view radius of 11. That is not the far edge,
  // it is the middle of the screen, and a fish dissolving there is a worse
  // defect than the imperceptible frenzy it was fixing.
  //
  // Note what could NOT have caught that: the probe's tap model always picks the
  // fish nearest the shark, so it can never tap the one that arm retires. Any
  // "no fish was taken from under a finger" statistic it produced would have
  // been an artefact of the instrument. Hence a structural guard, tested
  // structurally, rather than a reassuring number.
  assert.match(
    surplusRetirement,
    /distSq < SURPLUS_RETIRE_MIN_DISTANCE \* SURPLUS_RETIRE_MIN_DISTANCE\) continue;/,
    'the lower distance bound is gone — retirement can now take a fish in front of the child',
  );
});

test('the fish the shark is chasing is never retired out from under it', () => {
  // A chase that ends in the target evaporating is the Round 1 defect wearing a
  // different hat: the child is shown a pursuit and then denied its resolution.
  assert.match(
    surplusRetirement,
    /f\.root === huntState\.targetFishRoot\) continue;/,
    'retirement can now take the hunt target — a chase can end in the fish dissolving',
  );
});

test('a retired fish shrinks away rather than blinking out', () => {
  // Same exit the cull already uses. A fish that vanishes between two frames is
  // a glitch; a fish that scales to zero over 0.2s is a fish leaving.
  assert.match(
    surplusRetirement,
    /farthest\.despawnTimer = FISH_DESPAWN_SCALE_DURATION;/,
    'retirement no longer plays the despawn animation — fish will pop out of existence',
  );
  assert.doesNotMatch(surplusRetirement, /deactivateFish\(/, 'retirement is deactivating directly, which skips the shrink and pops the fish');
});

test('the retirement floor is at or beyond the edge of what the child can see', () => {
  // The guard above proves the code CONSULTS the floor. This proves the floor is
  // actually outside the child's view — a bound of 2 units would satisfy every
  // structural assertion in this file while retiring fish in the middle of the
  // screen. Values, not just shapes.
  assert.ok(
    w.SURPLUS_RETIRE_MIN_DISTANCE >= w.CAMERA_VIEW_RADIUS,
    `retirement may reach ${w.SURPLUS_RETIRE_MIN_DISTANCE}u but the child sees to ${w.CAMERA_VIEW_RADIUS}u — fish can now vanish on screen`,
  );
  assert.ok(
    w.SURPLUS_RETIRE_MIN_DISTANCE < w.CULL_DISTANCE,
    'the retirement floor has reached the cull distance — there is no band left to retire from and the reef is a ratchet again',
  );
  assert.ok(w.SURPLUS_RETIRE_INTERVAL > 0, 'a non-positive retirement interval would drain the reef as fast as the frame rate allows');
});

/**
 * Round 5 — the forgiveness circle has to know how fast the reef is swimming.
 *
 * `difficulty.level` is a ratchet: driven from the score, the score never falls,
 * the mapping is monotone. It reaches 1 after 89 s of play and a measured 73% of
 * the session is spent at >= 0.9. Everything the ramp does at the top it does for
 * the rest of the session.
 *
 * What it does at the top is spend the child's taps. A tap lands only if the fish
 * is still inside the snap circle when the finger ARRIVES: at level 0 a fish
 * covers 34% of the snap radius inside a 0.6 s reaction, at level 1 it covers 91%.
 * Measured across 24 seeds, dead taps run 15.5% -> 23.8% between the ramp's
 * endpoints and "caught the fish I aimed at" 65.6% -> 47.9%. The child earned that
 * by succeeding.
 *
 * The fix leaves every fish alone and widens the circle by exactly the distance
 * the extra speed covers inside an ASSUMED reaction time. Four damper arms, which
 * instead tried to stop the ramp, recovered 0.1-5.1 points against standard errors
 * of 0.6-1.1 and are recorded as failures in the review.
 *
 * These pin values, not just shapes, because every structural assertion below
 * would also pass on a fix widened by 3 px, or on one widened to 400 px, or on one
 * that quietly measured the child instead of assuming.
 */
const tapSnapBody = functionBody(orchestrator, 'function tapSnapRadiusPx(): number');

/** A tuning read out of index.ts. Never restated here — a test that restates it proves nothing. */
function shippedNumber(pattern, what) {
  const found = orchestrator.match(pattern);
  assert.ok(found, `index.ts no longer declares ${what} — this test cannot check a fix it cannot find`);
  return Number(found[1]);
}
const SNAP_FLAT_PX = shippedNumber(/const FISH_TAP_SNAP_RADIUS_PX = ([\d.]+);/, 'FISH_TAP_SNAP_RADIUS_PX');
const ASSUMED_LATENCY_S = shippedNumber(/const ASSUMED_TOUCH_LATENCY_S = ([\d.]+);/, 'ASSUMED_TOUCH_LATENCY_S');
const PX_PER_UNIT = (() => {
  const found = orchestrator.match(/const PX_PER_WORLD_UNIT_AT_SHARK_DEPTH = ([\d.]+) \/ ([\d.]+);/);
  assert.ok(found, 'index.ts no longer declares PX_PER_WORLD_UNIT_AT_SHARK_DEPTH');
  return Number(found[1]) / Number(found[2]);
})();
const t = await bundleTs('src/minigames/games/little-shark/types.ts');
const h = await bundleTs('src/minigames/games/little-shark/helpers.ts');
/** The shipped formula, reassembled from the shipped constants. */
const snapRadiusAt = (level) =>
  SNAP_FLAT_PX +
  Math.max(0, h.getSpeedMultiplier(level) - t.MIN_SPEED_MULTIPLIER) * ((t.FISH_BASE_SPEED_MIN + t.FISH_BASE_SPEED_MAX) / 2) * ASSUMED_LATENCY_S * PX_PER_UNIT;

test('the tap resolves against the speed-aware radius, not the flat one', () => {
  const body = functionBody(orchestrator, 'function findFishNearTap(');
  assert.match(body, /tapSnapRadiusPx\(\)/, 'the tap picker went back to a fixed radius — the fast fish clears the circle inside the reaction time again');
  assert.doesNotMatch(
    body,
    /FISH_TAP_SNAP_RADIUS_PX \* FISH_TAP_SNAP_RADIUS_PX/,
    'the tap picker is squaring the flat constant again, so the widening is computed and then ignored',
  );
});

test('the widening is driven by the difficulty level and by nothing about this particular child', () => {
  // This is the instrument flaw that nearly shipped. The first version of the fix
  // sized the circle from the session's OBSERVED reaction time, which granted it
  // perfect knowledge of the child in front of it and inflated every number it
  // produced. The shipped game cannot measure a reaction time; it can only assume
  // one, and then be judged on how it behaves when the assumption is wrong.
  assert.match(tapSnapBody, /getSpeedMultiplier\(context\.difficulty\.level\)/, 'the widening no longer follows the difficulty ramp it exists to compensate');
  assert.match(tapSnapBody, /ASSUMED_TOUCH_LATENCY_S/, 'the widening no longer uses the assumed latency');
  for (const measured of [/lastTapAt/, /reactionTime/, /observedLatency/, /performance\.now/, /Date\.now/]) {
    assert.doesNotMatch(tapSnapBody, measured, `the snap radius is measuring the child (${measured}) — the fix must assume, then be tested on being wrong`);
  }
});

test('the widening is zero at the bottom of the ramp', () => {
  // The gap between an aimed tap and a random poke is what makes the game
  // learnable, and the flat 120 px was chosen to maximise it for slow fish. A fix
  // that hands out extra forgiveness before the fish have earned it spends that
  // gap for nothing.
  assert.equal(snapRadiusAt(0), SNAP_FLAT_PX);
  assert.match(
    tapSnapBody,
    /Math\.max\(0,/,
    'the clamp is gone — a future MIN_SPEED_MULTIPLIER above the ramp floor would shrink the snap below its chosen value',
  );
});

test('the widening grows with the ramp and never shrinks', () => {
  let previous = -Infinity;
  for (let level = 0; level <= 1.0001; level += 0.05) {
    const r = snapRadiusAt(Math.min(1, level));
    assert.ok(
      r >= previous,
      `the snap radius falls between levels (${previous.toFixed(1)} -> ${r.toFixed(1)}) — succeeding would make the child's taps harder`,
    );
    previous = r;
  }
});

test('the widening is large enough to matter and small enough to keep aiming worth doing', () => {
  // Values, not shapes. Both bounds are the file's own: the lower one is the
  // arithmetic that makes the fast fish miss, the upper one is the 220 px radius
  // the snap sweep in that same file measured and rejected because a tap aimed at
  // nothing landed 72% of the time.
  const top = snapRadiusAt(1);
  const needed = (h.getSpeedMultiplier(1) - h.getSpeedMultiplier(0)) * ((t.FISH_BASE_SPEED_MIN + t.FISH_BASE_SPEED_MAX) / 2) * ASSUMED_LATENCY_S * PX_PER_UNIT;
  assert.ok(
    Math.abs(top - SNAP_FLAT_PX - needed) < 0.01,
    `the widening (${(top - SNAP_FLAT_PX).toFixed(1)} px) is no longer the distance the extra speed covers in the reaction time (${needed.toFixed(1)} px) — it has become a tuning`,
  );
  assert.ok(
    top - SNAP_FLAT_PX > 40,
    `only ${(top - SNAP_FLAT_PX).toFixed(1)} px of widening at the top of the ramp — the fix has been shrunk to something that cannot recover a tap`,
  );
  assert.ok(
    top < 220,
    `the snap reaches ${top.toFixed(0)} px, at or past the 220 px this file measured at a 72% random-poke hit rate — aiming has stopped paying`,
  );
});

test('the assumed reaction time stays under the measured floor for a toddler', () => {
  // ECITT (PMC8638877) reports mean median RT on prepotent trials of 1,038 ms at
  // 30 months and 1,089 ms at 24 months, on a STATIONARY iPad target. Assuming
  // less than a child's real reaction time under-compensates, which is paid for in
  // missed taps; assuming more over-compensates, which is paid for in the
  // random-poke column and is the worse currency. So the constant is deliberately
  // below the floor, and this pins the direction of the error.
  assert.ok(ASSUMED_LATENCY_S > 0, 'a non-positive assumed latency disables the fix while leaving all its code in place');
  assert.ok(
    ASSUMED_LATENCY_S < 1.038,
    `the assumed reaction time (${ASSUMED_LATENCY_S}s) has reached the measured 30-month floor — the fix now over-forgives rather than under-forgives`,
  );
});

test('the fix compensates the dial that was actually spending the taps', () => {
  // Decomposition, not intuition. Holding the reef and evasion at the top and
  // moving one dial at a time attributed +5.0 points of dead taps to speed and
  // +1.2 (inside its own standard error of 0.97) to evasion. A fix aimed at
  // evasion would have measured as a partial success and shipped as a whole one.
  assert.ok(t.MAX_SPEED_MULTIPLIER > t.MIN_SPEED_MULTIPLIER, 'the speed ramp is gone, so the widening it compensates is compensating nothing');
  assert.match(tapSnapBody, /MEAN_FISH_BASE_SPEED/, 'the widening no longer converts a speed multiplier into a distance');
  assert.match(
    orchestrator,
    /const MEAN_FISH_BASE_SPEED = \(FISH_BASE_SPEED_MIN \+ FISH_BASE_SPEED_MAX\) \/ 2;/,
    'the mean fish speed has become a literal — the widening can now disagree with how fast the fish actually swim',
  );
});

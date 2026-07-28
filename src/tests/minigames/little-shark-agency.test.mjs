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

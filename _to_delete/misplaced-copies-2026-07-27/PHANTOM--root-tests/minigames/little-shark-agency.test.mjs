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
  assert.match(orchestrator, /if \(getHuntPhase\(huntState\) === 'idle'\) autoHuntActive = false;/);
});

test('a fish the shark was not entitled to eat is pushed clear, not left inside it', () => {
  assert.match(orchestrator, /escapeFromShark\(fish, sharkPos\.x, sharkPos\.z\)/);
  assert.match(orchestrator, /escapeFromShark\(goldenFish, sharkPos\.x, sharkPos\.z\)/);
});

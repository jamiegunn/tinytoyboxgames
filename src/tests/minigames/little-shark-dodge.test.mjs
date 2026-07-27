/**
 * The golden fish's dodge must be a movement, not a teleport.
 *
 * THE DEFECT THIS GUARDS
 * ----------------------
 * `types.ts` declared, with a JSDoc comment stating its purpose:
 *
 *   /** Duration of a single dodge animation in seconds. *\/
 *   export const GOLDEN_DODGE_DURATION = 0.3;
 *
 * There was no dodge animation. `updateGoldenDodge` did this:
 *
 *   fish.root.position.x += perpX * side * GOLDEN_DODGE_DISTANCE;
 *   fish.root.position.z += perpZ * side * GOLDEN_DODGE_DISTANCE;
 *
 * — a 1.5-unit jump inside a single frame, with no tween and no timer. The
 * constant was never imported anywhere. It read as the parameter of a real
 * system while describing behaviour that had never been written, which is the
 * precise failure mode this sweep is hunting: code that documents its own
 * intent so plausibly that nobody checks whether it runs.
 *
 * It was also a gameplay bug. The golden fish is the prize the child chases;
 * making it blink from one place to another is unwatchable at three years old,
 * and unchaseable. The evasion now plays out across the duration.
 *
 * WHAT IS ASSERTED
 * ----------------
 * These tests execute the real `updateGoldenDodge`. The load-bearing ones are
 * the two that a teleport implementation passes and fails respectively: total
 * distance is still GOLDEN_DODGE_DISTANCE (so the dodge was not weakened), but
 * a single frame moves the fish only part of the way (so it is not a jump).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { bundleTs } from '../framework/_tsload.mjs';

const M = await bundleTs('src/minigames/games/little-shark/fish/effects.ts');
const T = await bundleTs('src/minigames/games/little-shark/types.ts');

const { updateGoldenDodge, updateFishDrift, escapeFromShark } = M;
const { GOLDEN_DODGE_DISTANCE, GOLDEN_DODGE_DURATION, GOLDEN_DODGE_COOLDOWN, GOLDEN_MAX_DODGES } = T;

// A golden fish sitting at the origin, close enough to trigger a dodge against
// a shark placed at DODGE_TRIGGER_POS below.
function goldenAt(x = 0, z = 0) {
  return {
    root: { position: { x, y: 0, z }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
    kind: 'golden',
    active: true,
    driftPhaseX: 0,
    driftPhaseZ: 0,
    driftSpeed: 1,
    driftCenterX: x,
    driftCenterZ: z,
    despawnTimer: -1,
    dodgeCount: 0,
    dodgeCooldown: 0,
    dodgeTimer: -1,
    dodgeDirX: 0,
    dodgeDirZ: 0,
    isTargeted: false,
    spawning: false,
    spawnTimer: 0,
    spawnEdgeX: 0,
    spawnEdgeZ: 0,
  };
}

// Shark 1 unit away on -X: inside DODGE_RADIUS_MIN (2.0) at evasiveness 0.
const SHARK_X = -1;
const SHARK_Z = 0;

const dist = (a, b) => Math.hypot(a.root.position.x - b.x, a.root.position.z - b.z);

// Runs whole frames of dt until the dart reports itself finished, or the cap
// trips. Returns the number of frames the dart actually occupied.
function runDodgeToCompletion(fish, dt, cap = 1000) {
  let frames = 0;
  while (fish.dodgeTimer > 0 && frames < cap) {
    updateGoldenDodge(fish, SHARK_X, SHARK_Z, dt);
    frames += 1;
  }
  return frames;
}

test('the constant is not decoration — a dodge lasts GOLDEN_DODGE_DURATION', () => {
  assert.ok(GOLDEN_DODGE_DURATION > 0, 'a zero duration would restore the teleport');
  // dt = 0 so the trigger frame consumes none of the window, leaving the armed
  // value visible.
  const fish = goldenAt();
  updateGoldenDodge(fish, SHARK_X, SHARK_Z, 0);
  assert.equal(fish.dodgeTimer, GOLDEN_DODGE_DURATION, 'triggering a dodge must arm the timer with the documented duration');

  // And the window is actually spent: at 60fps the dart must occupy roughly
  // GOLDEN_DODGE_DURATION seconds of frames, not one.
  const flying = goldenAt();
  updateGoldenDodge(flying, SHARK_X, SHARK_Z, 1 / 60);
  const frames = 1 + runDodgeToCompletion(flying, 1 / 60);
  assert.equal(frames, Math.ceil(GOLDEN_DODGE_DURATION * 60), 'the dart must span the documented duration at 60fps');
});

test('a single frame does NOT complete the dodge — this is the teleport guard', () => {
  const fish = goldenAt();
  const start = { x: 0, z: 0 };
  updateGoldenDodge(fish, SHARK_X, SHARK_Z, 1 / 60);

  const moved = dist(fish, start);
  assert.ok(
    moved < GOLDEN_DODGE_DISTANCE * 0.5,
    `one frame moved the fish ${moved.toFixed(3)} of ${GOLDEN_DODGE_DISTANCE} units — a dodge that lands inside a single frame is the teleport this test exists to prevent`,
  );
});

test('the dart covers exactly GOLDEN_DODGE_DISTANCE once it finishes', () => {
  const fish = goldenAt();
  const start = { x: 0, z: 0 };
  updateGoldenDodge(fish, SHARK_X, SHARK_Z, 1 / 60);
  runDodgeToCompletion(fish, 1 / 60);

  assert.ok(Math.abs(dist(fish, start) - GOLDEN_DODGE_DISTANCE) < 1e-9, 'slowing the dodge down must not shorten it');
  assert.equal(fish.dodgeTimer, -1, 'a finished dart must disarm itself');
});

test('distance travelled is frame-rate independent', () => {
  const travelled = [];
  for (const dt of [1 / 120, 1 / 60, 1 / 30, 0.1]) {
    const fish = goldenAt();
    updateGoldenDodge(fish, SHARK_X, SHARK_Z, dt);
    runDodgeToCompletion(fish, dt);
    travelled.push(dist(fish, { x: 0, z: 0 }));
  }
  for (const d of travelled) {
    assert.ok(Math.abs(d - GOLDEN_DODGE_DISTANCE) < 1e-9, `frame rate changed the dodge distance: ${travelled.join(', ')}`);
  }
});

test('the dart moves monotonically away — no backtracking mid-flight', () => {
  const fish = goldenAt();
  const start = { x: 0, z: 0 };
  updateGoldenDodge(fish, SHARK_X, SHARK_Z, 1 / 60);

  let previous = dist(fish, start);
  while (fish.dodgeTimer > 0) {
    updateGoldenDodge(fish, SHARK_X, SHARK_Z, 1 / 60);
    const now = dist(fish, start);
    assert.ok(now >= previous - 1e-12, 'the fish must not slide backwards during its own escape');
    previous = now;
  }
});

test('the dart eases out — the first half of the time covers more than half the distance', () => {
  const fish = goldenAt();
  const start = { x: 0, z: 0 };
  updateGoldenDodge(fish, SHARK_X, SHARK_Z, 0);

  updateGoldenDodge(fish, SHARK_X, SHARK_Z, GOLDEN_DODGE_DURATION / 2);
  const halfway = dist(fish, start);
  assert.ok(
    halfway > GOLDEN_DODGE_DISTANCE * 0.5,
    `a startled fish leaves fast and settles; halfway through the time it had covered ${halfway.toFixed(3)} units`,
  );
});

test('drift is suspended while a dart is in flight', () => {
  const fish = goldenAt();
  updateGoldenDodge(fish, SHARK_X, SHARK_Z, 1 / 60);
  const frozen = { ...fish.root.position };

  // A large drift step would visibly move the fish if drift were still running.
  updateFishDrift(fish, 0.5, 5, SHARK_X, SHARK_Z);
  assert.equal(fish.root.position.x, frozen.x, 'the drift spring must not fight the dodge');
  assert.equal(fish.root.position.z, frozen.z);
});

test('the cooldown only starts once the fish has landed', () => {
  const fish = goldenAt();
  updateGoldenDodge(fish, SHARK_X, SHARK_Z, 1 / 60);
  const armed = fish.dodgeCooldown;
  assert.equal(armed, GOLDEN_DODGE_COOLDOWN, 'a dodge at evasiveness 0 gets the full cooldown');

  runDodgeToCompletion(fish, 1 / 60);
  assert.equal(fish.dodgeCooldown, armed, 'time spent darting must not be billed against the cooldown');
});

test('being thrown clear cancels an in-flight dart', () => {
  const fish = goldenAt();
  updateGoldenDodge(fish, SHARK_X, SHARK_Z, 1 / 60);
  assert.ok(fish.dodgeTimer > 0);

  escapeFromShark(fish, SHARK_X, SHARK_Z);
  assert.equal(fish.dodgeTimer, -1, 'a fish squirted out from under the shark must not resume sliding sideways');
});

test('the fish faces the way it is darting', () => {
  const fish = goldenAt();
  updateGoldenDodge(fish, SHARK_X, SHARK_Z, 1 / 60);
  const expected = Math.atan2(fish.dodgeDirZ, fish.dodgeDirX);
  assert.ok(Math.abs(fish.root.rotation.y - expected) < 1e-9, 'a fish darting sideways while pointing forwards reads as sliding on ice');
});

test('the dodge budget is still spent per dart, not per frame', () => {
  const fish = goldenAt();
  updateGoldenDodge(fish, SHARK_X, SHARK_Z, 1 / 60);
  assert.equal(fish.dodgeCount, 1);
  runDodgeToCompletion(fish, 1 / 60);
  assert.equal(fish.dodgeCount, 1, 'a multi-frame dart must not consume a dodge on every frame');
  assert.ok(GOLDEN_MAX_DODGES >= 1);
});

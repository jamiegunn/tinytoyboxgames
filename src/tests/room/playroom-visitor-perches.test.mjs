/**
 * Playroom visitor perches — the kitty may only land on something that exists.
 *
 * THE DEFECT THIS GUARDS
 * ----------------------
 * `animalVisitors.ts` used to hold hand-written toybox coordinates:
 *
 *   const PURPLE_TOYBOX = new Vector3(3.67, 0.01, -6.88);
 *   await leapOnto(kitty, PURPLE_TOYBOX, TOYBOX_TOP_Y);
 *
 * A fourth "nature" toybox had been removed from `toyboxes/manifest.ts`, which
 * builds the only toyboxes the Playroom ever creates. The constant survived it.
 * Every 20 seconds the kitty walked to the back-right of the room, leapt to
 * y = 1.3 over bare floor, sat grooming in mid-air, and hopped down again.
 *
 * Nothing caught it. Every line involved was individually correct: a named
 * constant, a documented helper, an obstacle-avoidance list with a comment for
 * each entry. Only the referent was gone, and a stale coordinate is invisible
 * to both the compiler and the eye.
 *
 * WHY THIS SUITE EXECUTES CODE
 * ----------------------------
 * Most of tests/room/ asserts on source text. A source-text assertion could not
 * have caught this defect, because the source was never malformed. So the
 * central test here imports `selectPerchStops` and runs it. Mutating the
 * implementation must turn this suite red — that is the whole point of it.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bundleTs } from '../framework/_tsload.mjs';

const VISITORS = 'src/scenes/world/places/house/subplaces/playroom/critters/animalVisitors.ts';
const ROOM = 'src/scenes/world/places/house/subplaces/playroom/room.ts';
const MANIFEST = 'src/scenes/world/places/house/subplaces/playroom/toyboxes/manifest.ts';

const { selectPerchStops } = await bundleTs(VISITORS);

const perch = (x, z, topY, radius = 0.8) => ({ x, z, topY, radius });

test('no perches means no leaps — a removed toybox cannot be landed on', () => {
  assert.deepEqual(selectPerchStops([], 2), []);
});

test('fewer perches than stops yields only what exists', () => {
  const only = perch(5.25, 1.5, 1.25);
  assert.deepEqual(selectPerchStops([only], 2), [only]);
});

test('stops are the tallest perches, so the kitty lands on real tops', () => {
  const low = perch(-2.8, 8.25, 0.9);
  const mid = perch(-1.6, -6.5, 1.1);
  const high = perch(5.25, 1.5, 1.4);
  const stops = selectPerchStops([low, high, mid], 2);
  assert.deepEqual(
    stops.map((s) => s.topY),
    [1.4, 1.1],
    'perches must be ordered tallest-first',
  );
});

test('selectPerchStops never returns more stops than requested', () => {
  const many = [perch(0, 0, 1), perch(1, 1, 2), perch(2, 2, 3), perch(3, 3, 4)];
  assert.equal(selectPerchStops(many, 2).length, 2);
  assert.equal(selectPerchStops(many, 0).length, 0);
  assert.equal(selectPerchStops(many, -1).length, 0, 'a negative limit must not slice from the end');
});

test('selectPerchStops does not mutate its input', () => {
  const input = [perch(0, 0, 1), perch(1, 1, 3), perch(2, 2, 2)];
  const before = input.map((p) => p.topY);
  selectPerchStops(input, 3);
  assert.deepEqual(
    input.map((p) => p.topY),
    before,
    'sorting must happen on a copy',
  );
});

// ── Anti-regression guards ──
// These are source-text assertions and are honest about it: they cannot prove
// behaviour, only that the specific bad pattern has not come back.

test('animalVisitors.ts holds no hand-written toybox coordinates', () => {
  const src = readFileSync(new URL(`../../${VISITORS}`, import.meta.url), 'utf8');
  assert.doesNotMatch(src, /const\s+\w*TOYBOX\w*\s*=\s*new Vector3/, 'toybox positions must come from measured perches, not constants');
  assert.doesNotMatch(src, /TOYBOX_TOP_Y/, 'landing height must be measured from the built object, not assumed');
  assert.doesNotMatch(src, /-6\.88/, 'the phantom nature-toybox coordinate must not return');
});

test('room.ts passes measured perches to the visitors', () => {
  const src = readFileSync(new URL(`../../${ROOM}`, import.meta.url), 'utf8');
  assert.match(src, /new Box3\(\)\.setFromObject\(handle\.root\)/, 'perch height must be measured from the built toybox');
  assert.match(src, /spawnAnimalVisitors\(scene,\s*perches\)/);
});

test('the manifest is the only thing that creates Playroom toyboxes', () => {
  const src = readFileSync(new URL(`../../${ROOM}`, import.meta.url), 'utf8');
  const creations = src.match(/createInteractiveToybox\(/g) ?? [];
  assert.equal(creations.length, 1, 'more than one creation site would reintroduce a second source of truth');
  assert.match(src, /PLAYROOM_TOYBOXES\.forEach/);

  const manifest = readFileSync(new URL(`../../${MANIFEST}`, import.meta.url), 'utf8');
  assert.doesNotMatch(manifest, /id:\s*'nature'/, "the 'nature' toybox does not exist; re-adding it needs a perch review");
});

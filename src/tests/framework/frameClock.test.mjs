/**
 * FrameClock contract test — behavioural.
 *
 * Enforces architecture-standards.md#frameclock: one per-frame pump per surface
 * that subscribers attach to instead of each starting its own rAF. The load-
 * bearing guarantees:
 *   - dt is clamped to MAX_DELTA_SECONDS so a tab-switch/GC pause can't teleport
 *     physics (particles, idle animation).
 *   - elapsed accumulates the CLAMPED deltas.
 *   - unsubscribe works, and unsubscribing DURING a tick is safe (snapshot iter).
 *   - one throwing subscriber never stalls the frame for the others.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './_tsload.mjs';

const { createFrameClock, MAX_DELTA_SECONDS } = await loadTs('src/utils/frameClock.ts');

test('MAX_DELTA_SECONDS is the documented 0.1s clamp', () => {
  assert.equal(MAX_DELTA_SECONDS, 0.1);
});

test('a normal dt passes through unclamped', () => {
  const clock = createFrameClock();
  let seen = -1;
  clock.subscribe((dt) => (seen = dt));
  clock.tick(0.016);
  assert.ok(Math.abs(seen - 0.016) < 1e-9);
});

test('a huge raw dt is clamped to MAX_DELTA_SECONDS', () => {
  const clock = createFrameClock();
  let seen = -1;
  clock.subscribe((dt) => (seen = dt));
  clock.tick(5.0); // e.g. after a tab switch
  assert.equal(seen, MAX_DELTA_SECONDS);
});

test('elapsed accumulates clamped deltas, not raw ones', () => {
  const clock = createFrameClock();
  clock.subscribe(() => {});
  clock.tick(0.05);
  clock.tick(5.0); // clamped to 0.1
  assert.ok(Math.abs(clock.elapsed - 0.15) < 1e-9, `elapsed was ${clock.elapsed}, expected 0.15`);
});

test('unsubscribe stops future callbacks', () => {
  const clock = createFrameClock();
  let count = 0;
  const off = clock.subscribe(() => count++);
  clock.tick(0.016);
  off();
  clock.tick(0.016);
  assert.equal(count, 1);
});

test('unsubscribing during a tick is safe (snapshot iteration)', () => {
  const clock = createFrameClock();
  const ran = [];
  let offB;
  clock.subscribe(() => {
    ran.push('a');
    offB(); // remove B mid-iteration
  });
  offB = clock.subscribe(() => ran.push('b'));
  assert.doesNotThrow(() => clock.tick(0.016));
  // B was already in this frame's snapshot, so it still ran once this tick.
  assert.deepEqual(ran, ['a', 'b']);
  ran.length = 0;
  clock.tick(0.016);
  assert.deepEqual(ran, ['a'], 'B must be gone on the next tick');
});

test('one throwing subscriber does not stall the others', () => {
  const clock = createFrameClock();
  const ran = [];
  clock.subscribe(() => ran.push('a'));
  clock.subscribe(() => {
    throw new Error('boom');
  });
  clock.subscribe(() => ran.push('c'));
  assert.doesNotThrow(() => clock.tick(0.016));
  assert.deepEqual(ran, ['a', 'c']);
});

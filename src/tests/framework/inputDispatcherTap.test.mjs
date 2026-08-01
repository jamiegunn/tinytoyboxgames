/**
 * InputDispatcher tap-delivery contract test.
 *
 * Two defects from the minigame teardown live here, and both are invisible to
 * the compiler:
 *
 *   - a 120ms same-position cooldown that silently ate the second of two rapid
 *     taps (defect 0.3). A three-year-old hammering the same bubble taps well
 *     inside 120ms; the swallowed tap produced no sound, no particle, nothing.
 *   - taps delivered on `pointerup`, so the game did not respond until the
 *     child lifted their finger — routinely 150-300ms of apparent deafness in
 *     games that have no drag gesture to disambiguate against.
 *
 * These are behavioural properties of the event plumbing, so the test drives
 * the dispatcher with synthetic pointer events over a stub canvas.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bundleTs, loadTs } from './_tsload.mjs';

const { createInputDispatcher } = await bundleTs('src/minigames/framework/InputDispatcher.ts');
const { DRAG_THRESHOLD_PX, WOBBLE_TAP_TOLERANCE_PX } = await loadTs('src/utils/interaction/gestureRules.ts');

/** A canvas stand-in that records listeners so the test can fire events. */
function stubCanvas() {
  const listeners = new Map();
  return {
    addEventListener: (type, fn) => listeners.set(type, fn),
    removeEventListener: (type) => listeners.delete(type),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    fire: (type, x, y) => listeners.get(type)?.({ clientX: x, clientY: y }),
    has: (type) => listeners.has(type),
  };
}

/**
 * Builds a dispatcher over a stub canvas with no scene (so pick results are
 * misses — this suite is about delivery, not raycasting) and a tap spy.
 */
function harness(inputModes) {
  const canvas = stubCanvas();
  const taps = [];
  const drags = [];
  const dispatcher = createInputDispatcher(canvas, null, { inputModes }, undefined);
  dispatcher.onTap((e) => taps.push(e));
  dispatcher.onDrag((e) => drags.push(e));
  return { canvas, taps, drags, dispatcher };
}

/** Presses and releases at a point, as a real finger would. */
function tapAt(canvas, x, y) {
  canvas.fire('pointerdown', x, y);
  canvas.fire('pointerup', x, y);
}

// ── Responsiveness: a tap-only game answers on touch-down ───────────────────

test('a tap-only game delivers the tap on pointerdown, before the finger lifts', () => {
  const { canvas, taps } = harness(['tap']);
  canvas.fire('pointerdown', 100, 100);
  assert.equal(taps.length, 1, 'the game must respond while the finger is still down');
  assert.deepEqual([taps[0].screenX, taps[0].screenY], [100, 100]);
});

test('the down-fired tap is not delivered a second time on release', () => {
  const { canvas, taps } = harness(['tap']);
  tapAt(canvas, 100, 100);
  assert.equal(taps.length, 1, 'one press must score exactly once');
});

test('a game that also accepts drags still classifies on release', () => {
  // little-shark drags the shark, so a press cannot be resolved as a tap until
  // the gesture is known not to be a drag.
  const { canvas, taps } = harness(['tap', 'drag']);
  canvas.fire('pointerdown', 100, 100);
  assert.equal(taps.length, 0, 'a draggable game must wait to see whether this becomes a drag');
  canvas.fire('pointerup', 100, 100);
  assert.equal(taps.length, 1);
});

test('a real drag in a drag-capable game produces no tap', () => {
  const { canvas, taps } = harness(['tap', 'drag']);
  canvas.fire('pointerdown', 100, 100);
  canvas.fire('pointermove', 400, 400);
  canvas.fire('pointerup', 400, 400);
  assert.equal(taps.length, 0, 'a deliberate drag must not also register as a tap');
});

// ── Forgiveness: rapid repeat taps must all land ────────────────────────────

test('two fast taps on the same spot both register', () => {
  // The regression. With a 120ms cooldown the second of these was discarded in
  // silence, which is exactly the "dead tap" the star-catcher scoring module
  // calls a broken promise.
  const { canvas, taps } = harness(['tap']);
  tapAt(canvas, 200, 200);
  tapAt(canvas, 200, 200);
  assert.equal(taps.length, 2, 'a toddler hammering one spot must be answered every time');
});

test('a burst of taps on one spot loses none of them', () => {
  const { canvas, taps } = harness(['tap']);
  for (let i = 0; i < 8; i += 1) tapAt(canvas, 300, 300);
  assert.equal(taps.length, 8, `expected 8 taps, got ${taps.length}`);
});

test('no time-based suppression exists at any interval, however tight', async () => {
  // Deliberately stronger than "the window is short": there must be no window.
  // A timer here can only ever discard real input, because Pointer Events do
  // not duplicate and the down/up double-delivery is closed structurally.
  const { canvas, taps } = harness(['tap']);
  tapAt(canvas, 400, 400); // same millisecond as the next
  tapAt(canvas, 400, 400);
  await new Promise((resolve) => setTimeout(resolve, 5));
  tapAt(canvas, 400, 400);
  assert.equal(taps.length, 3, 'every press is a real press, at every interval');
});

test('taps at different positions never suppress each other', () => {
  const { canvas, taps } = harness(['tap']);
  tapAt(canvas, 100, 100);
  tapAt(canvas, 500, 400);
  tapAt(canvas, 120, 105);
  assert.equal(taps.length, 3);
});

// ── Pause and teardown still hold ───────────────────────────────────────────

test('a paused dispatcher delivers nothing, on down or on up', () => {
  const { canvas, taps, dispatcher } = harness(['tap']);
  dispatcher.setPaused(true);
  tapAt(canvas, 100, 100);
  assert.equal(taps.length, 0);
  dispatcher.setPaused(false);
  tapAt(canvas, 100, 100);
  assert.equal(taps.length, 1, 'resuming must restore delivery');
});

test('a cancelled pointer does not leave a tap pending for the next release', () => {
  const { canvas, taps } = harness(['tap']);
  canvas.fire('pointerdown', 100, 100);
  canvas.fire('pointercancel', 100, 100);
  canvas.fire('pointerup', 100, 100);
  assert.equal(taps.length, 1, 'exactly the one tap fired on down, and no phantom on release');
});

test('dispose removes every listener it added', () => {
  const { canvas, dispatcher } = harness(['tap', 'drag']);
  dispatcher.dispose();
  for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) {
    assert.equal(canvas.has(type), false, `${type} listener leaked`);
  }
});

// ── Threshold boundaries: exactly ON the line, not near it ──────────────────
//
// A 2026-08-01 mutation audit flipped `totalDistance >= DRAG_THRESHOLD` to `>`
// and `totalDistance < WOBBLE_TAP_TOLERANCE` to `<=`. Both mutants survived the
// entire 429-test suite. Every gesture test above moves either 0px or 400px, so
// the two numbers that actually decide tap-versus-drag were free to move by one
// pixel in either direction, unwatched. These two tests sit exactly on the line.

test('a gesture of exactly DRAG_THRESHOLD_PX is a drag, not one pixel short of one', () => {
  const { canvas, drags } = harness(['tap', 'drag']);
  canvas.fire('pointerdown', 100, 100);
  canvas.fire('pointermove', 100 + DRAG_THRESHOLD_PX, 100);
  assert.equal(drags.length, 1, `moving exactly ${DRAG_THRESHOLD_PX}px must cross the drag threshold — the comparison is >=, not >`);

  // One pixel short must NOT, so the assertion above cannot pass vacuously.
  const below = harness(['tap', 'drag']);
  below.canvas.fire('pointerdown', 100, 100);
  below.canvas.fire('pointermove', 100 + DRAG_THRESHOLD_PX - 1, 100);
  assert.equal(below.drags.length, 0, `moving ${DRAG_THRESHOLD_PX - 1}px must still be under the threshold`);
});

test('a smear of exactly WOBBLE_TAP_TOLERANCE_PX is a drag, not a forgiven tap', () => {
  // Below the tolerance a wobble is a toddler's smeared tap and must still score.
  const forgiven = harness(['tap', 'drag']);
  forgiven.canvas.fire('pointerdown', 100, 100);
  forgiven.canvas.fire('pointermove', 100 + WOBBLE_TAP_TOLERANCE_PX - 1, 100);
  forgiven.canvas.fire('pointerup', 100 + WOBBLE_TAP_TOLERANCE_PX - 1, 100);
  assert.equal(forgiven.taps.length, 1, `a ${WOBBLE_TAP_TOLERANCE_PX - 1}px smear is still a tap`);

  // Exactly at the tolerance it is a deliberate drag and must not also score.
  const { canvas, taps } = harness(['tap', 'drag']);
  canvas.fire('pointerdown', 100, 100);
  canvas.fire('pointermove', 100 + WOBBLE_TAP_TOLERANCE_PX, 100);
  canvas.fire('pointerup', 100 + WOBBLE_TAP_TOLERANCE_PX, 100);
  assert.equal(taps.length, 0, `a ${WOBBLE_TAP_TOLERANCE_PX}px drag must not be forgiven as a tap — the comparison is <, not <=`);
});

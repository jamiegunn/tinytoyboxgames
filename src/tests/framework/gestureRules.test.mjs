/**
 * Interaction gesture-rules contract test — behavioural, ruthless.
 *
 * Enforces architecture-standards.md#interactioncontroller. These two rules are
 * the child-UX heart of every tap in the app; if they drift, toddlers either
 * get swallowed taps (wobble misclassified as drag) or dead taps. The module is
 * pure (imports nothing), so this loads the REAL implementation and pins every
 * boundary of the classification and the proximity fallback.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './_tsload.mjs';

const g = await loadTs('src/utils/interaction/gestureRules.ts');

test('thresholds are the documented 10 / 28 / 70 px', () => {
  assert.equal(g.DRAG_THRESHOLD_PX, 10);
  assert.equal(g.WOBBLE_TAP_TOLERANCE_PX, 28);
  assert.equal(g.PROXIMITY_PX, 70);
});

test('classifyGesture: below the drag threshold is always a tap', () => {
  for (const drag of [true, false]) {
    assert.equal(g.classifyGesture(0, drag), 'tap');
    assert.equal(g.classifyGesture(9.99, drag), 'tap');
  }
});

test('classifyGesture: a draggable target drags as soon as it passes the threshold', () => {
  assert.equal(g.classifyGesture(10, true), 'drag');
  assert.equal(g.classifyGesture(11, true), 'drag');
  assert.equal(g.classifyGesture(1000, true), 'drag');
});

test('classifyGesture: a non-draggable target forgives a wobble up to (not incl.) 28px', () => {
  assert.equal(g.classifyGesture(10, false), 'tap', '10px wobble is a tap');
  assert.equal(g.classifyGesture(27.99, false), 'tap', 'just under 28 is still a tap');
  assert.equal(g.classifyGesture(28, false), 'drag', '28 exactly is a drag (boundary)');
  assert.equal(g.classifyGesture(50, false), 'drag');
});

test('nearestPointWithin: empty or all-outside returns -1', () => {
  assert.equal(g.nearestPointWithin(0, 0, [], 70), -1);
  assert.equal(
    g.nearestPointWithin(
      0,
      0,
      [
        { x: 100, y: 0 },
        { x: 0, y: 200 },
      ],
      70,
    ),
    -1,
  );
});

test('nearestPointWithin: picks the closest qualifying target', () => {
  const pts = [
    { x: 60, y: 0 }, // 60px away
    { x: 30, y: 0 }, // 30px away ← nearest
    { x: 65, y: 0 }, // 65px away
  ];
  assert.equal(g.nearestPointWithin(0, 0, pts, 70), 1);
});

test('nearestPointWithin: radius is inclusive at exactly radiusPx', () => {
  // A point exactly 70px away qualifies (distSq == radius²).
  assert.equal(g.nearestPointWithin(0, 0, [{ x: 70, y: 0 }], 70), 0);
  // 70.01px away does not.
  assert.equal(g.nearestPointWithin(0, 0, [{ x: 70.01, y: 0 }], 70), -1);
});

test('nearestPointWithin: uses Euclidean distance (diagonal)', () => {
  // (42,56) is 70px away (3-4-5 → 42²+56²=70²); (50,50) is ~70.7px away.
  assert.equal(g.nearestPointWithin(0, 0, [{ x: 50, y: 50 }], 70), -1, 'diagonal 70.7 is outside 70');
  assert.equal(g.nearestPointWithin(0, 0, [{ x: 42, y: 56 }], 70), 0, 'diagonal exactly 70 qualifies');
});

/**
 * math consolidation contract test — behavioural.
 *
 * Enforces architecture-standards.md#math (the single canonical `utils/math.ts`).
 * The critical standardization decision was to preserve BOTH lerps rather than
 * collapse them: scenes used an UNCLAMPED lerp, minigames a CLAMPED one, and
 * silently unifying to one would have changed motion in half the codebase. These
 * tests pin that distinction and the other shared helpers so a future "cleanup"
 * cannot quietly regress it.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './_tsload.mjs';

const math = await loadTs('src/utils/math.ts');

test('lerp is unclamped; lerpClamped clamps t to [0,1] (the preserved distinction)', () => {
  // In-range: identical.
  assert.equal(math.lerp(0, 10, 0.5), 5);
  assert.equal(math.lerpClamped(0, 10, 0.5), 5);
  // Overshoot: unclamped extrapolates, clamped saturates.
  assert.equal(math.lerp(0, 10, 2), 20, 'lerp must extrapolate past b');
  assert.equal(math.lerpClamped(0, 10, 2), 10, 'lerpClamped must saturate at b');
  // Undershoot.
  assert.equal(math.lerp(0, 10, -1), -10, 'lerp must extrapolate below a');
  assert.equal(math.lerpClamped(0, 10, -1), 0, 'lerpClamped must saturate at a');
});

test('clamp bounds a value to [lo, hi]', () => {
  assert.equal(math.clamp(5, 0, 10), 5);
  assert.equal(math.clamp(-3, 0, 10), 0);
  assert.equal(math.clamp(99, 0, 10), 10);
});

test('smooth01 is a smoothstep: fixed endpoints, symmetric midpoint', () => {
  assert.equal(math.smooth01(0), 0);
  assert.equal(math.smooth01(1), 1);
  assert.equal(math.smooth01(0.5), 0.5);
  // Clamps outside [0,1].
  assert.equal(math.smooth01(-1), 0);
  assert.equal(math.smooth01(2), 1);
  // Zero slope at the ends (eases in): value near 0 stays tiny.
  assert.ok(math.smooth01(0.1) < 0.1, 'smoothstep eases in near 0');
});

test('easeOutCubic starts fast and lands exactly at 1', () => {
  assert.equal(math.easeOutCubic(0), 0);
  assert.equal(math.easeOutCubic(1), 1);
  assert.ok(math.easeOutCubic(0.5) > 0.5, 'ease-out is ahead of linear at the midpoint');
});

test('randomRange stays within [min, max] and randomInt within [0, max)', () => {
  for (let i = 0; i < 5000; i++) {
    const r = math.randomRange(2, 5);
    assert.ok(r >= 2 && r < 5.0000001, `randomRange out of bounds: ${r}`);
    const n = math.randomInt(4);
    assert.ok(Number.isInteger(n) && n >= 0 && n < 4, `randomInt out of bounds: ${n}`);
  }
});

test('wrapAngle maps any angle into (-π, π]', () => {
  const twoPi = Math.PI * 2;
  for (const a of [0, Math.PI, -Math.PI, 3 * Math.PI, -5.5, 10]) {
    const w = math.wrapAngle(a);
    assert.ok(w > -Math.PI - 1e-9 && w <= Math.PI + 1e-9, `wrapAngle(${a}) = ${w} out of range`);
    // Same direction modulo 2π.
    const diff = Math.abs((a - w) % twoPi);
    assert.ok(diff < 1e-6 || Math.abs(diff - twoPi) < 1e-6, `wrapAngle(${a}) changed the angle`);
  }
});

test('randomPick returns an element of the array', () => {
  const arr = ['a', 'b', 'c'];
  for (let i = 0; i < 100; i++) assert.ok(arr.includes(math.randomPick(arr)));
});

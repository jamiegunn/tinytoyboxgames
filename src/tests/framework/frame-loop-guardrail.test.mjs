/**
 * FrameClock guardrail — no new self-driven rAF loops.
 *
 * Enforces architecture-standards.md#frameclock mechanically: scene and effect
 * code must subscribe to the shared FrameClock, not start a private
 * `requestAnimationFrame` loop that can outlive teardown, drift, and burn
 * battery. This test scans the whole source tree for `requestAnimationFrame(`
 * calls and fails on any outside a tiny, explicitly-justified allowlist — so a
 * regression is caught at commit time rather than in review.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const srcDir = path.join(packageRoot, 'src');

/**
 * Files permitted to call requestAnimationFrame directly, with the reason.
 * Everything else must use FrameClock.subscribe (see utils/sceneRuntime.ts for
 * how deep call sites reach the scene's clock).
 */
const ALLOWLIST = new Map([
  ['components/SceneFrame.tsx', 'the scene render host — this IS the per-frame pump that ticks the FrameClock'],
  ['minigames/framework/MiniGameHUD.tsx', 'a one-shot rAF to defer a single HUD flash by a frame — not a persistent loop'],
]);

/** Recursively lists .ts/.tsx files under a directory. */
function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

test('no self-driven requestAnimationFrame loops outside the approved render hosts', () => {
  const offenders = [];
  for (const file of walk(srcDir)) {
    const rel = path.relative(srcDir, file).replace(/\\/g, '/');
    // Match actual calls (with paren), not the many prose mentions in comments.
    if (/requestAnimationFrame\(/.test(readFileSync(file, 'utf8')) && !ALLOWLIST.has(rel)) {
      offenders.push(rel);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `These files call requestAnimationFrame() but are not allowlisted. Use FrameClock.subscribe (getSceneClock) instead, or justify + add to the allowlist:\n  ${offenders.join('\n  ')}`,
  );
});

test('the allowlisted render hosts still exist (the guardrail is anchored to real files)', () => {
  for (const rel of ALLOWLIST.keys()) {
    const full = path.join(srcDir, rel);
    assert.ok(
      /requestAnimationFrame\(/.test(readFileSync(full, 'utf8')),
      `${rel} is allowlisted but no longer calls requestAnimationFrame — prune the allowlist`,
    );
  }
});

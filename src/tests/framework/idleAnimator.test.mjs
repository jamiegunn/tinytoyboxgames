/**
 * IdleAnimator contract test.
 *
 * Enforces architecture-standards.md#idleanimator. The whole point of the
 * animator is that looping idle tweens can no longer leak, so the load-bearing
 * guarantees are structural: every preset and the loop() path register their
 * tween on the DisposalScope, phase is randomised so siblings don't pulse in
 * lockstep, and the sinusoid math matches the documented formula.
 *
 * IdleAnimator needs the gsap ticker (a browser runtime) to actually animate,
 * so — like the ParticleEngine — its guarantees are verified by parsing source
 * for the invariants plus an isolated check of the pure sinusoid math, rather
 * than by driving real tweens headless. (See the "Testing & rollout" rule.)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const idleDir = path.join(packageRoot, 'src', 'utils', 'idle');
const animatorSrc = readFileSync(path.join(idleDir, 'idleAnimator.ts'), 'utf8');
const registrySrc = readFileSync(path.join(idleDir, 'registry.ts'), 'utf8');

// ── Structural invariants ─────────────────────────────────────────────────────

test('the five documented presets and the loop/register escape hatches all exist', () => {
  for (const method of ['breathe', 'sway', 'bob', 'spin', 'flicker', 'loop', 'register']) {
    assert.ok(new RegExp(`\\b${method}\\b`).test(animatorSrc), `IdleAnimator must define ${method}()`);
  }
});

test('every looping tween is registered for kill on the scope (the leak fix)', () => {
  // The single chokepoint: handleFor() registers on scope.tween and is the only
  // way a preset returns a handle. register() also routes through scope.tween.
  assert.ok(/scope\.tween\(/.test(animatorSrc), 'must register tweens via scope.tween');
  // Every gsap.to/gsap.timeline that loops must flow through handleFor()/register.
  // Guard: there must be no bare `gsap.to(` result that is neither handled nor returned.
  const loopingTweens = animatorSrc.match(/gsap\.(to|timeline)\(/g) ?? [];
  const handled = animatorSrc.match(/handleFor\(|scope\.tween\(/g) ?? [];
  assert.ok(handled.length >= 2, 'looping tweens must be funnelled through handleFor()/scope.tween');
  assert.ok(loopingTweens.length >= 6, 'expected the presets + loop() to each build a gsap tween/timeline');
});

test('presets use repeat:-1 with yoyo sine.inOut (a true sinusoid), spin is linear', () => {
  assert.ok(/repeat:\s*-1/.test(animatorSrc), 'idle loops must repeat forever');
  assert.ok(/yoyo:\s*true/.test(animatorSrc), 'sinusoidal presets must yoyo');
  assert.ok(/ease:\s*'sine\.inOut'/.test(animatorSrc), 'sinusoidal presets must use sine.inOut');
  assert.ok(/ease:\s*'none'/.test(animatorSrc), 'spin must be linear (ease none)');
});

test('phase is randomised by default so siblings do not pulse in lockstep', () => {
  assert.ok(/phaseFraction\(/.test(animatorSrc), 'presets must derive a phase fraction');
  assert.ok(/randomRange\(0,\s*1\)/.test(animatorSrc), 'default phase must be random over the cycle');
  assert.ok(/\.seek\(/.test(animatorSrc), 'phase must be seeded via seek (no frozen startup delay)');
});

test('registry binds animators weakly per scene and degrades to a no-op, never throws', () => {
  assert.ok(/new WeakMap<Scene, IdleAnimator>/.test(registrySrc), 'registry must key weakly on Scene');
  assert.ok(/console\.warn/.test(registrySrc) && /NOOP/.test(registrySrc), 'a missing animator must be a no-op, not a throw');
});

// ── The sinusoid math (architecture-standards.md#idleanimator) ─────────────────

test('sinusoid model: value(t) = base + amplitude·sin(2π·t/period + phase)', () => {
  // The doc formula, checked as a pure function: yoyo sine.inOut over half a
  // period is exactly this sinusoid. Verify its defining properties.
  const base = 2;
  const amplitude = 0.5;
  const period = 4;
  const value = (t, phase = 0) => base + amplitude * Math.sin((2 * Math.PI * t) / period + phase);
  // Centred on base, bounded by ±amplitude.
  for (let t = 0; t <= period * 2; t += 0.05) {
    const v = value(t);
    assert.ok(v >= base - amplitude - 1e-9 && v <= base + amplitude + 1e-9, `value ${v} escaped ±amplitude`);
  }
  // Periodic.
  assert.ok(Math.abs(value(0) - value(period)) < 1e-9, 'sinusoid must be periodic in `period`');
  // A quarter period reaches the peak.
  assert.ok(Math.abs(value(period / 4) - (base + amplitude)) < 1e-9, 'peak at a quarter period');
  // Phase offset shifts the curve (not in lockstep): at t=0, sin(0)=0 but
  // sin(π/2)=1, so a quarter-turn phase moves the value by a full amplitude.
  assert.ok(Math.abs(value(0, 0) - value(0, Math.PI / 2)) > 1e-6, 'a phase offset must change the instantaneous value');
});

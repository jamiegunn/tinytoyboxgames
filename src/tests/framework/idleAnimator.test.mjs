/**
 * IdleAnimator contract test.
 *
 * Enforces architecture-standards.md#idleanimator.
 *
 * WHY THIS FILE WAS REWRITTEN. The previous version opened with this excuse:
 *
 *   "IdleAnimator needs the gsap ticker (a browser runtime) to actually animate,
 *    so — like the ParticleEngine — its guarantees are verified by parsing source
 *    for the invariants plus an isolated check of the pure sinusoid math, rather
 *    than by driving real tweens headless."
 *
 * It is not true, and a five-line experiment refutes it: gsap's `seek`,
 * `totalTime`, `progress`, `duration`, `repeat` and `yoyo` all work in Node with
 * no ticker, no rAF and no DOM. The ticker only drives the clock; if you supply
 * the time yourself, the tween evaluates and writes to its target exactly as it
 * does in a browser. Every assertion below reads a real `Object3D` or a real
 * `MeshStandardMaterial` after a real tween has written to it.
 *
 * WHAT THE EXCUSE COST. Freed from driving the code, the old suite tested two
 * things instead: regexes against the source text, and a local copy of the
 * sinusoid formula declared inside the test file. The copy read
 *
 *   value(t) = base + amplitude · sin(2π·t/period + phase)
 *
 * and the suite proved that copy was periodic, peaked at a quarter period and was
 * "centred on base, bounded by ±amplitude". All true of the copy. None of it true
 * of the animator, which yoyos `sine.inOut` between two endpoints and therefore
 * traces a raised cosine — one-sided, mean `base + amplitude/2`, never once
 * dipping below `base`. The test could not fail, because nothing it asserted was
 * connected to the module it was named after; and because it agreed with the
 * class docblock, the two of them corroborated each other for the whole life of
 * the module while three call sites quietly encoded the real behaviour and a
 * fourth worked around it.
 *
 * So the curves are pinned here, numerically, against the tweens themselves.
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { Object3D, MeshStandardMaterial } from 'three';
import gsap from 'gsap';
import { bundleTs } from './_tsload.mjs';

const IA = await bundleTs('src/utils/idle/idleAnimator.ts');
const DISPOSAL = await bundleTs('src/utils/disposal.ts');

// gsap's ticker holds a live timer for as long as any `repeat: -1` tween exists,
// and every preset here is one, so without this the test process would report
// all its results and then hang forever. Killing the tweens is not enough: one
// timer survives. `_tsload.mjs` keeps gsap external precisely so this line can
// reach the same ticker the animator is using.
after(() => gsap.ticker.sleep());

// A disposal scope that also hands back the tweens registered on it.
//
// Capturing at the registration chokepoint doubles as the proof that
// registration happened at all, which is the module's whole reason to exist.
function harness() {
  const real = DISPOSAL.createDisposalScope();
  const tweens = [];
  const scope = {
    ...real,
    tween: (t) => {
      tweens.push(t);
      real.tween(t);
    },
  };
  return { idle: IA.createIdleAnimator(scope), tweens, scope: real };
}

// Samples a channel across exactly one full there-and-back cycle.
function cycle(tween, read, period, steps = 24) {
  const out = [];
  for (let i = 0; i <= steps; i += 1) {
    tween.totalTime((i / steps) * period);
    out.push(read());
  }
  return out;
}

const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;

// ── Registration: the leak fix, proven rather than grepped ───────────────────

test('every preset registers its tween on the scope, so none can outlive it', () => {
  const { idle, tweens } = harness();
  const obj = new Object3D();
  idle.breathe(obj, { period: 2, amplitude: 0.1 });
  idle.sway(obj, { period: 2, amplitude: 0.1 });
  idle.bob(obj, { period: 2, amplitude: 0.1 });
  idle.spin(obj, { period: 2 });
  idle.flicker(new MeshStandardMaterial(), { period: 2, amplitude: 0.2 });
  idle.loop((tl) => tl.to(obj.position, { x: 1, duration: 1 }));
  assert.equal(tweens.length, 6, `only ${tweens.length} of the 6 idle entry points registered a killable`);
  for (const t of tweens) assert.equal(typeof t.kill, 'function', 'a registered object is not killable');
});

test('disposing the scope kills every idle it owns', () => {
  const { idle, tweens, scope } = harness();
  const obj = new Object3D();
  idle.breathe(obj, { period: 2, amplitude: 0.1 });
  idle.spin(obj, { period: 2 });
  // Wrap kill rather than reading isActive(): gsap reports a killed repeating
  // tween as still active, so isActive() would pass whether or not kill ran.
  const killed = [];
  for (const t of tweens) {
    const original = t.kill.bind(t);
    t.kill = () => {
      killed.push(t);
      return original();
    };
  }
  scope.dispose();
  assert.equal(killed.length, tweens.length, `scope.dispose() killed ${killed.length} of ${tweens.length} idles`);
});

test('the handle stops an idle early, and stopping twice is harmless', () => {
  const { idle, tweens } = harness();
  const handle = idle.breathe(new Object3D(), { period: 2, amplitude: 0.1 });
  let kills = 0;
  const original = tweens[0].kill.bind(tweens[0]);
  tweens[0].kill = () => {
    kills += 1;
    return original();
  };
  handle.stop();
  handle.stop();
  assert.equal(kills, 1, `stop() is not idempotent — it killed ${kills} times`);
});

test('register() adopts an existing killable and returns the very same object', () => {
  const { idle, tweens } = harness();
  const foreign = { kill: () => {} };
  const returned = idle.register(foreign);
  assert.equal(returned, foreign, 'register() must return its argument so it can be used inline');
  assert.deepEqual(tweens, [foreign], 'register() did not put the adopted tween on the scope');
});

test('loop() hands the builder a forever-repeating timeline', () => {
  const { idle, tweens } = harness();
  let received = null;
  idle.loop((tl) => {
    received = tl;
    tl.to(new Object3D().position, { x: 1, duration: 0.5 });
  });
  assert.ok(received, 'loop() never called its builder');
  assert.equal(received, tweens[0], 'the timeline handed to the builder is not the one registered');
  assert.equal(received.repeat(), -1, `loop() built a timeline with repeat ${received.repeat()}, not -1`);
});

// ── The curves, measured off the tweens ──────────────────────────────────────

test('breathe swells one way: [base, base·(1+amplitude)], never smaller than base', () => {
  const { idle, tweens } = harness();
  const obj = new Object3D();
  obj.scale.set(2, 2, 2);
  idle.breathe(obj, { period: 4, amplitude: 0.05, phase: 0 });
  const seen = cycle(tweens[0], () => obj.scale.x, 4);
  const min = Math.min(...seen);
  const max = Math.max(...seen);
  assert.ok(near(min, 2), `breathe dipped to ${min}; the base scale 2 must be the floor, not the centre`);
  assert.ok(near(max, 2.1), `breathe peaked at ${max}, expected base·(1+0.05) = 2.1`);
  // And the shape is the raised cosine, not the sine the docs used to claim.
  for (let i = 0; i <= 24; i += 1) {
    const t = (i / 24) * 4;
    tweens[0].totalTime(t);
    const raisedCosine = 2 + ((2 * 0.05) / 2) * (1 - Math.cos((2 * Math.PI * t) / 4));
    assert.ok(near(obj.scale.x, raisedCosine), `at t=${t} scale.x was ${obj.scale.x}, raised cosine predicts ${raisedCosine}`);
  }
});

test('breathe touches only the axes it was given', () => {
  const { idle, tweens } = harness();
  const obj = new Object3D();
  idle.breathe(obj, { period: 4, amplitude: 0.5, axes: ['y'], phase: 0 });
  tweens[0].totalTime(2); // the far end of the swell
  assert.ok(near(obj.scale.y, 1.5), `scale.y reached ${obj.scale.y}, expected 1.5`);
  assert.ok(near(obj.scale.x, 1), `scale.x moved to ${obj.scale.x} despite axes: ['y']`);
  assert.ok(near(obj.scale.z, 1), `scale.z moved to ${obj.scale.z} despite axes: ['y']`);
});

test('sway straddles its rest pose — a pendulum is centred on where it hangs', () => {
  const { idle, tweens } = harness();
  const obj = new Object3D();
  obj.rotation.z = 0.3;
  idle.sway(obj, { period: 4, amplitude: 0.1, phase: 0 });
  const seen = cycle(tweens[0], () => obj.rotation.z, 4);
  const min = Math.min(...seen);
  const max = Math.max(...seen);
  assert.ok(near(min, 0.2), `sway bottomed out at ${min}, expected base 0.3 − 0.1`);
  assert.ok(near(max, 0.4), `sway topped out at ${max}, expected base 0.3 + 0.1`);
  assert.ok(near((min + max) / 2, 0.3), `sway is centred on ${(min + max) / 2}, not on its rest pose 0.3`);
});

test('sway defaults to z and honours an explicit axis', () => {
  const { idle, tweens } = harness();
  const dflt = new Object3D();
  idle.sway(dflt, { period: 4, amplitude: 0.1, phase: 0 });
  tweens[0].totalTime(2);
  assert.ok(near(dflt.rotation.z, 0.1), `default sway axis moved rotation.z to ${dflt.rotation.z}, expected 0.1`);
  assert.ok(near(dflt.rotation.x, 0), 'default sway must not touch rotation.x');

  const explicit = new Object3D();
  idle.sway(explicit, { period: 4, amplitude: 0.1, axis: 'x', phase: 0 });
  tweens[1].totalTime(2);
  assert.ok(near(explicit.rotation.x, 0.1), `explicit axis moved rotation.x to ${explicit.rotation.x}, expected 0.1`);
  assert.ok(near(explicit.rotation.z, 0), 'an explicit axis must leave z alone');
});

test('bob travels one way, so `amplitude: target − current` lands on the target', () => {
  // This is the idiom at toyBall.ts, rubberDuck.ts and kitchen/floorToys.ts.
  // If bob ever became symmetric they would all overshoot backwards by the
  // same distance they were meant to travel forwards.
  const { idle, tweens } = harness();
  const obj = new Object3D();
  obj.position.y = 0.5;
  const target = 0.9;
  idle.bob(obj, { period: 4, amplitude: target - obj.position.y, phase: 0 });
  const seen = cycle(tweens[0], () => obj.position.y, 4);
  assert.ok(near(Math.min(...seen), 0.5), `bob dropped to ${Math.min(...seen)} below its start of 0.5`);
  assert.ok(near(Math.max(...seen), target), `bob reached ${Math.max(...seen)}, expected exactly the target ${target}`);
});

test('flicker oscillates emissive intensity upward from the base', () => {
  const { idle, tweens } = harness();
  const material = new MeshStandardMaterial();
  material.emissiveIntensity = 1;
  idle.flicker(material, { period: 4, amplitude: 0.4, phase: 0 });
  const seen = cycle(tweens[0], () => material.emissiveIntensity, 4);
  assert.ok(near(Math.min(...seen), 1), `flicker dimmed to ${Math.min(...seen)}, below its base intensity of 1`);
  assert.ok(near(Math.max(...seen), 1.4), `flicker peaked at ${Math.max(...seen)}, expected 1.4`);
});

test('spin is linear and completes exactly one revolution per period', () => {
  const { idle, tweens } = harness();
  const obj = new Object3D();
  idle.spin(obj, { period: 8, phase: 0 });
  const quarter = [];
  for (let i = 0; i <= 4; i += 1) {
    tweens[0].totalTime((i / 4) * 8);
    quarter.push(obj.rotation.y);
  }
  // Compared against 2π directly, not `% 2π`. gsap rounds what it writes to six
  // decimals, so the tween lands on 6.283185 and `6.283185 % 6.283185307…` is
  // 6.283185 rather than 0 — a modulo here fails on a correct implementation.
  assert.ok(near(quarter[4], Math.PI * 2, 1e-5), `one period turned ${quarter[4]} rad, not a full 2π revolution`);
  // Linear means equal steps. A sine ease would bunch them at the ends.
  for (let i = 1; i <= 4; i += 1) {
    assert.ok(near(quarter[i] - quarter[i - 1], Math.PI / 2, 1e-5), `quarter ${i} advanced ${quarter[i] - quarter[i - 1]}, not π/2 — spin is not linear`);
  }
});

test('spin honours direction: -1', () => {
  const { idle, tweens } = harness();
  const obj = new Object3D();
  idle.spin(obj, { period: 8, direction: -1, phase: 0.25 });
  assert.ok(obj.rotation.y < 0, `reverse spin produced rotation.y ${obj.rotation.y}, which is not negative`);
});

// ── Phase ────────────────────────────────────────────────────────────────────

test('phase seeks the tween rather than delaying it, so nothing starts frozen', () => {
  const { idle, tweens } = harness();
  idle.breathe(new Object3D(), { period: 4, amplitude: 0.1, phase: 0.25 });
  assert.equal(tweens[0].delay(), 0, `phase was realised as a ${tweens[0].delay()}s delay; a delayed prop sits motionless at one extreme`);
  assert.ok(near(tweens[0].totalTime(), 1), `phase 0.25 of a 4s period should seek to t=1, but the tween is at ${tweens[0].totalTime()}`);
});

test('an explicit phase lands on the curve it names', () => {
  const { idle } = harness();
  // Half a cycle into a one-sided swell is the far extreme.
  const half = new Object3D();
  idle.breathe(half, { period: 4, amplitude: 0.2, phase: 0.5 });
  assert.ok(near(half.scale.x, 1.2), `phase 0.5 sits at ${half.scale.x}, expected the peak 1.2`);
  // A full cycle is back to the start.
  const whole = new Object3D();
  idle.breathe(whole, { period: 4, amplitude: 0.2, phase: 0 });
  assert.ok(near(whole.scale.x, 1), `phase 0 sits at ${whole.scale.x}, expected the base 1`);
});

test('the default phase is random, so a shelf of identical toys does not pulse in lockstep', () => {
  const { idle } = harness();
  const starts = new Set();
  for (let i = 0; i < 24; i += 1) {
    const obj = new Object3D();
    idle.breathe(obj, { period: 4, amplitude: 0.2 });
    starts.add(obj.scale.x.toFixed(6));
  }
  // 24 draws from a continuous distribution; anything below ~20 distinct values
  // means the phase is being quantised or ignored.
  assert.ok(starts.size >= 20, `24 sibling props started at only ${starts.size} distinct points in their cycle`);
});

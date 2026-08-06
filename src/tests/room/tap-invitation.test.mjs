/**
 * The tap invitation's SHOW RULE, driven rather than described.
 *
 * WHY THIS FILE HAD TO EXIST BEFORE THE FEATURE COULD BE CALLED DONE. The halo is
 * a time-based effect: it appears a couple of seconds after the room opens,
 * withdraws the instant the child touches anything, and returns after a long
 * quiet. Every one of those is invisible in a screenshot, and the headless
 * renderer this repository takes its pictures with cannot help either --
 * `requestAnimationFrame` does not run under its software GL, so gsap's clock
 * advanced 0.58 s across four seconds of wall time and no animation ever reached
 * a second frame. A screenshot of this feature can only ever show one instant of
 * it, chosen by accident. So the timing is asserted here, against the real module
 * with the real tweens, by supplying the clock by hand -- the same technique
 * `tests/framework/idleAnimator.test.mjs` established after the previous suite
 * excused itself from driving gsap and spent its life testing a copy of a formula
 * that was not the one in the module.
 *
 * WHAT DRIVING IT BY HAND COST ME, AND WHY THE STEPS BELOW ARE SMALL. `updateRoot`
 * evaluates the timeline at the time you name; it does not simulate the times in
 * between. A `delayedCall` that fires at 2.5 s creates the fade-in tween AT the
 * moment it fires, so a single jump to 3.5 s leaves that tween newly born with
 * zero progress and the halo still invisible -- which is exactly what the render
 * harness reported when it jumped straight there, and it looked like a bug in the
 * feature for about ten minutes. It is not; it is what stepping a clock in one
 * stride does to anything that schedules work from inside a callback. `advance()`
 * therefore walks in sub-frame steps, and any future test that jumps instead will
 * measure the same illusion.
 *
 * THE ONE PLACE THIS DOES NOT USE THE REAL THING is `document`: there is none
 * under `node --test`, so `ringTexture()` returns null and the sprite carries no
 * map. That is deliberate in the module and it costs this suite nothing, because
 * every observable here is a transform, an opacity or a scene-graph edge, and
 * none of them is drawn.
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { BoxGeometry, Mesh, MeshStandardMaterial, Raycaster, Scene, Vector2, Vector3 } from 'three';
import gsap from 'gsap';
import { bundleEntry } from '../framework/_tsload.mjs';

const M = await bundleEntry(
  'tapInvitation',
  [
    `export { createTapInvitation } from '@app/utils/scene/tapInvitation';`,
    `export { setSceneIdleAnimator } from '@app/utils/idle/registry';`,
    `export { createDisposalScope } from '@app/utils/disposal';`,
    `export { STACK_CONTACT_Y } from '@app/utils/scene/perchSurfaces';`,
  ].join('\n'),
);

// A `repeat: -1` tween keeps gsap's ticker holding a live timer, and this module
// creates one per halo. Without this the suite reports every result and then
// never exits. Same reason, same fix, as `idleAnimator.test.mjs`.
after(() => gsap.ticker.sleep());

/** The module's own constants, read from the source rather than retyped here. */
const SOURCE = await import('node:fs').then((fs) => fs.readFileSync(new URL('../../src/utils/scene/tapInvitation.ts', import.meta.url), 'utf8'));
const constant = (name) => {
  const m = SOURCE.match(new RegExp(`^const ${name} = ([0-9.]+);`, 'm'));
  assert.ok(m, `tapInvitation.ts no longer declares ${name} as a plain number — this suite reads its constants from the source so it can never drift from them`);
  return Number(m[1]);
};
const APPEAR_DELAY = constant('APPEAR_DELAY');
const IDLE_RETURN = constant('IDLE_RETURN');
const FADE = constant('FADE');
const BREATH_PERIOD = constant('BREATH_PERIOD');
const BREATH_DEPTH = constant('BREATH_DEPTH');
const PEAK_OPACITY = constant('PEAK_OPACITY');
const GAP_Y = constant('GAP_Y');

/**
 * Builds one invitation over a box-shaped stand-in for a toybox.
 *
 * The target is a real `Mesh` and not a bare `Object3D` because the module sizes
 * and places the halo from `Box3.setFromObject`, which returns an EMPTY box for
 * an object with no geometry -- and the module's own early return for an empty
 * box would then make every assertion below vacuously pass.
 */
function harness() {
  const scene = new Scene();
  const scope = M.createDisposalScope();
  M.setSceneIdleAnimator(scene, scope);

  const target = new Mesh(new BoxGeometry(1.4, 1.0, 1.2), new MeshStandardMaterial());
  target.name = 'toybox_test_root';
  target.position.set(2, 0.5, -3);
  scene.add(target);
  scene.updateMatrixWorld(true);

  const listeners = new Map();
  const canvas = {
    addEventListener: (type, fn) => listeners.set(type, fn),
    removeEventListener: (type) => listeners.delete(type),
  };

  gsap.ticker.sleep();
  const t0 = gsap.globalTimeline.time();
  const invitation = M.createTapInvitation(scene, canvas, target);
  const sprite = scene.children.find((c) => c.name.startsWith('tapInvitation_'));
  assert.ok(sprite, 'no halo was added to the scene');

  /** Steps the global timeline in sub-frame slices. See the header for why. */
  const advance = (seconds) => {
    const steps = Math.max(1, Math.ceil(seconds / 0.05));
    for (let i = 0; i < steps; i++) gsap.updateRoot(gsap.globalTimeline.time() + seconds / steps);
  };

  return {
    scene,
    scope,
    target,
    sprite,
    invitation,
    advance,
    t0,
    tap: () => listeners.get('pointerdown')?.(),
    hasPointerListener: () => listeners.has('pointerdown'),
    opacity: () => sprite.material.opacity,
    shown: () => sprite.visible && sprite.material.opacity > 0.002,
  };
}

test('the halo starts invisible, so opening a room does not flash a ring in the first frame', () => {
  const h = harness();
  assert.equal(h.opacity(), 0, `the halo was born at opacity ${h.opacity()}`);
  h.advance(APPEAR_DELAY - 0.4);
  assert.ok(!h.shown(), `the halo showed itself ${(APPEAR_DELAY - 0.4).toFixed(1)}s in, before the ${APPEAR_DELAY}s wait was over`);
  h.invitation.dispose();
});

test('it fades in after the appear delay and reaches its full breathing range', () => {
  const h = harness();
  h.advance(APPEAR_DELAY + FADE + 0.2);
  assert.ok(h.shown(), 'the halo never appeared after the appear delay plus a full fade');

  // A whole breath, sampled. The breath is a yoyo between two endpoints, so the
  // opacity traces a raised cosine between PEAK*(1-DEPTH) and PEAK -- asserting
  // the ENDS is what catches a breath that has stopped moving, which is the
  // failure mode that shipped once already when `overwrite: true` killed it.
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < 60; i++) {
    h.advance(BREATH_PERIOD / 60);
    lo = Math.min(lo, h.opacity());
    hi = Math.max(hi, h.opacity());
  }
  assert.ok(hi > lo + 1e-4, `the halo is not breathing — opacity stayed within [${lo.toFixed(4)}, ${hi.toFixed(4)}] across a full ${BREATH_PERIOD}s period`);
  assert.ok(Math.abs(hi - PEAK_OPACITY) < 0.02, `the breath peaks at ${hi.toFixed(3)}, not the declared PEAK_OPACITY ${PEAK_OPACITY}`);
  assert.ok(
    Math.abs(lo - PEAK_OPACITY * (1 - BREATH_DEPTH)) < 0.02,
    `the breath troughs at ${lo.toFixed(3)}, not the ${(PEAK_OPACITY * (1 - BREATH_DEPTH)).toFixed(3)} that PEAK_OPACITY and BREATH_DEPTH declare`,
  );
  h.invitation.dispose();
});

test('any touch anywhere on the canvas withdraws it, including a drag that lands on nothing', () => {
  const h = harness();
  h.advance(APPEAR_DELAY + FADE + 0.2);
  assert.ok(h.shown(), 'precondition failed: the halo was not up before the tap');
  h.tap();
  h.advance(FADE + 0.2);
  assert.ok(!h.shown(), `the halo was still at opacity ${h.opacity().toFixed(3)} a full fade after the child touched the screen`);
  h.invitation.dispose();
});

test('it comes back after a long quiet, and each new touch restarts that quiet', () => {
  const h = harness();
  h.advance(APPEAR_DELAY + FADE + 0.2);
  h.tap();
  h.advance(FADE + 0.2);

  // Most of the way through the quiet period, then interrupted. If the wait were
  // additive rather than restarted, the halo would appear during the second leg.
  h.advance(IDLE_RETURN - 1.0);
  assert.ok(!h.shown(), `the halo came back after ${(IDLE_RETURN - 1.0).toFixed(1)}s, before the ${IDLE_RETURN}s quiet was up`);
  h.tap();
  h.advance(IDLE_RETURN - 1.0);
  assert.ok(!h.shown(), 'a second touch did not restart the quiet period — the halo returned early');

  h.advance(1.0 + FADE + 0.2);
  assert.ok(h.shown(), `the halo never came back: after a full ${IDLE_RETURN}s quiet it is at opacity ${h.opacity().toFixed(3)}`);
  h.invitation.dispose();
});

test('the halo cannot swallow the tap it exists to invite', () => {
  const h = harness();
  h.advance(APPEAR_DELAY + FADE + 0.2);
  h.scene.updateMatrixWorld(true);

  // A ray fired straight down the halo's own centre from above. It must pass
  // through the halo and reach the box; if `raycast` were left at the default,
  // the sprite would be the first hit and the child's finger would land on a
  // ring of light instead of the toybox.
  const caster = new Raycaster(new Vector3(h.sprite.position.x, 20, h.sprite.position.z), new Vector3(0, -1, 0));
  const hits = caster.intersectObjects(h.scene.children, true);
  assert.ok(hits.length > 0, 'the probe ray hit nothing at all — the harness, not the module, is broken');
  assert.ok(
    !hits.some((hit) => hit.object === h.sprite),
    'the halo is raycastable, so it will intercept the tap it is asking the child to make',
  );
  h.invitation.dispose();
});

test('the halo floats far enough clear of the lid that the owl cannot perch on it', () => {
  const h = harness();
  h.scene.updateMatrixWorld(true);
  const lidY = 1.0; // the stand-in box: centre y 0.5, height 1.0
  const haloBottom = h.sprite.position.y - h.sprite.scale.y / 2;
  assert.ok(
    haloBottom - lidY >= M.STACK_CONTACT_Y,
    `the halo's lower edge is only ${(haloBottom - lidY).toFixed(3)} above the lid, inside perchSurfaces' STACK_CONTACT_Y of ` +
      `${M.STACK_CONTACT_Y} — it would be classified as something to stand ON and the owl would land on a ring of light`,
  );
  assert.ok(Math.abs(haloBottom - lidY - GAP_Y) < 1e-6, `GAP_Y says ${GAP_Y} but the gap measures ${(haloBottom - lidY).toFixed(4)}`);
  h.invitation.dispose();
});

test('dispose takes the halo, its listener and every tween it owns with it', () => {
  const h = harness();
  h.advance(APPEAR_DELAY + FADE + 0.2);
  const before = gsap.globalTimeline.getChildren(true, true, true).length;
  assert.ok(h.hasPointerListener(), 'precondition failed: no pointerdown listener was ever installed');

  h.invitation.dispose();

  assert.ok(!h.scene.children.includes(h.sprite), 'the halo is still in the scene after dispose');
  assert.ok(!h.hasPointerListener(), 'the canvas is still holding a pointerdown listener for a disposed halo');
  const after = gsap.globalTimeline.getChildren(true, true, true).length;
  assert.ok(after < before, `dispose left every tween running — ${before} before, ${after} after`);

  // The strong form: nothing on the timeline may still be writing to this
  // sprite. A surviving `repeat: -1` breath would animate a detached object
  // forever, which is the exact defect `playroom-timer-ownership` was written for.
  const survivors = gsap.globalTimeline
    .getChildren(true, true, true)
    .filter((t) => (t.targets?.() ?? []).some((o) => o === h.sprite || o === h.sprite.material));
  assert.equal(survivors.length, 0, `${survivors.length} tween(s) are still animating a disposed halo`);
});

test('a target with no geometry is declined rather than given a zero-sized halo', () => {
  const scene = new Scene();
  const scope = M.createDisposalScope();
  M.setSceneIdleAnimator(scene, scope);
  const empty = new Mesh();
  empty.name = 'toybox_empty_root';
  scene.add(empty);
  scene.updateMatrixWorld(true);

  const invitation = M.createTapInvitation(scene, { addEventListener: () => {}, removeEventListener: () => {} }, empty);
  assert.ok(
    !scene.children.some((c) => c.name.startsWith('tapInvitation_')),
    'a halo was added over a target with no bounds, so it would sit at the world origin at zero size',
  );
  invitation.dispose();
});

// Silences an unused-import lint if the vector helpers above are ever trimmed.
void Vector2;

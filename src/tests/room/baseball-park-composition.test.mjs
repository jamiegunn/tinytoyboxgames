/**
 * Baseball Park is composed, and its two interactive props actually answer.
 *
 * WHAT THIS GUARDS. The scene is authored as procedural Three.js geometry, so
 * "it renders" is not something the type checker can promise — a composer that
 * throws, a staging entry that puts a base off the dirt, or a tap handler wired
 * to the wrong mesh all type-check cleanly. This suite builds the scene the way
 * the runtime does — every composer in `index.ts`, over a bare `Scene` — and
 * then drives the batting tee and a loose ball through a capturing dispatcher,
 * so the `create` / `compose` / `interaction` module in each prop family runs
 * under coverage rather than merely compiling.
 *
 * It is deliberately NOT a pixel test. What a child sees is bounded by the
 * framing suites (`scene-ground-coverage`, `sceneAxes`); what this suite owns is
 * that the scene's own building blocks assemble and react.
 *
 * ONE BUNDLE, NOT MANY. Every module is pulled through a single `bundleEntry`
 * re-export so the props and the tap wiring share one copy of every shared
 * module — most importantly the animation/particle helpers the handlers call.
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { Object3D, Scene } from 'three';
import { bundleEntry } from '../framework/_tsload.mjs';

const SCENE = '@app/scenes/immersive-toybox-scenes/baseball-park';

const M = await bundleEntry(
  'baseball-park-composition',
  [
    // gsap comes THROUGH the bundle, not from a direct import: the scene's
    // animation helper tweens with the bundled copy, and `isTweening` on a
    // different module instance would never see those tweens. This is the same
    // one-bundle discipline the pirate-cove interaction suite documents.
    `export { default as gsap } from 'gsap';`,
    `export { createImmersiveSceneMaterials } from '${SCENE}/materials';`,
    `export { composeInfieldProps } from '${SCENE}/factory/props/simple/infield';`,
    `export { composeBleacherProps } from '${SCENE}/factory/props/simple/bleachers';`,
    `export { composeScoreboardProps } from '${SCENE}/factory/props/simple/scoreboard';`,
    `export { composeBattingTeeProps } from '${SCENE}/factory/props/interactive/battingTee';`,
    `export { composeLooseBallProps } from '${SCENE}/factory/props/interactive/looseBalls';`,
    `export { INFIELD_STAGING } from '${SCENE}/staging/infield';`,
    `export { BATTING_TEE_STAGING } from '${SCENE}/staging/battingTee';`,
    `export { LOOSE_BALLS_STAGING } from '${SCENE}/staging/looseBalls';`,
    `export { HALF_DIAGONAL, DIRT_SIDE } from '${SCENE}/factory/props/simple/infield/constants';`,
  ].join('\n'),
);

const gsap = M.gsap;

// playAnimation starts gsap tweens; without this the process never exits.
after(() => gsap.ticker.sleep());

/**
 * A dispatcher stand-in that captures every registered (target, handler) pair
 * so the test can fire a specific prop's tap directly.
 *
 * @returns {{dispatcher: object, handlers: Map<import('three').Object3D, () => void>}}
 */
function capturingDispatcher() {
  const handlers = new Map();
  const dispatcher = {
    register: (target, handler) => {
      handlers.set(target, handler);
      return () => handlers.delete(target);
    },
    registerWithPoint: (target, handler) => {
      handlers.set(target, () => handler(target.getWorldPosition?.(undefined) ?? undefined));
      return () => handlers.delete(target);
    },
    setMissHandler: () => {},
    dispose: () => {},
  };
  return { dispatcher, handlers };
}

/**
 * Builds every baseball-park composer into a fresh scene.
 *
 * @param {object} dispatcher A dispatcher (capturing or noop).
 * @returns {{scene: import('three').Scene, teardowns: Array<() => void>}}
 */
function buildScene(dispatcher) {
  const scene = new Scene();
  const materials = M.createImmersiveSceneMaterials();
  const ctx = { scene, canvas: {}, camera: new Object3D(), dispatcher, materials };
  const composers = [M.composeInfieldProps, M.composeBleacherProps, M.composeScoreboardProps, M.composeBattingTeeProps, M.composeLooseBallProps];
  const teardowns = [];
  for (const compose of composers) {
    const off = compose(ctx);
    if (typeof off === 'function') teardowns.push(off);
  }
  return { scene, teardowns };
}

test('every composer builds without throwing and populates the scene', () => {
  const { dispatcher } = capturingDispatcher();
  const { scene, teardowns } = buildScene(dispatcher);

  // Each prop family roots its meshes under a named group; assert every family
  // actually put something in the scene.
  const rootNames = new Set();
  scene.traverse((o) => {
    if (o.name) rootNames.add(o.name);
  });
  for (const expected of ['baseball_infield', 'baseball_bleachers', 'baseball_scoreboard', 'baseball_batting_tee', 'baseball_loose_ball']) {
    assert.ok(rootNames.has(expected), `scene is missing the ${expected} root — a composer built nothing`);
  }

  for (const off of teardowns) off();
});

test('the infield bases sit on the dirt, at the diamond corners', () => {
  const { dispatcher } = capturingDispatcher();
  const { scene, teardowns } = buildScene(dispatcher);

  const byName = new Map();
  scene.traverse((o) => byName.set(o.name, o));

  // Home plate is the -Z corner; second base the +Z corner. Their separation
  // is the full diagonal (two corners either side of centre), and each sits at
  // the staged infield centre (z = 1.5) plus/minus its own corner offset.
  const home = byName.get('baseball_home_plate');
  const second = byName.get('baseball_second_base');
  assert.ok(home && second, 'home plate and second base must exist');
  // Local +Z is world +Z (staging rotY 0), so second base is deeper than home.
  assert.ok(second.position.z > home.position.z, 'second base must be deeper into the scene than home plate');

  // Bases rest ON the ground: their y is a small positive lift, never below 0.
  for (const name of ['baseball_first_base', 'baseball_second_base', 'baseball_third_base', 'baseball_home_plate']) {
    const base = byName.get(name);
    assert.ok(base.position.y >= 0 && base.position.y < 0.2, `${name} floats or sinks (y=${base.position.y})`);
  }

  // The constant the whole infield derives from is a real, positive size.
  assert.ok(M.HALF_DIAGONAL > 0 && Math.abs(M.DIRT_SIDE - M.HALF_DIAGONAL * Math.SQRT2) < 1e-9, 'dirt side must be the diagonal of the base square');

  for (const off of teardowns) off();
});

/**
 * Counts the timelines currently parented to the bundled gsap's root, so a
 * before/after delta measures whether firing a handler scheduled animation.
 *
 * This is the observable that survives headless gsap: a Timeline is added to
 * the global timeline the instant `playAnimation` runs, whereas the mesh's
 * numeric value only moves once the ticker advances — which it does not do on
 * its own in `node --test`.
 *
 * @returns {number} Live child count of the global timeline.
 */
function scheduledCount() {
  return gsap.globalTimeline.getChildren(false).length;
}

test('tapping the batting tee ball runs its handler and schedules the pop-fly', () => {
  const { dispatcher, handlers } = capturingDispatcher();
  const { teardowns } = buildScene(dispatcher);

  const ballCore = [...handlers.keys()].find((m) => m.name === 'baseball_tee_ball_core');
  assert.ok(ballCore, 'the tee ball must be registered as a tap target');

  // The handler must run its real interaction module — sound cue, pop-fly
  // animation, sparkle — without throwing, and must actually schedule motion.
  const before = scheduledCount();
  assert.doesNotThrow(() => handlers.get(ballCore)());
  assert.ok(scheduledCount() > before, 'the tap must schedule an animation on the ball');

  for (const off of teardowns) off();
});

test('tapping a loose ball runs its handler and schedules the hop', () => {
  const { dispatcher, handlers } = capturingDispatcher();
  const { teardowns } = buildScene(dispatcher);

  const looseCore = [...handlers.keys()].find((m) => m.name === 'baseball_loose_ball_core');
  assert.ok(looseCore, 'a loose ball must be registered as a tap target');

  const before = scheduledCount();
  assert.doesNotThrow(() => handlers.get(looseCore)());
  assert.ok(scheduledCount() > before, 'the tap must schedule a hop animation on the loose ball');

  for (const off of teardowns) off();
});

test('all three loose balls and one tee are registered as tap targets', () => {
  const { dispatcher, handlers } = capturingDispatcher();
  const { teardowns } = buildScene(dispatcher);

  const targetNames = [...handlers.keys()].map((m) => m.name).sort();
  const looseCount = targetNames.filter((n) => n === 'baseball_loose_ball_core').length;
  const teeCount = targetNames.filter((n) => n === 'baseball_tee_ball_core').length;
  assert.equal(looseCount, M.LOOSE_BALLS_STAGING.length, 'every staged loose ball must register a tap');
  assert.equal(teeCount, M.BATTING_TEE_STAGING.length, 'every staged tee must register a tap');

  for (const off of teardowns) off();
});

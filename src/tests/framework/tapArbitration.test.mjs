/**
 * Tap-arbitration contract test — who wins a tap, and does every tap answer.
 *
 * Round 5's review found three defects in the same family, all of them
 * invisible to the compiler and all of them invisible to a reader of the call
 * sites, because the damage was done by the ORDER of two correct-looking steps
 * inside `onPointerUp` plus one omitted constructor argument:
 *
 *   A. `pickRegistered` returned on any hit, and the ground plane is registered.
 *      So a tap aimed at a mushroom and landing a finger-width off never
 *      "missed every mesh" — it hit the FLOOR, the owl flew, and the proximity
 *      fallback that `gestureRules` documents as a core child-UX guarantee was
 *      never consulted. The ground answered 52-62% of the Nature canvas at every
 *      shipping viewport; a steady-handed child reaching for a flower got it 2%
 *      of the time.
 *   B. The same first-hit-wins rule made a small prop under a TRANSPARENT
 *      registered surface completely unreachable — a raycast reads geometry, not
 *      appearance. Two leaves staged in the stream measured zero tappable pixels
 *      at every viewport.
 *   C. Nothing acknowledged a tap that matched no target, and the controller's
 *      own no-dead-tap fallback had never been wired: `createWorldTapDispatcher`
 *      omitted the audio argument, and the only other caller had no call sites.
 *      Tapped for real at nine viewports, 11758 of 12500 taps were silent.
 *
 * These are behavioural properties of the arbitration, so this suite drives the
 * real controller with synthetic pointer events over a stub canvas and a real
 * camera, and asserts on which handler ran. Each of the first two cases is
 * paired with a CONTROL that registers only the environment surface, which is
 * what makes the assertion mean something: it proves the tap point genuinely
 * lies over the ground/water geometry, so the prop is winning by policy rather
 * than because the tap missed the environment surface anyway.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera, Scene, Mesh, PlaneGeometry, SphereGeometry, MeshBasicMaterial, Vector3 } from 'three';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundleTs } from './_tsload.mjs';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const { createInteractionController, TAP_BACKGROUND_KEY } = await bundleTs('src/utils/interaction/interactionController.ts');

const WIDTH = 800;
const HEIGHT = 600;

/** A canvas stand-in that records listeners so the test can fire pointer events. */
function stubCanvas() {
  const listeners = new Map();
  return {
    addEventListener: (type, fn) => listeners.set(type, fn),
    removeEventListener: (type) => listeners.delete(type),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: WIDTH, height: HEIGHT }),
    fire: (type, x, y) => listeners.get(type)?.({ clientX: x, clientY: y }),
  };
}

/** A disposal-scope stand-in; teardown is not what this suite is about. */
function stubScope() {
  return { listener: () => {}, add: () => {} };
}

/**
 * A camera pitched slightly DOWN but not enough to fill the frame with ground,
 * so the upper part of the view is open sky. That matters: without real sky
 * there is no way to reach case C at all.
 *
 * @returns A camera looking over a ground plane at the origin.
 */
function makeCamera() {
  const camera = new PerspectiveCamera(50, WIDTH / HEIGHT, 0.1, 100);
  camera.position.set(0, 2, 6);
  camera.lookAt(0, 1.2, 0);
  camera.updateMatrixWorld(true);
  return camera;
}

/** Projects a world point to canvas pixels, the same way the controller does. */
function toScreen(camera, world) {
  const p = world.clone().project(camera);
  return { x: ((p.x + 1) / 2) * WIDTH, y: ((1 - p.y) / 2) * HEIGHT };
}

/** A flat mesh lying in the XZ plane at the given height. */
function flat(size, y, material) {
  const mesh = new Mesh(new PlaneGeometry(size, size), material ?? new MeshBasicMaterial());
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y;
  return mesh;
}

/** Presses and releases at a point without moving, as a still finger would. */
function tapAt(canvas, x, y) {
  canvas.fire('pointerdown', x, y);
  canvas.fire('pointerup', x, y);
}

/**
 * Builds a controller over a stub canvas with a fresh scene and camera.
 *
 * @param audio - Optional audio hooks, to exercise the no-dead-tap rule.
 * @returns Harness with the controller, camera, scene and a `fired` log.
 */
function harness(audio) {
  const canvas = stubCanvas();
  const camera = makeCamera();
  const scene = new Scene();
  const fired = [];
  const controller = createInteractionController(canvas, camera, stubScope(), audio);
  /** Registers a named object and logs its name when it fires. */
  const add = (name, obj, opts) => {
    scene.add(obj);
    scene.updateMatrixWorld(true);
    return controller.register(obj, () => fired.push(name), opts);
  };
  return { canvas, camera, scene, fired, controller, add };
}

// ── A. an environment-scale surface must not eat a small target's near-miss ──

test('CONTROL: a tap 40px beside a mushroom does land on the ground plane', () => {
  // Without this the next test proves nothing: it would pass equally if the tap
  // point were over empty sky, where the ground was never a candidate.
  const h = harness();
  h.add('ground', flat(28, 0, undefined), { background: true });
  const cap = new Mesh(new SphereGeometry(0.12, 12, 8), new MeshBasicMaterial());
  cap.position.set(1.5, 0.3, 1.0);
  h.scene.add(cap);
  h.scene.updateMatrixWorld(true);
  const at = toScreen(h.camera, new Vector3(1.5, 0.3, 1.0));
  tapAt(h.canvas, at.x + 40, at.y);
  assert.deepEqual(h.fired, ['ground'], 'the tap point must be over ground geometry for the next test to be meaningful');
});

test('a tap that lands beside a small prop fires the prop, not the ground beneath it', () => {
  const h = harness();
  h.add('ground', flat(28, 0, undefined), { background: true });
  const cap = new Mesh(new SphereGeometry(0.12, 12, 8), new MeshBasicMaterial());
  cap.position.set(1.5, 0.3, 1.0);
  h.add('mushroom', cap);
  const at = toScreen(h.camera, new Vector3(1.5, 0.3, 1.0));
  tapAt(h.canvas, at.x + 40, at.y);
  assert.deepEqual(h.fired, ['mushroom'], 'small-target forgiveness must survive a registered ground plane');
});

test('a tap on open ground still fires the ground', () => {
  // The flag moves the surface to the back of the queue; it must not make open
  // ground inert, or the owl never gets called anywhere.
  const h = harness();
  h.add('ground', flat(28, 0, undefined), { background: true });
  const cap = new Mesh(new SphereGeometry(0.12, 12, 8), new MeshBasicMaterial());
  cap.position.set(1.5, 0.3, 1.0);
  h.add('mushroom', cap);
  const at = toScreen(h.camera, new Vector3(-3.5, 0, 1.0));
  tapAt(h.canvas, at.x, at.y);
  assert.deepEqual(h.fired, ['ground'], 'open ground far from any prop must still answer');
});

test('a tap on the prop itself fires the prop', () => {
  const h = harness();
  h.add('ground', flat(28, 0, undefined), { background: true });
  const cap = new Mesh(new SphereGeometry(0.12, 12, 8), new MeshBasicMaterial());
  cap.position.set(1.5, 0.3, 1.0);
  h.add('mushroom', cap);
  const at = toScreen(h.camera, new Vector3(1.5, 0.3, 1.0));
  tapAt(h.canvas, at.x, at.y);
  assert.deepEqual(h.fired, ['mushroom']);
});

// ── B. a prop under a transparent registered lid must stay reachable ─────────

test('CONTROL: the water plane is nearer to the camera than the leaf under it', () => {
  const h = harness();
  h.add('water', flat(6, 0.038, undefined), { background: true });
  const leaf = flat(0.4, 0.02, undefined);
  h.scene.add(leaf);
  h.scene.updateMatrixWorld(true);
  const at = toScreen(h.camera, new Vector3(0, 0.02, 0));
  tapAt(h.canvas, at.x, at.y);
  assert.deepEqual(h.fired, ['water'], 'first-hit-wins must genuinely return the lid here, or the next test is vacuous');
});

test('a prop staged under a registered transparent surface is still tappable', () => {
  const h = harness();
  h.add('water', flat(6, 0.038, undefined), { background: true });
  h.add('leaf', flat(0.4, 0.02, undefined));
  const at = toScreen(h.camera, new Vector3(0, 0.02, 0));
  tapAt(h.canvas, at.x, at.y);
  assert.deepEqual(h.fired, ['leaf'], 'a raycast reads geometry, not transparency — the lid must not drown the prop');
});

// ── C. every tap answers ────────────────────────────────────────────────────

test('a tap that matches nothing still asks for a sound and a visible acknowledgement', () => {
  const rays = [];
  let fallbacks = 0;
  const h = harness({ soundCount: () => 0, playFallback: () => (fallbacks += 1) });
  h.add('ground', flat(28, 0, undefined), { background: true });
  h.controller.setMissHandler((ray) => rays.push(ray));
  tapAt(h.canvas, WIDTH / 2, 4); // open sky above the horizon
  assert.deepEqual(h.fired, [], 'nothing registered should have fired');
  assert.equal(rays.length, 1, 'soul.md#6: empty space must still produce a response');
  assert.equal(fallbacks, 1, 'and it must be audible as well as visible');
  assert.ok(rays[0].direction.y > 0, 'the acknowledgement ray must point at the sky the child touched');
});

test('a handler that plays no sound of its own gets the shared fallback', () => {
  let fallbacks = 0;
  const h = harness({ soundCount: () => 0, playFallback: () => (fallbacks += 1) });
  const cap = new Mesh(new SphereGeometry(0.12, 12, 8), new MeshBasicMaterial());
  cap.position.set(1.5, 0.3, 1.0);
  h.add('mushroom', cap);
  const at = toScreen(h.camera, new Vector3(1.5, 0.3, 1.0));
  tapAt(h.canvas, at.x, at.y);
  assert.deepEqual(h.fired, ['mushroom']);
  assert.equal(fallbacks, 1, 'the controller owes the acknowledgement when the handler is silent');
});

test('a handler that plays its own sound is not doubled up', () => {
  let count = 0;
  let fallbacks = 0;
  const h = harness({ soundCount: () => count, playFallback: () => (fallbacks += 1) });
  const canvas = h.canvas;
  const cap = new Mesh(new SphereGeometry(0.12, 12, 8), new MeshBasicMaterial());
  cap.position.set(1.5, 0.3, 1.0);
  h.scene.add(cap);
  h.scene.updateMatrixWorld(true);
  h.controller.register(cap, () => (count += 1));
  const at = toScreen(h.camera, new Vector3(1.5, 0.3, 1.0));
  tapAt(canvas, at.x, at.y);
  assert.equal(count, 1);
  assert.equal(fallbacks, 0, 'a handler with its own voice must not be talked over');
});

// ── the flag is readable from the scene graph, and cleaned up ────────────────

test('the background flag is mirrored onto userData and removed on unregister', () => {
  const h = harness();
  const ground = flat(28, 0, undefined);
  const unregister = h.add('ground', ground, { background: true });
  const cap = new Mesh(new SphereGeometry(0.12, 12, 8), new MeshBasicMaterial());
  h.add('mushroom', cap);
  assert.equal(ground.userData[TAP_BACKGROUND_KEY], true);
  assert.equal(cap.userData[TAP_BACKGROUND_KEY], false, 'an ordinary target must say so, not stay silent');
  unregister();
  assert.equal(TAP_BACKGROUND_KEY in ground.userData, false, 'a stale flag would outlive the registration and mislead the graph');
});

// ── the wiring the arbitration depends on ───────────────────────────────────

test('the world tap dispatcher gives the controller its audio hooks', () => {
  // The no-dead-tap rule is written inside the controller, but it is inert
  // unless the caller supplies `soundCount`/`playFallback`. Every world scene
  // goes through this one factory, and for the whole life of the scene it
  // passed three arguments where the fourth is what makes the rule run.
  const source = readFileSync(path.join(packageRoot, 'src', 'utils', 'worldTapDispatcher.ts'), 'utf8');
  assert.match(source, /soundCount\s*:/, 'createInteractionController must receive a soundCount hook');
  assert.match(source, /playFallback\s*:/, 'createInteractionController must receive a playFallback hook');
});

test('every sound id requested by the shared tap plumbing is registered in SFX_REGISTRY', () => {
  // The counter this suite spies on ticks whether or not the id resolves, which
  // is right for measuring intent and useless for catching a typo. This is the
  // half that catches the typo.
  const registrySource = readFileSync(path.join(packageRoot, 'src', 'assets', 'audio', 'index.ts'), 'utf8');
  const block = registrySource.match(/SFX_REGISTRY[^=]*=\s*\{([\s\S]*?)\n\};/);
  assert.ok(block, 'SFX_REGISTRY object literal not found in assets/audio/index.ts');
  const ids = new Set([...block[1].matchAll(/^\s*(?:'([^']+)'|([A-Za-z0-9_]+)):/gm)].map((m) => m[1] ?? m[2]));

  const dispatcher = readFileSync(path.join(packageRoot, 'src', 'utils', 'worldTapDispatcher.ts'), 'utf8');
  const requested = [...dispatcher.matchAll(/triggerSound\(\s*'([^']+)'\s*\)/g)].map((m) => m[1]);
  assert.ok(requested.length > 0, 'the dispatcher must request at least the shared fallback');
  for (const id of requested) assert.ok(ids.has(id), `worldTapDispatcher requests unregistered SFX id '${id}'`);
});

test('the ground plane is registered as a background surface, not an ordinary target', () => {
  // `wireFloorTap` is the single place every world scene's ground becomes
  // tappable, so this is the one line that decides whether defect A is back.
  const source = readFileSync(path.join(packageRoot, 'src', 'utils', 'sceneHelpers.ts'), 'utf8');
  assert.match(source, /registerWithPoint\([^)]*\{\s*background:\s*true\s*\}/, 'wireFloorTap must register the floor with { background: true }');
});

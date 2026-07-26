/**
 * CelebrationSystem contract test — behavioural.
 *
 * This module shipped for a long time as a stub: `confetti()` played a sound
 * and rendered nothing, carrying a note about a Babylon.js integration that
 * never happened. All five minigames route both per-success feedback and
 * milestones through it, so the whole product's celebrations were audio-only
 * and nothing in the build ever complained. This suite exists so that cannot
 * silently recur.
 *
 * What it pins:
 *   1. `screenToWorld` is a real perspective unprojection — checked against an
 *      independent three.js Raycaster + Plane intersection, for both the fixed
 *      shell camera and an orbit camera matching the manifest descriptors.
 *   2. Screen → world is monotonic and centred: canvas centre maps to the
 *      world origin, right of centre maps right, below centre maps down.
 *   3. Intensity tiers are strictly increasing, in both particle layers.
 *   4. The sound contract: one sparkle per burst, exactly one fanfare per
 *      milestone (it used to double up), and the sound-type map is total.
 *   5. A missing particle engine degrades to silence-plus-audio, never a throw
 *      — a dropped sparkle must not crash gameplay for a toddler.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Vector3, Plane, Raycaster, PerspectiveCamera, Scene } from 'three';
import { bundleTs } from './_tsload.mjs';

const cel = await bundleTs('src/minigames/framework/CelebrationSystem.ts');

/** A canvas stand-in — the module only reads clientWidth/clientHeight. */
const fakeCanvas = (width, height) => ({ clientWidth: width, clientHeight: height });

/** The shell's default fixed camera: (0, 2, 5) looking at the origin. */
function fixedCamera(aspect = 16 / 9) {
  const camera = new PerspectiveCamera(50, aspect, 0.1, 100);
  camera.position.set(0, 2, 5);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  return camera;
}

/** An orbit camera in the shape of the little-shark / star-catcher descriptors. */
function orbitCamera(aspect = 9 / 16) {
  const camera = new PerspectiveCamera(52, aspect, 0.1, 100);
  // azimuth π, polar 0.95, distance 10 about (0, 0.5, 0) → behind on −Z.
  const r = 10;
  const phi = 0.95;
  const theta = Math.PI;
  camera.position.set(r * Math.sin(phi) * Math.sin(theta), 0.5 + r * Math.cos(phi), r * Math.sin(phi) * Math.cos(theta));
  camera.lookAt(0, 0.5, 0);
  camera.updateMatrixWorld(true);
  return camera;
}

/**
 * Independent reference: cast a ray through the same pixel and intersect the
 * camera-facing plane through the origin, using three.js's own Raycaster.
 */
function referencePoint(camera, canvas, screenX, screenY) {
  const ndc = {
    x: (screenX / canvas.clientWidth) * 2 - 1,
    y: -((screenY / canvas.clientHeight) * 2 - 1),
  };
  const raycaster = new Raycaster();
  raycaster.setFromCamera(ndc, camera);
  const forward = new Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  const plane = new Plane(forward, 0); // n·p + 0 = 0 → passes through the origin
  const hit = new Vector3();
  return raycaster.ray.intersectPlane(plane, hit);
}

const call = (camera, canvas, x, y) => cel.screenToWorld(camera, canvas, x, y, new Vector3(), new Vector3());

// ── 1. Real unprojection, agreeing with three.js itself ──────────────────────

test('screenToWorld matches an independent Raycaster + Plane intersection (fixed camera)', () => {
  const camera = fixedCamera();
  const canvas = fakeCanvas(1280, 720);
  for (let ix = 0; ix <= 8; ix++) {
    for (let iy = 0; iy <= 8; iy++) {
      const x = (ix / 8) * canvas.clientWidth;
      const y = (iy / 8) * canvas.clientHeight;
      const got = call(camera, canvas, x, y);
      const want = referencePoint(camera, canvas, x, y);
      assert.ok(want, 'reference ray must hit the plane');
      assert.ok(got.distanceTo(want) < 1e-6, `pixel (${x}, ${y}): got ${got.toArray()} want ${want.toArray()}`);
    }
  }
});

test('screenToWorld matches the reference for an orbit camera in portrait', () => {
  const camera = orbitCamera();
  const canvas = fakeCanvas(390, 844);
  for (let ix = 0; ix <= 6; ix++) {
    for (let iy = 0; iy <= 6; iy++) {
      const x = (ix / 6) * canvas.clientWidth;
      const y = (iy / 6) * canvas.clientHeight;
      const got = call(camera, canvas, x, y);
      const want = referencePoint(camera, canvas, x, y);
      assert.ok(want && got.distanceTo(want) < 1e-6, `pixel (${x}, ${y})`);
    }
  }
});

// ── 2. Centred and monotonic — the properties a wrong sign would break ───────

test('the centre of the canvas maps to the world origin for a camera aimed at it', () => {
  const canvas = fakeCanvas(1000, 800);
  const centre = call(fixedCamera(), canvas, 500, 400);
  assert.ok(centre.length() < 1e-6, `centre mapped to ${centre.toArray()}, expected the origin`);
});

test('every mapped point lies on the camera-facing plane through the origin', () => {
  // For a camera aimed slightly off the origin (the orbit descriptors target
  // (0, 0.65, 0) and (0, 0.5, 0)), the centre pixel does NOT land exactly on
  // the origin — it lands at the foot of the perpendicular from the camera to
  // the plane. That is the intended contract: the burst plane is fixed and
  // camera-facing, so a burst is never behind or in front of the action.
  const canvas = fakeCanvas(390, 844);
  const camera = orbitCamera();
  const forward = new Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  for (const [x, y] of [
    [195, 422],
    [20, 40],
    [370, 800],
  ]) {
    const point = call(camera, canvas, x, y);
    assert.ok(Math.abs(point.dot(forward)) < 1e-6, `pixel (${x}, ${y}) left the plane`);
  }
  // And the centre stays close enough to the action that a burst reads as
  // on-target rather than floating in space.
  assert.ok(call(camera, canvas, 195, 422).length() < 1, 'the centre pixel must land near the action');
});

test('moving right on screen moves right in view space; moving down moves down', () => {
  const camera = fixedCamera();
  const canvas = fakeCanvas(1000, 800);
  const right = new Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  const up = new Vector3(0, 1, 0).applyQuaternion(camera.quaternion);

  const centre = call(camera, canvas, 500, 400);
  const toRight = call(camera, canvas, 800, 400);
  const below = call(camera, canvas, 500, 700);

  assert.ok(toRight.clone().sub(centre).dot(right) > 0, 'a pixel right of centre must land right of centre');
  assert.ok(below.clone().sub(centre).dot(up) < 0, 'a pixel below centre must land below centre');
});

test('a zero-sized canvas does not produce NaN', () => {
  const point = call(fixedCamera(), fakeCanvas(0, 0), 0, 0);
  assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z));
});

// ── 3. Intensity tiers are legible without reading ──────────────────────────

test('intensity tiers strictly increase in both particle layers', () => {
  const { small, medium, large } = cel.CELEBRATION_INTENSITY;
  assert.ok(small.confetti < medium.confetti && medium.confetti < large.confetti, 'confetti counts must increase');
  assert.ok(small.flash < medium.flash && medium.flash < large.flash, 'flash counts must increase');
  assert.ok(small.confetti > 0 && small.flash > 0, 'even the smallest celebration must render something');
});

// ── 4. Sound contract ───────────────────────────────────────────────────────

/** Builds a system over a bare Scene (no registered engine) and a sound spy. */
function harness() {
  const played = [];
  const system = cel.createCelebrationSystem({
    scene: new Scene(),
    camera: fixedCamera(),
    canvas: fakeCanvas(1000, 800),
    playSound: (id) => played.push(id),
  });
  return { system, played };
}

test('confetti and burstAt each play exactly one sparkle', () => {
  const { system, played } = harness();
  system.confetti(500, 400, 'small');
  assert.deepEqual(played, ['sfx_shared_sparkle_burst']);
  system.burstAt(new Vector3(1, 2, 3), 'large');
  assert.deepEqual(played, ['sfx_shared_sparkle_burst', 'sfx_shared_sparkle_burst']);
});

test('a milestone plays exactly one fanfare and nothing else', () => {
  // Regression: milestone() used to delegate to confetti(), so every milestone
  // fired a sparkle AND a fanfare in the same frame.
  const { system, played } = harness();
  system.milestone(500, 400, 'large');
  assert.deepEqual(played, ['sfx_shared_fanfare']);
});

test('every celebration sound type maps to a real sfx id', () => {
  const types = ['pop', 'chime', 'fanfare', 'whoosh', 'chomp', 'splash'];
  const { system, played } = harness();
  for (const type of types) system.celebrationSound(type);
  assert.equal(played.length, types.length, 'no sound type may silently fall through');
  for (const id of played) assert.match(id, /^sfx_shared_/);
});

// ── 5. Never crash gameplay ─────────────────────────────────────────────────

test('a scene with no registered particle engine degrades gracefully', () => {
  const { system } = harness(); // bare Scene → the registry's no-op engine
  assert.doesNotThrow(() => {
    system.confetti(10, 10);
    system.burstAt(new Vector3());
    system.milestone(500, 400, 'large');
  });
});

test('the system exposes the full CelebrationSystem surface', () => {
  const { system } = harness();
  for (const method of ['confetti', 'burstAt', 'celebrationSound', 'milestone']) {
    assert.equal(typeof system[method], 'function', `${method} must be implemented`);
  }
});

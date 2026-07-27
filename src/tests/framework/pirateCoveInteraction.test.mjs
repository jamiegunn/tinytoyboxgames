/**
 * Pirate Cove interaction contract test — the sea and the rig answer, and they
 * answer without taking anything from the props that were already there.
 *
 * Round 6's review measured that Pirate Cove's own silhouette was scenery. Six
 * registered targets covered the whole scene; a tap on the sail, the mast or the
 * water produced the miss sparkle, the same answer a child got over empty sky.
 * The fix registered the sea and the rig. Three of its decisions are invisible to
 * the compiler, invisible to a reader of the call sites, and each one silently
 * undoes the fix if it is disturbed — which is what this suite exists to stop.
 *
 *   A. THE `background` FLAG ON BOTH NEW TARGETS. `background` does not mean
 *      "scenery" and it does not mean "no reaction". It means: skipped by
 *      `pickByProximity`. The sea catches 51% of the landscape frame and the
 *      sail is the largest object in the scene, so without the flag they win
 *      near-misses over empty sky that belong to a parrot 70px away. Measured,
 *      the unflagged sail took 36 landscape samples off `parrot_prop`.
 *      `interactionController.ts:70` documents where that road ends. Delete
 *      either flag and test A2/A4 fails.
 *
 *   B. THE `ship_sailSnap` NESTING. The ambient rig owns `ship_sailGroup`'s
 *      `scale.z` (`sail-luff-depth`) and `rotation.x` (`sail-luff-swing`).
 *      `playAnimations` calls `gsap.killTweensOf` on whatever it is handed, so
 *      pointing the tap animation at the outer group trades the scene's
 *      permanent sail motion for one tap animation, permanently, on the first
 *      tap. Nothing in the type system knows. Test B2 starts a stand-in for the
 *      ambient tween and asserts it is still alive after a tap.
 *
 *   C. THE RIPPLE IS SIZED IN SCREEN SPACE, NOT WORLD SPACE. Pirate Cove's sea
 *      spans 7.1x in depth. A fixed-size ripple — which is what reusing the
 *      sibling scene's `PARTICLES.waterRipple` would have shipped — renders about
 *      three pixels at the rail and sub-pixel at the horizon. Tests C1/C2 assert
 *      the projected diameter is the SAME at two depths and equals the proximity
 *      radius, so any drift in the perspective arithmetic fails rather than
 *      degrades.
 *
 * These are behavioural properties, so this suite drives the REAL shipped
 * modules — `createSceneShell`, `setupSailTap`, `createOcean`, `setupSeaTap`,
 * `createSeaRipples` — through the REAL `createInteractionController` over a stub
 * canvas, and asserts on which handler ran and what moved. Nothing here parses
 * source, and nothing here re-implements the thing it is checking.
 *
 * ONE BUNDLE, NOT FIVE. Every module is pulled through a single `bundleEntry`
 * re-export. Two `bundleTs` calls would give the controller and the scene two
 * copies of any module-private state between them, and — more sharply — two
 * copies of the dispatcher's own registry, at which point `register` and
 * `pickRegistered` consult different maps and every assertion passes while
 * proving nothing. See `_tsload.mjs`.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera, Scene, Group, Mesh, SphereGeometry, MeshStandardMaterial, MeshBasicMaterial, Vector3, Box3, Raycaster } from 'three';
import gsap from 'gsap';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundleEntry } from './_tsload.mjs';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCAFFOLD = '@scenes/immersive-toybox-scenes/pirate-cove/factory/scaffold';

const M = await bundleEntry(
  'pirateCoveInteraction',
  [
    `export { createInteractionController, TAP_BACKGROUND_KEY } from '@app/utils/interaction/interactionController';`,
    `export { createSceneShell } from '${SCAFFOLD}/sceneShell/create';`,
    `export { setupSailTap } from '${SCAFFOLD}/sceneShell/interaction';`,
    `export { createOcean, OCEAN_Y } from '${SCAFFOLD}/sea/create';`,
    `export { setupSeaTap } from '${SCAFFOLD}/sea/interaction';`,
    `export { createSeaRipples } from '${SCAFFOLD}/sea/ripple';`,
  ].join('\n'),
);

/**
 * The shipped proximity radius, read out of source rather than typed in — the
 * whole point of tests C1/C2 is that the ripple tracks THIS number, so a copy of
 * it here would make them tautological.
 */
const PROXIMITY_PX = (() => {
  const src = readFileSync(path.join(packageRoot, 'src/utils/interaction/gestureRules.ts'), 'utf8');
  const m = /export const PROXIMITY_PX = (\d+(?:\.\d+)?)/.exec(src);
  if (!m) throw new Error('PROXIMITY_PX not found in gestureRules.ts — fix this test, do not guess');
  return Number(m[1]);
})();

const WIDTH = 1280;
const HEIGHT = 720;

/** A canvas stand-in that records listeners so the test can fire pointer events. */
function stubCanvas() {
  const listeners = new Map();
  return {
    clientWidth: WIDTH,
    clientHeight: HEIGHT,
    width: WIDTH,
    height: HEIGHT,
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

/** Presses and releases at a point without moving, as a still finger would. */
function tapAt(canvas, x, y) {
  canvas.fire('pointerdown', x, y);
  canvas.fire('pointerup', x, y);
}

/** Projects a world point to canvas pixels, the same way the controller does. */
function toScreen(camera, world) {
  const p = world.clone().project(camera);
  return { x: ((p.x + 1) / 2) * WIDTH, y: ((1 - p.y) / 2) * HEIGHT };
}

/**
 * The inverse: a world point that projects to the given pixel, at the same
 * projective depth as a reference point. Lets a test place an object where the
 * SCREEN geometry needs it, which is the space the proximity rule works in.
 *
 * @param camera - Camera to unproject through.
 * @param x - Canvas x in pixels.
 * @param y - Canvas y in pixels.
 * @param refWorld - World point whose depth the result should share.
 * @returns The world point.
 */
function fromScreen(camera, x, y, refWorld) {
  const ndcZ = refWorld.clone().project(camera).z;
  return new Vector3((x / WIDTH) * 2 - 1, 1 - (y / HEIGHT) * 2, ndcZ).unproject(camera);
}

/** True when a camera ray through the given pixel hits nothing in the scene. */
function hitsNothing(camera, scene, x, y) {
  const rc = new Raycaster();
  rc.setFromCamera({ x: (x / WIDTH) * 2 - 1, y: 1 - (y / HEIGHT) * 2 }, camera);
  return rc.intersectObjects(scene.children, true).length === 0;
}

/** Stand-ins for the three shell materials; appearance is irrelevant to a raycast. */
function shellMaterials() {
  return { shellWall: new MeshStandardMaterial(), shellTrim: new MeshStandardMaterial(), weatheredWood: new MeshStandardMaterial() };
}

/**
 * Builds the real ship shell and the real controller over a stub canvas, with
 * the camera placed so the sail fills a usable part of the frame.
 *
 * @returns Harness with the scene, camera, canvas, shell root and a `fired` log.
 */
function shipHarness() {
  const canvas = stubCanvas();
  const scene = new Scene();
  const shellRoot = M.createSceneShell(scene, { wallHeight: 1.1, materials: shellMaterials() });
  scene.add(shellRoot);
  scene.updateMatrixWorld(true);

  const sailGroup = shellRoot.getObjectByName('ship_sailGroup');
  assert.ok(sailGroup, 'the shell must build a ship_sailGroup — everything below is about it');
  const sailCentre = new Box3().setFromObject(sailGroup).getCenter(new Vector3());

  // Looking at the sail from in front of and below it, the way the scene camera
  // does. The exact pose does not matter; that the sail projects to a large,
  // reachable region of the frame does, and every test below asserts it lands.
  const camera = new PerspectiveCamera(50, WIDTH / HEIGHT, 0.1, 100);
  camera.position.set(0, sailCentre.y - 1.5, sailCentre.z + 12);
  camera.lookAt(sailCentre);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();

  const fired = [];
  const controller = M.createInteractionController(canvas, camera, stubScope(), undefined);
  return { canvas, scene, camera, shellRoot, sailGroup, sailCentre, fired, controller };
}

// ── A. the two new targets must not outrank the props already there ──────────

test('A1 CONTROL: a tap on the sail is a tap on real sail geometry, and the sail answers', () => {
  // Without this the flag tests below prove nothing: they would pass equally if
  // the tap point missed the sail entirely and the sail were never a candidate.
  const h = shipHarness();
  const un = M.setupSailTap({ register: (o, cb, opts) => h.controller.register(o, () => (h.fired.push('sail'), cb?.()), opts) }, h.shellRoot);
  assert.ok(un, 'setupSailTap must find ship_sailGroup and ship_sailSnap and return a cleanup');
  const at = toScreen(h.camera, h.sailCentre);
  tapAt(h.canvas, at.x, at.y);
  assert.deepEqual(h.fired, ['sail'], 'a finger on the canvas must fire the sail');
});

/**
 * Stages the contest the `background` flag exists to settle, in the geometry
 * that actually produces it.
 *
 * `pickByProximity` takes each candidate's WORLD ORIGIN, projects it, and gives
 * the tap to the nearest centre inside the radius. So the regression only occurs
 * where the sail's origin is nearer to the finger than the small prop's is —
 * park a bird next to the tap and it wins on distance whether or not the sail is
 * flagged, and the test proves nothing while looking green. That is the shape of
 * the first draft of this suite, and it passed with the flag deleted.
 *
 * This searches the frame for a direction out of the sail's origin along which
 * both the tap point and the bird's position land on empty sky, then places the
 * bird FURTHER from the tap than the sail's origin is. The sail is the nearer
 * centre by construction; only the flag can stop it winning.
 *
 * @param h - A `shipHarness`.
 * @returns `{ tap, bird }` — the tap pixel and the registered bird mesh.
 */
function stageProximityContest(h) {
  const origin = h.sailGroup.getWorldPosition(new Vector3());
  const o = toScreen(h.camera, origin);
  const near = PROXIMITY_PX * 0.45;
  const far = PROXIMITY_PX * 0.95;

  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const tap = { x: o.x + Math.cos(a) * near, y: o.y + Math.sin(a) * near };
    const birdPx = { x: o.x + Math.cos(a) * far, y: o.y + Math.sin(a) * far };
    if (!hitsNothing(h.camera, h.scene, tap.x, tap.y)) continue;
    if (!hitsNothing(h.camera, h.scene, birdPx.x, birdPx.y)) continue;

    const bird = new Mesh(new SphereGeometry(0.18, 12, 8), new MeshBasicMaterial());
    bird.position.copy(fromScreen(h.camera, birdPx.x, birdPx.y, origin));
    h.scene.add(bird);
    h.scene.updateMatrixWorld(true);
    h.controller.register(bird, () => h.fired.push('bird'));

    // Both inside the radius, sail strictly nearer. Assert it rather than trust
    // the arithmetic, because this is the entire premise of A2 and A3.
    const b = toScreen(h.camera, bird.position);
    const dSail = Math.hypot(tap.x - o.x, tap.y - o.y);
    const dBird = Math.hypot(tap.x - b.x, tap.y - b.y);
    assert.ok(
      dSail < PROXIMITY_PX && dBird < PROXIMITY_PX,
      `both centres must be inside ${PROXIMITY_PX}px: sail ${dSail.toFixed(1)}, bird ${dBird.toFixed(1)}`,
    );
    assert.ok(dSail < dBird, `the sail must be the NEARER centre or the contest is not staged: sail ${dSail.toFixed(1)}, bird ${dBird.toFixed(1)}`);
    return { tap, bird };
  }
  assert.fail('no direction out of the sail origin reaches open sky — the harness camera needs re-aiming, do not weaken the test');
}

test('A2 a tap on empty sky nearer the sail than a small prop still fires the prop', () => {
  const h = shipHarness();
  M.setupSailTap({ register: (o, cb, opts) => h.controller.register(o, () => h.fired.push('sail'), opts) }, h.shellRoot);
  const { tap } = stageProximityContest(h);
  tapAt(h.canvas, tap.x, tap.y);
  assert.deepEqual(h.fired, ['bird'], 'small-target forgiveness must survive the largest object in the scene being registered');
});

test('A3 CONTROL: the same tap, with the sail unflagged, is won by the sail', () => {
  // The mutation the flag exists to prevent, performed deliberately. Without
  // this control A2 cannot distinguish "the flag works" from "the tap point
  // never favoured the sail in the first place" — which is exactly how the first
  // draft of A2 passed with the flag removed.
  const h = shipHarness();
  h.controller.register(h.sailGroup, () => h.fired.push('sail'));
  const { tap } = stageProximityContest(h);
  tapAt(h.canvas, tap.x, tap.y);
  assert.deepEqual(h.fired, ['sail'], 'an unflagged sail wins the near-miss — which is exactly why it ships flagged');
});

test('A4 the sea is registered background, so a tap near a floating prop fires the prop', () => {
  const canvas = stubCanvas();
  const scene = new Scene();
  const parent = new Group();
  scene.add(parent);

  const ocean = M.createOcean();
  parent.add(ocean);
  scene.updateMatrixWorld(true);

  const camera = new PerspectiveCamera(50, WIDTH / HEIGHT, 0.1, 100);
  camera.position.set(0, 2.4, 8);
  camera.lookAt(0, M.OCEAN_Y, 0);
  camera.updateMatrixWorld(true);

  const fired = [];
  const controller = M.createInteractionController(canvas, camera, stubScope(), undefined);
  M.setupSeaTap({ registerWithPoint: (o, cb, opts) => controller.register(o, () => fired.push('sea'), opts) }, ocean, parent, camera, canvas);

  const buoy = new Mesh(new SphereGeometry(0.16, 12, 8), new MeshBasicMaterial());
  buoy.position.set(1.1, M.OCEAN_Y + 0.16, 1.4);
  scene.add(buoy);
  scene.updateMatrixWorld(true);
  controller.register(buoy, () => fired.push('buoy'));

  const at = toScreen(camera, buoy.position);
  tapAt(canvas, at.x + PROXIMITY_PX * 0.5, at.y);
  assert.deepEqual(fired, ['buoy'], 'a 51%-of-frame water plane must never win a near-miss from a small prop');

  // And open water still answers, or the fix registered nothing worth having.
  fired.length = 0;
  const open = toScreen(camera, new Vector3(-4.5, M.OCEAN_Y, -1));
  tapAt(canvas, open.x, open.y);
  assert.deepEqual(fired, ['sea'], 'the flag moves the sea behind the props, it must not make open water inert');
});

// ── B. the tap animation must not evict the ambient rig ──────────────────────

test('B1 ship_sailSnap exists, is nested inside ship_sailGroup, and carries both sheets', () => {
  const h = shipHarness();
  const snap = h.shellRoot.getObjectByName('ship_sailSnap');
  assert.ok(snap, 'ship_sailSnap must exist');
  assert.equal(snap.parent, h.sailGroup, 'ship_sailSnap must sit between the sail group and its sheets');
  assert.ok(snap.children.length >= 2, 'the canvas and the band must both hang off the snap group, or the tap moves half a sail');
  assert.equal(h.sailGroup.getObjectByName('ship_mainsail')?.parent, snap, 'the sail canvas must be under the snap group');
});

test('B2 tapping the sail leaves an ambient tween on ship_sailGroup running', async () => {
  const h = shipHarness();
  M.setupSailTap({ register: (o, cb, opts) => h.controller.register(o, cb, opts) }, h.shellRoot);
  const snap = h.shellRoot.getObjectByName('ship_sailSnap');

  // Stand-in for `sail-luff-depth` and `sail-luff-swing`: the two channels the
  // ambient rig actually owns on the OUTER group.
  const depth = gsap.to(h.sailGroup.scale, { z: 1.12, duration: 1.4, repeat: -1, yoyo: true });
  const swing = gsap.to(h.sailGroup.rotation, { x: 0.06, duration: 2.1, repeat: -1, yoyo: true });

  const at = toScreen(h.camera, h.sailCentre);
  tapAt(h.canvas, at.x, at.y);

  assert.ok(
    depth.isActive() || gsap.getTweensOf(h.sailGroup.scale).includes(depth),
    'the ambient depth tween must survive a tap — playAnimations kills tweens on its target',
  );
  assert.ok(swing.isActive() || gsap.getTweensOf(h.sailGroup.rotation).includes(swing), 'the ambient swing tween must survive a tap');
  assert.ok(
    gsap.getTweensOf(snap.scale).length > 0 || gsap.getTweensOf(snap.rotation).length > 0,
    'the tap must actually animate something, or B2 passes by doing nothing',
  );

  depth.kill();
  swing.kill();
  gsap.killTweensOf(snap.scale);
  gsap.killTweensOf(snap.rotation);
});

// ── C. the ripple is sized in screen space ──────────────────────────────────

/**
 * Splashes at a world point and reports the ring's final world radius.
 *
 * The first keyframe of a `playAnimations` timeline is a timing anchor whose
 * VALUE is ignored — GSAP records the start value when the tween starts — so the
 * radius cannot be read off the timeline. It is read off the object after the
 * animation has run, which is also the only reading that proves the whole path
 * works rather than the arithmetic in isolation.
 *
 * @param ripples - A `createSeaRipples` handle.
 * @param parent - The group the rings are added to.
 * @param at - World point of the splash.
 * @returns The primary ring's final outer radius, in world units, measured.
 */
async function radiusAfterSplash(ripples, parent, at) {
  // The ring pool is built and parented at CONSTRUCTION, hidden — watching for
  // new children finds none. What a splash changes is `visible`, so the launched
  // rings are identified synchronously, before the animation can hide them again.
  //
  // The set is DIFFED rather than filtered. `parent` is the group the OCEAN hangs
  // off as well, and the ocean is visible, exactly one unit of scale wide, and
  // never animates — a plain `filter(visible)` picked it up and `Math.min` then
  // returned the ocean's `scale.x` of 1.0 instead of the ring's. That reading was
  // wrong at both depths; it merely happened to sit above the near ring (0.456)
  // and below the far one (1.819), so it failed loudly in only one of the two
  // assertions and silently corrupted the other.
  const before = new Set(parent.children.filter((c) => c.visible === true));
  ripples.splash(at);
  const launched = parent.children.filter((c) => c.visible === true && !before.has(c));
  assert.ok(launched.length > 0, 'a splash must launch at least one ring');
  await new Promise((r) => setTimeout(r, 1300));
  // MEASURED, NOT READ OFF `scale.x`. The two agree only because the ring
  // geometry's outer radius is exactly 1 — a coupling stated in a comment in
  // `ripple.ts` and enforced by nothing. Editing `RingGeometry(0.78, 1, 44)` to
  // any other outer radius resizes what the child actually sees while leaving
  // `scale.x` untouched, and a `scale.x` reading survived that mutation in
  // silence. A world-space bounding box is what the child is looking at.
  const outerRadius = (mesh) => {
    const size = new Box3().setFromObject(mesh).getSize(new Vector3());
    return Math.max(size.x, size.z) / 2;
  };
  // The trailing ring is deliberately wider than the leading one, so the primary
  // radius — the one sized to the proximity region — is the smaller.
  return Math.min(...launched.map(outerRadius));
}

/** A scene with a real ocean and real ripples, and a camera over the water. */
function seaHarness() {
  const canvas = stubCanvas();
  const scene = new Scene();
  const parent = new Group();
  scene.add(parent);
  parent.add(M.createOcean());
  const camera = new PerspectiveCamera(50, WIDTH / HEIGHT, 0.1, 100);
  camera.position.set(0, 2.4, 8);
  camera.lookAt(0, M.OCEAN_Y, 0);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
  scene.updateMatrixWorld(true);
  return { canvas, scene, parent, camera, ripples: M.createSeaRipples(parent, camera, canvas) };
}

test('C1 a ripple subtends the proximity radius on screen, at the rail and far out', async () => {
  // Both points are chosen to sit INSIDE the [MIN_RADIUS, MAX_RADIUS] clamp
  // band, roughly 7.7 to 66 units from this camera. A first draft used a point
  // 4.6 units out, where the minimum clamp binds, and the test failed against
  // correct code — the clamp is a separate property and C2 is where it belongs.
  const h = seaHarness();
  const near = new Vector3(0, M.OCEAN_Y, -1.6);
  const far = new Vector3(0, M.OCEAN_Y, -32);
  // Measured as the shipped code measures it: depth along the view axis, which
  // is what a perspective divide divides by. Distance from the eye is a larger
  // number for anything off centre and using it here would leave the premise
  // agreeing with the assertion for the wrong reason.
  const viewDepth = (p) => -p.clone().applyMatrix4(h.camera.matrixWorldInverse).z;
  assert.ok(viewDepth(near) > 8 && viewDepth(far) < 66, 'C1 must be measured where the radius clamp does not bind');

  const rNear = await radiusAfterSplash(h.ripples, h.parent, near);
  const rFar = await radiusAfterSplash(h.ripples, h.parent, far);

  // Project each ring's own radius through the camera and compare in pixels,
  // offsetting along the camera's own right axis so the offset point stays at
  // the same depth and the measurement is a pure screen-size reading.
  const right = new Vector3().setFromMatrixColumn(h.camera.matrixWorld, 0).normalize();
  const px = (point, radius) => {
    const a = toScreen(h.camera, point);
    const b = toScreen(h.camera, point.clone().addScaledVector(right, radius));
    return Math.hypot(b.x - a.x, b.y - a.y) * 2;
  };
  const dNear = px(near, rNear);
  const dFar = px(far, rFar);

  // 2%, not the 20% this started at. Nothing here is sampled or approximate —
  // the radius is arithmetic and the projection is arithmetic, and both readings
  // land on 70.00 px. A loose bound is not caution, it is room for a defect to
  // hide in: at 20% this assertion sat unmoved while the ring geometry's outer
  // radius was changed from 1 to 0.9 under it, a 10% error in what the child
  // sees. Widen this only with a measurement that says why.
  const TOL = 0.02;
  assert.ok(Math.abs(dNear - PROXIMITY_PX) < PROXIMITY_PX * TOL, `near ripple should span ~${PROXIMITY_PX}px, got ${dNear.toFixed(1)}px`);
  assert.ok(Math.abs(dFar - PROXIMITY_PX) < PROXIMITY_PX * TOL, `far ripple should span ~${PROXIMITY_PX}px, got ${dFar.toFixed(1)}px`);

  // The world radii must differ, or the test would pass for a fixed-size ripple
  // that happens to be right at one depth. This is the assertion that fails if
  // the perspective compensation is removed.
  assert.ok(rFar > rNear * 1.5, `world radius must grow with distance: near ${rNear.toFixed(3)}, far ${rFar.toFixed(3)}`);

  h.ripples.dispose();
});

test('C2 the ripple radius is clamped, so the horizon does not get a ring the size of the ship', async () => {
  const h = seaHarness();
  const r = await radiusAfterSplash(h.ripples, h.parent, new Vector3(0, M.OCEAN_Y, -180));
  assert.ok(r <= 3.0 + 1e-6, `far-horizon ripple must clamp, got ${r.toFixed(3)} world units`);
  assert.ok(r > 0, 'a clamped ripple is still a ripple');
  h.ripples.dispose();
});

/**
 * C3 — WHAT THE FIRST DRAFT OF THIS TEST GOT WRONG, RECORDED BECAUSE THE
 * MUTATION PASS IS THE ONLY REASON IT WAS CAUGHT.
 *
 * The first draft tapped the water twice at the same pixel and asserted the sea
 * fired both times, on the stated theory that a pooled ring "would be the
 * nearest hit and swallow the tap". It passed. It also passed with
 * `mesh.raycast = () => {};` deleted from `ripple.ts`, which is the mutation it
 * existed to catch — so it was proving nothing, twice over:
 *
 *   1. It stubbed `registerWithPoint` with a callback that only recorded the
 *      fire. The real handler never ran, so NO RIPPLE WAS EVER LAUNCHED. The
 *      test asserted a ring could not shadow the water while there was no ring.
 *   2. The stated mechanism is false anyway. `pickRegistered` raycasts
 *      `[...registry.keys()]` — only registered objects and their descendants.
 *      The rings hang off the sea-and-sky GROUP, siblings of the registered
 *      ocean mesh, so they are outside the raycast set entirely and could not
 *      shadow it whatever their `raycast` did. A second tap at the same pixel
 *      cannot fail.
 *
 * So `mesh.raycast = () => {}` survives mutation, and the honest reading is that
 * it is defence in depth rather than a load-bearing line — the property that
 * actually keeps a ripple out of the tap path is WHERE THE RINGS ARE PARENTED.
 * That is what this test now pins, at the pixel where it matters: one whose ray
 * genuinely crosses the ring's band. The premise is established against a
 * stand-in clone with an ordinary `raycast`, because the shipped ring has none,
 * and it fails loudly rather than quietly finding no such pixel.
 *
 * The mutation that kills this test is reparenting the pool from `parent` to the
 * ocean mesh — the obvious "put the ripples on the water" refactor — which is
 * exactly the change the guard is there to survive.
 */
test('C3 a live ripple is never the nearest hit inside the registered set', async () => {
  const canvas = stubCanvas();
  const scene = new Scene();
  const parent = new Group();
  scene.add(parent);
  const ocean = M.createOcean();
  parent.add(ocean);
  const camera = new PerspectiveCamera(50, WIDTH / HEIGHT, 0.1, 100);
  camera.position.set(0, 2.4, 8);
  camera.lookAt(0, M.OCEAN_Y, 0);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
  scene.updateMatrixWorld(true);

  const fired = [];
  const controller = M.createInteractionController(canvas, camera, stubScope(), undefined);
  // A faithful stand-in for `createWorldTapDispatcher.registerWithPoint`: it
  // records the fire AND calls through, so the real ripple code runs. The draft
  // that swallowed the callback is the reason this comment exists.
  const cleanup = M.setupSeaTap(
    {
      registerWithPoint: (o, cb, opts) =>
        controller.register(
          o,
          (hit) => {
            fired.push('sea');
            cb(hit.point ?? o.getWorldPosition(new Vector3()));
          },
          opts,
        ),
    },
    ocean,
    parent,
    camera,
    canvas,
  );

  const centre = new Vector3(0, M.OCEAN_Y, 2);
  const at = toScreen(camera, centre);
  tapAt(canvas, at.x, at.y);
  assert.deepEqual(fired, ['sea'], 'first tap must reach the water');

  // Searched over the whole scene, not over `parent.children`. A draft that
  // looked only at `parent` reported "no ring launched" under the very mutation
  // this test exists to catch — reparenting the pool — which is a kill by
  // bookkeeping rather than by the property, and would have hidden whether the
  // property assertion below is doing anything at all.
  const rings = [];
  scene.traverse((c) => {
    if (c.visible === true && c.name.startsWith('ship_seaRipple')) rings.push(c);
  });
  assert.ok(rings.length > 0, 'the first tap must have launched a real ring, or C3 is testing an empty scene again');

  // Let the ring grow before looking for a pixel on it: it starts at a quarter
  // of its final radius and a band that thin is easy to step over.
  await new Promise((r) => setTimeout(r, 600));
  scene.updateMatrixWorld(true);

  // The premise. A ring's geometry is an annulus — the middle is a HOLE, which
  // is the other reason the first draft's centre pixel proved nothing — so the
  // pixel has to be found, not assumed. The stand-in carries the ring's own
  // geometry and world matrix and nothing else.
  const probe = new Mesh(rings[0].geometry, new MeshBasicMaterial());
  rings[0].matrixWorld.decompose(probe.position, probe.quaternion, probe.scale);
  scene.add(probe);
  scene.updateMatrixWorld(true);

  const rc = new Raycaster();
  const castAt = (x, y, targets) => {
    rc.setFromCamera({ x: (x / WIDTH) * 2 - 1, y: 1 - (y / HEIGHT) * 2 }, camera);
    return rc.intersectObjects(targets, true);
  };

  // A pixel qualifies only if the ring is genuinely IN FRONT OF the water there —
  // otherwise the assertion below would be satisfied by a ring the ray never had
  // the chance to hit first. The water depth is taken non-recursively, so this
  // premise stays a statement about the ring and the surface even when a mutation
  // has made the ring a child of that surface.
  const waterDepth = (x, y) => {
    rc.setFromCamera({ x: (x / WIDTH) * 2 - 1, y: 1 - (y / HEIGHT) * 2 }, camera);
    return rc.intersectObject(ocean, false)[0]?.distance ?? Infinity;
  };

  let onBand = null;
  for (let dx = 0; dx <= 200 && !onBand; dx++) {
    for (const x of [at.x + dx, at.x - dx]) {
      const hit = castAt(x, at.y, [probe])[0];
      if (hit && hit.distance < waterDepth(x, at.y)) {
        onBand = { x, y: at.y };
        break;
      }
    }
  }
  assert.ok(onBand, 'no pixel found where the ring band sits in front of the water — the ring is not where this test thinks it is, do not weaken the search');

  // The property. Raycast exactly what the controller raycasts, the way it
  // raycasts it: the registered object, recursively. The nearest hit must be the
  // water itself and not a decoration drawn on top of it.
  const hits = castAt(onBand.x, onBand.y, [ocean]);
  assert.ok(hits.length > 0, 'the chosen pixel must still be over water');
  assert.equal(hits[0].object, ocean, 'a ripple ring must never be the nearest hit inside the registered set');

  // PROOF THAT THE ASSERTION ABOVE HAS TEETH, done here rather than by mutating
  // the source. The obvious mutation — reparent the pool onto the ocean mesh —
  // also drags every ring into the ocean's own rotated local space, so it kills
  // this test at the search premise and never reaches the line it was meant to
  // exercise. `attach` moves the stand-in into the registered subtree while
  // preserving its world transform, which isolates the one variable: membership.
  ocean.attach(probe);
  scene.updateMatrixWorld(true);
  assert.equal(
    castAt(onBand.x, onBand.y, [ocean])[0]?.object,
    probe,
    'the identity assertion above is asleep — a ring-shaped mesh inside the registered subtree was not returned as the nearest hit',
  );
  probe.removeFromParent();
  scene.updateMatrixWorld(true);

  // And end to end: the tap still reaches the sea, and still splashes.
  tapAt(canvas, onBand.x, onBand.y);
  assert.deepEqual(fired, ['sea', 'sea'], 'a ripple must never eat the next tap on the same patch of water');

  cleanup();
});

test('C4 a ring recycled mid-flight stays visible, and still hides when its own launch ends', async () => {
  // THE DEFECT THIS PINS, WHICH NO LINTER AND NO TYPE CAN SEE.
  //
  // Relaunching a pooled ring kills every tween the previous launch owned — two
  // `killTweensOf` calls inside `playAnimations` (mesh, mesh.scale) plus the
  // explicit one on the material. gsap collapses a timeline whose children have
  // all been killed and fires its `onComplete` on the NEXT TICK, after this
  // launch has already set `visible = true`. So the OLD launch's `onEnd` — whose
  // body is `visible = false` — hid the ring the NEW launch had just lit.
  //
  // The pool is 6 rings consumed 2 per splash, so the FOURTH tap inside one
  // 0.9s lifetime is the first one that reproduces it. Before the generation
  // guard the two recycled rings ran their whole animation at `visible = false`.
  // That is the worst possible failure for this file: the tap fires, the sound
  // plays, the arithmetic is perfect, and the child sees nothing.
  //
  // BOTH DIRECTIONS ARE ASSERTED. A guard that never hides anything would fix
  // the invisible ripple by leaving a foam ring painted on the sea forever, so
  // the second half of this test is not a formality.
  const h = seaHarness();
  const ringsOf = () => h.parent.children.filter((c) => c.name.startsWith('ship_seaRipple'));
  assert.equal(ringsOf().length, 6, 'C4 assumes a 6-ring pool consumed 2 at a time; re-derive the tap count if that changed');

  for (let i = 0; i < 3; i++) {
    h.ripples.splash(new Vector3(i, M.OCEAN_Y, -12 - i));
    await new Promise((r) => setTimeout(r, 60));
  }
  // Rings 0 and 1 are the oldest and are next to be recycled. They are ~180ms
  // into a 900ms life, so this tap takes them mid-flight.
  const recycled = [ringsOf()[0], ringsOf()[1]];
  h.ripples.splash(new Vector3(-1, M.OCEAN_Y, -13));
  await new Promise((r) => setTimeout(r, 350));

  for (const ring of recycled) {
    assert.equal(ring.visible, true, `${ring.name} was recycled and then blanked by its predecessor's onEnd — a splash that animates invisibly`);
    assert.ok(ring.material.opacity > 0, `${ring.name} is visible but transparent, which is the same failure wearing a hat`);
  }

  // The other direction: once nothing is competing for these rings, they must go
  // away. A stuck ring is a foam circle sitting on the water for the rest of the
  // session.
  await new Promise((r) => setTimeout(r, 1200));
  const stuck = ringsOf().filter((c) => c.visible === true);
  assert.deepEqual(
    stuck.map((c) => c.name),
    [],
    'rings left visible long after every splash finished — the recycle guard is swallowing the legitimate hide',
  );

  h.ripples.dispose();
});

test.after(() => {
  // gsap keeps a live timer while any tween exists, which would stop the process
  // exiting; see `_tsload.mjs`.
  gsap.globalTimeline.clear();
  gsap.ticker.sleep();
});

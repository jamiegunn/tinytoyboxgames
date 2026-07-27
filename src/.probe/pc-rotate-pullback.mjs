/**
 * ROUND 5, THE CHARGE: THE PULL-BACK IS APPLIED ONCE AND NEVER RE-APPLIED, SO
 * ROTATING A DEVICE LEAVES THE CAMERA AT THE WRONG DISTANCE.
 *
 * `createSceneCamera` opens at `radiusForAspect(preset, aspect)` — the preset's
 * distance times `distanceMultiplierForAspect`, which pulls the camera BACK on
 * portrait viewports so the same world width stays on screen. That is correct
 * on first paint, at any aspect.
 *
 * `resize()` then does this:
 *
 *     maxDistance = maxDistanceForAspect(newAspect);
 *     spherical.radius = clamp(spherical.radius, minDistance, maxDistance);
 *
 * It recomputes the CEILING and clamps the radius under it. A clamp can only
 * pull a radius DOWN. Nothing ever pushes it back OUT. So when the viewport
 * gets NARROWER — which is exactly when the pull-back is needed — the radius
 * that was right for the old shape is silently kept, and the new, larger
 * required radius is computed, used as a ceiling, and discarded.
 *
 * The asymmetry is the tell. Portrait -> landscape LOWERS the ceiling, so the
 * clamp fires and the camera happens to land correctly. Landscape -> portrait
 * RAISES the ceiling, the clamp does nothing, and the camera stays too close.
 * A child who rotates a tablet is served correctly one way and not the other.
 *
 * WHY THIS MATTERS MORE THAN A FRAMING WOBBLE. soul.md: "A dead tap is a broken
 * promise", and the REACHABLE rule this round's suite enforces — a tappable
 * prop a device cannot reach is an interaction that does not exist for that
 * player. If rotation leaves the camera too close, props leave the frame and
 * become untappable. And `tests/room/pirate-cove-composition.test.mjs` cannot
 * catch it: it asks `resolveSceneCameraPose`, which recomputes the radius from
 * scratch every time, so the suite verifies a pose the app does not adopt after
 * a rotation. The test is green against a code path the app stops taking.
 *
 * This probe drives the REAL `createSceneCamera` and its REAL `resize`, and
 * compares the pose it reaches by rotation against the pose the same device
 * would have had if the scene had simply been opened in that orientation.
 */

import { PerspectiveCamera, Scene, Vector3 } from 'three';
import { bundleEntry } from '../tests/framework/_tsload.mjs';
import { projectedHull } from '../tests/framework/_project.mjs';

globalThis.window ??= { addEventListener() {}, removeEventListener() {} };
const fakeCanvas = (w, h) => ({
  clientWidth: w,
  clientHeight: h,
  addEventListener() {},
  removeEventListener() {},
  style: {},
  getBoundingClientRect: () => ({ left: 0, top: 0, width: w, height: h }),
  setPointerCapture() {},
  releasePointerCapture() {},
});

const M = await bundleEntry(
  'pc-rotate-pullback',
  `
  export { SCENE_CAMERA_FOV, resolveSceneCameraPose, createSceneCamera, distanceMultiplierForAspect } from './src/utils/cameraPresets';
  export { createPirateCoveMaterials } from './src/scenes/immersive-toybox-scenes/pirate-cove/materials';
  export { CANNON_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/cannon';
  export { SHIP_WHEEL_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/shipWheel';
  export { TREASURE_CHEST_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/treasureChest';
  export { createCannon } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/interactive/cannon/create';
  export { createShipWheel } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/interactive/shipWheel/create';
  export { createTreasureChest } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/interactive/treasureChest/create';
`,
);

// The devices a child actually rotates, as (landscape, portrait) pairs of the
// SAME hardware. Rotation is not a jump between two arbitrary aspects.
const DEVICES = [
  ['iPhone 15', 393, 852],
  ['Pixel 8', 412, 915],
  ['iPhone SE', 375, 667],
  ['iPad', 768, 1024],
];

const materials = M.createPirateCoveMaterials();
const opts = { materials };

/** Every prop a child can tap, with its real mesh vertices in world space. */
const tappables = [
  ...M.CANNON_STAGING.map((p, i) => [`cannon${i}`, (s) => M.createCannon(s, p, opts).root]),
  ...M.SHIP_WHEEL_STAGING.map((p, i) => [`shipWheel${i}`, (s) => M.createShipWheel(s, p, opts).root]),
  ...M.TREASURE_CHEST_STAGING.map((p, i) => [`chest${i}`, (s) => M.createTreasureChest(s, p, opts).root]),
].map(([name, make]) => {
  const root = make(new Scene());
  root.updateMatrixWorld(true);
  const verts = [];
  const v = new Vector3();
  root.traverse((o) => {
    const pos = o.geometry?.attributes?.position;
    if (!pos) return;
    for (let i = 0; i < pos.count; i++) verts.push(v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).clone());
  });
  return { name, verts };
});

/** Builds a camera at an explicit pose so both paths are measured identically. */
const camAt = (position, target, aspect) => {
  const c = new PerspectiveCamera(M.SCENE_CAMERA_FOV, aspect, 0.1, 100);
  c.position.copy(position);
  c.lookAt(target);
  c.updateMatrixWorld(true);
  c.updateProjectionMatrix();
  return c;
};

/** Worst |ndc.x| over a prop's vertices. > 1 means part of it is off-frame. */
const worstNdcX = (cam, verts, aspect) => {
  const pj = projectedHull(cam, verts, aspect);
  if (!pj) return Infinity;
  return Math.max(...pj.hull.map(([x]) => Math.abs(x))) / pj.halfW;
};

console.log('==== 1. WHAT resize() DOES TO THE RADIUS, versus what the aspect asks for\n');
console.log('  device        rotation             radius after     radius if opened     short by');
console.log('                                     rotating         in that shape');

const rows = [];
for (const [name, w, h] of DEVICES) {
  const portraitAspect = w / h;
  const landscapeAspect = h / w;

  for (const [label, fromAspect, toAspect] of [
    ['landscape -> portrait', landscapeAspect, portraitAspect],
    ['portrait -> landscape', portraitAspect, landscapeAspect],
  ]) {
    // The app's path: open in one shape, rotate to the other.
    const fromIsPortrait = fromAspect < 1;
    const handle = M.createSceneCamera(fakeCanvas(fromIsPortrait ? w : h, fromIsPortrait ? h : w), 'pirate-cove');
    const toIsPortrait = toAspect < 1;
    handle.resize(toIsPortrait ? w : h, toIsPortrait ? h : w);
    const rotated = handle.camera.position.clone();
    handle.dispose?.();

    // The pose the same device would have had if simply opened in that shape.
    const fresh = M.resolveSceneCameraPose('pirate-cove', toAspect);

    const rRot = rotated.distanceTo(fresh.target);
    const rFresh = fresh.radius;
    const short = ((rFresh - rRot) / rFresh) * 100;
    rows.push({ name, label, toAspect, rotated, fresh, short });
    console.log(
      `  ${name.padEnd(12)}  ${label.padEnd(20)} ${rRot.toFixed(3).padStart(8)}     ${rFresh.toFixed(3).padStart(8)}         ${short > 0.05 ? `${short.toFixed(1)}% TOO CLOSE` : 'correct'}`,
    );
  }
}

console.log('\n==== 2. WHAT THAT COSTS: tappable props pushed out of frame by rotating\n');
console.log('  A child can only tap what is on screen. |ndc.x| > 1 means part of the');
console.log('  prop is past the frame edge; the REACHABLE rule says that must never');
console.log('  happen on a shipping device.\n');
console.log('  device        rotation             prop        opened in shape   after rotating');

let broken = 0;
for (const r of rows) {
  const camFresh = camAt(r.fresh.position, r.fresh.target, r.toAspect);
  const camRot = camAt(r.rotated, r.fresh.target, r.toAspect);
  for (const t of tappables) {
    const a = worstNdcX(camFresh, t.verts, r.toAspect);
    const b = worstNdcX(camRot, t.verts, r.toAspect);
    if (b > 1 && a <= 1) {
      broken++;
      console.log(`  ${r.name.padEnd(12)}  ${r.label.padEnd(20)} ${t.name.padEnd(11)} ${a.toFixed(3).padStart(9)} ok    ${b.toFixed(3).padStart(9)} OFF-FRAME`);
    }
  }
}
if (!broken) console.log('  (no tappable prop crosses the frame edge on these devices)');

console.log('\n==== 3. IS THE FRAME ITSELF NARROWER? world half-width visible at deck level\n');
for (const r of rows) {
  if (r.short <= 0.05) continue;
  const camFresh = camAt(r.fresh.position, r.fresh.target, r.toAspect);
  const camRot = camAt(r.rotated, r.fresh.target, r.toAspect);
  const halfWidthAt = (cam, z) => {
    let lo = 0;
    let hi = 40;
    for (let k = 0; k < 50; k++) {
      const m = (lo + hi) / 2;
      const v = new Vector3(m, 0, z).project(cam);
      if (Math.abs(v.x) <= 1) lo = m;
      else hi = m;
    }
    return lo;
  };
  const zs = [-5, -3, -1];
  const f = zs.map((z) => halfWidthAt(camFresh, z));
  const g = zs.map((z) => halfWidthAt(camRot, z));
  console.log(`  ${r.name} ${r.label}`);
  for (let i = 0; i < zs.length; i++) {
    console.log(
      `    z ${String(zs[i]).padStart(3)}   opened ${f[i].toFixed(2)}   rotated ${g[i].toFixed(2)}   lost ${(((f[i] - g[i]) / f[i]) * 100).toFixed(1)}%`,
    );
  }
}

console.log('\n==== 4. DOES IT ACCUMULATE? rotating back and forth repeatedly\n');
const [dn, dw, dh] = DEVICES[0];
const h2 = M.createSceneCamera(fakeCanvas(dn ? dw : dw, dh), 'pirate-cove');
const target = M.resolveSceneCameraPose('pirate-cove', dw / dh).target;
console.log(`  ${dn}, opened in PORTRAIT, then rotated repeatedly:`);
console.log(`    start (portrait)          radius ${h2.camera.position.distanceTo(target).toFixed(3)}`);
for (let i = 1; i <= 3; i++) {
  h2.resize(dh, dw);
  console.log(`    rotation ${i * 2 - 1} -> landscape   radius ${h2.camera.position.distanceTo(target).toFixed(3)}`);
  h2.resize(dw, dh);
  console.log(`    rotation ${i * 2} -> portrait    radius ${h2.camera.position.distanceTo(target).toFixed(3)}`);
}
console.log(`\n  correct portrait radius is ${M.resolveSceneCameraPose('pirate-cove', dw / dh).radius.toFixed(3)}`);

/**
 * Every Playroom toybox must fit on a portrait phone screen.
 *
 * THE DEFECT THIS GUARDS
 * ----------------------
 * `layout.ts` declared, under the header "Viewport-safe content box" and the
 * comment "Objects inside this box will not be clipped on portrait (9:16) or
 * landscape (16:9)":
 *
 *   export const SAFE_X_MIN = -4.8;
 *   export const SAFE_X_MAX = 4.8;
 *   export const SAFE_Z_MIN = -4.5;
 *   export const SAFE_Z_MAX = 8.0;
 *
 * Nothing imported them. Nothing checked them. They sat in a file whose own
 * header called it the single source of truth for the room's spatial zones, so
 * they read as a constraint the room was built to — and the room was not. All
 * three toyboxes were outside the box, and the `adventure` toybox, which is the
 * door to pirate-cove, was clipped 20% off the side of a portrait screen. A
 * child holding a phone upright saw a sliver of it.
 *
 * WHY THIS TEST DOES NOT JUST ENFORCE THE BOX
 * -------------------------------------------
 * Because the box cannot be made correct. What fits on screen is a frustum
 * cross-section: the X limit widens with depth (outer edge 3.52 at z -4, 6.52
 * at z +8), and the Z limit depends on the object's X, because approaching the
 * camera magnifies whatever sideways offset it already has. Four numbers cannot
 * describe that surface.
 *
 * SAFE_X_MAX = 4.8 looked measured — at z 1.5, where `adventure` happened to
 * sit, the true limit is 4.83. That is a coincidence at a single depth, and it
 * is very hard to tell from rigour. SAFE_Z_MIN/MAX were not right at any depth.
 * So the constants are gone and this asks the camera instead.
 *
 * WHAT IS ASSERTED
 * ----------------
 * The real specs are built with the real variant builders and the real
 * placement transform, and their real world bounds are projected through the
 * real `createSceneCamera` at both aspect ratios. No coordinate and no limit is
 * retyped here: retyping the answer is how the deleted TOYBOX_POSITIONS block,
 * and then the safe box itself, came to disagree with the game.
 *
 * Scope is the toyboxes, deliberately. They are the room's tappable
 * destinations, and a destination that is half off-screen is not reachable.
 * Decor is not held to this — the bean bag is clipped in portrait too, and a
 * clipped bean bag costs nothing.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, Vector3 } from 'three';
import { bundleTs } from '../framework/_tsload.mjs';

// How much of the frame a toybox must keep clear of the edge. 1.0 is exactly
// touching the edge, so this is a 4% margin — enough that a rounding change in
// the camera preset does not silently start shaving a corner, and loose enough
// that it is not a de-facto position lock.
const NDC_LIMIT = 0.96;

// The two shapes a phone is actually held in. Portrait is the binding one;
// landscape is checked so that fixing portrait cannot quietly break it.
// VIEWPORTS, MAPPED THROUGH THE LETTERBOX. The camera is never handed the
// device's aspect any more — the stage clamps it to [MIN_STAGE_ASPECT,
// MAX_STAGE_ASPECT] and the leftover viewport becomes chrome (see
// src/utils/scene/stageRect.ts). This list used to feed 405/720 = 0.56 straight
// into the projection, which is a shape the camera cannot be given, so a toybox
// "off screen at portrait 9:16" was a failure in a state the app cannot reach.
const VIEWPORTS = [
  ['portrait 9:16', 405, 720],
  ['landscape 16:9', 1280, 720],
];

// createSceneCamera subscribes to a window event and reads the canvas element.
// Neither exists under node --test, and neither affects the projection.
globalThis.window ??= { addEventListener() {}, removeEventListener() {} };

function fakeCanvas(w, h) {
  return {
    clientWidth: w,
    clientHeight: h,
    addEventListener() {},
    removeEventListener() {},
    style: {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: w, height: h }),
    setPointerCapture() {},
    releasePointerCapture() {},
  };
}

const layout = await bundleTs('src/scenes/world/places/house/subplaces/playroom/layout.ts');
const manifest = await bundleTs('src/scenes/world/places/house/subplaces/playroom/toyboxes/manifest.ts');
const variants = await bundleTs('src/toyboxes/variants/index.ts');
const runtime = await bundleTs('src/toyboxes/framework/runtime.ts');
const presets = await bundleTs('src/utils/cameraPresets.ts');
const { stageAspectFor } = await bundleTs('src/utils/scene/stageRect.ts');

const { RUG_DIAMETER, LEFT_WALL_FACE_X, RIGHT_WALL_FACE_X } = layout;

// Builds a spec exactly as the room does, and returns its world bounds.
function worldBounds(spec) {
  const built = variants.buildToyboxVariant(spec);
  runtime.applyToyboxPlacement(built.root, spec.placement);
  built.root.updateMatrixWorld(true);
  return new Box3().setFromObject(built.root);
}

// The worst-case screen position of any corner of `bounds`, as a fraction of
// the half-frame. Over 1.0 means part of the object is off-screen.
function worstNdc(camera, bounds) {
  let worst = 0;
  let behind = false;
  for (let i = 0; i < 8; i++) {
    const corner = new Vector3(i & 1 ? bounds.max.x : bounds.min.x, i & 2 ? bounds.max.y : bounds.min.y, i & 4 ? bounds.max.z : bounds.min.z);
    const p = corner.project(camera);
    if (p.z > 1) behind = true;
    worst = Math.max(worst, Math.abs(p.x), Math.abs(p.y));
  }
  return { worst, behind };
}

const toyboxes = manifest.PLAYROOM_TOYBOXES.map((spec) => ({ spec, bounds: worldBounds(spec) }));

test('the room still has toyboxes — a silent zero would make this suite vacuous', () => {
  assert.ok(toyboxes.length >= 3, `expected the Playroom's toyboxes, found ${toyboxes.length}`);
  for (const { spec, bounds } of toyboxes) {
    assert.ok(!bounds.isEmpty(), `${spec.id} built to an empty bounding box — the variant produced no geometry`);
  }
});

for (const [label, w, h] of VIEWPORTS) {
  test(`every toybox is fully on screen at ${label} (stage ${stageAspectFor(w, h).toFixed(2)})`, () => {
    const handle = presets.createSceneCamera(fakeCanvas(w, h), 'playroom');
    try {
      const camera = handle.camera;
      camera.aspect = stageAspectFor(w, h);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld(true);

      for (const { spec, bounds } of toyboxes) {
        const { worst, behind } = worstNdc(camera, bounds);
        assert.ok(!behind, `${spec.id} has a corner behind the camera at ${label}`);
        assert.ok(
          worst <= NDC_LIMIT,
          `${spec.id} reaches ${worst.toFixed(3)} of the half-frame at ${label} (limit ${NDC_LIMIT}; over 1.0 is cut off). ` +
            `It is anchored at x ${spec.placement.x}, z ${spec.placement.z} and spans x [${bounds.min.x.toFixed(2)}, ${bounds.max.x.toFixed(2)}] z [${bounds.min.z.toFixed(2)}, ${bounds.max.z.toFixed(2)}]. ` +
            `Note the frame widens with depth, so moving it back in +z buys as much room as pulling it in along x.`,
        );
      }
    } finally {
      handle.dispose();
    }
  });
}

test('no toybox sinks into the braided rug', () => {
  // The rug is a solid disc at the world origin, 0.06 thick, and a toybox sits
  // at y 0.01. Overlapping it does not clip anything off-screen; it pokes the
  // rug surface through the toybox floor, which is the kind of small wrongness
  // that reads as a broken toy rather than a placed one.
  const rugRadius = RUG_DIAMETER / 2;
  for (const { spec, bounds } of toyboxes) {
    const nearestX = Math.max(0, Math.max(-bounds.max.x, bounds.min.x));
    const nearestZ = Math.max(0, Math.max(-bounds.max.z, bounds.min.z));
    const gap = Math.hypot(nearestX, nearestZ) - rugRadius;
    assert.ok(gap > 0, `${spec.id} overlaps the rug by ${(-gap).toFixed(2)} units`);
  }
});

test('no toybox pokes through a wall', () => {
  for (const { spec, bounds } of toyboxes) {
    assert.ok(bounds.max.x <= LEFT_WALL_FACE_X, `${spec.id} reaches x ${bounds.max.x.toFixed(2)}, past the left wall face ${LEFT_WALL_FACE_X}`);
    assert.ok(bounds.min.x >= RIGHT_WALL_FACE_X, `${spec.id} reaches x ${bounds.min.x.toFixed(2)}, past the right wall face ${RIGHT_WALL_FACE_X}`);
  }
});

test('the layout file keeps no second copy of an answer the game already has', () => {
  // TOYBOX_POSITIONS was a hand-kept duplicate of the manifest that outlived a
  // toybox: it carried a fourth entry, `nature`, for a box that had already
  // been deleted. The SAFE_* box was a hand-kept duplicate of the camera
  // frustum, and was wrong about Z at every depth. A second copy of an answer
  // is only ever as good as the last person who remembered to update both.
  for (const name of ['TOYBOX_POSITIONS', 'WALL_ART_POSITIONS', 'RUG_CENTER', 'SAFE_X_MIN', 'SAFE_X_MAX', 'SAFE_Z_MIN', 'SAFE_Z_MAX']) {
    assert.equal(layout[name], undefined, `layout.ts is exporting ${name} again; the thing that builds the object is the only copy`);
  }
});

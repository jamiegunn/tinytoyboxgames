/**
 * Every Playroom toybox must be reachable on a portrait phone screen.
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
 * destinations, and a destination a child cannot get to is not a destination.
 * Decor is not held to this — the bean bag is clipped in portrait too, and a
 * clipped bean bag costs nothing.
 *
 * "FIT" BECAME "REACHABLE" WHEN THE LETTERBOX CAME OUT
 * ----------------------------------------------------
 * This file used to require every toybox fully in frame AT REST. That rule is
 * what the letterbox was buying: three toyboxes and a doorway only share one
 * frame if the frame is nearly square, so a 0.46 phone was cropped to a square
 * and the rest of the screen painted over. `.probe/narrow-binding.mjs` showed the
 * requirement was the only constraint that moves with aspect, so it was the only
 * thing the crop bought — and it has been replaced everywhere by REACHABLE: in
 * frame at some turn the child is allowed to make. See `utils/scene/rotationRange`.
 *
 * The defect this file was written for is untouched by that change, which is why
 * it is still here rather than folded into `room-opening-framing`. `adventure`
 * was not merely off-centre on a phone: at the pose that shipped it was clipped
 * 20% off the side, and a toybox that no turn brings back is exactly as broken as
 * one that is cropped at rest. This now asks the stronger question of the whole
 * turn instead of the weaker one of a single frame.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, Spherical, Vector3 } from 'three';
import { bundleTs } from '../framework/_tsload.mjs';

// How much of the frame a toybox must keep clear of the edge. 1.0 is exactly
// WHAT "REACHABLE" MEANS HERE, AND WHY IT IS STRICTER THAN ELSEWHERE.
// `room-opening-framing.test.mjs` asks whether a way out of a room can be seen
// and tapped at all: middle inside 0.85 of the half-frame, 60% of it on screen.
// That is the bar the poses were solved against and it is the right bar for a
// doorway. A toybox is a DESTINATION — the thing a child is looking for — so it
// has to be comfortably in view rather than merely hittable, and these two are
// tighter on both axes.
//
// The binding case is `animals`, which at its best turn on a 0.46 phone sits at
// centre 0.31 with 91% of itself on screen: a sliver of one side is past the
// edge and the rest is squarely in the middle of the frame. It clips on X, not
// on Y — worth saying, because the fix for a Y clip is a different move.
//
// The old rule here was the whole bounding box inside 0.96, which `animals` now
// fails at 1.16. That rule is the one the letterbox existed to make satisfiable;
// see the header. It is not merely relaxed — the defect it was written for,
// `adventure` at 1.237 with its middle pushed to the edge, fails both of these
// too, and by a wide margin.
const CENTRE_LIMIT = 0.7;
const AREA_LIMIT = 0.85;

// How much of the shipped turn a toybox has to be reachable within. A toybox
// that only comes into frame in the last degree of travel is one a child will
// not find.
const REACH_MARGIN = 0.85;

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
  ['a tall phone', 393, 852],
  ['that phone on its side', 852, 393],
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
const { resolveRotationRange } = await bundleTs('src/utils/scene/rotationRange.ts');
const { getSceneCameraPreset } = await bundleTs('src/scenes/sceneCatalog.ts');
const { stageAspectFor } = await bundleTs('src/utils/scene/stageRect.ts');

const { RUG_DIAMETER, LEFT_WALL_FACE_X, RIGHT_WALL_FACE_X } = layout;

// Builds a spec exactly as the room does, and returns its world bounds.
function worldBounds(spec) {
  const built = variants.buildToyboxVariant(spec);
  runtime.applyToyboxPlacement(built.root, spec.placement);
  built.root.updateMatrixWorld(true);
  return new Box3().setFromObject(built.root);
}

// Where `bounds` sits on screen: how far its middle is from the centre of the
// frame, and how much of it is actually inside the frame. Both as fractions.
function screenFit(camera, bounds) {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  let behind = false;
  for (let i = 0; i < 8; i++) {
    const corner = new Vector3(i & 1 ? bounds.max.x : bounds.min.x, i & 2 ? bounds.max.y : bounds.min.y, i & 4 ? bounds.max.z : bounds.min.z);
    const p = corner.project(camera);
    if (p.z > 1) behind = true;
    x0 = Math.min(x0, p.x);
    x1 = Math.max(x1, p.x);
    y0 = Math.min(y0, p.y);
    y1 = Math.max(y1, p.y);
  }
  const full = (x1 - x0) * (y1 - y0);
  const visible = Math.max(0, Math.min(x1, 1) - Math.max(x0, -1)) * Math.max(0, Math.min(y1, 1) - Math.max(y0, -1));
  return {
    behind,
    offCentre: Math.max(Math.abs((x0 + x1) / 2), Math.abs((y0 + y1) / 2)),
    onScreen: full > 1e-9 ? visible / full : 1,
  };
}

const toyboxes = manifest.PLAYROOM_TOYBOXES.map((spec) => ({ spec, bounds: worldBounds(spec) }));

test('the room still has toyboxes — a silent zero would make this suite vacuous', () => {
  assert.ok(toyboxes.length >= 3, `expected the Playroom's toyboxes, found ${toyboxes.length}`);
  for (const { spec, bounds } of toyboxes) {
    assert.ok(!bounds.isEmpty(), `${spec.id} built to an empty bounding box — the variant produced no geometry`);
  }
});

for (const [label, w, h] of VIEWPORTS) {
  test(`every toybox comes within reach at ${label} (stage ${stageAspectFor(w, h).toFixed(2)})`, () => {
    const aspect = stageAspectFor(w, h);
    const preset = getSceneCameraPreset('playroom');
    const handle = presets.createSceneCamera(fakeCanvas(w, h), 'playroom');
    try {
      const camera = handle.camera;
      camera.aspect = aspect;
      const target = new Vector3(...preset.target);
      const ceilingY = preset.constraints?.ceilingY ?? 6.0;
      const radius = presets.resolveSceneCameraPose('playroom', aspect).radius;
      const budget = resolveRotationRange(aspect, 'playroom') * REACH_MARGIN;
      const step = budget > 0 ? budget / 32 : Infinity;

      for (const { spec, bounds } of toyboxes) {
        // The BEST turn, not the resting one: the whole point of the schedule is
        // that a child sweeps the room, and a toybox only has to be comfortable
        // somewhere inside the sweep. Walked rather than sampled at its ends —
        // a toybox can be off the left edge at one extreme and off the right at
        // the other while sitting squarely in frame in between.
        let best = null;
        for (let turn = -budget; turn <= budget + 1e-9; turn += step) {
          camera.position.copy(target).add(new Vector3().setFromSpherical(new Spherical(radius, preset.polar, preset.azimuth + turn)));
          if (camera.position.y > ceilingY) camera.position.y = ceilingY;
          camera.lookAt(target);
          camera.updateMatrixWorld(true);
          camera.updateProjectionMatrix();
          const fit = screenFit(camera, bounds);
          if (fit.behind) continue;
          const score = Math.max(fit.offCentre / CENTRE_LIMIT, (1 - fit.onScreen) / (1 - AREA_LIMIT));
          if (!best || score < best.score) best = { ...fit, score, turn };
          if (!Number.isFinite(step)) break;
        }
        assert.ok(best, `${spec.id} is behind the camera at every turn at ${label} — it is not merely off the edge, it is astern`);
        const where =
          `at its best turn of ${((best.turn * 180) / Math.PI).toFixed(1)}° out of ±${((budget * 180) / Math.PI).toFixed(1)}°. ` +
          `It is anchored at x ${spec.placement.x}, z ${spec.placement.z} and spans x [${bounds.min.x.toFixed(2)}, ${bounds.max.x.toFixed(2)}] z [${bounds.min.z.toFixed(2)}, ${bounds.max.z.toFixed(2)}]. ` +
          `Note the frame widens with depth, so moving it back in +z buys as much room as pulling it in along x.`;
        assert.ok(
          best.offCentre <= CENTRE_LIMIT,
          `${spec.id} never gets its middle closer than ${best.offCentre.toFixed(3)} of the half-frame at ${label} (limit ${CENTRE_LIMIT}) ${where}`,
        );
        assert.ok(
          best.onScreen >= AREA_LIMIT,
          `${spec.id} never gets more than ${(best.onScreen * 100).toFixed(0)}% of itself on screen at ${label} (limit ${AREA_LIMIT * 100}%) ${where}`,
        );
      }
    } finally {
      handle.dispose?.();
    }
  });
}

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

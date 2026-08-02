/**
 * The axis convention every scene file's placement comments rely on.
 *
 * WHY THIS EXISTS
 * ---------------
 * Every scene in this repo places props by hand-authored `Vector3` literals,
 * and the single most useful thing to know when writing one is which way each
 * axis goes ON SCREEN. One of the three is counter-intuitive:
 *
 *     +X  ->  screen LEFT      (not right)
 *     +Y  ->  screen UP
 *     +Z  ->  AWAY from the camera, deeper into the scene
 *
 * +X reads LEFT because the camera looks ALONG +Z with +Y up, which makes the
 * screen-right vector -X. Anyone who assumes the usual "x increases rightward"
 * places props mirrored, and the mistake is invisible until something renders.
 *
 * Those three lines are now written into the header of every scene's layout or
 * environment file. A comment is a claim nothing checks — this is the check.
 * If a camera preset is ever re-posed (a different azimuth, or a camera moved
 * to +Z), the comments become lies and this test fails first.
 *
 * WHAT IS ASSERTED
 * ----------------
 * The projected direction of each unit axis at each scene's own opening pose,
 * using the same `resolveSceneCameraPose` the runtime uses. Not the azimuth
 * value — the observable consequence of it, because the azimuth is a means and
 * the screen direction is the thing the comments actually promise.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera, Vector3 } from 'three';
import { bundleEntry } from './_tsload.mjs';

const M = await bundleEntry(
  'scene-axes',
  `
  export { SCENE_CAMERA_FOV, resolveSceneCameraPose } from './src/utils/cameraPresets';
  export { SCENE_CATALOG } from './src/scenes/sceneCatalog';
`,
);

/** A representative landscape aspect; the convention does not vary with aspect. */
const ASPECT = 1280 / 720;

/**
 * Projects the three unit axes at a scene's opening pose.
 *
 * @param {string} sceneId Registered scene id.
 * @returns {{xNdc: number, yNdc: number, zDepth: number}} Signed screen/depth deltas per world unit.
 */
function axesFor(sceneId) {
  const pose = M.resolveSceneCameraPose(sceneId, ASPECT);
  const cam = new PerspectiveCamera(M.SCENE_CAMERA_FOV, ASPECT, 0.1, 200);
  cam.position.copy(pose.position);
  cam.lookAt(pose.target);
  cam.updateMatrixWorld(true);

  const origin = pose.target.clone();
  const base = origin.clone().project(cam);
  const shifted = (v) => origin.clone().add(v).project(cam);

  return {
    xNdc: shifted(new Vector3(1, 0, 0)).x - base.x,
    yNdc: shifted(new Vector3(0, 1, 0)).y - base.y,
    zDepth: cam.position.distanceTo(origin.clone().add(new Vector3(0, 0, 1))) - cam.position.distanceTo(origin),
  };
}

const SCENE_IDS = Object.keys(M.SCENE_CATALOG);

test('there are scenes to check', () => {
  assert.ok(SCENE_IDS.length >= 5, `expected the registered scenes, found ${SCENE_IDS.length}`);
});

for (const sceneId of SCENE_IDS) {
  test(`${sceneId}: +X is screen LEFT, +Y is up, +Z is away from the camera`, () => {
    const { xNdc, yNdc, zDepth } = axesFor(sceneId);

    assert.ok(
      xNdc < 0,
      `${sceneId}: +X projects ${xNdc > 0 ? 'RIGHT' : 'nowhere'} (ndc.x ${xNdc.toFixed(4)} per world unit).\n` +
        `Every scene file's header comment tells authors that +X is screen LEFT. If the camera was ` +
        `deliberately re-posed, update those comments in the same change — otherwise every hand-authored ` +
        `placement in the repo is now mirrored relative to its documentation.`,
    );

    assert.ok(yNdc > 0, `${sceneId}: +Y does not project up the frame (ndc.y ${yNdc.toFixed(4)} per world unit)`);

    assert.ok(
      zDepth > 0,
      `${sceneId}: +Z moves ${zDepth.toFixed(3)} units of eye distance — it should INCREASE distance from the camera.\n` +
        `Scene comments tell authors that "nearer the child = more negative Z". This inverts that.`,
    );
  });
}

test('the camera sits on the x = 0 plane in every scene, which is why centreline props eclipse each other', () => {
  // Not decoration: this is the geometry behind a shipped defect. Pirate Cove's
  // wheel at (0, 0, -5.0) and its portal at (0, 0, -1.5) were both on x = 0,
  // and so was the eye — three collinear points. The portal measured 72%
  // covered. Anything placed on the centreline is stacked along the view ray
  // with everything else on the centreline.
  for (const sceneId of SCENE_IDS) {
    const pose = M.resolveSceneCameraPose(sceneId, ASPECT);
    assert.ok(
      Math.abs(pose.position.x) < 1e-6,
      `${sceneId}: camera x is ${pose.position.x.toFixed(3)}, not 0 — the "centreline props eclipse each other" ` +
        `note in the scene headers assumes the eye is on x = 0.`,
    );
    assert.ok(pose.position.z < pose.target.z, `${sceneId}: camera is not behind its target in -Z`);
  }
});

/**
 * Scene ground coverage — an immersive scene must never show sky under the
 * player's feet, must keep its playable surface under the bottom of the frame,
 * and must never frame its own portals off the edge.
 *
 * THE DEFECT THIS GUARDS
 * ----------------------
 * A scene's floor is a finite plane. The scene camera pulls BACK on portrait
 * viewports (`distanceMultiplierForAspect`), so the narrower the viewport, the
 * further past the floor's near edge the bottom of the frame looks. In the
 * Nature scene at 16x14 that overrun was 0.52 world units, which rendered as the
 * bottom 54 rows of a 480x854 frame showing the inside of the skydome: pale blue
 * sky, below the grass, under the child's own point of view. The same overrun
 * was reachable in LANDSCAPE by panning sideways, where the frame ran off the
 * ground's left edge instead of its near edge.
 *
 * Nothing caught it, because every individual value was reasonable. A 16x14
 * ground is a sensible size. A portrait pull-back is a sensible rule. The defect
 * only exists in the product of the two, and only at aspects nobody screenshots.
 *
 * EACH SCENE DECLARES ITS OWN FLOOR, AND IT IS NOT ALWAYS THE PLAY AREA
 * --------------------------------------------------------------------
 * The first version of this suite asserted both scenes against
 * `environment.ground` at y = 0. For Nature that is right: the ground plane is
 * the floor, and past its edge there is nothing. For Pirate Cove it is wrong in
 * a way that made the test meaningless. Pirate Cove's `ground` is a 16x14 hull
 * — a ship — floating on a 400x400 ocean at `OCEAN_Y = -0.6`. A view ray that
 * misses the hull lands on water. That is not sky under the player's feet; it is
 * the sea, and a ship is supposed to have some.
 *
 * So the pirate row of this suite was green for a reason that had nothing to do
 * with what it claimed: `maxDistance: 10` pins the orbit radius at 10 for every
 * aspect, so the bottom edge never travelled far enough for the wrong plane to
 * matter. Remove that constraint and the suite would have started failing on a
 * scene that was still perfectly correct.
 *
 * The fix is FLOORS below: each scene names the opaque plane it actually stands
 * on. Because that plane is enormous for Pirate Cove, the floor assertion alone
 * would prove little there — which is why the third test asserts the bottom-
 * CENTRE ray lands on the *playable* surface. That one is tight for both scenes
 * (Pirate Cove clears its stern-to-bow half-depth of 7 by 1.44 units; Nature
 * clears 16 by 4.94) and it is the property a child actually experiences: the
 * near half of the frame is the thing you can touch, not the backdrop.
 *
 * WHY THIS SUITE CALLS THE REAL FUNCTIONS
 * ---------------------------------------
 * The first version of this check re-derived the camera pose with its own
 * trigonometry. That version passes forever no matter what the app does, because
 * it is testing a copy of the arithmetic. `resolveSceneCameraPose`,
 * `bottomEdgeGroundReach`, `sceneCameraMaxDistance` and `getSceneCameraPreset`
 * are imported from the app and are the same code paths `createSceneCamera` uses
 * at runtime.
 *
 * That principle was violated here even after it was written down. The envelope
 * test used to compute the orbit radius with an inline
 * `preset.distance * (aspect < 1 ? (1 / aspect) * 0.75 : 1)` — its own copy of
 * the pull-back rule, and, as it turned out, its own copy of a rule that was
 * wrong over a third of its domain. `sceneCameraMaxDistance` was exported so
 * that line could be deleted. See tests/room/camera-pullback-rule.test.mjs.
 *
 * WHAT IS DELIBERATELY NOT ASSERTED
 * ---------------------------------
 * Rays that clear the treeline and descend to the floor plane far BEYOND the
 * ground's far edge are not a defect: that region of the frame is skydome above
 * a treeline, which is what looking across a forest looks like. Only rays
 * landing SHORT of the near edge or BESIDE the ground within its depth are
 * counted. See `.probe/treeline-fit.mjs`, which classifies all three.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera, Spherical, Vector3 } from 'three';
import { bundleEntry } from '../framework/_tsload.mjs';

const {
  stageAspectFor,
  resolveSceneCameraPose,
  bottomEdgeGroundReach,
  sceneCameraMaxDistance,
  getSceneCameraPreset,
  SCENE_CAMERA_FOV,
  NATURE_ENVIRONMENT,
  PIRATE_COVE_ENVIRONMENT,
  OCEAN_Y,
  OCEAN_HALF_EXTENT,
  TREELINE_BACK_ROWS,
  TREELINE_SIDE_COLUMNS,
  TREELINE_SPACING,
  TREELINE_CANOPY_RADIUS,
  resolveRotationRange,
} = await bundleEntry(
  'scene-ground-coverage',
  `
  export { stageAspectFor } from './src/utils/scene/stageRect';
  export {
    resolveSceneCameraPose,
    bottomEdgeGroundReach,
    sceneCameraMaxDistance,
    SCENE_CAMERA_FOV,
  } from './src/utils/cameraPresets';
  export { resolveRotationRange } from './src/utils/scene/rotationRange';
  export { getSceneCameraPreset } from './src/scenes/sceneCatalog';
  export { NATURE_ENVIRONMENT } from './src/scenes/immersive-toybox-scenes/naturescene/environment';
  export { PIRATE_COVE_ENVIRONMENT } from './src/scenes/immersive-toybox-scenes/pirate-cove/environment';
  export { OCEAN_Y, OCEAN_HALF_EXTENT } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/scaffold/sea';
  export {
    TREELINE_BACK_ROWS,
    TREELINE_SIDE_COLUMNS,
    TREELINE_SPACING,
    TREELINE_CANOPY_RADIUS,
  } from './src/scenes/immersive-toybox-scenes/naturescene/factory/scaffold/treeline';
`,
);

// Real device aspects, spanning the range the pull-back rule actually sees.
// `extreme` is not a shipping device; it is the narrowest aspect the rule is
// asked to survive, and it is where the overrun was worst.
// THE ASPECTS THE CAMERA CAN ACTUALLY BE GIVEN, not the aspects a device can
// have. The stage is letterboxed (see src/utils/scene/stageRect.ts): outside a
// 1.0-1.4 band the leftover viewport becomes chrome rather than scene, so a
// 0.40 phone renders a 1.00 stage. This list used to be nine raw device aspects,
// five of which the camera can no longer be handed at all — and asserting
// against a state the app cannot reach is how a suite comes to look thorough
// while covering less than it claims. Derived from `stageAspectFor` so that
// widening the band cannot leave it behind.
const SHIPPING_VIEWPORTS = [
  ['landscape 1280x720', 1280, 720],
  ['tablet 1024x768', 1024, 768],
  ['square 800x800', 800, 800],
  ['iPad portrait 768x1024', 768, 1024],
  ['viewport 480x854', 480, 854],
  ['iPhone SE 375x667', 375, 667],
  ['iPhone 15 393x852', 393, 852],
  ['Pixel 8 412x915', 412, 915],
  ['extreme 400x1000', 400, 1000],
];
const ASPECTS = SHIPPING_VIEWPORTS.map(([label, w, h]) => [`${label} -> stage ${stageAspectFor(w, h).toFixed(2)}`, stageAspectFor(w, h)]);

// The opaque plane each scene actually stands on, versus the surface the player
// is meant to be looking at. For Nature these are the same object; for Pirate
// Cove they are a ship and the sea it floats on, and conflating them is what
// made the pirate half of this suite vacuous.
const SCENES = [
  [
    'nature',
    NATURE_ENVIRONMENT,
    {
      name: 'the ground plane',
      planeY: 0,
      halfWidth: NATURE_ENVIRONMENT.ground.width / 2,
      halfDepth: NATURE_ENVIRONMENT.ground.depth / 2,
    },
  ],
  [
    'pirate-cove',
    PIRATE_COVE_ENVIRONMENT,
    {
      name: 'the ocean',
      planeY: OCEAN_Y,
      halfWidth: OCEAN_HALF_EXTENT,
      halfDepth: OCEAN_HALF_EXTENT,
    },
  ],
];

const camAt = (position, target, aspect) => {
  const cam = new PerspectiveCamera(SCENE_CAMERA_FOV, aspect, 0.1, 100);
  cam.position.copy(position);
  cam.lookAt(target);
  cam.updateMatrixWorld(true);
  return cam;
};

for (const [sceneId, env, floor] of SCENES) {
  const playHalfW = env.ground.width / 2;
  const playHalfD = env.ground.depth / 2;

  test(`${sceneId}: the opening pose keeps the bottom edge of the frame on ${floor.name}`, () => {
    for (const [label, aspect] of ASPECTS) {
      const pose = resolveSceneCameraPose(sceneId, aspect);
      const hits = bottomEdgeGroundReach(camAt(pose.position, pose.target, aspect), floor.planeY);
      hits.forEach((hit, i) => {
        const corner = ['bottom-left', 'bottom-centre', 'bottom-right'][i];
        assert.ok(hit, `${sceneId} ${label}: the ${corner} view ray never reaches ${floor.name} at y=${floor.planeY}`);
        assert.ok(
          Math.abs(hit.z) <= floor.halfDepth + 1e-6,
          `${sceneId} ${label}: ${corner} ray lands at z=${hit.z.toFixed(2)}, past ${floor.name} half-depth ${floor.halfDepth}`,
        );
        assert.ok(
          Math.abs(hit.x) <= floor.halfWidth + 1e-6,
          `${sceneId} ${label}: ${corner} ray lands at x=${hit.x.toFixed(2)}, past ${floor.name} half-width ${floor.halfWidth}`,
        );
      });
    }
  });

  test(`${sceneId}: every camera the player can reach keeps the bottom edge on ${floor.name}`, () => {
    // The opening pose is one point in an envelope the player can drag around.
    // Checking only the opening pose hid half of the original defect.
    //
    // THE TARGET IS FIXED. That envelope used to include a sideways pan, and the
    // landscape overrun this test was written for needed one to reach. Panning
    // was removed outright — a drag turns the room now — so the reachable set is
    // tilt x turn, and the turn is asked of the app rather than read off the
    // preset: rotation range stopped being per-scene data when the Playroom was
    // found to be authored a third wider than its own walls allow. See
    // utils/scene/rotationRange.
    const preset = getSceneCameraPreset(sceneId);
    const c = preset.constraints ?? {};
    const minPolar = c.minPolar ?? Math.max(0.9, preset.polar - 0.1);
    const maxPolar = c.maxPolar ?? Math.min(1.35, preset.polar + 0.1);
    const ceilingY = c.ceilingY ?? 6.0;
    const target = new Vector3(...preset.target);

    let worst = null;
    for (const [label, aspect] of ASPECTS) {
      // BOTH OF THESE ARE PER ASPECT. The turn used to be hoisted out of this
      // loop, which was correct only while it was one constant for every
      // viewport. It is a schedule now — ±45° on a tall phone, ±10° on a laptop
      // — so hoisting it would test the widest turn against every aspect and
      // report a failure no device can reach.
      const maxAz = resolveRotationRange(aspect, sceneId);
      // The furthest the player can orbit out is where the bottom edge reaches
      // furthest. Asked of the app, not re-derived here — the inline copy this
      // replaced was carrying the buggy pull-back rule.
      const maxDistance = sceneCameraMaxDistance(sceneId, aspect);
      for (const polar of [minPolar, preset.polar, maxPolar]) {
        for (const az of [preset.azimuth - maxAz, preset.azimuth, preset.azimuth + maxAz]) {
          const position = target.clone().add(new Vector3().setFromSpherical(new Spherical(maxDistance, polar, az)));
          if (position.y > ceilingY) position.y = ceilingY;
          for (const hit of bottomEdgeGroundReach(camAt(position, target, aspect), floor.planeY)) {
            if (!hit) {
              worst = { label, why: `a bottom-edge ray never reaches ${floor.name}`, polar, az };
              continue;
            }
            const over = Math.max(Math.abs(hit.z) - floor.halfDepth, Math.abs(hit.x) - floor.halfWidth);
            if (over > 1e-6 && (!worst || over > (worst.over ?? 0))) {
              worst = {
                label,
                why: `lands at (${hit.x.toFixed(2)}, ${hit.z.toFixed(2)}) outside ${floor.name} ${floor.halfWidth}x${floor.halfDepth}`,
                over,
                polar,
                az,
              };
            }
          }
        }
      }
    }
    assert.equal(
      worst,
      null,
      worst &&
        `${sceneId}: reachable camera looks past ${floor.name} — ${worst.label} polar=${worst.polar?.toFixed(2)} az=${worst.az?.toFixed(3)}: ${worst.why}`,
    );
  });

  test(`${sceneId}: the near half of the opening frame is playable surface, not backdrop`, () => {
    // Pirate Cove's floor is a 400x400 ocean, so the two tests above cannot fail
    // for it however badly the ship is framed. This is the assertion that can:
    // the ray through the bottom-centre of the viewport must land on the surface
    // the child can actually touch — the deck, the lawn — at y = 0.
    //
    // Measured margins when written: pirate-cove lands at z=-5.56 against a
    // half-depth of 7 at all nine aspects; nature reaches z=-11.06 at the
    // narrowest aspect against a half-depth of 16.
    for (const [label, aspect] of ASPECTS) {
      const pose = resolveSceneCameraPose(sceneId, aspect);
      const hit = bottomEdgeGroundReach(camAt(pose.position, pose.target, aspect), 0)[1];
      assert.ok(hit, `${sceneId} ${label}: the bottom-centre view ray never descends to the playable surface`);
      assert.ok(
        Math.abs(hit.x) <= playHalfW + 1e-6 && Math.abs(hit.z) <= playHalfD + 1e-6,
        `${sceneId} ${label}: the bottom of the frame is backdrop, not play area — the centre ray lands at (${hit.x.toFixed(2)}, ${hit.z.toFixed(2)}), outside the ${env.ground.width}x${env.ground.depth} surface`,
      );
    }
  });

  test(`${sceneId}: every portal is inside the frame at the opening pose`, () => {
    // The portals are the only affordance a pre-reading child has. A camera rule
    // that fixes the ground by framing them off the edge has traded one defect
    // for a worse one, so the two are asserted together on purpose.
    //
    // This loop reports the WORST aspect, not the first failing one. The
    // original `assert.ok` inside the loop aborted at iPad portrait with an
    // overshoot of 0.05 NDC and never reached `extreme`, where the same portal
    // was 0.962 outside — a defect nineteen times larger, hidden by nothing more
    // than the order of the array.
    let worst = null;
    for (const [label, aspect] of ASPECTS) {
      const pose = resolveSceneCameraPose(sceneId, aspect);
      const cam = camAt(pose.position, pose.target, aspect);
      for (const portal of env.portals) {
        const p = portal.position.clone();
        // Portals sit on the floor; sample at the disc centre, lifted to the
        // height the scene actually draws the ring at.
        p.y = 0.3;
        const ndc = p.project(cam);
        const over = Math.max(Math.abs(ndc.x) - 1, Math.abs(ndc.y) - 1);
        if (over > 0 && (!worst || over > worst.over)) {
          worst = { label, gameId: portal.gameId, over, ndc: ndc.clone() };
        }
      }
    }
    assert.equal(
      worst,
      null,
      worst &&
        `${sceneId}: portal '${worst.gameId}' is ${worst.over.toFixed(3)} NDC outside the frame at ${worst.label} (ndc ${worst.ndc.x.toFixed(2)}, ${worst.ndc.y.toFixed(2)}) — worst of ${ASPECTS.length} aspects`,
    );
  });
}

test('nature: the treeline rows sit behind the ground far edge with no gap', () => {
  // The treeline is what the player sees where the ground stops. If the first
  // row stands beyond the ground's far edge, a strip of skydome shows between
  // the last grass and the first trunk.
  const halfD = NATURE_ENVIRONMENT.ground.depth / 2;
  assert.ok(
    TREELINE_BACK_ROWS[0].z <= halfD,
    `first treeline row is at z=${TREELINE_BACK_ROWS[0].z}, beyond the ground far edge z=${halfD} — that gap renders as sky`,
  );
  // Rows must recede, and haze must increase with distance or the aerial
  // perspective reads backwards.
  for (let i = 1; i < TREELINE_BACK_ROWS.length; i++) {
    assert.ok(TREELINE_BACK_ROWS[i].z > TREELINE_BACK_ROWS[i - 1].z, `treeline row ${i} is not behind row ${i - 1}`);
    assert.ok(TREELINE_BACK_ROWS[i].haze > TREELINE_BACK_ROWS[i - 1].haze, `treeline row ${i} is not hazier than row ${i - 1}`);
  }
  // Adjacent canopies must overlap, or the row is a comb and the sky shows
  // through it at ground level.
  assert.ok(
    TREELINE_CANOPY_RADIUS > TREELINE_SPACING / 2,
    `canopy radius ${TREELINE_CANOPY_RADIUS} does not span half the spacing ${TREELINE_SPACING} — the row has gaps`,
  );
  // The side columns are the load-bearing ones: without them the audit leaks
  // rays past the ground's left and right edges.
  for (const col of TREELINE_SIDE_COLUMNS) {
    assert.ok(col.x >= NATURE_ENVIRONMENT.ground.width / 2 - 1, `side column at |x|=${col.x} stands well inside the ground edge`);
    assert.ok(col.height >= TREELINE_BACK_ROWS[TREELINE_BACK_ROWS.length - 1].height, `side column at |x|=${col.x} is shorter than the far back row`);
  }
});

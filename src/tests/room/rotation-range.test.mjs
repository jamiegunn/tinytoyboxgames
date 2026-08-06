/**
 * How far a scene may turn, and whether the shipped number is one its walls can
 * actually take.
 *
 * THE DEFECT THIS FOUND
 * ---------------------
 * Rotation range used to be per-scene data — `maxAzimuthRange` in the catalog,
 * defaulting to 0.25. Recomputing each room's limit from its own walls showed
 * the Playroom was authored a third wider than its geometry allows.
 *
 * Nothing caught it because `tests/room/scene-ground-coverage.test.mjs` covers
 * Nature and Pirate Cove only. No guard had ever looked at a ROOM's camera
 * envelope. This file is that guard.
 *
 * WHAT "TOO FAR" MEANS, AND THE TWO WRONG ANSWERS BEFORE IT
 * ---------------------------------------------------------
 * Not "the camera left the box". The portrait pull-back legitimately puts the
 * camera OUTSIDE the room, in front of the opening looking in — a rule about
 * where the camera stands calls that a failure at every scene and reports a
 * limit of zero everywhere. And not "the camera is outboard of a side wall"
 * either: a camera safely between the walls can still be pointed so a corner of
 * the frame sweeps past the end of one.
 *
 * The rule that survives is about the FRAME: every corner ray must land on
 * something the set contains. `rayMissesTheRoom` answers that for one ray by
 * asking which face of the room's box the ray leaves by — the open front is the
 * only face that is not a surface.
 *
 * WHAT IS ASSERTED
 * ----------------
 * Tests 1-8 drive the pure geometry with hand-made shells and hand-made corner
 * rays, so the rule can be reasoned about without a scene in the way. Tests 9
 * onward rebuild each room's shell and orbit from that room's own layout
 * constants and its own preset, measure per aspect, and fail if
 * `SHARED_ROTATION_RANGE` exceeds what any cleanly-framed aspect can take.
 *
 * `EXPECTED_UNCLEAN_ASPECTS` pins the aspects that already show past the walls
 * with the view untouched. It is EMPTY now — letterboxing the stage fixed the
 * portrait framing defect it was written to name — and it is kept empty rather
 * than deleted so that a regression fails with the names in it.
 *
 * MUTATION RESULTS, 2026-08-02: 13 mutations of `rotationRange.ts` and the scene
 * catalog, 13 killed. Two of them changed what this file asserts:
 *
 *   M8  delete `if (!safe(0)) return 0;` from `largestSafeRotation`
 *       Survived at first, and the reason was instructive: bisection alone
 *       already returns zero whenever safety is MONOTONIC in the turn, so the
 *       guard only earns its place on a non-monotonic envelope — which is not a
 *       hypothetical, since a room is not convex from every pose and the ceiling
 *       clamp bends the arc. The first fixture written for it was still
 *       monotonic (the orbit left the test room's walls at large turns, so
 *       nothing was ever clean). "A broken resting frame stays zero even when a
 *       WIDER turn happens to be clean" is the fixture that actually bites, and
 *       it asserts the non-monotonicity itself so it cannot rot into a tautology.
 *
 *   M12 reinstate `panRangeX` on ONE catalog entry
 *       Survived, because the pan guard asked Nature only — and Nature has no
 *       `constraints` block at all, so it could not have failed however many pan
 *       ranges came back elsewhere. It now sweeps every scene in the catalog.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera, Vector3 } from 'three';
import { bundleEntry } from '../framework/_tsload.mjs';

const {
  rayMissesTheRoom,
  frameSeesPastWalls,
  orbitPositionsAt,
  largestSafeRotation,
  clampAzimuth,
  resolveRotationRange,
  ROTATION_BUDGET,
  getSceneCameraPreset,
  SCENE_CATALOG,
  MIN_STAGE_ASPECT,
  MAX_STAGE_ASPECT,
  stageAspectFor,
  sceneCameraMaxDistance,
  SCENE_CAMERA_FOV,
  PLAYROOM,
  KITCHEN,
  LIVING,
} = await bundleEntry(
  'rotation-range',
  `
  export { rayMissesTheRoom, frameSeesPastWalls, orbitPositionsAt, largestSafeRotation, clampAzimuth, resolveRotationRange, ROTATION_BUDGET }
    from './src/utils/scene/rotationRange';
  export { getSceneCameraPreset, SCENE_CATALOG } from './src/scenes/sceneCatalog';
  export { MIN_STAGE_ASPECT, MAX_STAGE_ASPECT, stageAspectFor } from './src/utils/scene/stageRect';
  export { sceneCameraMaxDistance, SCENE_CAMERA_FOV } from './src/utils/cameraPresets';
  export * as PLAYROOM from './src/scenes/world/places/house/subplaces/playroom/layout';
  export * as KITCHEN from './src/scenes/world/places/house/subplaces/kitchen/layout';
  export * as LIVING from './src/scenes/world/places/house/subplaces/living-room/layout';
`,
);

/**
 * The aspects the CAMERA is ever given, which is not the same as the aspects the
 * device ever has.
 *
 * Nine shipping viewports, mapped through the letterbox. A 0.40 phone renders a
 * 1.00 stage with a chrome band under it, so 0.40 is not in this list and no
 * amount of rotation work has anything to say about it. Derived from
 * `stageAspectFor` rather than written out, so that widening the band cannot
 * leave this list behind — which is exactly how the previous version of this
 * file came to measure a rotation limit of zero on phones and report it as a
 * property of rotation.
 */
const SHIPPING_VIEWPORTS = [
  [1280, 720],
  [1024, 768],
  [800, 800],
  [768, 1024],
  [480, 854],
  [375, 667],
  [393, 852],
  [412, 915],
  [400, 1000],
];
const ASPECTS = [...new Set(SHIPPING_VIEWPORTS.map(([w, h]) => stageAspectFor(w, h)))].sort((a, b) => a - b);

const DEG = 180 / Math.PI;

/** The camera height clamp `createSceneCamera` applies when no preset overrides it. */
const DEFAULT_CEILING_CLAMP = 6.0;

// ── the pure rule ────────────────────────────────────────────────────────────

/** A room 10 wide, 18 deep, 6 tall, open toward -z. */
const SHELL = { wallX: 5, frontZ: -10, backZ: 8, ceilingY: 6, floorY: 0 };

/** Straight ahead, from the usual camera pose. */
const INSIDE = new Vector3(0, 3, -6);

test('a ray that ends on the back wall is fine', () => {
  assert.equal(rayMissesTheRoom(INSIDE, new Vector3(0, 0, 1), SHELL), false);
});

test('a ray that ends on a side wall, the floor or the ceiling is fine', () => {
  assert.equal(rayMissesTheRoom(INSIDE, new Vector3(1, 0, 0.2).normalize(), SHELL), false, 'side wall');
  assert.equal(rayMissesTheRoom(INSIDE, new Vector3(0, -1, 0.3).normalize(), SHELL), false, 'floor');
  assert.equal(rayMissesTheRoom(INSIDE, new Vector3(0, 1, 0.3).normalize(), SHELL), false, 'ceiling');
});

test('a ray that leaves through the open front shows the child nothing', () => {
  // Turned so far round that it is looking back out of the doorway. There is no
  // fourth wall, so this is the void.
  assert.equal(rayMissesTheRoom(INSIDE, new Vector3(0.3, 0, -1).normalize(), SHELL), true);
});

test('a camera in FRONT of the room, looking in, is fine', () => {
  // This is not a contrived case: the portrait pull-back moves the room cameras
  // from z -13 out to z -24, well outside the set. An earlier version of this
  // rule required the camera to be inside the box and reported every scene as
  // having zero permitted rotation.
  const outside = new Vector3(0, 3, -20);
  assert.equal(rayMissesTheRoom(outside, new Vector3(0, 0, 1), SHELL), false);
  // ...but a ray from out there that never meets the room at all still misses.
  assert.equal(rayMissesTheRoom(outside, new Vector3(1, 0, 0).normalize(), SHELL), true);
});

test('a ray pointing away from the room misses it', () => {
  assert.equal(rayMissesTheRoom(new Vector3(0, 3, -20), new Vector3(0, 0, -1), SHELL), true);
});

test('frameSeesPastWalls fails if ANY corner escapes, not the average', () => {
  const forward = new Vector3(0, 0, 1);
  const escaping = new Vector3(0.9, 0, -1).normalize();
  assert.equal(frameSeesPastWalls(INSIDE, [forward, forward, forward, forward], SHELL), false);
  assert.equal(frameSeesPastWalls(INSIDE, [forward, forward, forward, escaping], SHELL), true);
});

test('orbitPositionsAt pivots on a FIXED centre and samples both ends only', () => {
  const orbit = { azimuth: Math.PI, pivot: new Vector3(0, 0.5, 0), radii: [10], polars: [1.2], ceilingClamp: 100 };
  const none = orbitPositionsAt(0, orbit);
  const some = orbitPositionsAt(0.3, orbit);
  assert.equal(none.length, 2, 'both signs are still sampled at zero');
  assert.equal(some.length, 2);
  assert.ok(Math.abs(none[0].x - none[1].x) < 1e-9, 'at zero offset the two extremes coincide');
  assert.ok(Math.abs(some[0].x - some[1].x) > 1e-6, 'at a real offset they do not');
  // The pivot is the same for both, so the two positions are equidistant from it.
  const d0 = some[0].distanceTo(orbit.pivot);
  const d1 = some[1].distanceTo(orbit.pivot);
  assert.ok(Math.abs(d0 - d1) < 1e-9, 'a fixed pivot means a symmetric arc');
});

test('orbitPositionsAt applies the camera height clamp the app applies', () => {
  // Not cosmetic: the portrait pull-back lifts the Playroom camera above its own
  // ceiling, and without this clamp the measurement watches the top corners sail
  // over the back wall and calls every room unrotatable.
  const orbit = { azimuth: Math.PI, pivot: new Vector3(0, 0, 0), radii: [20], polars: [0.9], ceilingClamp: 6 };
  for (const position of orbitPositionsAt(0.2, orbit)) {
    assert.ok(position.y <= 6 + 1e-9, `expected the clamp to hold y at 6, got ${position.y.toFixed(3)}`);
  }
});

test('largestSafeRotation finds the angle where the frame first shows the void', () => {
  // A pinhole frame — all four corners on the view axis — reduces to a single
  // ray, and a single ray from the centre of a room of half-width 5, orbiting at
  // radius 10 in the horizontal plane, leaves through the front when the turn
  // reaches pi/2. Below that it always lands on a wall. Nothing about the
  // implementation is consulted to know that.
  const pinhole = (position, pivot) => {
    const d = pivot.clone().sub(position).normalize();
    return [d, d, d, d];
  };
  const orbit = { azimuth: Math.PI, pivot: new Vector3(0, 3, 0), radii: [10], polars: [Math.PI / 2], ceilingClamp: 100 };
  const limit = largestSafeRotation({ wallX: 5, frontZ: -100, backZ: 100, ceilingY: 6, floorY: 0 }, orbit, pinhole, 1.2);
  assert.ok(limit > 1.19, `a ray aimed at the pivot always hits something; got ${limit.toFixed(3)}`);

  // Widen the frame and the corners start escaping long before the axis does.
  const wide = (position, pivot) => {
    const d = pivot.clone().sub(position).normalize();
    const left = d.clone().applyAxisAngle(new Vector3(0, 1, 0), 0.6);
    const right = d.clone().applyAxisAngle(new Vector3(0, 1, 0), -0.6);
    return [d, d, left, right];
  };
  const narrower = largestSafeRotation({ wallX: 5, frontZ: -100, backZ: 100, ceilingY: 6, floorY: 0 }, orbit, wide, 1.2);
  assert.ok(narrower < limit, `a wider frame must permit less turn: ${narrower.toFixed(3)} vs ${limit.toFixed(3)}`);
});

test('largestSafeRotation returns zero when the untouched frame already shows the void', () => {
  // Every corner aimed straight out of the opening: there is no turn small
  // enough to fix that, and the answer has to be exactly zero rather than a
  // small positive number the caller might ship.
  const outward = () => {
    const d = new Vector3(0, 0, -1);
    return [d, d, d, d];
  };
  const orbit = { azimuth: Math.PI, pivot: new Vector3(0, 3, 0), radii: [10], polars: [Math.PI / 2], ceilingClamp: 100 };
  assert.equal(largestSafeRotation(SHELL, orbit, outward), 0);
});

test('a broken resting frame stays zero even when a WIDER turn happens to be clean', () => {
  // The zero short-circuit is not redundant with the bisection, and this is the
  // case that proves it. Bisection alone would leave `lo` at zero only while
  // safety is monotonic in the turn — and it is not guaranteed to be, because a
  // room is not convex from every pose and the ceiling clamp bends the arc.
  //
  // Here the frame escapes at rest and at small turns but lands on a wall once
  // the turn is large. Reporting the large number would be a rotation range the
  // player reaches THROUGH a broken view, which is worse than reporting none.
  // A room wide enough that the orbit stays inside it throughout, so the only
  // thing deciding safety is the frame — which is the whole point of the fixture.
  const wide = { wallX: 20, frontZ: -30, backZ: 30, ceilingY: 6, floorY: 0 };
  const orbit = { azimuth: Math.PI, pivot: new Vector3(0, 3, 0), radii: [10], polars: [Math.PI / 2], ceilingClamp: 100 };
  const flaky = (position) => {
    const escaped = new Vector3(0, 0, -1);
    const inward = new Vector3(0, 0, 1);
    // |x| grows with the turn: small turns escape, large ones do not.
    const d = Math.abs(position.x) < 4 ? escaped : inward;
    return [d, d, d, d];
  };
  assert.ok(largestSafeRotation(wide, orbit, flaky, 1.2) === 0, 'a wide turn being clean must not license the broken resting frame');
  // ...and the fixture really is non-monotonic, or the assertion above proves
  // nothing: a turn beyond asin(0.4) frames cleanly, and is still not offered.
  const wideOrbit = { ...orbit, azimuth: Math.PI + 0.6 };
  assert.ok(largestSafeRotation(wide, wideOrbit, flaky, 0.05) > 0.04, 'the fixture is clean at a large turn');
});

test('clampAzimuth holds a heading inside the arc, and leaves one inside it alone', () => {
  assert.equal(clampAzimuth(Math.PI + 1, Math.PI, 0.33), Math.PI + 0.33);
  assert.equal(clampAzimuth(Math.PI - 1, Math.PI, 0.33), Math.PI - 0.33);
  assert.equal(clampAzimuth(Math.PI + 0.1, Math.PI, 0.33), Math.PI + 0.1);
});

// ── the rooms, measured against their own walls ──────────────────────────────

const ROOMS = [
  ['playroom', PLAYROOM],
  ['kitchen', KITCHEN],
  ['living-room', LIVING],
];

/**
 * The aspects at which a room's frame shows past its walls with the view
 * UNTOUCHED — so there is no clean frame for rotation to be measured from.
 *
 * EMPTY, AND IT WAS NOT. Before the stage was letterboxed this listed five
 * aspects per room: the portrait pull-back drove the camera from z -13 out to
 * z -24 while the ceiling clamp pinned it at y 6.0, so the frame was wider than
 * the set before the player had touched anything. That was never a rotation
 * defect and reducing the rotation range would never have fixed it; the stage
 * aspect band did, by never handing the camera an aspect the set cannot fill.
 *
 * Kept as an explicit empty list rather than deleted. A regression here is a
 * silent one — the frame showing void at rest looks like scenery to anyone who
 * has not seen the room before — and an assertion that a list is empty fails
 * with the names in it.
 */
const EXPECTED_UNCLEAN_ASPECTS = {
  playroom: [],
  kitchen: [],
  'living-room': [],
};

/**
 * Frustum corner directions for a camera at `position` looking at `pivot`.
 *
 * Built from a real `PerspectiveCamera` with the app's own FOV rather than from
 * trigonometry here, so the measurement cannot drift away from what three.js
 * actually projects.
 *
 * @param aspect - Viewport aspect ratio.
 * @returns A `(position, pivot) => Vector3[]` of four normalised corner rays.
 */
function cornersFor(aspect) {
  return (position, pivot) => {
    const camera = new PerspectiveCamera(SCENE_CAMERA_FOV, aspect, 0.1, 200);
    camera.position.copy(position);
    camera.lookAt(pivot);
    camera.updateMatrixWorld(true);
    camera.updateProjectionMatrix();
    return [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ].map(([nx, ny]) => new Vector3(nx, ny, 1).unproject(camera).sub(position).normalize());
  };
}

/**
 * The room's box and its reachable orbit, from that room's own constants.
 *
 * @param sceneId - Registered scene id.
 * @param layout - The room's layout module.
 * @returns The shell, and a builder for a single-aspect orbit envelope.
 */
function envelopeOf(sceneId, layout) {
  const preset = getSceneCameraPreset(sceneId);
  const c = preset.constraints ?? {};
  return {
    shell: {
      wallX: layout.LEFT_WALL_X,
      frontZ: layout.BACK_WALL_CENTER_Z - layout.ROOM_DEPTH,
      backZ: layout.BACK_WALL_CENTER_Z,
      ceilingY: layout.CEILING_Y,
      floorY: 0,
    },
    orbitAt: (aspect) => ({
      azimuth: preset.azimuth,
      // The pivot is the preset's target and cannot move: panning is gone.
      pivot: new Vector3(...preset.target),
      radii: [sceneCameraMaxDistance(sceneId, aspect)],
      polars: [c.minPolar ?? Math.max(0.9, preset.polar - 0.1), preset.polar, c.maxPolar ?? Math.min(1.35, preset.polar + 0.1)],
      ceilingClamp: c.ceilingY ?? DEFAULT_CEILING_CLAMP,
    }),
  };
}

/**
 * Every aspect's rotation limit for a room.
 *
 * @param sceneId - Registered scene id.
 * @param layout - The room's layout module.
 * @returns `{ aspect, limit }` per shipping aspect.
 */
function limitsPerAspect(sceneId, layout) {
  const { shell, orbitAt } = envelopeOf(sceneId, layout);
  return ASPECTS.map((aspect) => ({ aspect, limit: largestSafeRotation(shell, orbitAt(aspect), cornersFor(aspect)) }));
}

for (const [sceneId, layout] of ROOMS) {
  test(`${sceneId}: exactly the expected aspects start out framed past the walls`, () => {
    const unclean = limitsPerAspect(sceneId, layout)
      .filter(({ limit }) => limit === 0)
      .map(({ aspect }) => aspect);
    const expected = EXPECTED_UNCLEAN_ASPECTS[sceneId];
    assert.deepEqual(
      unclean.map((a) => a.toFixed(4)),
      expected.map((a) => a.toFixed(4)),
      `${sceneId}: the set of aspects whose resting frame shows past the walls has changed. If portrait framing was ` +
        `just fixed, shrink EXPECTED_UNCLEAN_ASPECTS. If it grew, a preset or a pull-back has regressed.`,
    );
  });

  test(`${sceneId}: the shipped rotation range is one this room's walls can take`, () => {
    const clean = limitsPerAspect(sceneId, layout).filter(({ limit }) => limit > 0);
    assert.ok(clean.length > 0, `${sceneId}: no aspect frames this room cleanly at all`);
    for (const { aspect, limit } of clean) {
      const shipped = resolveRotationRange(aspect);
      assert.ok(
        shipped <= limit,
        `${sceneId} at aspect ${aspect.toFixed(2)}: rotation is set to ±${(shipped * DEG).toFixed(1)}° but ` +
          `the frame starts showing past the walls at ±${(limit * DEG).toFixed(1)}°. Either lower ROTATION_BUDGET ` +
          `around this aspect or give the room the geometry to take it.`,
      );
    }
  });
}

test('the shipped range keeps a margin against the tightest cleanly-framed aspect', () => {
  // Exact equality with the limit would mean any change to a wall or a preset
  // silently starts showing the void. The margin is what makes this guard fail
  // on a near miss instead of a direct hit.
  //
  // PER ASPECT, because the shipped range now is. A single worst-case comparison
  // would let a generous narrow-end budget hide a wide-end violation, and the
  // wide end is exactly where the safe limit collapses.
  const all = ROOMS.flatMap(([sceneId, layout]) =>
    limitsPerAspect(sceneId, layout)
      .filter(({ limit }) => limit > 0)
      .map(({ aspect, limit }) => ({ sceneId, aspect, limit, margin: 1 - resolveRotationRange(aspect) / limit })),
  );
  const tightest = all.reduce((a, b) => (a.margin <= b.margin ? a : b));
  assert.ok(
    tightest.margin >= 0.1,
    `the tightest clean framing is ${tightest.sceneId} at aspect ${tightest.aspect.toFixed(2)}, ±${(tightest.limit * DEG).toFixed(1)}°, ` +
      `and rotation there is ±${(resolveRotationRange(tightest.aspect) * DEG).toFixed(1)}° — only ${(tightest.margin * 100).toFixed(1)}% inside it. Keep 10%.`,
  );
});

test('the budget never exceeds what the walls allow, swept rather than sampled', () => {
  // The pinned entries are measured, but what SHIPS is the interpolation between
  // them, and a straight line between two safe points can pass over an unsafe one
  // — the rooms' safe limit is not linear in aspect. So this walks the whole band
  // at 0.01 rather than checking the pins.
  const envelopes = ROOMS.map(([sceneId, layout]) => [sceneId, envelopeOf(sceneId, layout)]);
  let worst = null;
  for (let aspect = MIN_STAGE_ASPECT; aspect <= MAX_STAGE_ASPECT + 1e-9; aspect += 0.01) {
    const shipped = resolveRotationRange(aspect);
    for (const [sceneId, { shell, orbitAt }] of envelopes) {
      const limit = largestSafeRotation(shell, orbitAt(aspect), cornersFor(aspect));
      if (limit <= 0) continue;
      const margin = 1 - shipped / limit;
      if (!worst || margin < worst.margin) worst = { sceneId, aspect, limit, shipped, margin };
    }
  }
  assert.ok(worst, 'no aspect in the band frames any room cleanly');
  assert.ok(
    worst.margin >= 0.1,
    `interpolating between the pinned entries overshoots: ${worst.sceneId} at aspect ${worst.aspect.toFixed(2)} allows ` +
      `±${(worst.limit * DEG).toFixed(1)}° and the budget interpolates to ±${(worst.shipped * DEG).toFixed(1)}°, ` +
      `${(worst.margin * 100).toFixed(1)}% inside it. A pinned entry is safe but the line between two of them is not.`,
  );
});

test('the budget is a schedule, not a constant, and it falls as the frame widens', () => {
  // The shape carries the argument. A narrow frame sees less of the room's width,
  // so it must turn further to reach a toybox AND may turn further before it
  // meets a wall end; a wide frame is the reverse. A budget that did not fall
  // with aspect would be one of those two failures somewhere.
  assert.ok(ROTATION_BUDGET.length >= 4, 'a table this short is a constant wearing a table costume');
  for (let i = 1; i < ROTATION_BUDGET.length; i++) {
    const [aPrev, rPrev] = ROTATION_BUDGET[i - 1];
    const [aNext, rNext] = ROTATION_BUDGET[i];
    assert.ok(aNext > aPrev, `ROTATION_BUDGET is not sorted by aspect: ${aPrev} then ${aNext}`);
    assert.ok(rNext < rPrev, `the budget rises from ±${(rPrev * DEG).toFixed(1)}° at ${aPrev} to ±${(rNext * DEG).toFixed(1)}° at ${aNext}`);
    assert.ok(rNext > 0, `the budget reaches ${rNext} at aspect ${aNext}, which locks rotation rather than limiting it`);
  }
  // The table has to cover the band, or the flat ends are doing the work of a
  // measurement that was never taken.
  assert.ok(ROTATION_BUDGET[0][0] <= MIN_STAGE_ASPECT, `the table starts at ${ROTATION_BUDGET[0][0]}, above the stage floor ${MIN_STAGE_ASPECT}`);
  assert.ok(
    ROTATION_BUDGET[ROTATION_BUDGET.length - 1][0] >= MAX_STAGE_ASPECT,
    `the table ends at ${ROTATION_BUDGET[ROTATION_BUDGET.length - 1][0]}, below the stage ceiling ${MAX_STAGE_ASPECT}`,
  );
  // Flat outside the table rather than extrapolated: a straight line off the end
  // of this one crosses zero at about 3.7 and goes negative after.
  assert.equal(resolveRotationRange(0.1), ROTATION_BUDGET[0][1]);
  assert.equal(resolveRotationRange(9), ROTATION_BUDGET[ROTATION_BUDGET.length - 1][1]);
  // A NON-NUMBER GETS THE TIGHTEST, NOT THE WIDEST. Three test files called this
  // with no argument while it still took none, and returning the narrow-phone
  // budget for `undefined` applied ±45° of turn to a landscape frame without
  // anything failing. An aspect that cannot be read must not license the widest
  // turn in the table.
  const tightest = ROTATION_BUDGET[ROTATION_BUDGET.length - 1][1];
  assert.equal(resolveRotationRange(Number.NaN), tightest, 'a NaN aspect must not produce a NaN clamp, or the widest one');
  assert.equal(resolveRotationRange(undefined), tightest);
});

test('nothing can pan: no scene in the catalog carries a target or azimuth constraint', () => {
  // The pivot being fixed is the premise of every measurement above. If a pan
  // constraint comes back, `orbitPositionsAt` stops describing the reachable set
  // and these limits become optimistic without anything else failing.
  //
  // EVERY scene, not a sample. An earlier version of this asked Nature only —
  // which has no `constraints` block at all, so it could not have failed however
  // many pan ranges were reinstated elsewhere in the catalog.
  const offenders = [];
  for (const sceneId of Object.keys(SCENE_CATALOG)) {
    const constraints = getSceneCameraPreset(sceneId).constraints ?? {};
    for (const dead of ['panRangeX', 'minTargetY', 'maxTargetY', 'maxAzimuthRange']) {
      if (dead in constraints) offenders.push(`${sceneId}.${dead}`);
    }
  }
  assert.deepEqual(offenders, [], `pan or per-scene azimuth constraints are back — see this file's header: ${offenders.join(', ')}`);
});

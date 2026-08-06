/**
 * The opening turn, re-derived rather than re-read.
 *
 * WHAT IT IS FOR. `utils/scene/openingTurn.ts` turns each room a little before it
 * opens, so a portrait phone has a toybox — and therefore the halo hung over it —
 * in the resting frame instead of off the edge. That schedule is a pinned table
 * of solved minima: each row is the smallest turn that shows a halo while leaving
 * a point of frame to spare on every composition bound, with nothing added
 * afterwards — its own header explains why padding the angle would have been the
 * wrong place to put the safety. A table like that is only as good as the guard
 * that re-derives it, so this suite recomputes the properties the solver was
 * solving for, on a grid ten times finer than the table's own rows, from the same
 * scenes the app builds.
 *
 * THE FOUR CLAIMS, and each is a way the schedule could be wrong:
 *
 *   1. THE OPENING POSE IS INSIDE THE ROOM'S OWN TURN LIMIT. A turn wider than
 *      `resolveRotationRange` would open the room outside the window the child is
 *      then allowed to drag within, so the first thing any drag does is snap the
 *      view somewhere else.
 *   2. THE OPENING FRAME IS STILL CLEAN. Turned far enough, a frame corner
 *      escapes past the end of a side wall and the child sees the void. This is
 *      `frameSeesPastWalls`, over the same polar spread the shipped orbit is free
 *      to tilt through — not just at the nominal polar.
 *   3. A HALO IS IN FRAME AND SO IS THE BOX UNDER IT, wherever the schedule is
 *      non-zero. This is the only claim that says the feature works, and it is
 *      checked against the real sprites the real `createTapInvitation` put in the
 *      scene, not against a recomputed guess at where they would be.
 *
 *      BOTH HALVES, because the first version of this suite checked only the halo
 *      and passed on a schedule that opened the Kitchen and the Living Room with
 *      their toyboxes cut in half by the frame edge and a tidy ring floating above
 *      them. A halo is a pointer; a pointer at something half off screen points at
 *      half a thing. The box test is its own standard — bbox centre inside 0.85
 *      NDC with 90% of its projected area on screen — and deliberately NOT the
 *      shipped `tappable` predicate, which those clipped poses already satisfied:
 *      0.85 with 60% of the area showing is "jammed against the edge with a corner
 *      missing", and `tappable` answers "could a finger find this" rather than
 *      "did the room open onto it".
 *   4. THE TURN IS NOT GRATUITOUS. No ROW of the table may carry a turn at an
 *      aspect where a halo is already wholly in frame without one. Rooms opening
 *      crooked for no reason is a bug no other claim here can see, because every
 *      other claim is satisfied by turning MORE.
 *
 *      IT IS THE ROWS AND NOT THE FINE GRID, and the difference is the whole
 *      content of the claim. Each table ramps to zero over its last interval, so
 *      between the last non-zero row and the zero one the interpolation returns
 *      small turns — 0.6° for the Playroom at aspect 0.665, 0.2° for the Living
 *      Room at 0.905, 0.2° for the Kitchen at 1.055 — at aspects where a halo has
 *      just come into frame on its own. Asserting on the grid failed all three on
 *      exactly those points, which is the assertion being wrong rather than the
 *      schedule: a ramp has to pass through the small values on its way down, and
 *      a fifth of a degree is not a crooked room. What would be a real defect is a
 *      solved ROW that turns a room which did not need turning, and rows are what
 *      the solver produces.
 *
 * WHAT THIS SUITE DELIBERATELY DOES NOT CHECK is composition — whether the turned
 * frame is still made of things rather than of empty floor. That is
 * `room-opening-framing.test.mjs`'s job and it already does it at every shipping
 * aspect. Rasterising a thousand rays per aspect on a grid this fine would take
 * minutes, and two suites bounding the same number is how a bound gets quietly
 * relaxed in one of them.
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { Box3, PerspectiveCamera, Scene, Vector3 } from 'three';
import gsap from 'gsap';
import { bundleEntry } from '../framework/_tsload.mjs';

const M = await bundleEntry(
  'openingTurn',
  [
    `export { OPENING_TURN, resolveOpeningTurn } from '@app/utils/scene/openingTurn';`,
    `export { frameSeesPastWalls, orbitPositionsAt, resolveRotationRange } from '@app/utils/scene/rotationRange';`,
    `export { SCENE_CAMERA_FOV, resolveSceneCameraPose } from '@app/utils/cameraPresets';`,
    `export { getSceneCameraPreset } from '@app/scenes/sceneCatalog';`,
    `export { buildPlayroomContents } from '@scenes/world/places/house/subplaces/playroom/room';`,
    `export { buildRoomContents as buildKitchen } from '@scenes/world/places/house/subplaces/kitchen/room';`,
    `export { buildRoomContents as buildLiving } from '@scenes/world/places/house/subplaces/living-room/room';`,
    `export * as PLAYROOM from '@scenes/world/places/house/subplaces/playroom/layout';`,
    `export * as KITCHEN from '@scenes/world/places/house/subplaces/kitchen/layout';`,
    `export * as LIVING from '@scenes/world/places/house/subplaces/living-room/layout';`,
    `export { setSceneIdleAnimator } from '@app/utils/idle/registry';`,
    `export { createDisposalScope } from '@app/utils/disposal';`,
  ].join('\n'),
);

// Building a room starts `repeat: -1` idle tweens, and gsap's ticker holds a live
// timer for as long as one exists — so without this the suite reports every
// result and then sits there forever with nothing left to do. It has to be an
// `after` hook and not a top-level call: a top-level `sleep()` runs before the
// tests do, and the first room built wakes the ticker straight back up. That is
// exactly what happened, and it hung the whole 604-test run after the last
// assertion in this file had already passed.
after(() => gsap.ticker.sleep());

const ROOMS = [
  ['playroom', M.buildPlayroomContents, M.PLAYROOM],
  ['living-room', M.buildLiving, M.LIVING],
  ['kitchen', M.buildKitchen, M.KITCHEN],
];

const CEILING_CLAMP = 6.0;
/**
 * Clear frame a halo must keep around it, in NDC, to count as arrived.
 *
 * The same 0.06 the solver used. A halo touching the frame edge is not the state
 * this feature exists to produce: it reads as something being cut off rather than
 * as something being pointed at.
 */
const HALO_MARGIN = 0.06;

const noop = () => {};
const stubCanvas = () => ({
  width: 1280,
  height: 720,
  clientWidth: 1280,
  clientHeight: 720,
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }),
  addEventListener: noop,
  removeEventListener: noop,
  style: {},
});

/** Builds a room the way the app does, and hands back its halos. */
function roomWithHalos(build) {
  const scene = new Scene();
  M.setSceneIdleAnimator(scene, M.createDisposalScope());
  const contents = build({
    scene,
    canvas: stubCanvas(),
    camera: new PerspectiveCamera(),
    dispatcher: { register: () => noop, registerWithPoint: () => noop, setMissHandler: noop, dispose: noop },
    nav: { navigateTo: noop, launchMiniGame: noop, exitMiniGame: noop },
    owl: { flyTo: noop, setSurfaceYAt: noop, land: noop, group: { position: new Vector3() } },
  });
  scene.updateMatrixWorld(true);
  const halos = [];
  scene.traverse((o) => {
    if (!o.name.startsWith('tapInvitation_')) return;
    // The box each halo hangs over, found by name so the pairing cannot drift
    // from whatever `createTapInvitation` decided to hang a halo on.
    const boxName = o.name.replace('tapInvitation_', '');
    const target = scene.children.find((c) => c.name === boxName);
    const bounds = target ? new Box3().setFromObject(target) : null;
    const pts = [];
    if (bounds && !bounds.isEmpty()) {
      for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) pts.push(new Vector3(x, y, z));
    }
    halos.push({ name: boxName, centre: o.getWorldPosition(new Vector3()), radius: o.scale.x / 2, pts });
  });
  return { scene, halos, cleanup: () => contents?.cleanup?.() };
}

const cam = new PerspectiveCamera(M.SCENE_CAMERA_FOV, 1, 0.1, 400);
const aimAt = (position, target, aspect) => {
  cam.aspect = aspect;
  cam.position.copy(position);
  cam.lookAt(target);
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();
};
const frameCorners = () =>
  [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ].map(([x, y]) => new Vector3(x, y, 1).unproject(cam).sub(cam.position).normalize());

/**
 * How well framed the box under a halo has to be. See claim 3 in the header for
 * why these are not the shipped `tappable` numbers.
 */
const BOX_CENTRE_LIMIT = 0.85;
const BOX_AREA_LIMIT = 0.9;

/** Is the box wholly enough in frame to be what the room opened onto? */
function boxFramed(pts) {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const p of pts) {
    const q = p.clone().project(cam);
    if (q.z > 1) return false;
    x0 = Math.min(x0, q.x);
    x1 = Math.max(x1, q.x);
    y0 = Math.min(y0, q.y);
    y1 = Math.max(y1, q.y);
  }
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  if (Math.abs(cx) > BOX_CENTRE_LIMIT || Math.abs(cy) > BOX_CENTRE_LIMIT) return false;
  const full = (x1 - x0) * (y1 - y0);
  if (full <= 1e-9) return true;
  return (Math.max(0, Math.min(x1, 1) - Math.max(x0, -1)) * Math.max(0, Math.min(y1, 1) - Math.max(y0, -1))) / full >= BOX_AREA_LIMIT;
}

/** Is the whole halo disc inside the frame, with `HALO_MARGIN` to spare? */
function haloInFrame(halo) {
  const centre = halo.centre.clone().project(cam);
  if (centre.z > 1) return false;
  const edge = halo.centre.clone().addScaledVector(new Vector3().setFromMatrixColumn(cam.matrixWorld, 0), halo.radius).project(cam);
  const rx = Math.abs(edge.x - centre.x);
  // The sprite faces the screen, so its NDC height per world unit is its NDC
  // width times the aspect. Deriving one from the other keeps this exact
  // everywhere instead of only at aspect 1.
  const ry = rx * cam.aspect;
  return Math.abs(centre.x) + rx <= 1 - HALO_MARGIN && Math.abs(centre.y) + ry <= 1 - HALO_MARGIN;
}

/** A halo has "arrived" only when it AND the box it points at are in frame. */
const arrived = (halo) => haloInFrame(halo) && halo.pts.length > 0 && boxFramed(halo.pts);

/**
 * A grid ten times finer than the table's rows, so an interpolation that dips
 * below the requirement between two rows is caught rather than assumed away.
 */
const FINE_ASPECTS = [];
for (let a = 0.4; a <= 2.601; a += 0.005) FINE_ASPECTS.push(+a.toFixed(3));

test('every room with an opening turn has one at every aspect the table covers, and none beyond it', () => {
  for (const [sceneId] of ROOMS) {
    const table = M.OPENING_TURN[sceneId];
    assert.ok(table && table.length > 0, `${sceneId} has no opening-turn table — every room needs one, even if it is all zeroes`);
    const signs = new Set(table.map(([, t]) => Math.sign(t)).filter((s) => s !== 0));
    assert.ok(signs.size <= 1, `${sceneId}'s table changes turn direction, so interpolating between two rows passes through zero and opens the room facing nothing`);
    assert.equal(table[table.length - 1][1], 0, `${sceneId}'s table must end at zero, or every aspect above it inherits a turn that was never solved for`);
    for (let i = 1; i < table.length; i++) {
      assert.ok(table[i][0] > table[i - 1][0], `${sceneId}'s table is not in ascending aspect order at row ${i}`);
      assert.ok(Math.abs(table[i][1]) <= Math.abs(table[i - 1][1]) + 1e-9, `${sceneId}'s turn grows with aspect at row ${i} — a wider frame needs less turn, never more`);
      assert.ok(table[i][0] - table[i - 1][0] <= 0.0501, `${sceneId}'s rows ${i - 1} and ${i} are ${(table[i][0] - table[i - 1][0]).toFixed(3)} apart; the schedule carries no margin and is only safe sampled every 0.05`);
    }
  }
});

for (const [sceneId, build, L] of ROOMS) {
  test(`${sceneId}: the opening turn stays inside the room's own turn limit and never shows the void`, () => {
    const preset = M.getSceneCameraPreset(sceneId);
    const shell = {
      wallX: L.LEFT_WALL_X,
      frontZ: L.BACK_WALL_CENTER_Z - L.ROOM_DEPTH,
      backZ: L.BACK_WALL_CENTER_Z,
      ceilingY: L.CEILING_Y,
      floorY: 0,
    };
    const pivot = new Vector3(...preset.target);
    const orbit = {
      azimuth: preset.azimuth,
      pivot,
      radii: [preset.distance],
      polars: [Math.max(0.75, preset.polar - 0.1), preset.polar, Math.min(1.5, preset.polar + 0.1)],
      ceilingClamp: CEILING_CLAMP,
    };

    for (const aspect of FINE_ASPECTS) {
      const turn = M.resolveOpeningTurn(aspect, sceneId);
      const budget = M.resolveRotationRange(aspect, sceneId);
      assert.ok(
        Math.abs(turn) <= budget + 1e-9,
        `${sceneId} at aspect ${aspect}: opens turned ${((turn * 180) / Math.PI).toFixed(1)}° but may only turn ±${((budget * 180) / Math.PI).toFixed(1)}° — ` +
          `the room would open outside its own clamp and snap on the first drag`,
      );
      for (const position of M.orbitPositionsAt(Math.abs(turn), orbit)) {
        aimAt(position, pivot, aspect);
        assert.ok(
          !M.frameSeesPastWalls(position, frameCorners(), shell),
          `${sceneId} at aspect ${aspect}: opening turned ${((turn * 180) / Math.PI).toFixed(1)}° puts a frame corner past a wall end — the child opens the room looking at the void`,
        );
      }
    }
  });

  test(`${sceneId}: the room opens with a tap halo wholly in frame, and stops turning as soon as one already is`, () => {
    const { halos, cleanup } = roomWithHalos(build);
    try {
      assert.ok(halos.length > 0, `${sceneId} built no tap invitations at all, so there is nothing for an opening turn to show`);

      // Portrait only. Above these aspects both the turn and the requirement are
      // zero, and the fourth claim below is what checks that.
      for (const aspect of FINE_ASPECTS) {
        const turn = M.resolveOpeningTurn(aspect, sceneId);
        const pose = M.resolveSceneCameraPose(sceneId, aspect);
        aimAt(pose.position, pose.target, aspect);
        const shown = halos.filter(arrived);

        if (turn !== 0) {
          assert.ok(
            shown.length > 0,
            `${sceneId} at aspect ${aspect}: opens turned ${((turn * 180) / Math.PI).toFixed(1)}° and STILL has no halo wholly in frame — ` +
              `the turn is being spent for nothing — either the halo is off the edge or the box under it is clipped. Halo NDC centres: ` +
              halos.map((h) => `${h.name} ${h.centre.clone().project(cam).x.toFixed(2)}`).join(', '),
          );
          continue;
        }

        // Turn is zero: either a halo is already in frame, or this aspect is
        // above the table and the room genuinely cannot do better.
        const table = M.OPENING_TURN[sceneId];
        const crossover = table[table.length - 1][0];
        if (aspect >= crossover) {
          assert.ok(
            shown.length > 0,
            `${sceneId} at aspect ${aspect}: the table ended at ${crossover} on the claim that a halo is in frame there without turning, and none is`,
          );
        }
      }
    } finally {
      cleanup();
    }
  });

  test(`${sceneId}: no solved row turns a room that was already showing a halo`, () => {
    const { halos, cleanup } = roomWithHalos(build);
    try {
      const preset = M.getSceneCameraPreset(sceneId);
      const target = new Vector3(...preset.target);
      for (const [aspect, turn] of M.OPENING_TURN[sceneId]) {
        if (turn === 0) continue;
        // The pose the room WOULD have opened at with no turn, rebuilt from the
        // preset rather than from `resolveSceneCameraPose`, which now carries the
        // turn this row is being judged on.
        const radius = M.resolveSceneCameraPose(sceneId, aspect).radius;
        const position = target
          .clone()
          .add(
            new Vector3(Math.sin(preset.azimuth), 0, Math.cos(preset.azimuth))
              .multiplyScalar(radius * Math.sin(preset.polar))
              .setY(radius * Math.cos(preset.polar)),
          );
        if (position.y > CEILING_CLAMP) position.y = CEILING_CLAMP;
        aimAt(position, target, aspect);
        const already = halos.filter(arrived);
        assert.equal(
          already.length,
          0,
          `${sceneId} row [${aspect}, ${turn}] turns ${((turn * 180) / Math.PI).toFixed(1)}° even though ${already.map((h) => h.name).join(' and ')} ` +
            `is already wholly in frame at rest — that row should be zero`,
        );
      }
    } finally {
      cleanup();
    }
  });
}


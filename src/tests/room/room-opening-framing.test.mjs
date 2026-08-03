/**
 * What a child can actually see when a room opens.
 *
 * THE DEFECT THIS FOUND
 * ---------------------
 * Nothing had ever asked what a room's own props project to. Building all three
 * rooms and projecting every registered tap target through the opening camera
 * found, at the square end of the stage band:
 *
 *     playroom      `hub_door_doorway`                       off the edge
 *     kitchen       `toybox_kitchen-nature_root`             off the edge
 *     living-room   both toyboxes                            off the edge
 *
 * Every one of those is a way OUT of the room. They were all in frame in
 * landscape, which is why it shipped: the only viewport anyone develops on is
 * the one that happened to be fine.
 *
 * WHAT IS ASSERTED
 * ----------------
 * For each room, at every aspect the letterbox can hand the camera:
 *   1. every registered tap target is fully inside the frame — bounding box, not
 *      centre point, so a prop half off the edge fails;
 *   2. no corner of the frame leaves the set, at rest and at both ends of the
 *      rotation clamp, so the fix for (1) cannot be "pull back until the void
 *      shows";
 *   3. the props are not merely inside but LARGE — at the tightest aspect the
 *      spread must fill most of the frame, because "everything just gets
 *      smaller" is the complaint the framing work answers and a pose that frames
 *      the room from orbit satisfies (1) and (2) perfectly.
 *
 * (3) is what stops this suite from being satisfiable by zooming out, which is
 * the degenerate solution to every framing constraint ever written.
 *
 * WHY BOUNDING BOXES RATHER THAN CENTRES
 * --------------------------------------
 * A toybox whose lid is off-screen is a toybox a child may not recognise as the
 * thing they opened last time, and the two living-room toyboxes fail by 10% —
 * which is exactly the range a centre-point rule would call fine.
 */

import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { Box3, PerspectiveCamera, Raycaster, Scene, Spherical, Vector2, Vector3 } from 'three';
import gsap from 'gsap';
import { bundleEntry } from '../framework/_tsload.mjs';

// GSAP STARTS A TICKER THE MOMENT A ROOM TWEENS ANYTHING, and it is a repeating
// timer. Without this the suite passes and then never exits: `node --test` waits
// on a process whose event loop nothing will ever empty. Building a real room in
// a test means owning its teardown.
after(() => gsap.ticker.sleep());

const M = await bundleEntry(
  'room-opening-framing',
  `
  export { frameSeesPastWalls, orbitPositionsAt, SHARED_ROTATION_RANGE } from './src/utils/scene/rotationRange';
  export { getSceneCameraPreset } from './src/scenes/sceneCatalog';
  export { SCENE_CAMERA_FOV, resolveSceneCameraPose } from './src/utils/cameraPresets';
  export { stageAspectFor } from './src/utils/scene/stageRect';
  export { buildPlayroomContents } from './src/scenes/world/places/house/subplaces/playroom/room';
  export { buildRoomContents as buildKitchenContents } from './src/scenes/world/places/house/subplaces/kitchen/room';
  export { buildRoomContents as buildLivingRoomContents } from './src/scenes/world/places/house/subplaces/living-room/room';
  export * as PLAYROOM from './src/scenes/world/places/house/subplaces/playroom/layout';
  export * as KITCHEN from './src/scenes/world/places/house/subplaces/kitchen/layout';
  export * as LIVING from './src/scenes/world/places/house/subplaces/living-room/layout';
`,
);

/** Nine shipping viewports, mapped through the letterbox. See tests/room/stage-rect. */
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
const ASPECTS = [...new Set(SHIPPING_VIEWPORTS.map(([w, h]) => M.stageAspectFor(w, h)))].sort((a, b) => a - b);
const TIGHTEST = Math.min(...ASPECTS);

/**
 * How much of the frame the prop spread has to fill at the tightest aspect.
 *
 * Solved, not chosen. Was 0.90 when all three rooms sat at 0.95; the two
 * shortened rooms are now framed by `.probe/no-ceiling-solve.mjs`, which picks
 * the pose that keeps every tappable FURTHEST inside the edge among poses that
 * show no ceiling — the living room lands at 0.880. So the bound is 0.85: still
 * far above any pose that frames the room from across the street, and honest
 * about the fact that "no ceiling" and "props at the very edge" pull apart.
 */
const MIN_FILL = 0.85;

/** The camera height clamp `createSceneCamera` applies when no preset overrides it. */
const CEILING_CLAMP = 6.0;

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

/**
 * Builds a room and returns every mesh it registered as tappable.
 *
 * The dispatcher is the inventory. Asking the scene graph instead would need a
 * rule for what counts as a prop, and any such rule is a second opinion about
 * interactivity that can disagree with the one the app acts on.
 *
 * @param build - The room's real `buildContents`.
 * @returns Named bounding-box corner sets, one per registered target.
 */
function tappablePropsOf(build) {
  const scene = new Scene();
  const registered = [];
  const dispatcher = {
    register: (t) => {
      registered.push(t);
      return noop;
    },
    registerWithPoint: (t) => {
      registered.push(t);
      return noop;
    },
    setMissHandler: noop,
    dispose: noop,
  };
  const contents = build({
    scene,
    canvas: stubCanvas(),
    camera: new PerspectiveCamera(),
    dispatcher,
    nav: { navigateTo: noop, launchMiniGame: noop, exitMiniGame: noop },
    owl: { flyTo: noop, setSurfaceYAt: noop, land: noop, group: { position: new Vector3() } },
  });
  scene.updateMatrixWorld(true);

  // The floor is registered too, and it is the one target that is SUPPOSED to
  // run off the edge of the frame — it is what the child taps to move the owl,
  // and a floor that fits on screen is a room seen from outside.
  const ground = contents.floorTargets?.[0];
  const props = [];
  const seen = new Set();
  for (const target of registered) {
    if (target === ground || seen.has(target)) continue;
    seen.add(target);
    const box = new Box3().setFromObject(target);
    if (box.isEmpty()) continue;
    const corners = [];
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) corners.push(new Vector3(x, y, z));
    props.push({ name: target.name || '(unnamed)', corners });
  }

  // The room is NOT torn down here — the composition test rasterises it. See
  // the `after` hook, which stops GSAP's ticker once every suite has run;
  // without that this file passed and then hung, because a room's idle animator
  // and particle effects keep timers alive and the process never reaches exit.
  return { props, scene, cleanup: () => contents?.cleanup?.() };
}

const cam = new PerspectiveCamera(M.SCENE_CAMERA_FOV, 1, 0.1, 300);
const aim = (position, pivot, aspect) => {
  cam.aspect = aspect;
  cam.position.copy(position);
  cam.lookAt(pivot);
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();
};
const cornerDirs = () =>
  [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ].map(([nx, ny]) => new Vector3(nx, ny, 1).unproject(cam).sub(cam.position).normalize());

/**
 * The widest |NDC| any of these points projects to. <= 1 means all in frame.
 *
 * A point behind the eye comes back from `project` with its NDC negated and
 * unbounded, so it can land inside [-1, 1] while being behind the camera. `z > 1`
 * is that case, and it is treated as infinitely outside rather than as a pass.
 *
 * @param points - World-space points.
 * @returns The largest absolute NDC component across them.
 */
function worstNdc(points) {
  let worst = 0;
  const v = new Vector3();
  for (const point of points) {
    v.copy(point).project(cam);
    const d = v.z > 1 ? Infinity : Math.max(Math.abs(v.x), Math.abs(v.y));
    if (d > worst) worst = d;
  }
  return worst;
}

const ROOMS = [
  ['playroom', M.buildPlayroomContents, M.PLAYROOM],
  ['kitchen', M.buildKitchenContents, M.KITCHEN],
  ['living-room', M.buildLivingRoomContents, M.LIVING],
];

/**
 * Every tappable in each room, pinned by name and count.
 *
 * A room that quietly stops registering a prop would otherwise make the framing
 * tests EASIER to pass, so the inventory is asserted before it is used.
 */
const EXPECTED_TAPPABLES = {
  playroom: ['hub_door_doorway', 'toybox_adventure_root', 'toybox_animals_root', 'toybox_creative_root'],
  kitchen: 15,
  'living-room': 11,
};

for (const [sceneId, build, layout] of ROOMS) {
  const { props, scene } = tappablePropsOf(build);
  const preset = M.getSceneCameraPreset(sceneId);
  const pivot = new Vector3(...preset.target);
  const shell = {
    wallX: layout.LEFT_WALL_X,
    frontZ: layout.BACK_WALL_CENTER_Z - layout.ROOM_DEPTH,
    backZ: layout.BACK_WALL_CENTER_Z,
    ceilingY: layout.CEILING_Y,
    floorY: 0,
  };

  test(`${sceneId}: the tappable inventory is the one these tests were solved against`, () => {
    const expected = EXPECTED_TAPPABLES[sceneId];
    if (Array.isArray(expected)) {
      assert.deepEqual(
        props.map((p) => p.name).sort(),
        [...expected].sort(),
        `${sceneId}: the set of tappable props changed. The opening pose in sceneCatalog was solved against the old set — re-run .probe/room-pose-final.mjs before updating this.`,
      );
    } else {
      assert.equal(props.length, expected, `${sceneId}: tappable count changed; see .probe/room-pose-final.mjs`);
    }
  });

  test(`${sceneId}: every tappable prop is fully inside the opening frame, at every stage aspect`, () => {
    const offenders = [];
    for (const aspect of ASPECTS) {
      const pose = M.resolveSceneCameraPose(sceneId, aspect);
      aim(pose.position, pose.target, aspect);
      for (const prop of props) {
        const ndc = worstNdc(prop.corners);
        if (ndc > 1) offenders.push(`${prop.name} at aspect ${aspect.toFixed(2)} (${((ndc - 1) * 100).toFixed(0)}% past the edge)`);
      }
    }
    assert.deepEqual(
      offenders,
      [],
      `${sceneId}: a child cannot see these at all when the room opens — ${offenders.join('; ')}. Every one of the originals was a way out of a room.`,
    );
  });

  test(`${sceneId}: the props FILL the frame rather than merely fitting in it`, () => {
    // Without this the whole suite is satisfiable by moving the camera further
    // away, which is the degenerate answer to every framing constraint and is
    // also the exact defect being fixed.
    const pose = M.resolveSceneCameraPose(sceneId, TIGHTEST);
    aim(pose.position, pose.target, TIGHTEST);
    const fill = worstNdc(props.flatMap((p) => p.corners));
    assert.ok(
      fill >= MIN_FILL,
      `${sceneId}: at aspect ${TIGHTEST.toFixed(2)} the prop spread fills only ${(fill * 100).toFixed(0)}% of the half-frame. ` +
        `The camera has been pulled back and the room now sits in the middle of the screen instead of filling it.`,
    );
    assert.ok(fill <= 1, `${sceneId}: fill ${fill.toFixed(3)} means something is cropped — the previous test should have caught it`);
  });

  test(`${sceneId}: turning the room never shows the void, at any stage aspect`, () => {
    // The other half of the trade. Tests above push the camera IN; this is what
    // stops it going so far in that the corner of the frame passes the end of a
    // side wall once the player turns.
    const c = preset.constraints ?? {};
    const orbit = {
      azimuth: preset.azimuth,
      pivot,
      radii: [preset.distance],
      polars: [c.minPolar ?? Math.max(0.9, preset.polar - 0.1), preset.polar, c.maxPolar ?? Math.min(1.35, preset.polar + 0.1)],
      ceilingClamp: c.ceilingY ?? CEILING_CLAMP,
    };
    const offenders = [];
    for (const range of [0, M.SHARED_ROTATION_RANGE]) {
      for (const position of M.orbitPositionsAt(range, orbit)) {
        for (const aspect of ASPECTS) {
          aim(position, pivot, aspect);
          if (M.frameSeesPastWalls(position, cornerDirs(), shell)) {
            offenders.push(`aspect ${aspect.toFixed(2)} at turn ${((range * 180) / Math.PI).toFixed(1)}°`);
          }
        }
      }
    }
    assert.deepEqual(offenders, [], `${sceneId}: the frame leaves the set — ${[...new Set(offenders)].join('; ')}`);
  });
}

/**
 * What the opening frame of each room is actually MADE of.
 *
 * WHY THIS IS A TEST AND NOT A NOTE
 * ---------------------------------
 * "The ceiling in the playroom is much too in your face — the kitchen is ideal,
 * because there is no ceiling." That is a judgement about a picture, and the
 * temptation is to treat it as untestable and fix it by eye. It is not: casting
 * a ray through every cell of the frame and asking what it lands on turns it
 * into numbers, and on the ceiling the numbers agreed with the eye exactly —
 * 15.0% of the playroom's frame was ceiling against 0% of the kitchen's. The
 * playroom was re-framed until it was 0% too.
 *
 * THE FIRST VERSION OF THIS COMMENT WAS WRONG, AND IT IS WORTH LEAVING THE
 * WRECKAGE. It read:
 *
 *     kitchen       74.1% props   25.9% wall    0% floor    0% ceiling
 *     playroom      33.3% props   25.3% wall   26.4% floor  15.0% ceiling
 *
 * and concluded that what separated them was DENSITY — that the kitchen reads
 * well because its frame is three quarters content. The kitchen's ceiling and
 * floor were unnamed (it is a generated room and the template named neither), so
 * this classifier counted an 11 x 20 ceiling slab and an 18 x 24 floor plane as
 * props. Measured correctly the kitchen is 17.8% props and 64.7% BARE FLOOR —
 * the emptiest frame of the three, and still the one that reads best. Density is
 * not the variable. Nothing in this table separates the room that works from the
 * ones that do not; the honest state is that the ceiling was the finding and the
 * rest is unexplained.
 *
 *     playroom      31.7% props   24.1% wall   44.1% floor   0.0% ceiling
 *     kitchen       17.8% props   17.5% wall   64.7% floor   0.0% ceiling
 *     living-room   17.0% props   30.7% wall   46.5% floor   5.9% ceiling
 *
 * Two mechanical theories were also tried and both were refuted by measurement
 * before the naming bug was found, and both stay refuted after it:
 *
 *   longer lens   FOV 50 -> 32 moved the playroom's backmost prop from 17.9% of
 *                 frame height to 15.6% — worse — and cost ±31.9° of turn to
 *                 ±13.4°. (.probe/lens-and-ceiling.mjs)
 *   shorter room  depth x0.65 moved prop share 30.1% -> 29.7%. The floor it
 *                 recovered went to WALL and CEILING, not to things.
 *                 (.probe/room-shorten-sim.mjs)
 *
 * So these bounds are a RATCHET, not a theory: they hold the ceiling at zero
 * where it was won, and stop the camera drifting backwards until the frame is
 * all carpet. They are not a claim to know what makes a room read well.
 */
//
// Bounds are taken from the WORST aspect in the band, not from the opening one.
// Prop share falls as the frame widens — the playroom runs 31.7% at 1.00 and
// 24.7% at 1.40, because a wider frame is mostly more side wall — so a bound set
// at the square end would fail on a desktop the day it was written.
const EXPECTED_COMPOSITION = {
  // Measured 24.7% props, 0.0% ceiling at the worst aspect.
  playroom: { maxCeiling: 0.01, minProps: 0.22 },
  // Measured 17.8% props, 0.0% ceiling. Was 14.6% before the room was shortened
  // by 25% and re-posed.
  kitchen: { maxCeiling: 0.01, minProps: 0.15 },
  // Measured 21.0% props, 0.0% ceiling. This was the room with a ceiling still
  // in frame — 5.9%, reported as "ceiling is still visible in living room" — and
  // the bound is 0.01 for all three now rather than 0.07 for this one.
  'living-room': { maxCeiling: 0.01, minProps: 0.18 },
};

/**
 * Casts a ray through every cell of the frame and reports what each one hits.
 *
 * @param scene - The built room.
 * @param pose - Camera position and target.
 * @param aspect - Stage aspect.
 * @returns Fraction of the frame landing on props, wall, floor, ceiling, nothing.
 */
function rasteriseFrame(scene, pose, aspect) {
  const camera = new PerspectiveCamera(M.SCENE_CAMERA_FOV, aspect, 0.1, 400);
  camera.position.copy(pose.position);
  camera.lookAt(pose.target);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
  const caster = new Raycaster();
  const tally = { props: 0, wall: 0, floor: 0, ceiling: 0, nothing: 0 };
  const n = 32;
  for (let iy = 0; iy < n; iy++) {
    for (let ix = 0; ix < n; ix++) {
      caster.setFromCamera(new Vector2((ix / (n - 1)) * 2 - 1, (iy / (n - 1)) * 2 - 1), camera);
      const hit = caster.intersectObjects(scene.children, true)[0];
      if (!hit) {
        tally.nothing += 1;
        continue;
      }
      // Classified by name, walking UP to the nearest named ancestor: a leaf
      // mesh inside `kit_pot` may have no name of its own, and reading the leaf
      // alone would classify it by fallback.
      //
      // Which is the bug this whole classifier had. The Kitchen's ceiling and
      // floor shipped unnamed — it is a generated room and the template named
      // neither — so this counted an 11 x 20 ceiling slab as a PROP and reported
      // the Kitchen at 82.5% props, 0% ceiling, the best-composed room in the
      // app. `tests/room/room-scene-mesh-names.test.mjs` is what now stops a
      // room from being scored on names it does not have.
      let node = hit.object;
      while (node && !node.name) node = node.parent;
      const name = (node?.name || '').toLowerCase();
      if (name.includes('ceiling')) tally.ceiling += 1;
      else if (name.includes('floor') || name.includes('ground')) tally.floor += 1;
      else if (name.includes('wall') || name.includes('wainscot') || name.includes('wallpaper')) tally.wall += 1;
      else tally.props += 1;
    }
  }
  return Object.fromEntries(Object.entries(tally).map(([k, v]) => [k, v / (n * n)]));
}

for (const [sceneId, build] of ROOMS.map(([id, b]) => [id, b])) {
  test(`${sceneId}: the opening frame is made of the room, not of its ceiling`, () => {
    const { scene, cleanup } = tappablePropsOf(build);
    try {
      const bounds = EXPECTED_COMPOSITION[sceneId];
      for (const aspect of ASPECTS) {
        const composition = rasteriseFrame(scene, M.resolveSceneCameraPose(sceneId, aspect), aspect);
        const shown = Object.entries(composition)
          .filter(([, v]) => v > 0.001)
          .map(([k, v]) => `${k} ${(v * 100).toFixed(1)}%`)
          .join(', ');
        assert.ok(
          composition.ceiling <= bounds.maxCeiling,
          `${sceneId} at aspect ${aspect.toFixed(2)}: ${(composition.ceiling * 100).toFixed(1)}% of the frame is ceiling, over the ${(bounds.maxCeiling * 100).toFixed(0)}% bound (${shown})`,
        );
        assert.ok(
          composition.props >= bounds.minProps,
          `${sceneId} at aspect ${aspect.toFixed(2)}: only ${(composition.props * 100).toFixed(1)}% of the frame is props, under the ${(bounds.minProps * 100).toFixed(0)}% bound — ` +
            `the camera has been backed off or pointed at the carpet (${shown})`,
        );
        assert.equal(
          composition.nothing,
          0,
          `${sceneId} at aspect ${aspect.toFixed(2)}: ${(composition.nothing * 100).toFixed(1)}% of the frame is void (${shown})`,
        );
      }
    } finally {
      cleanup();
    }
  });
}

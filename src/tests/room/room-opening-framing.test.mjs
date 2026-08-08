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
 * THE RULE CHANGED, AND THIS IS THE FILE WHERE IT SHOWS
 * -----------------------------------------------------
 * "Every tappable fully in frame at rest" is what forced the letterbox. Four
 * toyboxes and a doorway only fit one frame if that frame is nearly square, so
 * the stage was cropped to a square and 54% of a phone screen was painted brown.
 * `.probe/narrow-binding.mjs` showed that requirement was the ONLY constraint
 * that moves with aspect — the void and ceiling limits do not — so it was the
 * only thing the crop was buying. It has been replaced by REACHABLE: a way out
 * of the room must be visible and tappable somewhere inside the turn the child
 * is allowed to make, at every aspect.
 *
 * WHAT IS ASSERTED
 * ----------------
 * For each room, at every aspect a device can produce:
 *   1. every way out of the room — toybox or doorway — is reachable within the
 *      shipped turn, and with a margin, so a toybox that only appears in the
 *      last degree of travel fails;
 *   2. the tappables NO turn can reach are only the ones already known about,
 *      pinned by name, so a prop cannot quietly become unreachable;
 *   3. no corner of the frame leaves the set, at rest and at both ends of the
 *      turn, so the fix for (1) cannot be "pull back until the void shows";
 *   4. the frame is mostly ROOM — measured by raycasting every cell of it, not
 *      by projecting bounding boxes — because "everything just gets smaller" is
 *      the complaint this work answers and a pose that frames the room from
 *      across the street satisfies (1) and (3) perfectly.
 *
 * (4) is what stops this suite from being satisfiable by zooming out, which is
 * the degenerate solution to every framing constraint ever written.
 *
 * WHY REACHABILITY IS NOT A CENTRE-POINT RULE
 * -------------------------------------------
 * A toybox whose lid is off-screen is a toybox a child may not recognise as the
 * thing they opened last time. `isTappable` below asks for the prop's middle
 * well inside the frame AND most of its area on screen — the same two constants
 * `.probe/joint-solve.mjs` solved the poses against, so the guard and the solver
 * cannot disagree about what "reachable" means.
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
  export { frameSeesPastWalls, orbitPositionsAt, resolveRotationRange } from './src/utils/scene/rotationRange';
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

/**
 * Shipping viewports, mapped through the stage rect. See tests/room/stage-rect.
 *
 * THE LANDSCAPE PHONES ARE NEW AND THEY ARE NOT PADDING. While the band ended at
 * 1.4 every one of them was pillarboxed down to 1.4, so the list only ever
 * exercised aspects up to 1.4 however many wide entries it had. The band now
 * ends at 2.6 and a phone on its side is 2.17, so these reach the camera as
 * themselves — and the wide end is where a room runs out of side wall.
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
  [852, 393],
  [915, 412],
  [1194, 834],
  [1920, 1080],
  [2560, 1080],
];
const ASPECTS = [...new Set(SHIPPING_VIEWPORTS.map(([w, h]) => M.stageAspectFor(w, h)))].sort((a, b) => a - b);
const TIGHTEST = Math.min(...ASPECTS);

/**
 * What "a child can see this and put a finger on it" means, in NDC.
 *
 * These two numbers are the ones `.probe/joint-solve.mjs` solved the poses
 * against. They are duplicated here rather than imported because the probe is
 * scratch and the app does not ship it — but they are the same pair, and a
 * change to one that is not made to the other shows up as the poses failing
 * their own reachability test, which is the failure worth having.
 */
const CENTRE_LIMIT = 0.85;
const AREA_LIMIT = 0.6;

/** How much of the safe turn a way out must be reachable within. */
const REACH_MARGIN = 0.85;

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

/**
 * Is this prop one a child could see and tap, from the camera as currently aimed?
 *
 * Two conditions, not one. The middle has to be well inside the frame, so a prop
 * clipped to a sliver at the edge does not count; and most of its area has to be
 * on screen, so a doorway showing only its architrave does not either.
 *
 * @param points - The prop's world-space bounding-box corners.
 * @returns True when the prop is both visible and reachable by a fingertip.
 */
function isTappable(points) {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  const v = new Vector3();
  for (const point of points) {
    v.copy(point).project(cam);
    if (v.z > 1) return false; // behind the eye
    x0 = Math.min(x0, v.x);
    x1 = Math.max(x1, v.x);
    y0 = Math.min(y0, v.y);
    y1 = Math.max(y1, v.y);
  }
  if (Math.abs((x0 + x1) / 2) > CENTRE_LIMIT || Math.abs((y0 + y1) / 2) > CENTRE_LIMIT) return false;
  const full = (x1 - x0) * (y1 - y0);
  if (full <= 1e-9) return true;
  const visible = Math.max(0, Math.min(x1, 1) - Math.max(x0, -1)) * Math.max(0, Math.min(y1, 1) - Math.max(y0, -1));
  return visible / full >= AREA_LIMIT;
}

/** A way OUT of a room, as opposed to a thing to play with. */
const isExit = (name) => name.startsWith('toybox_') || name.includes('_doorway');

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
  // 15 -> 16 for the Kitchen's SECOND destination toybox, the white-and-red
  // chest by the left cabinets that opens into the Baseball Park
  // (`kitchen/toyboxes/manifest.ts`). A count moving here is normally a reason
  // to stop and re-run `.probe/room-pose-final.mjs`, because the opening pose
  // was solved against the old set — but this addition does not move the pose:
  // the chest stands at x 3.5, z 4.6, deep in the room, and the Kitchen's
  // opening frame is composed around the front floor. The guard that would have
  // caught it if it did is `opening-turn.test.mjs`, which re-derives the whole
  // turn schedule against the built scene and passes.
  kitchen: 16,
  'living-room': 11,
};

/**
 * Props that no turn brings into reach, pinned per room.
 *
 * Empty for all three. Kept rather than deleted so a regression fails with the
 * offending names in it instead of with a bare count.
 */
const EXPECTED_UNREACHABLE = {
  playroom: [],
  kitchen: [],
  'living-room': [],
};

/**
 * Can this prop be reached by turning, from a room's opening pose?
 *
 * Walks the turn rather than sampling its ends: a prop can be off the left edge
 * at one extreme and off the right at the other while sitting comfortably in
 * frame in between, and a two-point check would call that unreachable.
 *
 * @param sceneId - Registered scene id.
 * @param aspect - Stage aspect.
 * @param radius - The orbit radius the app resolves at this aspect.
 * @param budget - Turn allowed either side, in radians.
 * @param prop - A named prop with bounding-box corners.
 * @returns True when some turn inside the budget puts it within reach.
 */
function reachableWithin(sceneId, aspect, radius, budget, prop) {
  const preset = M.getSceneCameraPreset(sceneId);
  const pivot = new Vector3(...preset.target);
  const ceiling = preset.constraints?.ceilingY ?? CEILING_CLAMP;
  const step = budget > 0 ? budget / 24 : Infinity;
  for (let turn = -budget; turn <= budget + 1e-9; turn += step) {
    const position = pivot.clone().add(new Vector3().setFromSpherical(new Spherical(radius, preset.polar, preset.azimuth + turn)));
    if (position.y > ceiling) position.y = ceiling;
    aim(position, pivot, aspect);
    if (isTappable(prop.corners)) return true;
    if (!Number.isFinite(step)) break;
  }
  return false;
}

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

  test(`${sceneId}: every way out of the room is reachable within the shipped turn`, () => {
    // THE ASSERTION THAT REPLACED "fully inside the frame at rest". That one was
    // satisfiable only by a nearly-square frame, which is what the letterbox was.
    // This one is what a child actually needs: turn the room, and the way out
    // comes into reach — with margin, so a toybox that appears only in the last
    // degree of travel is a failure and not a pass.
    const offenders = [];
    for (const aspect of ASPECTS) {
      const budget = M.resolveRotationRange(aspect) * REACH_MARGIN;
      const pose = M.resolveSceneCameraPose(sceneId, aspect);
      for (const prop of props.filter((p) => isExit(p.name))) {
        if (!reachableWithin(sceneId, aspect, pose.radius, budget, prop)) {
          offenders.push(`${prop.name} at aspect ${aspect.toFixed(2)} (turn budget ±${((budget * 180) / Math.PI).toFixed(1)}°)`);
        }
      }
    }
    assert.deepEqual(
      offenders,
      [],
      `${sceneId}: a child cannot get to these however far they turn — ${offenders.join('; ')}. Every one of them is a way out of a room.`,
    );
  });

  test(`${sceneId}: the tappables no turn can reach are only the ones already known about`, () => {
    // Ways out are covered above. This is about the rest: a toy that has drifted
    // behind the camera or under the furniture is a toy nobody can play with, and
    // it would otherwise make every other test in this file EASIER to pass by
    // leaving the frame.
    //
    // ADMISSIONS, NOT PERMISSIONS. A prop is expected to be reachable at some
    // aspect until someone writes its name down here and says why it is not.
    const unreachable = props
      .filter(
        (prop) =>
          !ASPECTS.some((aspect) => reachableWithin(sceneId, aspect, M.resolveSceneCameraPose(sceneId, aspect).radius, M.resolveRotationRange(aspect), prop)),
      )
      .map((prop) => prop.name);
    assert.deepEqual(
      unreachable.sort(),
      [...(EXPECTED_UNREACHABLE[sceneId] ?? [])].sort(),
      `${sceneId}: the set of props no turn can reach has changed. If one just became reachable, shrink EXPECTED_UNREACHABLE. If one dropped out of reach, the pose or the layout put it there.`,
    );
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
    for (const aspect of ASPECTS) {
      for (const range of [0, M.resolveRotationRange(aspect)]) {
        for (const position of M.orbitPositionsAt(range, orbit)) {
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
//
// RATCHETED after the poses were re-solved against a SCREENSHOT. The rendered
// frames showed what the percentages did not: the bare floor was all in one
// band across the bottom, in front of the nearest prop, while the furniture was
// WHAT THE LETTERBOX WAS COSTING, IN THE ONE UNIT THAT MATTERS: how much of a
// child's screen has toys in it. Measured by `.probe/composition-now.mjs` at
// every aspect a shipping device produces. On a 393x852 phone the frame went
// from 46% of the screen to 100% of it, and inside that frame:
//
//                 objects        rug           bare floor
//     playroom    22.9%          24.1%         39.5%
//     kitchen     21.1%          24.7%         37.9%
//     living-room 19.8%          25.6%         42.0%
//
// THE KITCHEN IS THE ROW THAT MOVED. It was 18.8% objects, 5.7% rug and 60.0%
// BARE BOARDS — half again as much bare floor as either other room, because it
// had nothing on its floor forward of the breakfast table. Dressing that band
// (`decor/frontFloor.ts`) took it to the numbers above, and it is now the least
// bare of the three.
//
// THE SPLIT IS NOT WHAT IT LOOKS LIKE, which is the whole reason the rug bucket
// exists. With the runner off, every object in that band together moves bare
// floor 60.0% -> 56.8%. The runner alone moves it 56.8% -> 37.9%. Objects a
// third of a metre across do not cover twelve square metres of near floor,
// however many of them there are; a floor covering covers floor. Counted as one
// bucket that reads as a fix, and it is only half of one.
//
// THREE BOUNDS, NOT ONE.
//   minObjects / minObjectsPortrait — the anti-zoom-out guard, and now immune to
//     being re-earned by enlarging a rug. Portrait is separate because the
//     objects share falls as the frame widens and fills with wall, so a single
//     floor set by the widest aspect would let portrait regress most of the way
//     back without failing.
//   maxBareFloor — the guard the Kitchen needed and nothing had: a room may not
//     go back to being a plank field.
const PORTRAIT_MAX_ASPECT = 1.0;
const EXPECTED_COMPOSITION = {
  // Measured: objects 22.9% on a phone, 18.6% at the widest; bare floor <= 41.4%.
  playroom: { maxCeiling: 0.01, minObjects: 0.17, minObjectsPortrait: 0.2, maxBareFloor: 0.45 },
  // Measured: objects 21.1% on a phone, 16.8% at the widest; bare floor <= 38.5%.
  kitchen: { maxCeiling: 0.01, minObjects: 0.145, minObjectsPortrait: 0.185, maxBareFloor: 0.42 },
  // Measured: objects 19.8% on a phone, 12.8% at the widest; bare floor <= 42.1%.
  'living-room': { maxCeiling: 0.01, minObjects: 0.115, minObjectsPortrait: 0.175, maxBareFloor: 0.46 },
}; /**
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
  const tally = { props: 0, rug: 0, wall: 0, floor: 0, ceiling: 0, nothing: 0 };
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
      // A RUG IS NOT A PROP, and this bucket exists because treating it as one
      // hid the thing it was supposed to reveal. The Kitchen's front floor was
      // dressed to answer "60% of a phone frame is bare boards"; six small
      // objects moved the props share 24.4% -> 25.1%, and one rag runner moved
      // it to 39.6%. Under the old two-way split that read as a fix. It is not:
      // a floor covering covers floor, which is worth doing and is not the same
      // claim as "there is more to look at". Counted apart, both claims can be
      // made and neither can be earned with the other's evidence.
      if (name.includes('ceiling')) tally.ceiling += 1;
      else if (name.includes('rug') || name.includes('runner') || name.includes('carpet')) tally.rug += 1;
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
        const floor = aspect <= PORTRAIT_MAX_ASPECT ? bounds.minObjectsPortrait : bounds.minObjects;
        assert.ok(
          composition.props >= floor,
          `${sceneId} at aspect ${aspect.toFixed(2)}: only ${(composition.props * 100).toFixed(1)}% of the frame is objects, under the ${(floor * 100).toFixed(1)}% bound — ` +
            `the camera has been backed off or pointed at the carpet (${shown})`,
        );
        assert.ok(
          composition.floor <= bounds.maxBareFloor,
          `${sceneId} at aspect ${aspect.toFixed(2)}: ${(composition.floor * 100).toFixed(1)}% of the frame is bare floorboards, over the ${(bounds.maxBareFloor * 100).toFixed(0)}% bound — ` +
            `this room needs something on its floor, not a different camera (${shown})`,
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

/**
 * The owl must land ON things and never IN them — and it must never be left
 * standing on nothing. This file is also the inventory of what every room and
 * every immersive scene contains that it could land in or under.
 *
 * THE FIRST DEFECT: LANDING INSIDE THE FURNITURE
 * ----------------------------------------------
 * `dispatcher.registerWithPoint` hands the owl `hit.point`, the raycast
 * intersection of the child's tap. The raycaster only tests REGISTERED targets,
 * and on the floor-tap path the only registered targets are the floor meshes —
 * deliberately, with a long argument for it in `wireFloorTap`. So a tap aimed at
 * the fridge passes through the fridge and returns a point on the PLANKING
 * UNDERNEATH IT, and the owl flew there.
 *
 * The code even claimed otherwise. `clampFlightTarget` carried the comment "so
 * the owl perches on a toybox/table/log instead of sinking to floor level inside
 * it" — true only when the CALLER measured a surface and passed its height in,
 * which exactly one caller did. Every floor tap passed y = 0.
 *
 * THE SECOND DEFECT, WHICH THE FIRST FIX CAUSED
 * ----------------------------------------------
 * The repair raised the owl to the top of any prop whose BOUNDING BOX contained
 * the landing point. In a room full of cupboards that is nearly right. In Nature
 * it is a disaster: five trees with 5 x 5 footprints and crowns at y 6.5, so a
 * tap on open grass under a canopy sent the owl to treetop height, where the
 * flight ceiling at maxY 5.0 caught it and left it hanging with nothing under
 * its feet. Measured: 18.5% of the ground raised the owl and 13.9% parked it at
 * exactly the ceiling. Pirate Cove was worse — a mast and mainsail over a deck,
 * against a lower ceiling.
 *
 * That defect reached a person before it reached a test, and the reason is the
 * whole lesson here: the suite covered the three ROOMS and neither immersive
 * scene. The rooms are cupboards. The scenes are trees. A guard that only sees
 * the easy half of the world is not a guard, so all five scenes are swept below.
 *
 * WHAT THE THREE SWEEP ASSERTIONS ARE FOR
 * ----------------------------------------
 *   NOT INSIDE   — the owl's body may not overlap any prop's geometry.
 *   NOT HOVERING — its feet must be on the ground or on some prop's top surface.
 *                  This is the one that catches defect two, and nothing in the
 *                  first version of this suite could have.
 *   REACHABLE    — the landing must be inside the scene's own flight bounds.
 *
 * All three are measured through the SAME function the owl calls, over a grid of
 * every scene's reachable floor, against per-MESH boxes rather than per-prop
 * ones — because a tree's root box and a solid block are the same object.
 */

import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import gsap from 'gsap';
import { Box3, BoxGeometry, Group, Mesh, PerspectiveCamera, Scene, Shape, ShapeGeometry, Vector3 } from 'three';
import { bundleEntry } from '../framework/_tsload.mjs';

const M = await bundleEntry(
  'owl-perch-surfaces',
  `
  export { classifyPerchRoots, buildPerchField, standingYAt, spansAt, resolvePerchTarget, FLOOR_CONTACT_Y, MIN_SOLID_HEIGHT }
    from './src/utils/scene/perchSurfaces';
  export { wireFloorTap, deriveOwlFlightBounds } from './src/utils/sceneHelpers';

  export { buildPlayroomContents } from './src/scenes/world/places/house/subplaces/playroom/room';
  export { buildRoomContents as buildKitchenContents } from './src/scenes/world/places/house/subplaces/kitchen/room';
  export { buildRoomContents as buildLivingRoomContents } from './src/scenes/world/places/house/subplaces/living-room/room';
  export { PLAYROOM_ENVIRONMENT } from './src/scenes/world/places/house/subplaces/playroom/environment';
  export { ROOM_ENVIRONMENT as KITCHEN_ENVIRONMENT } from './src/scenes/world/places/house/subplaces/kitchen/environment';
  export { ROOM_ENVIRONMENT as LIVING_ROOM_ENVIRONMENT } from './src/scenes/world/places/house/subplaces/living-room/environment';

  export { buildSceneBase } from './src/utils/sceneHelpers';
  export { NATURE_ENVIRONMENT } from './src/scenes/immersive-toybox-scenes/naturescene/environment';
  export { createNatureMaterials } from './src/scenes/immersive-toybox-scenes/naturescene/materials';
  export { composeAcorns } from './src/scenes/immersive-toybox-scenes/naturescene/factory/props/simple/acorns';
  export { composeFerns } from './src/scenes/immersive-toybox-scenes/naturescene/factory/props/simple/ferns';
  export { composeGrassPatches } from './src/scenes/immersive-toybox-scenes/naturescene/factory/props/simple/grassPatch';
  export { composeLeafLitter } from './src/scenes/immersive-toybox-scenes/naturescene/factory/props/simple/leafLitter';
  export { composeMossPatches } from './src/scenes/immersive-toybox-scenes/naturescene/factory/props/simple/mossPatch';
  export { composeToadstools } from './src/scenes/immersive-toybox-scenes/naturescene/factory/props/simple/toadstools';
  export { composeButterflies } from './src/scenes/immersive-toybox-scenes/naturescene/factory/props/interactive/butterflies';
  export { composeFlowers } from './src/scenes/immersive-toybox-scenes/naturescene/factory/props/interactive/flowers';
  export { composeLeaves } from './src/scenes/immersive-toybox-scenes/naturescene/factory/props/interactive/leaves';
  export { composeLog } from './src/scenes/immersive-toybox-scenes/naturescene/factory/props/interactive/log';
  export { composeMushrooms } from './src/scenes/immersive-toybox-scenes/naturescene/factory/props/interactive/mushrooms';
  export { composeSnail } from './src/scenes/immersive-toybox-scenes/naturescene/factory/props/interactive/snail';
  export { composeStones } from './src/scenes/immersive-toybox-scenes/naturescene/factory/props/interactive/stones';
  export { composeStream } from './src/scenes/immersive-toybox-scenes/naturescene/factory/props/complex/stream';
  export { composeTrees } from './src/scenes/immersive-toybox-scenes/naturescene/factory/props/complex/trees';

  export { PIRATE_COVE_ENVIRONMENT } from './src/scenes/immersive-toybox-scenes/pirate-cove/environment';
  export { HULL_OUTLINE } from './src/scenes/immersive-toybox-scenes/pirate-cove/hullPlan';
  export { createPirateCoveMaterials } from './src/scenes/immersive-toybox-scenes/pirate-cove/materials';
  export { composeBarrels } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/simple/barrels';
  export { composeAnchor } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/simple/anchor';
  export { composeRopeCoils } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/simple/ropeCoils';
  export { composeRailStowage } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/simple/railStowage';
  export { composeParrots } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/simple/parrot';
  export { composeCannons } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/interactive/cannon';
  export { composeTreasureChests } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/interactive/treasureChest';
  export { composeShipWheels } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/interactive/shipWheel';
  export { createSceneShell } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/scaffold/sceneShell';
`,
);

// Every composer and the owl itself start `repeat: -1` idle tweens. The
// teardowns below kill the ones they own, but gsap installs a timer of its own
// the first time any tween exists and that timer holds the event loop open after
// the last assertion. Without this the suite passes and then hangs, which in CI
// is indistinguishable from a suite that never finished.
after(() => gsap.ticker.sleep());

/** The owl's resting centre height above whatever it stands on. Every scene authors 0.35. */
const PERCH_OFFSET = 0.35;

/**
 * How tall the owl is above its feet.
 *
 * The runtime measures this off the built bird (`entities/owl/actions.ts` takes
 * a `Box3` at construction) rather than writing it down. This suite does not
 * build an owl, so it states the measured value — and over-states it slightly,
 * which is the safe direction: a taller owl needs more clearance, so every
 * assertion below is stricter than the real bird faces.
 */
const OWL_BODY = 1.1;

const noop = () => {};

const stubDispatcher = () => ({
  register: () => noop,
  registerWithPoint: () => noop,
  setMissHandler: noop,
  dispose: noop,
});

/** Enough canvas surface for listener wiring, and no behaviour. */
const stubCanvas = () => ({
  width: 1280,
  height: 720,
  clientWidth: 1280,
  clientHeight: 720,
  style: {},
  addEventListener: noop,
  removeEventListener: noop,
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720, right: 1280, bottom: 720 }),
});

/** An owl that exists and does nothing. Toyboxes take one to fly at their lid. */
const stubOwl = () => ({ root: new Group(), flyTo: noop, tapReaction: noop, setSurfaceYAt: noop, dispose: noop });

const stubNav = () => ({ goToScene: noop, goBack: noop, launchMiniGame: noop, exitMiniGame: noop });

// ── the five scenes ──────────────────────────────────────────────────────────
//
// THE WHOLE SCENE, NOT A DECOR BARREL. An early version built `decor/` only and
// was wrong in a way that looked right: Raggedy Ann and Andy classified as
// having nothing beneath them, because the toybox they lean on is built in
// `room.ts`. A suite that inventories a scene has to build the scene.

/** Runs a room's real `buildContents` and returns its scene and ground mesh. */
function buildRoom(build) {
  const scene = new Scene();
  const contents = build({
    scene,
    canvas: stubCanvas(),
    camera: new PerspectiveCamera(),
    dispatcher: stubDispatcher(),
    nav: stubNav(),
    owl: stubOwl(),
  });
  return { scene, ground: contents.floorTargets[0], cleanup: () => contents?.cleanup?.() };
}

/** Runs an immersive scene's real composer list and returns its scene and ground. */
function buildImmersive(composers, materials, ground, extra) {
  const scene = new Scene();
  const ctx = { scene, canvas: stubCanvas(), camera: new PerspectiveCamera(), dispatcher: stubDispatcher(), materials };
  const teardowns = [];
  for (const compose of composers) {
    const off = compose(ctx);
    if (typeof off === 'function') teardowns.push(off);
  }
  if (extra) extra(scene, materials);
  const groundMesh = ground(scene);
  return { scene, ground: groundMesh, cleanup: () => teardowns.forEach((off) => off()) };
}

const SCENES = [
  { id: 'playroom', build: () => buildRoom(M.buildPlayroomContents), config: M.PLAYROOM_ENVIRONMENT.floorTap },
  { id: 'kitchen', build: () => buildRoom(M.buildKitchenContents), config: M.KITCHEN_ENVIRONMENT.floorTap },
  { id: 'living-room', build: () => buildRoom(M.buildLivingRoomContents), config: M.LIVING_ROOM_ENVIRONMENT.floorTap },
  {
    id: 'nature',
    config: M.NATURE_ENVIRONMENT.floorTap,
    build: () =>
      buildImmersive(
        [
          M.composeStream,
          M.composeMushrooms,
          M.composeFlowers,
          M.composeLeaves,
          M.composeLog,
          M.composeStones,
          M.composeButterflies,
          M.composeTrees,
          M.composeGrassPatches,
          M.composeLeafLitter,
          M.composeToadstools,
          M.composeMossPatches,
          M.composeFerns,
          M.composeAcorns,
          M.composeSnail,
        ],
        M.createNatureMaterials(),
        // The scene's own ground builder, with the scene's own ground config.
        (scene) =>
          M.buildSceneBase(scene, {
            groundMaterial: 'felt',
            groundColor: M.NATURE_ENVIRONMENT.ground.color,
            groundWidth: M.NATURE_ENVIRONMENT.ground.width,
            groundDepth: M.NATURE_ENVIRONMENT.ground.depth,
          }).ground,
        null,
      ),
  },
  {
    id: 'pirate-cove',
    config: M.PIRATE_COVE_ENVIRONMENT.floorTap,
    build: () =>
      buildImmersive(
        [
          M.composeBarrels,
          M.composeAnchor,
          M.composeRopeCoils,
          M.composeRailStowage,
          M.composeParrots,
          M.composeCannons,
          M.composeTreasureChests,
          M.composeShipWheels,
        ],
        M.createPirateCoveMaterials(),
        // The deck is the hull outline, filled — same construction as the scene's
        // own `buildContents`, reading the same `HULL_OUTLINE` and no literals.
        (scene) => {
          const shape = new Shape();
          M.HULL_OUTLINE.forEach(([x, z], i) => (i === 0 ? shape.moveTo(x, -z) : shape.lineTo(x, -z)));
          shape.closePath();
          const geometry = new ShapeGeometry(shape);
          geometry.rotateX(-Math.PI / 2);
          const deck = new Mesh(geometry);
          deck.name = 'deck';
          scene.add(deck);
          return deck;
        },
        // The mast, sail and rigging are not composers, and the mast is the
        // tallest thing in the scene — leaving it out was how the cove looked
        // clear when it was not.
        (scene, materials) => M.createSceneShell(scene, { wallHeight: 2, materials }),
      ),
  },
];

/** Builds a scene once, classifies it, and derives everything the tests need. */
function inventory(scene) {
  const built = scene.build();
  built.scene.updateMatrixWorld(true);
  const bounds = M.deriveOwlFlightBounds(built.ground, scene.config);
  const table = M.classifyPerchRoots(built.scene.children, bounds);
  const field = M.buildPerchField(built.scene.children, bounds);

  const solidBoxes = table.filter((entry) => entry.solid).map((entry) => entry.solid);

  built.cleanup();
  return { table, field, solidBoxes, bounds };
}

const INVENTORIES = Object.fromEntries(SCENES.map((scene) => [scene.id, inventory(scene)]));

// ─────────────────────────────────────────────────────────────────────────────
// TEST 1 — the inventory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * THE INVENTORY: every root the owl can stand on, and every root with volume it
 * must not stand in, pinned by name.
 *
 * `solid` is a surface — supported by the floor or by another solid, and taller
 * than `MIN_SOLID_HEIGHT`. `airborne` has volume but nothing beneath it: a
 * ceiling, a hanging mobile, a butterfly, the books on the upper shelves.
 *
 * Only these two are pinned. `flat` (floor seams, rug bands, wall scribbles) and
 * `out-of-bounds` (walls, wainscot panels, window glass) run to hundreds of
 * entries and change whenever someone adds a decorative mark, none of which can
 * affect the owl. Pinning them would make this suite fire on changes that cannot
 * matter, which is how a guard gets suppressed. Both counts still print on
 * failure.
 *
 * WHEN THIS FAILS. Read the new name and ask which category it belongs in.
 * Furniture in `airborne` means its underside floats more than STACK_CONTACT_Y
 * above whatever it should rest on — a bug in the prop, not in this list.
 */
const EXPECTED_INVENTORY = {
  playroom: {
    solid: [
      'backpack_root',
      'basket0_root',
      'basket1_root',
      'beanbag_root',
      'bookshelf_root',
      'chalkboardEasel_root',
      'chick',
      'deskLamp_root',
      'floorBooks_root',
      'floorDuck_root',
      'mouse_root',
      'mushroomStem',
      'musicPlayer',
      'pillow0_root',
      'pillow1_root',
      'planeFuselage',
      'pullToy_root',
      'raggedyAndy_root',
      'raggedyAnn_root',
      'ringPeg',
      'shelfCar',
      'shelfRubberDuck',
      'shelfStar',
      'shelfTeapot',
      'spinTop',
      'teddy_root',
      'toyBall',
      'toyBlock0',
      'toyBlock1',
      'toyBlock2',
      'toyCar_root',
      'toyDrum_root',
      'toybox_adventure_root',
      'toybox_animals_root',
      'toybox_creative_root',
      'trainRoot',
      'webSlinger',
    ],
    airborne: ['ceiling', 'mobilePivot', 'sunRay0', 'sunRay1', 'sunRay2'],
  },
  kitchen: {
    solid: [
      'Group',
      'kit_apple',
      'kit_ballRed',
      'kit_ballTeal',
      'kit_block0',
      'kit_block1',
      'kit_block2',
      'kit_duck',
      'kit_orange',
      'kit_plush',
      'kit_pot',
      'kitchen_cabinetRun',
      'kitchen_diningTable',
      'kitchen_fridge',
      'kitchen_leftBaseUnits',
      'kitchen_leftDresser',
      'kitchen_livingRoomDoor_doorway',
      'kitchen_stove',
      'toybox_kitchen-nature_root',
    ],
    airborne: ['Mesh'],
  },
  'living-room': {
    solid: [
      'livingRoom_catPlush',
      'livingRoom_couch',
      'livingRoom_fireplace',
      'livingRoom_floorLamp',
      'livingRoom_kitchenDoor_doorway',
      'livingRoom_playroomDoor_doorway',
      'livingRoom_sideTable',
      'toybox_living-room-nature_root',
      'toybox_living-room-pirate-cove_root',
    ],
    airborne: ['livingRoom_ceiling'],
  },
  nature: {
    solid: [
      'acorn_root',
      'acorn_root',
      'acorn_root',
      'fern_root',
      'fern_root',
      'fern_root',
      'fern_root',
      'fern_root',
      'fern_root',
      'fern_root',
      'flower_root',
      'flower_root',
      'flower_root',
      'flower_root',
      'flower_root',
      'grass_patch',
      'grass_patch',
      'grass_patch',
      'grass_patch',
      'grass_patch',
      'log_root',
      'mushroom_root',
      'mushroom_root',
      'mushroom_root',
      'mushroom_root',
      'mushroom_root',
      'snail_root',
      'stone_root',
      'stone_root',
      'stone_root',
      'streamRoot',
      'tree_-3.0_4.5',
      'tree_-4.5_-3.0',
      'tree_-5.0_2.0',
      'tree_4.8_3.5',
      'tree_5.2_-1.0',
    ],
    airborne: [],
  },
  'pirate-cove': {
    solid: [
      'anchor_prop',
      'barrel_prop',
      'barrel_prop',
      'barrel_prop',
      'barrel_prop',
      'cannon_prop',
      'parrot_prop',
      'rail_stowage',
      'rail_stowage',
      'rope_coil_prop',
      'rope_coil_prop',
      'scene_shell',
      'ship_wheel_prop',
      'treasure_chest_prop',
    ],
    airborne: [],
  },
};

for (const scene of SCENES) {
  test(`${scene.id}: the inventory of what the owl can and cannot stand on`, () => {
    const { table } = INVENTORIES[scene.id];
    assert.ok(table.length > 0, `${scene.id}: no roots at all — the stubs are not building the scene`);

    const named = (category) =>
      table
        .filter((entry) => (entry.rejection ?? 'solid') === category)
        .map((entry) => entry.name)
        .sort();

    const counts = { solid: 0, airborne: 0, flat: 0, 'out-of-bounds': 0, empty: 0 };
    for (const entry of table) counts[entry.rejection ?? 'solid'] += 1;

    const actual = { solid: named('solid'), airborne: named('airborne') };
    assert.deepEqual(
      actual,
      EXPECTED_INVENTORY[scene.id],
      `${scene.id}: the perch inventory moved.\n` +
        `  solid    (${counts.solid}): ${actual.solid.join(', ')}\n` +
        `  airborne (${counts.airborne}): ${actual.airborne.join(', ')}\n` +
        `  not pinned: flat ${counts.flat}, out-of-bounds ${counts['out-of-bounds']}, empty ${counts.empty}\n` +
        `Update EXPECTED_INVENTORY and check the new prop landed in the category you expected.`,
    );
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 2 — the classifier's rules hold on real geometry
// ─────────────────────────────────────────────────────────────────────────────

for (const scene of SCENES) {
  test(`${scene.id}: every perch surface is tall enough to be furniture`, () => {
    const { table } = INVENTORIES[scene.id];
    const wrong = table
      .filter((entry) => entry.solid)
      .filter((entry) => entry.height < M.MIN_SOLID_HEIGHT)
      .map((entry) => `${entry.name} (height ${entry.height.toFixed(2)})`);
    assert.deepEqual(wrong, [], `${scene.id}: classified as perch surfaces but are floor dressing: ${wrong.join('; ')}`);

    // And the converse, which is the half that catches a rule quietly inverted.
    const missed = table
      .filter((entry) => !entry.solid && entry.rejection !== 'out-of-bounds' && entry.rejection !== 'empty')
      .filter((entry) => entry.minY <= M.FLOOR_CONTACT_Y && entry.height >= M.MIN_SOLID_HEIGHT)
      .map((entry) => entry.name);
    assert.deepEqual(missed, [], `${scene.id}: stand on the floor and are furniture-sized, but were rejected: ${missed.join('; ')}`);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 3 — sweep every square of every scene's reachable floor
// ─────────────────────────────────────────────────────────────────────────────

/** Grid resolution per axis. 81 x 81 = 6,561 taps per scene. */
const SWEEP = 80;

/** How close a foot must be to a surface top to count as standing on it. */
const CONTACT_EPS = 0.02;

/** The height field's cell size. Its footprints are rounded out to this. */
const FIELD_CELL = 0.25;

for (const scene of SCENES) {
  test(`${scene.id}: no floor tap lands the owl inside a prop, or on nothing`, () => {
    const { field, solidBoxes, bounds } = INVENTORIES[scene.id];
    assert.ok(field.occupied > 40, `${scene.id}: only ${field.occupied} occupied cells — this sweep would pass over an empty scene`);

    const stand = (x, z, floorY, bodyHeight) => M.standingYAt(x, z, floorY, bodyHeight, field);
    let inside = null;
    let hovering = null;
    let unreachable = null;
    let unfurnished = null;

    for (let i = 0; i <= SWEEP; i++) {
      const x = bounds.minX + ((bounds.maxX - bounds.minX) * i) / SWEEP;
      for (let j = 0; j <= SWEEP; j++) {
        const z = bounds.minZ + ((bounds.maxZ - bounds.minZ) * j) / SWEEP;

        // A floor tap: the raycast hit is ON THE FLOOR, y = 0, whatever is
        // standing there. That is the whole defect, reproduced exactly.
        const landed = M.resolvePerchTarget(new Vector3(x, 0, z), PERCH_OFFSET, OWL_BODY, bounds, stand);
        const feet = landed.y - PERCH_OFFSET;
        // FEET plus body, not root plus body. `landed.y` is the owl's centre, so
        // adding the body height to it overstates its head by one perch offset —
        // which made this report 0.04-unit "overlaps" with things sitting just
        // above the bird.
        const head = feet + OWL_BODY;
        // The RESOLVED position, not the grid point. `resolvePerchTarget` may
        // step the owl aside when a spot cannot be climbed out of, and checking
        // the tap's own x/z after that measures a place the owl is not.
        const { x: lx, z: lz } = landed;

        // REACHABLE.
        if (landed.y > bounds.maxY + 1e-6 || landed.y < bounds.minY - 1e-6) {
          if (!unreachable) unreachable = { x: lx, z: lz, y: landed.y };
        }

        // ONLY EVER ON FURNITURE. The three checks around this one all consult
        // the height field, so between them they cannot notice the field being
        // built out of the WRONG THINGS — stamp the Playroom's sun shafts as
        // solid and the owl flies five metres up into a beam of light, with
        // every one of them satisfied that it is neither inside anything nor
        // hovering. It is standing on a sunbeam, and a sunbeam has a top.
        //
        // This is the independent check: whatever the owl is standing on has to
        // be a root the classifier called `solid`, and that list is pinned by
        // name in test 1. A sunbeam is `airborne` there, so it cannot quietly
        // become somewhere to stand.
        if (feet > CONTACT_EPS) {
          // Slack of one CELL on the footprint, because the field is a grid and
          // a triangle stamps every cell it touches — a prop whose box stops at
          // x -5.30 genuinely occupies the cell running to -5.50. That
          // over-estimate is deliberate and documented in `PerchField`; this is
          // the same tolerance read back. It does NOT slacken the height, which
          // is the part that matters: a sunbeam at y 5.15 is nowhere near the
          // top of any solid root no matter how the footprint is rounded.
          const onFurniture = solidBoxes.some(
            (solid) =>
              lx >= solid.minX - FIELD_CELL &&
              lx <= solid.maxX + FIELD_CELL &&
              lz >= solid.minZ - FIELD_CELL &&
              lz <= solid.maxZ + FIELD_CELL &&
              feet <= solid.topY + CONTACT_EPS,
          );
          if (!onFurniture && !unfurnished) unfurnished = { x: lx, z: lz, feet };
        }

        // NOT HOVERING. Feet on the ground, or on the top of an actual span.
        if (feet > CONTACT_EPS) {
          const spans = M.spansAt(field, lx, lz);
          const supported = spans?.some(([, top]) => Math.abs(top - feet) <= CONTACT_EPS) ?? false;
          if (!supported && !hovering) hovering = { x: lx, z: lz, feet };
        }

        // NOT INSIDE. Asked of the field starting FROM the owl's own feet: if
        // anything occupies the volume between its feet and its head, this
        // returns a height above the feet.
        //
        // Not a tautology against the resolver, though it looks like one. The
        // resolver computes a height and then puts it through a horizontal
        // clamp, a ceiling clamp, a sideways nudge and a give-up fallback, and
        // every one of those can hand back a position the surface rule never
        // sanctioned — the give-up branch does it by construction. This asks
        // whether the FINAL position survives the rule.
        const settled = M.standingYAt(lx, lz, feet, OWL_BODY, field);
        if (settled > feet + 1e-6 && (!inside || settled - feet > inside.sunk)) {
          inside = { sunk: settled - feet, x: lx, z: lz, feet, clear: settled };
        }
      }
    }

    assert.equal(
      hovering,
      null,
      hovering &&
        `${scene.id}: a tap at (${hovering.x.toFixed(2)}, ${hovering.z.toFixed(2)}) leaves the owl's feet at y ` +
          `${hovering.feet.toFixed(2)} with no surface under them — it is hanging in the air.`,
    );
    assert.equal(
      unfurnished,
      null,
      unfurnished &&
        `${scene.id}: a tap at (${unfurnished.x.toFixed(2)}, ${unfurnished.z.toFixed(2)}) stands the owl at y ${unfurnished.feet.toFixed(2)}, ` +
          `where no root classified 'solid' reaches. It is perched on something that is not furniture — check what test 1 says that thing is.`,
    );
    assert.equal(
      unreachable,
      null,
      unreachable &&
        `${scene.id}: a tap at (${unreachable.x.toFixed(2)}, ${unreachable.z.toFixed(2)}) resolved to y ${unreachable?.y.toFixed(2)}, outside the flight bounds.`,
    );
    assert.equal(
      inside,
      null,
      inside &&
        `${scene.id}: a tap at (${inside.x.toFixed(2)}, ${inside.z.toFixed(2)}) puts the owl's feet at y ${inside.feet.toFixed(2)}, ` +
          `with ${inside.sunk.toFixed(2)} of solid geometry through its body — the nearest clear height there is ${inside.clear.toFixed(2)}. ` +
          `Swept ${(SWEEP + 1) ** 2} floor points.`,
    );
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 4 — the resolver's own contract
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The unit tests below build REAL geometry rather than hand-writing spans.
 *
 * They used to pass literal boxes into the resolver, and that was comfortable
 * and wrong: the model has now been rebuilt twice — boxes per prop, boxes per
 * mesh, and finally triangles stamped into a height field — and each time the
 * hand-written fixtures kept passing while the scenes broke, because a literal
 * box is the one shape every version of the model got right. Meshes go through
 * `buildPerchField`, so these exercise the code the owl exercises.
 *
 * @param specs - `[width, height, depth, x, y, z]` per box, y being the underside.
 * @param bounds - Flight bounds the field is built over.
 * @returns The height field.
 */
function fieldOf(specs, bounds) {
  const scene = new Scene();
  const root = new Group();
  root.name = 'fixture';
  for (const [w, h, d, x, y, z] of specs) {
    const mesh = new Mesh(new BoxGeometry(w, h, d));
    mesh.position.set(x, y + h / 2, z);
    root.add(mesh);
  }
  scene.add(root);
  scene.updateMatrixWorld(true);
  return M.buildPerchField(scene.children, bounds);
}

const WIDE = { minX: -9, maxX: 9, minZ: -9, maxZ: 9, minY: 0.3, maxY: 8 };

test('standingYAt does not lift the owl for something it can walk under', () => {
  // THE NATURE BUG. A trunk from the ground and a canopy from y 2.5 to 6.5 spread
  // over 5 x 5, and a bird 1.1 tall standing on the grass beneath the leaves. The
  // version that lifted to the top of any containing box sent the owl to 6.5
  // here, and the flight ceiling then left it hanging at 5.0.
  const tree = fieldOf(
    [
      [0.4, 3, 0.4, 0, 0, 0],
      [5, 4, 5, 0, 2.5, 0],
    ],
    WIDE,
  );
  assert.equal(M.standingYAt(2, 0, 0, OWL_BODY, tree), 0, 'under the canopy, clear of the trunk');
});

test('standingYAt lifts the owl onto anything actually in its way', () => {
  const fridge = fieldOf([[1.2, 2.6, 1, 0, 0, 0]], WIDE);
  assert.ok(Math.abs(M.standingYAt(0, 0, 0, OWL_BODY, fridge) - 2.6) < 0.01, 'on top of the fridge');
  assert.equal(M.standingYAt(7, 7, 0, OWL_BODY, fridge), 0, 'outside the footprint, nothing to climb');
});

test('standingYAt sees the inside of a closed box, not just its faces', () => {
  // Triangles are surfaces. Stamped naively, the middle of a box holds a triangle
  // at its lid and one at its base with apparently empty air between — and the
  // owl walked in through the lid. `buildPerchField` brackets each mesh's own
  // min and max per cell for exactly this reason.
  const box = fieldOf([[2, 2.4, 2, 0, 0, 0]], WIDE);
  assert.ok(Math.abs(M.standingYAt(0, 0, 0, OWL_BODY, box) - 2.4) < 0.01);
});

test('standingYAt keeps lifting until it is clear, not just once', () => {
  // Clearing the trunk puts the owl in the leaves, so one lift is not enough.
  const tree = fieldOf(
    [
      [0.4, 3, 0.4, 0, 0, 0],
      [5, 4, 5, 0, 2.5, 0],
    ],
    WIDE,
  );
  assert.ok(M.standingYAt(0, 0, 0, OWL_BODY, tree) > 6, 'at the trunk, the only clear height is above the canopy');
});

test('resolvePerchTarget clamps horizontally BEFORE it resolves the surface', () => {
  // Not a detail. The version this replaced set y from the tapped point and then
  // clamped x and z, so a tap outside the bounds was slid sideways while keeping
  // the height of a surface it was no longer above.
  const bounds = { minX: -5, maxX: 5, minZ: -5, maxZ: 5, minY: 0.3, maxY: 6 };
  const plinth = fieldOf([[2, 2, 2, 4.5, 0, 0]], bounds);
  const stand = (x, z, floorY, bodyHeight) => M.standingYAt(x, z, floorY, bodyHeight, plinth);

  const landed = M.resolvePerchTarget(new Vector3(40, 0, 0), PERCH_OFFSET, OWL_BODY, bounds, stand);
  assert.equal(landed.x, 5);
  assert.ok(Math.abs(landed.y - (2 + PERCH_OFFSET)) < 0.01, 'clamped onto the plinth but resolved the surface at the pre-clamp position');
});

test('resolvePerchTarget steps aside when the perch is out of reach, never hovers', () => {
  // The Nature treetop case: a trunk tap resolves above a ceiling it cannot
  // reach. Clamping to the ceiling is the worst of the three options — the owl is
  // then neither on the tree nor on the ground, which is exactly what a child
  // reported as the owl getting stuck.
  const bounds = { minX: -9, maxX: 9, minZ: -9, maxZ: 9, minY: 0.3, maxY: 5 };
  const tree = fieldOf(
    [
      [0.4, 3, 0.4, 0, 0, 0],
      [3, 4, 3, 0, 2.5, 0],
    ],
    bounds,
  );
  const stand = (x, z, floorY, bodyHeight) => M.standingYAt(x, z, floorY, bodyHeight, tree);

  const landed = M.resolvePerchTarget(new Vector3(0, 0, 0), PERCH_OFFSET, OWL_BODY, bounds, stand);
  assert.ok(landed.y <= bounds.maxY, 'must be reachable');
  assert.ok(Math.abs(landed.y - PERCH_OFFSET) < 0.01, 'should be standing on the ground');
  assert.ok(Math.hypot(landed.x, landed.z) > 0.2, 'and beside the trunk, not inside it');
});

test('resolvePerchTarget never lowers a caller that measured its own surface', () => {
  // `wireToyboxInteractions` measures the toybox lid with its own Box3 and passes
  // that height in. A footprint map that knows less must not overrule it.
  const mat = fieldOf([[2, 0.2, 2, 0, 0, 0]], WIDE);
  const landed = M.resolvePerchTarget(new Vector3(0, 1.8, 0), PERCH_OFFSET, OWL_BODY, undefined, (x, z, floorY, bodyHeight) =>
    M.standingYAt(x, z, floorY, bodyHeight, mat),
  );
  assert.equal(landed.y, 1.8 + PERCH_OFFSET);
});

test('resolvePerchTarget without a surface lookup behaves exactly as it did before', () => {
  const bounds = { minX: -5, maxX: 5, minZ: -5, maxZ: 5, minY: 0.3, maxY: 6 };
  const landed = M.resolvePerchTarget(new Vector3(9, 0, -2), PERCH_OFFSET, OWL_BODY, bounds);
  assert.deepEqual([landed.x, landed.y, landed.z], [5, PERCH_OFFSET, -2]);
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 5 — the wiring, end to end
// ─────────────────────────────────────────────────────────────────────────────

test('a floor tap on a room prop flies the owl ON TOP of it, through the real wiring', () => {
  // WHY THIS EXISTS, AND WHY IT IS NOT REDUNDANT WITH THE SWEEP.
  //
  // Everything above drives `resolvePerchTarget` directly. That proves the RULE
  // is right and proves nothing about whether the rule is connected. When the
  // wiring in `wireFloorTap` was deleted as a mutation, every other test here
  // stayed green — and the wiring at the time was genuinely broken: room scenes
  // build their owl before their contents and hand it to `wireFloorTap` as
  // `existingOwl`, so a constructor option reached the two immersive scenes and
  // missed all three rooms.
  const scene = new Scene();
  const contents = M.buildKitchenContents({
    scene,
    canvas: stubCanvas(),
    camera: new PerspectiveCamera(),
    dispatcher: stubDispatcher(),
    nav: stubNav(),
    owl: stubOwl(),
  });

  const fridge = scene.children.find((child) => child.name === 'kitchen_fridge');
  assert.ok(fridge, 'kitchen: no fridge in the built room');
  const box = new Box3().setFromObject(fridge);
  const spot = new Vector3((box.min.x + box.max.x) / 2, 0, (box.min.z + box.max.z) / 2);

  // The room path: an owl that already exists, exactly as `createRoomScene` does it.
  let surfaceLookup = null;
  const owl = { ...stubOwl(), setSurfaceYAt: (resolve) => (surfaceLookup = resolve) };

  let tapHandler = null;
  const dispatcher = { ...stubDispatcher(), registerWithPoint: (target, handler) => ((tapHandler = handler), noop) };

  const { cleanup } = M.wireFloorTap(scene, dispatcher, contents.floorTargets, M.KITCHEN_ENVIRONMENT.floorTap, owl);

  assert.ok(surfaceLookup, 'wireFloorTap did not give the owl a surface lookup — the fix is not connected');
  assert.ok(tapHandler, 'wireFloorTap registered no tap handler');

  let flownTo = null;
  owl.flyTo = (target) => {
    flownTo = M.resolvePerchTarget(target, PERCH_OFFSET, OWL_BODY, M.KITCHEN_ENVIRONMENT.floorTap.flightBounds, surfaceLookup);
  };

  // THE TAP. A raycast through the fridge lands on the planking under it: y = 0.
  tapHandler(spot);

  assert.ok(flownTo, 'the floor tap did not move the owl');
  const feet = flownTo.y - PERCH_OFFSET;
  assert.ok(
    feet >= box.max.y - 1e-6,
    `a tap on the fridge put the owl's feet at y ${feet.toFixed(2)}, below the fridge's top at ${box.max.y.toFixed(2)} — it is standing inside the fridge`,
  );

  cleanup();
  contents?.cleanup?.();
});

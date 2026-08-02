import { BoxGeometry, Color, CylinderGeometry, Group, Mesh, SphereGeometry, TorusGeometry, type Scene } from 'three';
import { createGlossyPaintMaterial, createToyMetalMaterial, createTranslucentMaterial, createWoodMaterial } from '@app/utils/materialFactory';
import {
  COUNTERTOP_Y,
  DRESSER_HUTCH_TOP_Y,
  LEFT_BASE_CABINET_WIDTH,
  LEFT_BASE_CABINET_Z,
  LEFT_CABINET_DEPTH,
  LEFT_DRESSER_WIDTH,
  LEFT_DRESSER_Z,
  LEFT_WALL_FACE_X,
} from '../layout';

// ── WHICH WALL THIS IS, AND WHICH WAY IT FACES ──────────────────────────────
//
// The left wall is the one at POSITIVE x — see the navigation header in
// `../layout.ts`. Both pieces here hang off `LEFT_WALL_FACE_X` and are turned
// with `rotation.y = -Math.PI / 2`, the same quarter turn
// `createInteractiveDoorway` uses for the Living Room door on the same wall, so
// that inside each root:
//
//     local +X  ->  world +Z, i.e. ALONG the wall, deeper into the room
//     local +Z  ->  world -X, i.e. OUT of the wall, toward the room's centre
//     local +Y  ->  world +Y, unchanged
//
// So a piece's WIDTH is authored on local x and its DEPTH on local z, exactly as
// it would be for a back-wall piece, and only the root carries the turn. Nothing
// below restates the sign of anything.
//
// THE ROOT IS HALF A DEPTH OFF THE WALL, DELIBERATELY. The first version put it
// ON `LEFT_WALL_FACE_X` and then centred the carcass at local z = 0, which
// buried half of every piece — 0.29 units — inside the wall. The measurement in
// `_kcheck` caught it as `max x 5.590 vs wall face 5.275`; nothing on screen
// would have, because the wall is opaque and the visible half looked correct.
// With the root at `LEFT_WALL_FACE_X - LEFT_CABINET_DEPTH / 2`, local z = -D/2
// IS the wall face, and every back panel below is authored against that.
//
// WHAT PORTRAIT VIEWPORTS ACTUALLY SEE OF THIS WALL
// --------------------------------------------------
// Measured by sweeping a wall-sized probe box along z at all nine shipping
// aspects. A piece against this wall is fully in frame on every aspect only from
// z >= 5.5; it is fully in frame on landscape and tablet everywhere; and between
// those, phones see a progressively smaller corner of it. At z = -0.6 a phone
// sees two corners of eight.
//
// That is why the two pieces are shaped the way they are, and it is not a
// compromise made by eye:
//
//   - the BASE UNITS sit at `LEFT_BASE_CABINET_Z` (= `PEG_RAIL_Z`, 5.6), inside
//     the band every device can see, and are counter-high because the peg rail's
//     cloths hang down to y 1.95 and a taller piece would collide with them.
//   - the DRESSER sits forward, in the stretch only landscape and tablet see. It
//     is deliberately SCENERY and registers no tap: the rule this room's larger
//     siblings follow (`tests/room/pirate-cove-composition.test.mjs`) is that
//     anything REACHABLE must be in frame at every aspect, while scenery need
//     only be visible where its own floor is. It also has company — the wall
//     clock at z 0.1 and the menu board at z 0.4 have exactly this profile
//     already, so the near band is where this room has always put things that
//     dress a wide frame.
//
// If the near band should carry something a phone can see, the fix is a camera
// change, not a furniture change, and it would move the clock and the menu board
// too.

/** Carcass height under the counter slab — the room's one counter height. */
const CARCASS_HEIGHT = COUNTERTOP_Y - 0.04;

/** Thickness of every plank, slab and door front in both pieces. */
const PLANK = 0.06;

/** Local z of the wall face. Everything with a back is authored against this. */
const WALL_Z = -LEFT_CABINET_DEPTH / 2;

/**
 * Builds a plain cupboard carcass with a counter slab and a row of doors.
 *
 * Shared by both pieces on this wall, because a dresser base and a run of base
 * units differ in how wide they are and in what stands on top of them, not in
 * how they are made.
 *
 * @param parent - Root group for the piece.
 * @param width - Carcass width along the wall.
 * @param doors - How many door fronts to divide the width into.
 * @param bodyMat - Carcass paint.
 * @param doorMat - Door paint.
 * @param counterMat - Counter slab wood.
 * @param knobMat - Knob metal.
 * @param prefix - Mesh-name prefix so the two pieces stay distinguishable.
 */
function buildCupboardBase(
  parent: Group,
  width: number,
  doors: number,
  bodyMat: ReturnType<typeof createGlossyPaintMaterial>,
  doorMat: ReturnType<typeof createGlossyPaintMaterial>,
  counterMat: ReturnType<typeof createWoodMaterial>,
  knobMat: ReturnType<typeof createToyMetalMaterial>,
  prefix: string,
): void {
  const carcass = new Mesh(new BoxGeometry(width, CARCASS_HEIGHT, LEFT_CABINET_DEPTH), bodyMat);
  carcass.name = `${prefix}Carcass`;
  carcass.position.set(0, CARCASS_HEIGHT / 2, 0);
  carcass.castShadow = true;
  carcass.receiveShadow = true;
  parent.add(carcass);

  // Counter slab: 0.06 deeper than the carcass, all of it overhanging the FRONT
  // so the back stays flush against the wall.
  const counter = new Mesh(new BoxGeometry(width + 0.1, 0.07, LEFT_CABINET_DEPTH + 0.06), counterMat);
  counter.name = `${prefix}Counter`;
  counter.position.set(0, COUNTERTOP_Y, 0.03);
  counter.castShadow = true;
  parent.add(counter);

  // Kick recess: the carcass stands on a slightly inset plinth so the piece
  // reads as furniture rather than as a box resting on the floor.
  const plinth = new Mesh(new BoxGeometry(width - 0.14, 0.1, LEFT_CABINET_DEPTH - 0.12), bodyMat);
  plinth.name = `${prefix}Plinth`;
  plinth.position.set(0, 0.05, 0);
  parent.add(plinth);

  const doorWidth = (width - 0.16 * (doors + 1)) / doors;
  for (let i = 0; i < doors; i++) {
    const doorX = -width / 2 + 0.16 + doorWidth / 2 + i * (doorWidth + 0.16);

    const door = new Mesh(new BoxGeometry(doorWidth, CARCASS_HEIGHT - 0.3, PLANK), doorMat);
    door.name = `${prefix}Door${i}`;
    door.position.set(doorX, CARCASS_HEIGHT / 2 + 0.02, LEFT_CABINET_DEPTH / 2 + PLANK / 2);
    parent.add(door);

    const knob = new Mesh(new SphereGeometry(0.042, 10, 8), knobMat);
    knob.name = `${prefix}Knob${i}`;
    knob.position.set(doorX + doorWidth / 2 - 0.12, CARCASS_HEIGHT / 2 + 0.18, LEFT_CABINET_DEPTH / 2 + PLANK);
    parent.add(knob);
  }
}

/**
 * Creates the tall dresser on the near half of the left wall: a two-door
 * cupboard base with a wooden counter, and an open plate hutch above it holding
 * standing plates, a jug, storage tins, and two mugs on hooks.
 *
 * It stands FORWARD of the Living Room doorway. The doorway is 2.0 wide and
 * centred at `LIVING_ROOM_DOOR_Z`, so it owns the middle of this wall, and the
 * stretch in front of it was the emptiest floor in the room. The hutch stops
 * below `WALL_CLOCK_Y` so the clock hangs clear above the cornice, which is
 * where a clock goes.
 *
 * @param scene - The Three.js scene that receives the dresser group.
 */
function createDresser(scene: Scene): void {
  const root = new Group();
  root.name = 'kitchen_leftDresser';
  root.position.set(LEFT_WALL_FACE_X - LEFT_CABINET_DEPTH / 2, 0, LEFT_DRESSER_Z);
  root.rotation.y = -Math.PI / 2;
  scene.add(root);

  const bodyMat = createGlossyPaintMaterial('kitchen_dresserBodyMat', new Color(0.86, 0.82, 0.72));
  const doorMat = createGlossyPaintMaterial('kitchen_dresserDoorMat', new Color(0.78, 0.73, 0.6));
  const counterMat = createWoodMaterial('kitchen_dresserCounterMat', new Color(0.56, 0.42, 0.28));
  const knobMat = createToyMetalMaterial('kitchen_dresserKnobMat', new Color(0.78, 0.68, 0.44));
  const plankMat = createWoodMaterial('kitchen_dresserPlankMat', new Color(0.68, 0.52, 0.34));

  buildCupboardBase(root, LEFT_DRESSER_WIDTH, 2, bodyMat, doorMat, counterMat, knobMat, 'dresser');

  // ── Hutch: a shallow open case standing on the counter, back to the wall ──
  const hutchDepth = LEFT_CABINET_DEPTH - 0.2;
  const hutchZ = WALL_Z + hutchDepth / 2;
  const hutchBottom = COUNTERTOP_Y + 0.04;
  const hutchHeight = DRESSER_HUTCH_TOP_Y - hutchBottom;

  const backPanel = new Mesh(new BoxGeometry(LEFT_DRESSER_WIDTH - 0.1, hutchHeight, PLANK / 2), bodyMat);
  backPanel.name = 'dresserHutchBack';
  backPanel.position.set(0, hutchBottom + hutchHeight / 2, WALL_Z + PLANK / 4);
  backPanel.receiveShadow = true;
  root.add(backPanel);

  [-1, 1].forEach((side, index) => {
    const upright = new Mesh(new BoxGeometry(PLANK + 0.02, hutchHeight, hutchDepth), plankMat);
    upright.name = `dresserHutchUpright${index}`;
    upright.position.set((side * (LEFT_DRESSER_WIDTH - 0.1)) / 2, hutchBottom + hutchHeight / 2, hutchZ);
    upright.castShadow = true;
    root.add(upright);
  });

  // Cornice, so the hutch ends in a lip rather than in a cut edge.
  const cornice = new Mesh(new BoxGeometry(LEFT_DRESSER_WIDTH + 0.06, 0.09, hutchDepth + 0.08), plankMat);
  cornice.name = 'dresserCornice';
  // +0.04 is exactly half the cornice's extra depth, so all of the overhang is
  // on the FRONT and its back edge lands on WALL_Z rather than 0.02 inside it.
  cornice.position.set(0, DRESSER_HUTCH_TOP_Y, hutchZ + 0.04);
  cornice.castShadow = true;
  root.add(cornice);

  const shelfYs = [hutchBottom + hutchHeight * 0.36, hutchBottom + hutchHeight * 0.72];
  shelfYs.forEach((y, index) => {
    const shelf = new Mesh(new BoxGeometry(LEFT_DRESSER_WIDTH - 0.12, PLANK, hutchDepth), plankMat);
    shelf.name = `dresserHutchShelf${index}`;
    shelf.position.set(0, y, hutchZ);
    shelf.castShadow = true;
    root.add(shelf);
  });

  // Standing plates on the lower shelf — thin cylinders on edge, tipped back
  // against the panel. This is what makes the piece read as a dresser rather
  // than as a bookcase.
  const plateColors = [new Color(0.95, 0.92, 0.84), new Color(0.72, 0.82, 0.78), new Color(0.93, 0.76, 0.66)];
  plateColors.forEach((color, index) => {
    const plateMat = createGlossyPaintMaterial(`kitchen_dresserPlateMat${index}`, color);
    const plate = new Mesh(new CylinderGeometry(0.21, 0.21, 0.028, 18), plateMat);
    plate.name = `dresserPlate${index}`;
    plate.position.set(-0.62 + index * 0.62, shelfYs[0] + PLANK / 2 + 0.21, WALL_Z + 0.12);
    plate.rotation.set(Math.PI / 2 - 0.12, 0, 0);
    plate.castShadow = true;
    root.add(plate);
  });

  // Upper shelf: a cream jug and two storage tins.
  const jugMat = createGlossyPaintMaterial('kitchen_dresserJugMat', new Color(0.96, 0.94, 0.88));
  const jug = new Mesh(new CylinderGeometry(0.11, 0.13, 0.24, 14), jugMat);
  jug.name = 'dresserJug';
  jug.position.set(-0.66, shelfYs[1] + PLANK / 2 + 0.12, hutchZ);
  jug.castShadow = true;
  root.add(jug);

  const jugHandle = new Mesh(new TorusGeometry(0.06, 0.016, 6, 12, Math.PI), jugMat);
  jugHandle.name = 'dresserJugHandle';
  jugHandle.position.set(-0.66 - 0.11, shelfYs[1] + PLANK / 2 + 0.13, hutchZ);
  jugHandle.rotation.z = Math.PI / 2;
  root.add(jugHandle);

  [
    { x: 0.05, radius: 0.095, height: 0.2, color: new Color(0.66, 0.76, 0.7) },
    { x: 0.36, radius: 0.08, height: 0.15, color: new Color(0.85, 0.68, 0.5) },
  ].forEach((spec, index) => {
    const tinMat = createGlossyPaintMaterial(`kitchen_dresserTinMat${index}`, spec.color);
    const tin = new Mesh(new CylinderGeometry(spec.radius, spec.radius, spec.height, 12), tinMat);
    tin.name = `dresserTin${index}`;
    tin.position.set(spec.x, shelfYs[1] + PLANK / 2 + spec.height / 2, hutchZ);
    tin.castShadow = true;
    root.add(tin);

    const lid = new Mesh(new CylinderGeometry(spec.radius + 0.012, spec.radius + 0.012, 0.03, 12), knobMat);
    lid.name = `dresserTinLid${index}`;
    lid.position.set(spec.x, shelfYs[1] + PLANK / 2 + spec.height + 0.015, hutchZ);
    root.add(lid);
  });

  // Two mugs hanging from little hooks under the upper shelf — the detail that
  // stops the middle bay reading as empty.
  [-0.18, 0.14].forEach((x, index) => {
    const mugMat = createGlossyPaintMaterial(`kitchen_dresserMugMat${index}`, index === 0 ? new Color(0.9, 0.62, 0.55) : new Color(0.6, 0.7, 0.85));
    const mug = new Mesh(new CylinderGeometry(0.075, 0.065, 0.13, 12), mugMat);
    mug.name = `dresserHangingMug${index}`;
    mug.position.set(x, shelfYs[1] - 0.12, hutchZ + 0.04);
    mug.castShadow = true;
    root.add(mug);

    const hook = new Mesh(new CylinderGeometry(0.008, 0.008, 0.06, 6), knobMat);
    hook.name = `dresserMugHook${index}`;
    hook.position.set(x, shelfYs[1] - 0.03, hutchZ + 0.04);
    root.add(hook);
  });
}

/**
 * Creates the run of low base units on the back half of the left wall, tucked
 * under the peg rail with a bowl stack, a crock of wooden spoons and a storage
 * jar on top.
 *
 * It is deliberately only counter-high. `LEFT_BASE_CABINET_Z` is `PEG_RAIL_Z` —
 * this stands UNDER the rail, whose cloths hang down to y 1.95, and the counter
 * plus its tallest item reach 1.67.
 *
 * This is the piece that carries the wall on a phone: it is the only left-wall
 * furniture inside the band every shipping aspect can see. See the header.
 *
 * @param scene - The Three.js scene that receives the base-unit group.
 */
function createBaseUnits(scene: Scene): void {
  const root = new Group();
  root.name = 'kitchen_leftBaseUnits';
  root.position.set(LEFT_WALL_FACE_X - LEFT_CABINET_DEPTH / 2, 0, LEFT_BASE_CABINET_Z);
  root.rotation.y = -Math.PI / 2;
  scene.add(root);

  const bodyMat = createGlossyPaintMaterial('kitchen_leftBaseBodyMat', new Color(0.82, 0.86, 0.78));
  const doorMat = createGlossyPaintMaterial('kitchen_leftBaseDoorMat', new Color(0.74, 0.8, 0.68));
  const counterMat = createWoodMaterial('kitchen_leftBaseCounterMat', new Color(0.56, 0.42, 0.28));
  const knobMat = createToyMetalMaterial('kitchen_leftBaseKnobMat', new Color(0.78, 0.68, 0.44));

  buildCupboardBase(root, LEFT_BASE_CABINET_WIDTH, 3, bodyMat, doorMat, counterMat, knobMat, 'leftBase');

  // A stack of mixing bowls.
  const bowlMat = createGlossyPaintMaterial('kitchen_leftBaseBowlMat', new Color(0.95, 0.9, 0.8));
  [0, 1, 2].forEach((index) => {
    const bowl = new Mesh(new CylinderGeometry(0.17 - index * 0.02, 0.11, 0.08, 14), bowlMat);
    bowl.name = `leftBaseBowl${index}`;
    bowl.position.set(-0.78, COUNTERTOP_Y + 0.075 + index * 0.06, 0.02);
    bowl.castShadow = true;
    root.add(bowl);
  });

  // A crock of wooden spoons.
  const crockMat = createGlossyPaintMaterial('kitchen_leftBaseCrockMat', new Color(0.72, 0.5, 0.42));
  const crock = new Mesh(new CylinderGeometry(0.11, 0.09, 0.24, 12), crockMat);
  crock.name = 'leftBaseCrock';
  crock.position.set(0.16, COUNTERTOP_Y + 0.155, 0.02);
  crock.castShadow = true;
  root.add(crock);

  const spoonMat = createWoodMaterial('kitchen_leftBaseSpoonMat', new Color(0.72, 0.58, 0.38));
  [
    { lean: 0.16, spin: 0 },
    { lean: -0.12, spin: 0.9 },
    { lean: 0.06, spin: -1.1 },
  ].forEach((spec, index) => {
    const handle = new Mesh(new CylinderGeometry(0.014, 0.014, 0.34, 6), spoonMat);
    handle.name = `leftBaseSpoon${index}`;
    handle.position.set(0.16, COUNTERTOP_Y + 0.34, 0.02);
    handle.rotation.set(spec.lean, spec.spin, spec.lean * 0.7);
    root.add(handle);
  });

  // A glass storage jar at the far end, echoing the back-wall shelf's pair.
  const jarMat = createTranslucentMaterial('kitchen_leftBaseJarMat', new Color(0.85, 0.9, 0.86), 0.55);
  const jar = new Mesh(new CylinderGeometry(0.1, 0.1, 0.26, 12), jarMat);
  jar.name = 'leftBaseJar';
  jar.position.set(0.9, COUNTERTOP_Y + 0.165, 0.02);
  root.add(jar);

  const jarLid = new Mesh(new CylinderGeometry(0.113, 0.113, 0.04, 12), counterMat);
  jarLid.name = 'leftBaseJarLid';
  jarLid.position.set(0.9, COUNTERTOP_Y + 0.315, 0.02);
  root.add(jarLid);
}

/**
 * Creates both left-wall cabinetry pieces: the tall dresser forward of the
 * Living Room doorway, and the low base units behind it under the peg rail.
 *
 * Both are scenery and neither registers a tap, which is the same call the
 * fridge, the stove and the open shelves make. The room's tappable delights are
 * small things a child can pick out — the kettle, the pots, the cloths — and a
 * two-metre cupboard is not one of those. The plates and the jug are the natural
 * candidates if this wall should later answer back; adding one means updating
 * the per-room tappable count pinned in
 * `tests/room/prop-reaction-channels.contract.test.mjs`, which is deliberate.
 *
 * @param scene - The Three.js scene that receives both groups.
 */
export function createLeftWallCabinets(scene: Scene): void {
  createDresser(scene);
  createBaseUnits(scene);
}

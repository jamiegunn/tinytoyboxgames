import { BoxGeometry, Color, CylinderGeometry, Group, Mesh, SphereGeometry, TorusGeometry, type Scene } from 'three';
import { createFeltMaterial, createGlossyPaintMaterial, createPlasticMaterial, createToyMetalMaterial, createWoodMaterial } from '@app/utils/materialFactory';
import {
  LAUNDRY_BASKET_X,
  LAUNDRY_BASKET_Z,
  FRONT_RUNNER_HALF_DEPTH,
  FRONT_RUNNER_HALF_WIDTH,
  FRONT_RUNNER_X,
  FRONT_RUNNER_Z,
  MIXING_BOWLS_X,
  MIXING_BOWLS_Z,
  PET_CORNER_X,
  PET_CORNER_Z,
  PLAY_KITCHEN_X,
  PLAY_KITCHEN_Z,
  SHOP_BASKET_X,
  SHOP_BASKET_Z,
  STEP_STOOL_X,
  STEP_STOOL_Z,
} from '../layout';

/**
 * Dresses the Kitchen's front floor — the band the camera looks across before it
 * reaches anything.
 *
 * WHY THIS FILE EXISTS. With the letterbox removed the scene fills the screen,
 * and 60.0% of the Kitchen's opening frame on a phone was bare floorboards —
 * against 39.5% in the Playroom and 42.0% in the Living Room. The camera was not
 * the problem: the pose that ships is the richest of 2,965 that are clean at
 * every aspect from 0.40 to 2.60. The room simply had nothing on its floor
 * forward of the breakfast table, so a frame tall enough to fill a phone filled
 * its lower half with planks.
 *
 * WHERE THE PIECES GO IS MEASURED, NOT CHOSEN. `.probe/kitchen-bare-footprint.mjs`
 * casts a ray through every cell of the frame and reports where the ones that hit
 * bare floor LAND. The heaviest square is (0, -4); the bottom third of a phone
 * frame covers x [-2.0, 2.0], z [-4.3, -1.3], and the full width x [-5.2, 5.2]
 * on a laptop. See the "front floor" section of `layout.ts`, which owns every
 * position here.
 *
 * WHAT ACTUALLY DID THE WORK, WHICH IS NOT WHAT I EXPECTED. With the runner
 * switched off, every object in this file together takes the phone frame from
 * 18.8% objects and 60.0% bare boards to 21.2% and 56.8%. The runner alone then
 * takes bare floor from 56.8% to 37.9%.
 *
 * That is not a trick, it is geometry: this band is twelve square metres of near
 * floor and objects a third of a metre across do not cover it, however many of
 * them there are. A floor covering covers floor. But "the frame has more in it"
 * and "the frame has more to LOOK at" are different claims and the runner only
 * earns the first, so `room-opening-framing.test.mjs` counts rugs in their own
 * bucket and bounds three things separately: objects, bare floor, ceiling. The
 * runner cannot be enlarged to satisfy the object floor, and the objects cannot
 * be shrunk on the strength of the runner.
 *
 * EVERY PIECE HERE IS EARNING ITS PLACE IN ONE SLOT OR THE OTHER, and each was
 * checked by switching it off. The three in the phone strip — stool, shopping
 * basket, mixing bowls — carry the whole +2.4 points of objects a phone sees;
 * the play kitchen and the laundry basket sit outside that strip and contribute
 * nothing to it. On a laptop those two are worth +2.3 points at aspect 1.33 and
 * +1.4 at 2.37, which is the same order as the small pieces buy on a phone. Two
 * slots, two sets, both measured.
 *
 * WHY THERE IS NO BROOM. There was one — leaning against the right wall, which
 * is the kind of detail this band wants. `owl-perch-surfaces.test.mjs` rejected
 * it and was right to. Anything named and taller than 0.12 becomes a surface the
 * owl can land on, and a perch is modelled as its bounding BOX: a tilted broom
 * is a 0.58 x 1.19 x 0.23 box that is a 4cm stick and otherwise air, so a tap
 * anywhere in its footprint would have stood the owl a metre up on nothing. That
 * is the exact defect that suite exists to catch, in miniature, and it is not
 * fixable by moving the broom — only by not having a tall thin leaning thing on
 * a floor the owl can be sent to. The other pieces here are boxy enough that
 * their bounding box IS roughly their top surface.
 *
 * NONE OF IT IS TAPPABLE, on purpose. These are set dressing, like the loose
 * floor toys beside them: the room's tappable inventory is pinned at 15 by
 * `room-opening-framing.test.mjs`, and a threshold that answers to a finger would
 * compete with the toybox two steps behind it.
 *
 * @param scene - The Kitchen scene to add the front-floor dressing to.
 */
export function createKitchenFrontFloor(scene: Scene): void {
  addRunner(scene);
  addPlayKitchen(scene);
  addLaundryBasket(scene);
  addStepStool(scene);
  addShoppingBasket(scene);
  addMixingBowls(scene);
  addPetCorner(scene);
}

/**
 * A child's play kitchen — a hob, an oven door and a rail — facing the camera.
 *
 * @param scene - Scene that receives the unit.
 */
function addPlayKitchen(scene: Scene): void {
  const root = new Group();
  root.name = 'kit_playKitchen';
  root.position.set(PLAY_KITCHEN_X, 0, PLAY_KITCHEN_Z);
  // FACING THE CHILD, and it took a render to notice it was not. Local +z is
  // this unit's front — door, knobs, hob — and the scene camera stands at
  // z -8.4 looking toward +z, so it sees the -z side of everything. Left at
  // rotation 0.22 the unit presented its splashback to the room and read as a
  // shed with a pitched roof; the oven door was against the back wall.
  root.rotation.y = Math.PI + 0.22;
  scene.add(root);

  // Warm rather than the sage the rest of the room wears: the nature toybox two
  // metres away is already a teal box of about this size, and two of them at
  // opposite corners of the frame read as a matched pair rather than as a toybox
  // and a toy.
  const body = createGlossyPaintMaterial('kit_playKitchenBodyMat', new Color(0.9, 0.62, 0.5));
  const wood = createWoodMaterial('kit_playKitchenWoodMat', new Color(0.87, 0.73, 0.5));
  const W = 1.05;
  const D = 0.45;
  const CARCASS_H = 0.62;

  const carcass = new Mesh(new BoxGeometry(W, CARCASS_H, D), body);
  carcass.name = 'kit_playKitchenCarcass';
  carcass.position.y = CARCASS_H / 2 + 0.06;
  carcass.castShadow = true;
  carcass.receiveShadow = true;
  root.add(carcass);

  const top = new Mesh(new BoxGeometry(W + 0.06, 0.05, D + 0.05), wood);
  top.name = 'kit_playKitchenTop';
  top.position.y = CARCASS_H + 0.09;
  top.castShadow = true;
  root.add(top);

  // Splashback with a rail, which is what gives it a silhouette above the
  // counter line rather than reading as a box.
  const back = new Mesh(new BoxGeometry(W, 0.3, 0.05), body);
  back.name = 'kit_playKitchenSplashback';
  back.position.set(0, CARCASS_H + 0.26, -D / 2 + 0.02);
  back.castShadow = true;
  root.add(back);
  const rail = new Mesh(new CylinderGeometry(0.014, 0.014, W * 0.8, 8), createToyMetalMaterial('kit_playKitchenRailMat', new Color(0.72, 0.74, 0.76)));
  rail.rotation.z = Math.PI / 2;
  rail.position.set(0, CARCASS_H + 0.3, -D / 2 + 0.08);
  root.add(rail);
  const pan = new Mesh(new CylinderGeometry(0.09, 0.08, 0.06, 14), createToyMetalMaterial('kit_playKitchenPanMat', new Color(0.66, 0.68, 0.7)));
  pan.name = 'kit_playKitchenPan';
  pan.position.set(-0.26, CARCASS_H + 0.22, -D / 2 + 0.09);
  pan.rotation.x = Math.PI / 2;
  root.add(pan);

  // Two hob rings and two knobs, so the front face is not blank.
  [-0.26, 0.26].forEach((x, index) => {
    const ring = new Mesh(new TorusGeometry(0.075, 0.014, 8, 18), createPlasticMaterial(`kit_playKitchenRing${index}Mat`, new Color(0.32, 0.3, 0.29)));
    ring.name = `kit_playKitchenRing${index}`;
    ring.position.set(x, CARCASS_H + 0.12, -0.08);
    ring.rotation.x = -Math.PI / 2;
    root.add(ring);
    const knob = new Mesh(new CylinderGeometry(0.032, 0.032, 0.035, 12), createGlossyPaintMaterial(`kit_playKitchenKnob${index}Mat`, new Color(0.9, 0.6, 0.3)));
    knob.name = `kit_playKitchenKnob${index}`;
    knob.position.set(x, CARCASS_H - 0.08, D / 2 + 0.01);
    knob.rotation.x = Math.PI / 2;
    root.add(knob);
  });

  // Oven door: a lighter panel with a handle, on the front.
  const door = new Mesh(new BoxGeometry(W * 0.62, 0.34, 0.03), createGlossyPaintMaterial('kit_playKitchenDoorMat', new Color(0.9, 0.87, 0.8)));
  door.name = 'kit_playKitchenDoor';
  door.position.set(0, 0.32, D / 2 + 0.015);
  root.add(door);
  const doorHandle = new Mesh(new CylinderGeometry(0.016, 0.016, W * 0.5, 8), wood);
  doorHandle.rotation.z = Math.PI / 2;
  doorHandle.position.set(0, 0.46, D / 2 + 0.05);
  root.add(doorHandle);

  // Stubby feet, so it sits on the floor rather than in it.
  [-1, 1].forEach((side) => {
    [-1, 1].forEach((depth) => {
      const foot = new Mesh(new BoxGeometry(0.07, 0.06, 0.07), wood);
      foot.position.set(side * (W / 2 - 0.08), 0.03, depth * (D / 2 - 0.08));
      root.add(foot);
    });
  });
}

/**
 * A laundry basket with cloths folded over the rim.
 *
 * @param scene - Scene that receives the basket.
 */
function addLaundryBasket(scene: Scene): void {
  const root = new Group();
  root.name = 'kit_laundryBasket';
  root.position.set(LAUNDRY_BASKET_X, 0, LAUNDRY_BASKET_Z);
  root.rotation.y = -0.3;
  scene.add(root);

  const weave = createFeltMaterial('kit_laundryBasketMat', new Color(0.83, 0.76, 0.62));
  const basket = new Mesh(new CylinderGeometry(0.3, 0.24, 0.46, 20, 1, true), weave);
  basket.name = 'kit_laundryBasketBody';
  basket.position.y = 0.23;
  basket.castShadow = true;
  basket.receiveShadow = true;
  root.add(basket);
  const base = new Mesh(new CylinderGeometry(0.24, 0.24, 0.03, 20), weave);
  base.position.y = 0.015;
  root.add(base);
  const rim = new Mesh(new TorusGeometry(0.3, 0.025, 8, 22), createWoodMaterial('kit_laundryRimMat', new Color(0.72, 0.58, 0.38)));
  rim.name = 'kit_laundryBasketRim';
  rim.position.y = 0.46;
  rim.rotation.x = Math.PI / 2;
  root.add(rim);

  // Cloths spilling over the edge — the bit that makes it read as full.
  const cloths = [
    { colour: new Color(0.9, 0.62, 0.55), x: 0.18, z: 0.1, rot: 0.6 },
    { colour: new Color(0.6, 0.74, 0.86), x: -0.14, z: -0.13, rot: -0.4 },
    { colour: new Color(0.95, 0.9, 0.78), x: 0.02, z: -0.2, rot: 0.2 },
  ];
  cloths.forEach((cloth, index) => {
    const mesh = new Mesh(new SphereGeometry(0.15, 12, 8), createFeltMaterial(`kit_laundryCloth${index}Mat`, cloth.colour));
    mesh.name = `kit_laundryCloth${index}`;
    mesh.scale.set(1, 0.5, 0.8);
    mesh.position.set(cloth.x, 0.5, cloth.z);
    mesh.rotation.y = cloth.rot;
    mesh.castShadow = true;
    root.add(mesh);
  });
}

/**
 * Woven rag runner, striped along its length.
 *
 * @param scene - Scene that receives the runner and its stripes.
 */
function addRunner(scene: Scene): void {
  const width = FRONT_RUNNER_HALF_WIDTH * 2;
  const depth = FRONT_RUNNER_HALF_DEPTH * 2;
  const thickness = 0.04;

  // Deeper than the boards it lies on. At (0.74, 0.66, 0.55) it read as a patch
  // of lighter floor rather than as a rug — same value, same hue family, and the
  // stripes on top of it were pastel on pastel.
  const runner = new Mesh(new BoxGeometry(width, thickness, depth), createFeltMaterial('kitchen_frontRunnerMat', new Color(0.55, 0.5, 0.44)));
  runner.name = 'kitchen_frontRunner';
  runner.position.set(FRONT_RUNNER_X, thickness / 2, FRONT_RUNNER_Z);
  runner.receiveShadow = true;
  scene.add(runner);

  // Stripes across the short axis, so they read as woven rather than printed.
  const stripeColours = [new Color(0.82, 0.42, 0.32), new Color(0.36, 0.55, 0.5), new Color(0.92, 0.84, 0.66)];
  const count = 7;
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    const stripe = new Mesh(
      new BoxGeometry(width * 0.94, 0.006, depth / count / 2.4),
      createFeltMaterial(`kitchen_frontRunnerStripe${i}Mat`, stripeColours[i % stripeColours.length]),
    );
    stripe.name = `kitchen_frontRunnerStripe${i}`;
    stripe.position.set(FRONT_RUNNER_X, thickness + 0.003, FRONT_RUNNER_Z - FRONT_RUNNER_HALF_DEPTH + depth * t);
    scene.add(stripe);
  }
}

/**
 * A child's two-step stool: the thing that makes a kitchen reachable.
 *
 * @param scene - Scene that receives the stool.
 */
function addStepStool(scene: Scene): void {
  const root = new Group();
  root.name = 'kit_stepStool';
  root.position.set(STEP_STOOL_X, 0, STEP_STOOL_Z);
  root.rotation.y = 0.35;
  scene.add(root);

  const wood = createWoodMaterial('kit_stepStoolMat', new Color(0.86, 0.72, 0.5));
  const trim = createGlossyPaintMaterial('kit_stepStoolTrimMat', new Color(0.53, 0.7, 0.66));

  const steps = [
    { y: 0.2, z: -0.12, w: 0.56, d: 0.24 },
    { y: 0.4, z: 0.11, w: 0.56, d: 0.24 },
  ];
  steps.forEach((step, index) => {
    const tread = new Mesh(new BoxGeometry(step.w, 0.05, step.d), wood);
    tread.name = `kit_stepStoolTread${index}`;
    tread.position.set(0, step.y, step.z);
    tread.castShadow = true;
    tread.receiveShadow = true;
    root.add(tread);
    // A painted lip on the front edge of each tread.
    const lip = new Mesh(new BoxGeometry(step.w, 0.03, 0.03), trim);
    lip.position.set(0, step.y - 0.01, step.z - step.d / 2);
    root.add(lip);
  });

  // Two side panels rather than four legs — simpler and it reads sturdier.
  [-1, 1].forEach((side) => {
    const panel = new Mesh(new BoxGeometry(0.045, 0.4, 0.5), wood);
    panel.name = `kit_stepStoolPanel${side > 0 ? 'L' : 'R'}`;
    panel.position.set(side * 0.26, 0.2, 0);
    panel.castShadow = true;
    root.add(panel);
  });
}

/**
 * A shopping basket set down mid-unpack, play food spilling over the rim.
 *
 * @param scene - Scene that receives the basket and its groceries.
 */
function addShoppingBasket(scene: Scene): void {
  const root = new Group();
  root.name = 'kit_shopBasket';
  root.position.set(SHOP_BASKET_X, 0, SHOP_BASKET_Z);
  root.rotation.y = -0.4;
  scene.add(root);

  const weave = createFeltMaterial('kit_shopBasketMat', new Color(0.78, 0.62, 0.38));
  // An open box: four walls and a base, so the food inside is actually visible.
  const w = 0.44;
  const d = 0.32;
  const h = 0.26;
  const base = new Mesh(new BoxGeometry(w, 0.03, d), weave);
  base.position.y = 0.015;
  base.receiveShadow = true;
  root.add(base);
  const walls = [
    { x: 0, z: d / 2, sx: w, sz: 0.03 },
    { x: 0, z: -d / 2, sx: w, sz: 0.03 },
    { x: w / 2, z: 0, sx: 0.03, sz: d },
    { x: -w / 2, z: 0, sx: 0.03, sz: d },
  ];
  walls.forEach((wall, index) => {
    const panel = new Mesh(new BoxGeometry(wall.sx, h, wall.sz), weave);
    panel.name = `kit_shopBasketWall${index}`;
    panel.position.set(wall.x, h / 2, wall.z);
    panel.castShadow = true;
    root.add(panel);
  });
  const handle = new Mesh(new TorusGeometry(0.15, 0.018, 8, 16, Math.PI), createWoodMaterial('kit_shopBasketHandleMat', new Color(0.6, 0.44, 0.28)));
  handle.name = 'kit_shopBasketHandle';
  handle.position.y = h;
  handle.rotation.y = Math.PI / 2;
  root.add(handle);

  // Groceries, sitting proud of the rim so the basket reads as full.
  const goods = [
    { name: 'Carrot', colour: new Color(0.93, 0.55, 0.2), r: 0.055, x: -0.1, z: 0.05, y: 0.24 },
    { name: 'Milk', colour: new Color(0.95, 0.95, 0.93), r: 0.06, x: 0.09, z: -0.04, y: 0.27 },
    { name: 'Melon', colour: new Color(0.5, 0.72, 0.36), r: 0.075, x: 0.02, z: 0.08, y: 0.25 },
  ];
  goods.forEach((item) => {
    const mesh = new Mesh(new SphereGeometry(item.r, 12, 10), createGlossyPaintMaterial(`kit_shopBasket${item.name}Mat`, item.colour));
    mesh.name = `kit_shopBasket${item.name}`;
    mesh.position.set(item.x, item.y, item.z);
    mesh.castShadow = true;
    root.add(mesh);
  });
}

/**
 * Nesting mixing bowls, with the smallest tipped out beside the stack.
 *
 * @param scene - Scene that receives the bowls and the spoon.
 */
function addMixingBowls(scene: Scene): void {
  const root = new Group();
  root.name = 'kit_mixingBowls';
  root.position.set(MIXING_BOWLS_X, 0, MIXING_BOWLS_Z);
  root.rotation.y = 0.7;
  scene.add(root);

  const sizes = [
    { r: 0.2, h: 0.14, colour: new Color(0.85, 0.45, 0.38) },
    { r: 0.155, h: 0.12, colour: new Color(0.95, 0.82, 0.5) },
  ];
  let y = 0;
  sizes.forEach((size, index) => {
    const bowl = new Mesh(new CylinderGeometry(size.r, size.r * 0.66, size.h, 18), createGlossyPaintMaterial(`kit_mixingBowl${index}Mat`, size.colour));
    bowl.name = `kit_mixingBowl${index}`;
    bowl.position.y = y + size.h / 2;
    bowl.castShadow = true;
    bowl.receiveShadow = true;
    root.add(bowl);
    y += size.h * 0.72;
  });

  // The third one is on its side on the floor, which is what makes the group
  // read as a child's doing rather than a shelf display.
  const tipped = new Mesh(new CylinderGeometry(0.13, 0.086, 0.1, 18), createGlossyPaintMaterial('kit_mixingBowlTippedMat', new Color(0.5, 0.68, 0.72)));
  tipped.name = 'kit_mixingBowlTipped';
  tipped.position.set(0.34, 0.13, -0.06);
  tipped.rotation.z = Math.PI / 2;
  tipped.rotation.y = 0.4;
  tipped.castShadow = true;
  root.add(tipped);

  const spoon = new Mesh(new CylinderGeometry(0.014, 0.014, 0.3, 8), createWoodMaterial('kit_mixingSpoonMat', new Color(0.84, 0.68, 0.44)));
  spoon.name = 'kit_mixingSpoon';
  spoon.position.set(-0.26, 0.015, 0.16);
  spoon.rotation.z = Math.PI / 2;
  spoon.rotation.y = -0.5;
  root.add(spoon);
}

/**
 * A mat with two bowls on it, out where only a wide frame reaches.
 *
 * @param scene - Scene that receives the mat and bowls.
 */
function addPetCorner(scene: Scene): void {
  const root = new Group();
  root.name = 'kit_petCorner';
  root.position.set(PET_CORNER_X, 0, PET_CORNER_Z);
  root.rotation.y = -0.25;
  scene.add(root);

  const mat = new Mesh(new BoxGeometry(0.62, 0.02, 0.4), createFeltMaterial('kit_petMatMat', new Color(0.6, 0.68, 0.72)));
  mat.name = 'kit_petMat';
  mat.position.y = 0.01;
  mat.receiveShadow = true;
  root.add(mat);

  const bowls = [
    { name: 'Water', colour: new Color(0.55, 0.74, 0.86), x: -0.15 },
    { name: 'Food', colour: new Color(0.9, 0.6, 0.35), x: 0.15 },
  ];
  bowls.forEach((item) => {
    const bowl = new Mesh(new CylinderGeometry(0.11, 0.085, 0.07, 16), createPlasticMaterial(`kit_petBowl${item.name}Mat`, item.colour));
    bowl.name = `kit_petBowl${item.name}`;
    bowl.position.set(item.x, 0.055, 0);
    bowl.castShadow = true;
    root.add(bowl);
  });
}

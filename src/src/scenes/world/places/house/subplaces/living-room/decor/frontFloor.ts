import { BoxGeometry, Color, CylinderGeometry, Group, Mesh, SphereGeometry, TorusGeometry, type Scene } from 'three';
import { createFeltMaterial, createGlossyPaintMaterial, createWoodMaterial } from '@app/utils/materialFactory';
import { BLOCK_BASKET_X, BLOCK_BASKET_Z, FLOOR_BALL_X, FLOOR_BALL_Z, FLOOR_BOOKS_X, FLOOR_BOOKS_Z, FLOOR_CUSHION_X, FLOOR_CUSHION_Z } from '../layout';

/**
 * Dresses the Living Room's front floor — the band the camera looks across
 * before it reaches anything.
 *
 * WHY IT EXISTS. The Living Room now opens rotated toward one of its toyboxes on
 * a portrait phone, so a child meets the tap halo without first having to know
 * that the room turns (`utils/scene/openingTurn.ts`). At the narrowest shipping
 * aspect the smallest turn that shows a halo left 46.6% of the frame on bare
 * boards against a 46.0% bound. The full reasoning, the rejected alternative and
 * the measured empty squares live in the "front floor" section of `layout.ts`,
 * which owns every position here.
 *
 * THE KITCHEN'S LESSON IS TAKEN AS READ AND NOT RE-LEARNED. `kitchen/decor/
 * frontFloor.ts` found that small objects barely move a bare-floor number — a
 * band of near floor is square metres and a bowl is a third of a metre — and that
 * a floor covering is what moves it. This room already HAS its covering: the rug
 * is 10.4% to 18.5% of the opening frame depending on the angle, and enlarging it
 * would be the cheap answer to a bound that is about emptiness rather than about
 * carpet. Four objects is the small, honest amount: the gap is six rays, not sixty.
 *
 * NOTHING HERE IS TAPPABLE, deliberately, exactly as in the Kitchen. This is set
 * dressing; the room's tappable inventory is pinned by
 * `room-opening-framing.test.mjs` and a fifth thing answering a finger two steps
 * in front of a toybox would compete with it.
 *
 * NOT ONE NAME HERE CONTAINS THE WORD "floor", AND THAT IS LOAD-BEARING. The
 * composition guard in `room-opening-framing.test.mjs` buckets a ray by the name
 * of the nearest named ancestor it hits, and its floor test is
 * `name.includes('floor')`. The first version of this file called its pieces
 * `livingRoom_floorCushion`, `livingRoom_floorBooks` and `livingRoom_floorBall`
 * — so three of the four objects added to fix a BARE FLOOR number were counted
 * as bare floor. The measurement still improved, because the fourth piece is
 * called `blockBasket`, which is the kind of partial result that reads as
 * success.
 *
 * The same trap has a live occupant elsewhere in this room: `livingRoom_floorLamp`
 * has been counted as floorboards since the classifier was written. That is not
 * fixed here on purpose. The honest fix is in the classifier — surface buckets
 * should match a name's own segment, not any substring of it — and it would move
 * the pinned composition numbers for all three rooms, and with them the solved
 * opening-turn schedule. Bundling that into this change would make neither
 * reviewable. It is recorded here and in the classifier's own comment instead.
 *
 * NOTHING HERE IS TALL AND THIN, also deliberately. Anything named and taller
 * than 0.12 becomes a surface the owl can be sent to, and a perch is modelled as
 * its bounding BOX — which is why the Kitchen has no broom. Every piece below is
 * boxy or squat enough that its bounding box is roughly its own top surface.
 *
 * @param scene - The Living Room scene to add the front-floor dressing to.
 */
export function createLivingRoomFrontFloor(scene: Scene): void {
  addFloorCushion(scene);
  addPictureBooks(scene);
  addBlockBasket(scene);
  addFloorBall(scene);
}

/**
 * A squashed round floor cushion, the biggest single piece of cover.
 *
 * @param scene - Scene that receives the cushion.
 */
function addFloorCushion(scene: Scene): void {
  const root = new Group();
  root.name = 'livingRoom_sitCushion';
  root.position.set(FLOOR_CUSHION_X, 0, FLOOR_CUSHION_Z);
  root.rotation.y = 0.4;
  scene.add(root);

  // Dusty rose, picked up from the rug rather than from the couch: the couch is
  // teal and the far wall is warm beige, so a third hue in the foreground would
  // read as a stray object instead of as part of the room.
  const fabric = createFeltMaterial('livingRoom_sitCushionMat', new Color(0.85, 0.66, 0.66));
  const piping = createFeltMaterial('livingRoom_sitCushionPipingMat', new Color(0.94, 0.9, 0.86));

  const pad = new Mesh(new CylinderGeometry(0.44, 0.46, 0.16, 20), fabric);
  pad.name = 'livingRoom_sitCushionPad';
  pad.position.y = 0.08;
  pad.castShadow = true;
  pad.receiveShadow = true;
  root.add(pad);

  const trim = new Mesh(new TorusGeometry(0.45, 0.026, 8, 24), piping);
  trim.name = 'livingRoom_sitCushionTrim';
  trim.rotation.x = Math.PI / 2;
  trim.position.y = 0.08;
  root.add(trim);

  const button = new Mesh(new SphereGeometry(0.05, 10, 8), piping);
  button.name = 'livingRoom_sitCushionButton';
  button.scale.y = 0.5;
  button.position.y = 0.16;
  root.add(button);
}

/**
 * Three picture books in a slew, the way they get left.
 *
 * @param scene - Scene that receives the books.
 */
function addPictureBooks(scene: Scene): void {
  const root = new Group();
  root.name = 'livingRoom_bookSlew';
  root.position.set(FLOOR_BOOKS_X, 0, FLOOR_BOOKS_Z);
  root.rotation.y = -0.35;
  scene.add(root);

  const covers = [new Color(0.55, 0.72, 0.62), new Color(0.92, 0.75, 0.42), new Color(0.72, 0.6, 0.82)];
  const pages = createFeltMaterial('livingRoom_bookSlewBookPagesMat', new Color(0.96, 0.94, 0.88));

  covers.forEach((colour, i) => {
    const book = new Group();
    book.name = `livingRoom_bookSlewBook${i}`;
    book.position.set(i * 0.07 - 0.07, i * 0.055, i * 0.05 - 0.05);
    book.rotation.y = (i - 1) * 0.28;
    root.add(book);

    const cover = new Mesh(new BoxGeometry(0.4, 0.045, 0.3), createGlossyPaintMaterial(`livingRoom_bookSlewBookCoverMat${i}`, colour));
    cover.name = `livingRoom_bookSlewBookCover${i}`;
    cover.position.y = 0.025;
    cover.castShadow = true;
    cover.receiveShadow = true;
    book.add(cover);

    const leaf = new Mesh(new BoxGeometry(0.37, 0.02, 0.275), pages);
    leaf.name = `livingRoom_bookSlewBookPages${i}`;
    leaf.position.y = 0.048;
    book.add(leaf);
  });
}

/**
 * A shallow basket with wooden blocks spilling over the rim.
 *
 * @param scene - Scene that receives the basket.
 */
function addBlockBasket(scene: Scene): void {
  const root = new Group();
  root.name = 'livingRoom_blockBasket';
  root.position.set(BLOCK_BASKET_X, 0, BLOCK_BASKET_Z);
  root.rotation.y = 0.55;
  scene.add(root);

  const wicker = createWoodMaterial('livingRoom_blockBasketMat', new Color(0.82, 0.68, 0.45));

  const bowl = new Mesh(new CylinderGeometry(0.3, 0.24, 0.26, 16, 1, true), wicker);
  bowl.name = 'livingRoom_blockBasketBowl';
  bowl.position.y = 0.13;
  bowl.castShadow = true;
  bowl.receiveShadow = true;
  root.add(bowl);

  const base = new Mesh(new CylinderGeometry(0.24, 0.24, 0.03, 16), wicker);
  base.name = 'livingRoom_blockBasketBase';
  base.position.y = 0.015;
  root.add(base);

  const rim = new Mesh(new TorusGeometry(0.3, 0.026, 8, 20), wicker);
  rim.name = 'livingRoom_blockBasketRim';
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.26;
  root.add(rim);

  const blockColours = [new Color(0.9, 0.55, 0.45), new Color(0.5, 0.72, 0.8), new Color(0.94, 0.82, 0.45), new Color(0.62, 0.78, 0.55)];
  blockColours.forEach((colour, i) => {
    const block = new Mesh(new BoxGeometry(0.12, 0.12, 0.12), createGlossyPaintMaterial(`livingRoom_blockMat${i}`, colour));
    block.name = `livingRoom_block${i}`;
    // Two inside the basket and two tipped out beside it, so the basket reads as
    // in use rather than as tidied away.
    const inside = i < 2;
    block.position.set(inside ? (i - 0.5) * 0.14 : (i - 2.5) * 0.34, inside ? 0.2 : 0.06, inside ? 0.04 : 0.34);
    block.rotation.set(0, i * 0.6, inside ? 0 : 0.18);
    block.castShadow = true;
    root.add(block);
  });
}

/**
 * A soft ball, come to rest short of the cushion.
 *
 * @param scene - Scene that receives the ball.
 */
function addFloorBall(scene: Scene): void {
  const root = new Group();
  root.name = 'livingRoom_playBall';
  root.position.set(FLOOR_BALL_X, 0, FLOOR_BALL_Z);
  scene.add(root);

  const ball = new Mesh(new SphereGeometry(0.17, 16, 12), createFeltMaterial('livingRoom_playBallMat', new Color(0.95, 0.78, 0.4)));
  ball.name = 'livingRoom_playBallBody';
  ball.position.y = 0.17;
  ball.castShadow = true;
  ball.receiveShadow = true;
  root.add(ball);

  const stripe = new Mesh(new TorusGeometry(0.168, 0.022, 8, 24), createFeltMaterial('livingRoom_playBallStripeMat', new Color(0.8, 0.45, 0.45)));
  stripe.name = 'livingRoom_playBallStripe';
  stripe.position.y = 0.17;
  stripe.rotation.set(Math.PI / 2, 0, 0.5);
  root.add(stripe);
}

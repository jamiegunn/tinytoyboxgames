import gsap from 'gsap';
import { BoxGeometry, Color, CylinderGeometry, Group, Mesh, PlaneGeometry, TorusGeometry, Vector3, type Scene } from 'three';
import { triggerSound } from '@app/assets/audio/sceneBridge';
import { createGlossyPaintMaterial, createPaperMaterial, createToyMetalMaterial, createWoodMaterial } from '@app/utils/materialFactory';
import { getParticleEngine } from '@app/utils/particles/registry';
import { PARTICLES } from '@app/utils/particles/presets';
import { createTapInteraction } from '@app/utils/tapInteraction';
import type { WorldTapDispatcher } from '@app/utils/worldTapDispatcher';
import { MENU_BOARD_Y, MENU_BOARD_Z, PLATE_RACK_Y, PLATE_RACK_Z, RIGHT_WALL_FACE_X } from '../layout';

/**
 * Right-wall dressing: a plate rack and a chalk menu board.
 *
 * This wall was the emptiest measured surface in the house — 97.7% flat tiles
 * above the furniture line, which is to say bare plaster occupying roughly a
 * quarter of the frame on its own. The reference for what fills it is not a
 * guess: the Playroom's left wall, under the identical camera preset, reads
 * 32.3% because it carries a large pinned corkboard and a window. What moved
 * that number was BROAD, HIGH-CONTRAST, RECTILINEAR content at wall scale, not
 * a scatter of small objects, so that is what this file builds.
 *
 * Both pieces sit above y = 2.2. Below that line the wall is behind the floor
 * toys and reads as background; above it, it is what the camera shows.
 */

/** Plank length along Z, and the gap between the two planks. */
const RACK_LENGTH = 3.4;
const RACK_GAP = 0.86;
const PLANK_THICKNESS = 0.07;
const PLANK_DEPTH = 0.34;

/** One upright plate standing on a plank: offset along Z, radius, colour. */
interface PlateSpec {
  z: number;
  radius: number;
  color: Color;
}

const UPPER_PLATES: PlateSpec[] = [
  { z: -1.18, radius: 0.36, color: new Color(0.94, 0.94, 0.9) },
  { z: -0.36, radius: 0.32, color: new Color(0.82, 0.5, 0.42) },
  { z: 0.44, radius: 0.36, color: new Color(0.94, 0.94, 0.9) },
  { z: 1.22, radius: 0.3, color: new Color(0.56, 0.68, 0.6) },
];

const LOWER_PLATES: PlateSpec[] = [
  { z: -1.24, radius: 0.31, color: new Color(0.55, 0.67, 0.78) },
  { z: -0.5, radius: 0.35, color: new Color(0.94, 0.94, 0.9) },
  { z: 0.9, radius: 0.33, color: new Color(0.95, 0.83, 0.5) },
];

/** Mugs hanging from hooks under the lower plank. */
const MUGS: { z: number; color: Color }[] = [
  { z: 0.06, color: new Color(0.85, 0.45, 0.38) },
  { z: 0.62, color: new Color(0.55, 0.66, 0.58) },
  { z: 1.24, color: new Color(0.95, 0.82, 0.5) },
];

/**
 * Builds one rack plank with a retaining rail and its row of standing plates.
 *
 * @param parent - Group that receives the plank, rail and plates.
 * @param woodMat - Shared wood material for plank and rail.
 * @param y - Plank centre height in the parent's local space.
 * @param plates - Plates standing on this plank.
 * @param index - Plank index, used for mesh naming.
 */
function createRackPlank(parent: Group, woodMat: ReturnType<typeof createWoodMaterial>, y: number, plates: PlateSpec[], index: number): void {
  const plank = new Mesh(new BoxGeometry(PLANK_DEPTH, PLANK_THICKNESS, RACK_LENGTH), woodMat);
  plank.name = `plateRackPlank${index}`;
  plank.position.set(PLANK_DEPTH / 2, y, 0);
  plank.castShadow = true;
  parent.add(plank);

  // Retaining rail along the front lip, which is what stops the plates reading
  // as discs floating against the wall.
  const rail = new Mesh(new CylinderGeometry(0.022, 0.022, RACK_LENGTH, 8), woodMat);
  rail.name = `plateRackRail${index}`;
  rail.position.set(PLANK_DEPTH - 0.04, y + 0.16, 0);
  rail.rotation.x = Math.PI / 2;
  parent.add(rail);

  plates.forEach((spec, plateIndex) => {
    const plate = new Mesh(
      new CylinderGeometry(spec.radius, spec.radius, 0.035, 20),
      createGlossyPaintMaterial(`kitchen_plate${index}_${plateIndex}Mat`, spec.color),
    );
    plate.name = `plateRackPlate${index}_${plateIndex}`;
    // Standing on edge, leaning back against the wall.
    plate.position.set(0.13, y + PLANK_THICKNESS / 2 + spec.radius - 0.02, spec.z);
    plate.rotation.z = Math.PI / 2;
    plate.rotation.y = 0.09;
    plate.castShadow = true;
    parent.add(plate);
  });
}

/**
 * Creates the right-wall plate rack — two wooden planks of upright crockery
 * with three enamel mugs on hooks beneath — and the framed chalk menu board
 * forward of it. Tapping a mug sets it swinging with a soft clink and a
 * sparkle; the board is set dressing and stays quiet.
 *
 * @param scene - The Three.js scene that receives the groups.
 * @param dispatcher - Shared tap dispatcher owned by the room runtime.
 * @returns Cleanup that unregisters the mug taps and kills their tweens.
 */
export function createPlateRack(scene: Scene, dispatcher: WorldTapDispatcher): () => void {
  const root = new Group();
  root.name = 'kitchen_plateRack';
  // Inward is +X from the right wall face.
  root.position.set(RIGHT_WALL_FACE_X, PLATE_RACK_Y, PLATE_RACK_Z);
  scene.add(root);

  const woodMat = createWoodMaterial('kitchen_plateRackMat', new Color(0.72, 0.55, 0.36));
  createRackPlank(root, woodMat, RACK_GAP, UPPER_PLATES, 0);
  createRackPlank(root, woodMat, 0, LOWER_PLATES, 1);

  // Side uprights tying the two planks together.
  const uprightMat = createWoodMaterial('kitchen_plateRackUprightMat', new Color(0.66, 0.49, 0.31));
  [-1, 1].forEach((side, index) => {
    const upright = new Mesh(new BoxGeometry(PLANK_DEPTH, RACK_GAP + 0.5, 0.09), uprightMat);
    upright.name = `plateRackUpright${index}`;
    upright.position.set(PLANK_DEPTH / 2, RACK_GAP / 2 - 0.05, side * (RACK_LENGTH / 2 - 0.045));
    root.add(upright);
  });

  const hookMat = createToyMetalMaterial('kitchen_mugHookMat', new Color(0.6, 0.56, 0.5));
  const cleanups: (() => void)[] = [];

  MUGS.forEach((spec, index) => {
    const pivot = new Group();
    pivot.name = `mugPivot${index}`;
    pivot.position.set(0.14, -PLANK_THICKNESS / 2 - 0.02, spec.z);
    root.add(pivot);

    const hook = new Mesh(new TorusGeometry(0.045, 0.012, 6, 12, Math.PI * 1.4), hookMat);
    hook.name = `mugHook${index}`;
    hook.position.set(0, -0.035, 0);
    hook.rotation.y = Math.PI / 2;
    pivot.add(hook);

    const mug = new Mesh(new CylinderGeometry(0.11, 0.095, 0.2, 14), createGlossyPaintMaterial(`kitchen_mug${index}Mat`, spec.color));
    mug.name = `mug${index}`;
    mug.position.set(0, -0.17, 0);
    mug.castShadow = true;
    pivot.add(mug);

    const handle = new Mesh(new TorusGeometry(0.06, 0.017, 6, 12, Math.PI * 1.1), createGlossyPaintMaterial(`kitchen_mugHandle${index}Mat`, spec.color));
    handle.name = `mugHandle${index}`;
    handle.position.set(0, -0.17, -0.11);
    handle.rotation.y = Math.PI / 2;
    pivot.add(handle);

    cleanups.push(
      createTapInteraction(dispatcher, mug, () => {
        triggerSound('sfx_hub_toybox_tap');
        getParticleEngine(scene).emit(PARTICLES.sceneSparkle, mug.getWorldPosition(new Vector3()).add(new Vector3(0, 0.12, 0)));

        gsap.killTweensOf(pivot.rotation);
        pivot.rotation.x = 0;
        gsap.fromTo(pivot.rotation, { x: 0.34 }, { x: 0, duration: 1.1, ease: 'elastic.out(1, 0.28)' });
      }),
    );
  });

  createMenuBoard(scene);

  return () => {
    cleanups.forEach((cleanup) => cleanup());
    MUGS.forEach((_, index) => {
      const pivot = root.getObjectByName(`mugPivot${index}`);
      if (pivot) {
        gsap.killTweensOf(pivot.rotation);
      }
    });
  };
}

/** Menu board panel size along Z and Y. */
const BOARD_SPAN_Z = 1.5;
const BOARD_SPAN_Y = 1.9;

/**
 * Creates the framed chalk menu board forward of the plate rack: a dark slate
 * panel in a painted frame with a few chalk strokes on it. Broad and dark
 * against pale plaster, which is the contrast the measurement says this wall
 * was missing.
 *
 * @param scene - The Three.js scene that receives the board group.
 */
function createMenuBoard(scene: Scene): void {
  const root = new Group();
  root.name = 'kitchen_menuBoard';
  root.position.set(RIGHT_WALL_FACE_X, MENU_BOARD_Y, MENU_BOARD_Z);
  root.rotation.y = Math.PI / 2;
  scene.add(root);

  const slate = new Mesh(new PlaneGeometry(BOARD_SPAN_Z, BOARD_SPAN_Y), createGlossyPaintMaterial('kitchen_menuSlateMat', new Color(0.16, 0.22, 0.19)));
  slate.name = 'menuSlate';
  slate.position.set(0, 0, 0.035);
  root.add(slate);

  const frameMat = createWoodMaterial('kitchen_menuFrameMat', new Color(0.78, 0.6, 0.38));
  const frameThick = 0.13;

  [BOARD_SPAN_Y / 2, -BOARD_SPAN_Y / 2].forEach((yOff, index) => {
    const bar = new Mesh(new BoxGeometry(BOARD_SPAN_Z + frameThick * 2, frameThick, 0.075), frameMat);
    bar.name = `menuFrame${index === 0 ? 'Top' : 'Bot'}`;
    bar.position.set(0, yOff, 0.02);
    root.add(bar);
  });
  [BOARD_SPAN_Z / 2, -BOARD_SPAN_Z / 2].forEach((zOff, index) => {
    const bar = new Mesh(new BoxGeometry(frameThick, BOARD_SPAN_Y + frameThick * 2, 0.075), frameMat);
    bar.name = `menuFrameSide${index}`;
    bar.position.set(zOff, 0, 0.02);
    root.add(bar);
  });

  // Chalk strokes: short pale bars, uneven lengths, like a list in a child's
  // hand. They matter more than they look — a flat dark rectangle is still a
  // flat rectangle, and flatness is the thing being fixed.
  const chalkMat = createPaperMaterial('kitchen_menuChalkMat', new Color(0.92, 0.93, 0.88));
  const strokes = [
    { y: 0.62, w: 1.06 },
    { y: 0.32, w: 0.72 },
    { y: 0.04, w: 0.94 },
    { y: -0.26, w: 0.58 },
    { y: -0.56, w: 0.84 },
  ];
  strokes.forEach((stroke, index) => {
    const bar = new Mesh(new BoxGeometry(stroke.w, 0.055, 0.012), chalkMat);
    bar.name = `menuChalk${index}`;
    bar.position.set(-(BOARD_SPAN_Z / 2 - stroke.w / 2 - 0.14), stroke.y, 0.05);
    root.add(bar);
  });
}

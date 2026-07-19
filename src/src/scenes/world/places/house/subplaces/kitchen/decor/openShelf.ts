import { BoxGeometry, Color, CylinderGeometry, Group, Mesh, TorusGeometry, type Scene } from 'three';
import { createGlossyPaintMaterial, createTranslucentMaterial, createWoodMaterial } from '@app/utils/materialFactory';
import { BACK_WALL_FACE_Z, SHELF_X, SHELF_Y } from '../layout';

/** Shelf plank dimensions. */
const SHELF_WIDTH = 2.3;
const SHELF_DEPTH = 0.32;
const SHELF_THICKNESS = 0.06;

/** Vertical gap between the two planks. */
const SHELF_GAP = 0.72;

/**
 * Creates one wooden shelf plank with two small support brackets.
 *
 * @param parent - Group that receives the plank meshes.
 * @param plankMat - Shared wood material for the plank and brackets.
 * @param y - Plank center height in the parent's local space.
 * @param index - Plank index used for mesh naming.
 */
function createPlank(parent: Group, plankMat: ReturnType<typeof createWoodMaterial>, y: number, index: number): void {
  const plank = new Mesh(new BoxGeometry(SHELF_WIDTH, SHELF_THICKNESS, SHELF_DEPTH), plankMat);
  plank.name = `shelfPlank${index}`;
  plank.position.set(0, y, 0);
  plank.castShadow = true;
  parent.add(plank);

  [-1, 1].forEach((side, bracketIndex) => {
    const bracket = new Mesh(new BoxGeometry(0.06, 0.16, SHELF_DEPTH - 0.06), plankMat);
    bracket.name = `shelfBracket${index}_${bracketIndex}`;
    bracket.position.set(side * (SHELF_WIDTH / 2 - 0.25), y - SHELF_THICKNESS / 2 - 0.08, 0.02);
    parent.add(bracket);
  });
}

/**
 * Creates the open crockery shelves on the back wall above the counter: two
 * wooden planks holding a row of pastel cups with little handles and a pair
 * of lidded storage jars. Quiet set dressing echoing the Playroom's bookshelf
 * clutter at kitchen scale.
 *
 * @param scene - The Three.js scene that receives the shelf group.
 */
export function createOpenShelf(scene: Scene): void {
  const root = new Group();
  root.name = 'kitchen_openShelf';
  root.position.set(SHELF_X, SHELF_Y, BACK_WALL_FACE_Z - SHELF_DEPTH / 2 - 0.02);
  scene.add(root);

  const plankMat = createWoodMaterial('kitchen_shelfPlankMat', new Color(0.68, 0.52, 0.34));
  createPlank(root, plankMat, 0, 0);
  createPlank(root, plankMat, SHELF_GAP, 1);

  // Lower plank: three pastel cups with handles.
  const cupColors = [new Color(0.9, 0.62, 0.55), new Color(0.62, 0.74, 0.62), new Color(0.6, 0.7, 0.85)];
  cupColors.forEach((color, index) => {
    const cupMat = createGlossyPaintMaterial(`kitchen_shelfCupMat${index}`, color);
    const cup = new Mesh(new CylinderGeometry(0.09, 0.075, 0.16, 12), cupMat);
    cup.name = `shelfCup${index}`;
    cup.position.set(-0.7 + index * 0.55, SHELF_THICKNESS / 2 + 0.08, -0.02);
    cup.castShadow = true;
    root.add(cup);

    const handle = new Mesh(new TorusGeometry(0.045, 0.014, 6, 12, Math.PI), cupMat);
    handle.name = `shelfCupHandle${index}`;
    handle.position.set(-0.7 + index * 0.55 - 0.09, SHELF_THICKNESS / 2 + 0.08, -0.02);
    handle.rotation.z = Math.PI / 2;
    root.add(handle);
  });

  // Lower plank: a small stack of bowls at the right end.
  const bowlMat = createGlossyPaintMaterial('kitchen_shelfBowlMat', new Color(0.95, 0.9, 0.8));
  [0, 1].forEach((index) => {
    const bowl = new Mesh(new CylinderGeometry(0.13 - index * 0.015, 0.08, 0.07, 14), bowlMat);
    bowl.name = `shelfBowl${index}`;
    bowl.position.set(0.85, SHELF_THICKNESS / 2 + 0.035 + index * 0.07, -0.02);
    root.add(bowl);
  });

  // Upper plank: two lidded jars and a tiny potted herb.
  const jarMat = createTranslucentMaterial('kitchen_shelfJarMat', new Color(0.85, 0.9, 0.86), 0.55);
  const lidMat = createWoodMaterial('kitchen_shelfJarLidMat', new Color(0.66, 0.5, 0.32));
  [
    { x: -0.6, radius: 0.1, height: 0.28 },
    { x: -0.25, radius: 0.085, height: 0.2 },
  ].forEach((spec, index) => {
    const jar = new Mesh(new CylinderGeometry(spec.radius, spec.radius, spec.height, 12), jarMat);
    jar.name = `shelfJar${index}`;
    jar.position.set(spec.x, SHELF_GAP + SHELF_THICKNESS / 2 + spec.height / 2, -0.02);
    root.add(jar);

    const lid = new Mesh(new CylinderGeometry(spec.radius + 0.015, spec.radius + 0.015, 0.04, 12), lidMat);
    lid.name = `shelfJarLid${index}`;
    lid.position.set(spec.x, SHELF_GAP + SHELF_THICKNESS / 2 + spec.height + 0.018, -0.02);
    root.add(lid);
  });

  const potMat = createGlossyPaintMaterial('kitchen_shelfHerbPotMat', new Color(0.82, 0.55, 0.42));
  const herbPot = new Mesh(new CylinderGeometry(0.09, 0.07, 0.14, 12), potMat);
  herbPot.name = 'shelfHerbPot';
  herbPot.position.set(0.6, SHELF_GAP + SHELF_THICKNESS / 2 + 0.07, -0.02);
  root.add(herbPot);

  const herbMat = createGlossyPaintMaterial('kitchen_shelfHerbMat', new Color(0.42, 0.64, 0.34));
  [
    { dx: 0, dy: 0.12, scale: 1 },
    { dx: -0.05, dy: 0.08, scale: 0.7 },
    { dx: 0.05, dy: 0.09, scale: 0.75 },
  ].forEach((spec, index) => {
    const leaf = new Mesh(new CylinderGeometry(0.05 * spec.scale, 0.05 * spec.scale, 0.06, 8), herbMat);
    leaf.name = `shelfHerbLeaf${index}`;
    leaf.position.set(0.6 + spec.dx, SHELF_GAP + SHELF_THICKNESS / 2 + 0.14 + spec.dy, -0.02);
    root.add(leaf);
  });
}

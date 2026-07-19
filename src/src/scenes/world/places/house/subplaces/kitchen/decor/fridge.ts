import { BoxGeometry, Color, CylinderGeometry, Group, Mesh, type Scene } from 'three';
import { createGlossyPaintMaterial, createPaperMaterial, createToyMetalMaterial } from '@app/utils/materialFactory';
import { BACK_WALL_FACE_Z, FRIDGE_X } from '../layout';

/** Fridge body dimensions. */
const BODY_WIDTH = 1.25;
const BODY_HEIGHT = 2.55;
const BODY_DEPTH = 0.9;

/**
 * Creates the tall mint fridge in the back-left corner: a rounded-feeling
 * two-door box with vertical handles, a freezer seam, and a little crayon
 * drawing pinned to the door. Quiet set dressing that gives the back wall a
 * tall silhouette to balance the window and shelves.
 *
 * @param scene - The Three.js scene that receives the fridge group.
 */
export function createFridge(scene: Scene): void {
  const root = new Group();
  root.name = 'kitchen_fridge';
  root.position.set(FRIDGE_X, 0, BACK_WALL_FACE_Z - BODY_DEPTH / 2);
  scene.add(root);

  const bodyMat = createGlossyPaintMaterial('kitchen_fridgeBodyMat', new Color(0.78, 0.87, 0.82));
  const seamMat = createGlossyPaintMaterial('kitchen_fridgeSeamMat', new Color(0.66, 0.76, 0.7));
  const handleMat = createToyMetalMaterial('kitchen_fridgeHandleMat', new Color(0.8, 0.7, 0.46));

  const body = new Mesh(new BoxGeometry(BODY_WIDTH, BODY_HEIGHT, BODY_DEPTH), bodyMat);
  body.name = 'fridgeBody';
  body.position.y = BODY_HEIGHT / 2 + 0.05;
  body.castShadow = true;
  body.receiveShadow = true;
  root.add(body);

  // Kick base.
  const base = new Mesh(new BoxGeometry(BODY_WIDTH - 0.15, 0.1, BODY_DEPTH - 0.15), seamMat);
  base.name = 'fridgeBase';
  base.position.y = 0.05;
  root.add(base);

  // Freezer seam line across the upper third.
  const seam = new Mesh(new BoxGeometry(BODY_WIDTH + 0.02, 0.05, 0.04), seamMat);
  seam.name = 'fridgeSeam';
  seam.position.set(0, BODY_HEIGHT * 0.72, -BODY_DEPTH / 2 - 0.01);
  root.add(seam);

  // Vertical door handles beside the seam.
  [
    { y: BODY_HEIGHT * 0.85, height: 0.35 },
    { y: BODY_HEIGHT * 0.5, height: 0.55 },
  ].forEach((spec, index) => {
    const handle = new Mesh(new CylinderGeometry(0.028, 0.028, spec.height, 8), handleMat);
    handle.name = `fridgeHandle${index}`;
    handle.position.set(-BODY_WIDTH / 2 + 0.16, spec.y, -BODY_DEPTH / 2 - 0.07);
    root.add(handle);
  });

  // A child's drawing pinned to the lower door.
  const drawing = new Mesh(new BoxGeometry(0.34, 0.42, 0.012), createPaperMaterial('kitchen_fridgeDrawingMat', new Color(0.97, 0.95, 0.88)));
  drawing.name = 'fridgeDrawing';
  drawing.position.set(0.15, BODY_HEIGHT * 0.45, -BODY_DEPTH / 2 - 0.02);
  drawing.rotation.z = -0.06;
  root.add(drawing);

  const doodle = new Mesh(new CylinderGeometry(0.07, 0.07, 0.012, 12), createGlossyPaintMaterial('kitchen_fridgeDoodleMat', new Color(0.95, 0.65, 0.3)));
  doodle.name = 'fridgeDoodle';
  doodle.position.set(0.15, BODY_HEIGHT * 0.47, -BODY_DEPTH / 2 - 0.03);
  doodle.rotation.x = Math.PI / 2;
  root.add(doodle);

  // Magnet dots holding the drawing.
  [
    { x: 0.02, y: BODY_HEIGHT * 0.53, color: new Color(0.9, 0.35, 0.3) },
    { x: 0.28, y: BODY_HEIGHT * 0.54, color: new Color(0.35, 0.55, 0.85) },
  ].forEach((spec, index) => {
    const magnet = new Mesh(new CylinderGeometry(0.03, 0.03, 0.015, 10), createGlossyPaintMaterial(`kitchen_fridgeMagnetMat${index}`, spec.color));
    magnet.name = `fridgeMagnet${index}`;
    magnet.position.set(spec.x, spec.y, -BODY_DEPTH / 2 - 0.03);
    magnet.rotation.x = Math.PI / 2;
    root.add(magnet);
  });
}

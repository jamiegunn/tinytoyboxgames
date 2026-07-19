import { BoxGeometry, Color, CylinderGeometry, Group, Mesh, PlaneGeometry, type Scene } from 'three';
import { createGlossyPaintMaterial, createPlasticMaterial, createToyMetalMaterial } from '@app/utils/materialFactory';
import { BACK_WALL_FACE_Z, COUNTERTOP_Y, STOVE_X } from '../layout';

/** Stove body dimensions (top aligns with the cabinet countertop). */
const BODY_WIDTH = 1.2;
const BODY_DEPTH = 0.85;

/**
 * Creates the cream stove in the back-right corner: an oven box with a dark
 * glass door and wooden handle, a cooktop with two burners, and a row of
 * little control knobs. Quiet set dressing that anchors the pot rail above it.
 *
 * @param scene - The Three.js scene that receives the stove group.
 */
export function createStove(scene: Scene): void {
  const root = new Group();
  root.name = 'kitchen_stove';
  root.position.set(STOVE_X, 0, BACK_WALL_FACE_Z - BODY_DEPTH / 2);
  scene.add(root);

  const bodyMat = createGlossyPaintMaterial('kitchen_stoveBodyMat', new Color(0.93, 0.9, 0.83));
  const topMat = createPlasticMaterial('kitchen_stoveTopMat', new Color(0.5, 0.52, 0.54));
  const burnerMat = createPlasticMaterial('kitchen_stoveBurnerMat', new Color(0.2, 0.2, 0.22));
  const glassMat = createPlasticMaterial('kitchen_stoveGlassMat', new Color(0.16, 0.14, 0.13));
  const handleMat = createToyMetalMaterial('kitchen_stoveHandleMat', new Color(0.78, 0.68, 0.44));
  const knobMat = createGlossyPaintMaterial('kitchen_stoveKnobMat', new Color(0.72, 0.78, 0.66));

  const bodyHeight = COUNTERTOP_Y - 0.08;
  const body = new Mesh(new BoxGeometry(BODY_WIDTH, bodyHeight, BODY_DEPTH), bodyMat);
  body.name = 'stoveBody';
  body.position.y = bodyHeight / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  root.add(body);

  // Cooktop slab with two burners.
  const top = new Mesh(new BoxGeometry(BODY_WIDTH + 0.06, 0.08, BODY_DEPTH + 0.06), topMat);
  top.name = 'stoveTop';
  top.position.y = COUNTERTOP_Y - 0.04;
  root.add(top);

  [-0.28, 0.28].forEach((x, index) => {
    const burner = new Mesh(new CylinderGeometry(0.16, 0.16, 0.03, 16), burnerMat);
    burner.name = `stoveBurner${index}`;
    burner.position.set(x, COUNTERTOP_Y + 0.01, 0);
    root.add(burner);
  });

  // Oven door: dark window pane and a wooden towel-bar handle.
  const glass = new Mesh(new PlaneGeometry(BODY_WIDTH - 0.34, bodyHeight - 0.5), glassMat);
  glass.name = 'stoveGlass';
  glass.position.set(0, bodyHeight / 2 - 0.06, -BODY_DEPTH / 2 - 0.005);
  glass.rotation.y = Math.PI;
  root.add(glass);

  const handle = new Mesh(new CylinderGeometry(0.03, 0.03, BODY_WIDTH - 0.25, 8), handleMat);
  handle.name = 'stoveHandle';
  handle.position.set(0, bodyHeight - 0.12, -BODY_DEPTH / 2 - 0.09);
  handle.rotation.z = Math.PI / 2;
  root.add(handle);

  // Control knobs along the top edge of the door.
  [-0.35, -0.12, 0.12, 0.35].forEach((x, index) => {
    const knob = new Mesh(new CylinderGeometry(0.04, 0.04, 0.035, 10), knobMat);
    knob.name = `stoveKnob${index}`;
    knob.position.set(x, bodyHeight + 0.005, -BODY_DEPTH / 2 - 0.03);
    knob.rotation.x = Math.PI / 2;
    root.add(knob);
  });
}

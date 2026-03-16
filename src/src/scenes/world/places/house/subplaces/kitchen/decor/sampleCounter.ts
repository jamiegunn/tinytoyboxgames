import { BoxGeometry, Color, CylinderGeometry, Group, Mesh, SphereGeometry, type Scene } from 'three';
import { createGlossyPaintMaterial, createPlasticMaterial, createWoodMaterial } from '@app/utils/materialFactory';
import { COUNTER_X, COUNTER_Y, COUNTER_Z } from '../layout';

/**
 * Creates a simple kitchen-style counter vignette.
 *
 * This is intentionally a non-interactive authored prop. It demonstrates where
 * room-local decor should live and gives the generated room at least one piece
 * of content that is not part of the shell or the toybox system.
 *
 * @param scene - The Three.js scene that receives the counter group.
 */
export function createSampleCounter(scene: Scene): void {
  const root = new Group();
  root.position.set(COUNTER_X, COUNTER_Y, COUNTER_Z);
  scene.add(root);

  const cabinet = new Mesh(new BoxGeometry(2.4, 1.15, 0.9), createGlossyPaintMaterial('kitchen_cabinetMat', new Color(0.82, 0.86, 0.78)));
  cabinet.position.y = 0.575;
  cabinet.castShadow = true;
  cabinet.receiveShadow = true;
  root.add(cabinet);

  const countertop = new Mesh(new BoxGeometry(2.55, 0.08, 1.0), createWoodMaterial('kitchen_countertopMat', new Color(0.56, 0.42, 0.28)));
  countertop.position.y = 1.16;
  countertop.castShadow = true;
  root.add(countertop);

  const bowl = new Mesh(new SphereGeometry(0.22, 16, 12), createPlasticMaterial('kitchen_bowlMat', new Color(0.95, 0.92, 0.84)));
  bowl.scale.y = 0.45;
  bowl.position.set(0.45, 1.28, -0.05);
  bowl.castShadow = true;
  root.add(bowl);

  const fruitColors = [new Color(0.96, 0.22, 0.18), new Color(0.98, 0.8, 0.18), new Color(0.58, 0.78, 0.2)];
  fruitColors.forEach((color, index) => {
    const fruit = new Mesh(new SphereGeometry(0.09, 12, 10), createPlasticMaterial(`kitchen_fruitMat${index}`, color));
    fruit.position.set(0.34 + index * 0.11, 1.33, 0.02 - index * 0.06);
    fruit.castShadow = true;
    root.add(fruit);
  });

  const stool = new Mesh(new CylinderGeometry(0.24, 0.28, 0.32, 18), createWoodMaterial('kitchen_stoolMat', new Color(0.71, 0.55, 0.38)));
  stool.position.set(-1.05, 0.16, -0.2);
  stool.castShadow = true;
  root.add(stool);
}

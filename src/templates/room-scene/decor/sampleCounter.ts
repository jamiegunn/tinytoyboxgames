import { BoxGeometry, Color, Group, Mesh, type Scene } from 'three';
import { createPlasticMaterial } from '@app/utils/materialFactory';
import { PLACEHOLDER_X, PLACEHOLDER_Y, PLACEHOLDER_Z } from '../layout';

/**
 * Creates a small gift-box-shaped placeholder prop.
 *
 * Replace this with your room's authored content. This exists only so that
 * a freshly generated room has at least one piece of non-structural decor
 * to confirm the `decor/` folder is wired correctly.
 *
 * @param scene - The Three.js scene that receives the placeholder group.
 */
export function createPlaceholderProp(scene: Scene): void {
  const root = new Group();
  root.position.set(PLACEHOLDER_X, PLACEHOLDER_Y, PLACEHOLDER_Z);
  scene.add(root);

  // Box body
  const box = new Mesh(new BoxGeometry(0.6, 0.6, 0.6), createPlasticMaterial('__SCENE_ID___placeholderBoxMat', new Color(0.75, 0.75, 0.78)));
  box.position.y = 0.3;
  box.castShadow = true;
  box.receiveShadow = true;
  root.add(box);

  // Horizontal ribbon
  const hRibbon = new Mesh(new BoxGeometry(0.62, 0.08, 0.62), createPlasticMaterial('__SCENE_ID___placeholderRibbonHMat', new Color(0.85, 0.35, 0.35)));
  hRibbon.position.y = 0.3;
  root.add(hRibbon);

  // Vertical ribbon
  const vRibbon = new Mesh(new BoxGeometry(0.08, 0.62, 0.62), createPlasticMaterial('__SCENE_ID___placeholderRibbonVMat', new Color(0.85, 0.35, 0.35)));
  vRibbon.position.y = 0.3;
  root.add(vRibbon);
}

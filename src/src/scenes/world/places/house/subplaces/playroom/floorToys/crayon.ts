import { Color, CylinderGeometry, Mesh, type DirectionalLight, type Scene } from 'three';
import { createGlossyPaintMaterial, createPlasticMaterial } from '@app/utils/materialFactory';

/**
 * Creates a purple crayon lying on its side with a paper wrapper and conical tip.
 * @param scene - The Three.js scene to add the crayon to
 * @param _keyLight - The directional light (unused)
 */
export function createCrayon(scene: Scene, _keyLight: DirectionalLight): void {
  const body = new Mesh(new CylinderGeometry(0.04, 0.04, 0.32, 10), createGlossyPaintMaterial('hub_crayonMat', new Color(0.58, 0.22, 0.72)));
  body.name = 'crayon';
  body.position.set(1.8, 0.04, 2.0);
  body.rotation.z = Math.PI / 2;
  body.rotation.y = 0.4;
  body.castShadow = true;
  scene.add(body);

  const wrapper = new Mesh(new CylinderGeometry(0.042, 0.042, 0.15, 10), createPlasticMaterial('hub_crayonWrapMat', new Color(0.65, 0.3, 0.78)));
  wrapper.name = 'crayonWrap';
  wrapper.position.y = -0.02;
  body.add(wrapper);

  const tip = new Mesh(new CylinderGeometry(0, 0.04, 0.1, 10), createGlossyPaintMaterial('hub_crayonTipMat', new Color(0.5, 0.18, 0.65)));
  tip.name = 'crayonTip';
  tip.position.y = 0.21;
  body.add(tip);
}

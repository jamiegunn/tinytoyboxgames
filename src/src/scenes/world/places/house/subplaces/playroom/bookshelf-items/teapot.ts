import { Color, CylinderGeometry, Mesh, SphereGeometry, TorusGeometry, type Scene } from 'three';
import { createGlossyPaintMaterial } from '@app/utils/materialFactory';

/**
 * Creates a toy teapot on the middle shelf of the bookshelf.
 * @param scene - The Three.js scene to add the teapot to
 */
export function createTeapot(scene: Scene): void {
  const teapotMat = createGlossyPaintMaterial('hub_teapotMat', new Color(0.85, 0.55, 0.65));

  const teapotBody = new Mesh(new SphereGeometry(0.09, 8, 8), teapotMat);
  teapotBody.name = 'shelfTeapot';
  teapotBody.position.set(2.5 + 0.5, 0.93, 8.2);
  scene.add(teapotBody);

  const spout = new Mesh(new CylinderGeometry(0.01, 0.02, 0.1, 6), teapotMat);
  spout.name = 'teapotSpout';
  spout.position.set(0.08, 0.02, 0);
  spout.rotation.z = -0.6;
  teapotBody.add(spout);

  const handle = new Mesh(new TorusGeometry(0.05, 0.0075, 16, 10), teapotMat);
  handle.name = 'teapotHandle';
  handle.position.set(-0.06, 0.02, 0);
  handle.rotation.y = Math.PI / 2;
  handle.scale.y = 0.6;
  teapotBody.add(handle);
}

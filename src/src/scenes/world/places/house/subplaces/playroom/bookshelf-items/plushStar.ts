import { CircleGeometry, Color, Mesh, type Scene } from 'three';
import { createFeltMaterial } from '@app/utils/materialFactory';

/**
 * Creates a small plush star on the middle shelf of the bookshelf.
 * @param scene - The Three.js scene to add the star to
 */
export function createPlushStar(scene: Scene): void {
  const shelfStar = new Mesh(new CircleGeometry(0.08, 5), createFeltMaterial('hub_shelfStarMat', new Color(1.0, 0.88, 0.3)));
  shelfStar.name = 'shelfStar';
  shelfStar.position.set(2.5 + 0.8, 0.88, 8.18);
  shelfStar.rotation.x = -0.3;
  scene.add(shelfStar);
}

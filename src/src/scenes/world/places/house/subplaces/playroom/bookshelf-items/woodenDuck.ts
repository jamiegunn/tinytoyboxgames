import { Color, CylinderGeometry, Mesh, SphereGeometry, type Scene } from 'three';
import { createGlossyPaintMaterial, createWoodMaterial } from '@app/utils/materialFactory';

/**
 * Creates a wooden duck on the top shelf of the bookshelf.
 * @param scene - The Three.js scene to add the duck to
 */
export function createWoodenDuck(scene: Scene): void {
  const duckWoodMat = createWoodMaterial('hub_shelfDuckMat', new Color(0.75, 0.6, 0.4));

  const shelfDuck = new Mesh(new SphereGeometry(0.5, 8, 8), duckWoodMat);
  shelfDuck.name = 'shelfDuck';
  shelfDuck.scale.set(0.12, 0.1, 0.08);
  shelfDuck.position.set(2.5 + 0.3, 1.72, 8.2);
  scene.add(shelfDuck);

  const shelfDuckHead = new Mesh(new SphereGeometry(0.035, 6, 6), duckWoodMat);
  shelfDuckHead.name = 'shelfDuckHead';
  shelfDuckHead.position.set(0.05, 0.05, 0);
  shelfDuck.add(shelfDuckHead);

  const shelfDuckBeak = new Mesh(new CylinderGeometry(0, 0.015, 0.03, 4), createGlossyPaintMaterial('hub_shelfDuckBeakMat', new Color(0.9, 0.5, 0.15)));
  shelfDuckBeak.name = 'shelfDuckBeak';
  shelfDuckBeak.position.set(0.04, 0, 0);
  shelfDuckBeak.rotation.z = -Math.PI / 2;
  shelfDuckHead.add(shelfDuckBeak);
}

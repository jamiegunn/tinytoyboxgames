import { BoxGeometry, Color, Mesh, SphereGeometry, type Scene } from 'three';
import { createGlossyPaintMaterial } from '@app/utils/materialFactory';

/**
 * Creates a rubber duck on the middle shelf of the bookshelf.
 * @param scene - The Three.js scene to add the duck to
 */
export function createRubberDuck(scene: Scene): void {
  const rubberMat = createGlossyPaintMaterial('hub_rubberDuckMat', new Color(1.0, 0.85, 0.1));

  const duckBody = new Mesh(new SphereGeometry(0.5, 8, 8), rubberMat);
  duckBody.name = 'shelfRubberDuck';
  duckBody.scale.set(0.14, 0.11, 0.12);
  duckBody.position.set(2.5 + 0.9, 1.01, 8.2);
  duckBody.rotation.y = Math.PI;
  duckBody.scale.setScalar(3);
  // Re-apply non-uniform scale after setScalar
  duckBody.scale.set(0.14 * 3, 0.11 * 3, 0.12 * 3);
  scene.add(duckBody);

  const duckHead = new Mesh(new SphereGeometry(0.04, 6, 6), rubberMat);
  duckHead.name = 'shelfRubberDuckHead';
  duckHead.position.set(0.05, 0.06, 0);
  duckBody.add(duckHead);

  const duckBeak = new Mesh(new BoxGeometry(0.04, 0.015, 0.025), createGlossyPaintMaterial('hub_rubberDuckBeakMat', new Color(0.95, 0.5, 0.05)));
  duckBeak.name = 'shelfRubberDuckBeak';
  duckBeak.position.set(0.045, -0.005, 0);
  duckHead.add(duckBeak);

  const duckEyeMat = createGlossyPaintMaterial('hub_rubberDuckEyeMat', new Color(0.05, 0.05, 0.05));
  [-1, 1].forEach((side) => {
    const eye = new Mesh(new SphereGeometry(0.006, 4, 4), duckEyeMat);
    eye.name = `shelfRubberDuckEye${side > 0 ? 'R' : 'L'}`;
    eye.position.set(0.03, 0.015, side * 0.02);
    duckHead.add(eye);
  });
}

import { CircleGeometry, Color, Mesh, TorusGeometry, type DirectionalLight, type Scene } from 'three';
import { createFeltMaterial } from '@app/utils/materialFactory';

/**
 * Creates a flat felt stuffed star with stitching detail, bead eyes, and an embroidered smile.
 * @param scene - The Three.js scene to add the stuffed star to
 * @param _keyLight - The directional light (unused)
 */
export function createStuffedStar(scene: Scene, _keyLight: DirectionalLight): void {
  const star = new Mesh(new CircleGeometry(0.22, 5), createFeltMaterial('hub_starMat', new Color(1.0, 0.88, 0.3)));
  star.name = 'stuffedStar';
  star.position.set(-1.5, 0.04, 2.0);
  star.rotation.x = Math.PI / 2;
  star.scale.y = 1.3;
  star.castShadow = true;
  scene.add(star);

  const back = new Mesh(new CircleGeometry(0.2, 5), createFeltMaterial('hub_starBackMat', new Color(0.95, 0.82, 0.25)));
  back.name = 'stuffedStarBack';
  back.position.y = -0.01;
  back.scale.set(0.95, 0.95, 1);
  star.add(back);

  const stitchRing = new Mesh(new TorusGeometry(0.175, 0.005, 16, 5), createFeltMaterial('hub_starStitchMat', new Color(0.8, 0.65, 0.2)));
  stitchRing.name = 'starStitch';
  stitchRing.position.y = 0.005;
  star.add(stitchRing);

  const faceMat = createFeltMaterial('hub_starFaceMat', new Color(0.4, 0.28, 0.15));
  [-1, 1].forEach((side) => {
    const dot = new Mesh(new CircleGeometry(0.015, 6), faceMat);
    dot.name = `starEye${side}`;
    dot.position.set(side * 0.04, 0.015, 0.015);
    dot.rotation.x = -Math.PI / 2;
    star.add(dot);
  });

  const smile = new Mesh(new CircleGeometry(0.025, 8, 0, Math.PI), faceMat);
  smile.name = 'starSmile';
  smile.position.set(0, 0.015, -0.02);
  smile.rotation.x = -Math.PI / 2;
  smile.rotation.z = Math.PI;
  star.add(smile);
}

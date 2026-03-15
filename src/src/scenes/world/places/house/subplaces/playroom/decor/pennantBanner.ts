import { CircleGeometry, Color, CylinderGeometry, Mesh, type Scene } from 'three';
import { createFeltMaterial } from '@app/utils/materialFactory';
import {
  wallY,
  BACK_WALL_FACE_Z,
  PENNANT_STRING_T,
  PENNANT_FLAG_T,
  PENNANT_STRING_LENGTH,
  PENNANT_COUNT,
  PENNANT_FLAG_RADIUS,
  PENNANT_SPACING,
  PENNANT_START_X,
  PENNANT_DROOP,
} from '../layout';

/**
 * Creates a colourful pennant banner string with triangular felt flags along the back wall.
 * @param scene - The Three.js scene to add the banner to
 */
export function createPennantBanner(scene: Scene): void {
  const pennantColors = [
    new Color(0.92, 0.4, 0.35),
    new Color(0.9, 0.75, 0.25),
    new Color(0.5, 0.82, 0.6),
    new Color(0.45, 0.7, 0.92),
    new Color(0.72, 0.58, 0.85),
    new Color(1.0, 0.78, 0.6),
    new Color(0.92, 0.4, 0.35),
    new Color(0.9, 0.75, 0.25),
    new Color(0.5, 0.82, 0.6),
    new Color(0.45, 0.7, 0.92),
  ];

  const bannerZ = BACK_WALL_FACE_Z + 0.01;
  const flagZ = BACK_WALL_FACE_Z + 0.02;

  const stringMat = createFeltMaterial('hub_bannerStringMat', new Color(0.6, 0.5, 0.4));
  const string = new Mesh(new CylinderGeometry(0.01, 0.01, PENNANT_STRING_LENGTH, 4), stringMat);
  string.name = 'bannerString';
  string.position.set(0.5, wallY(PENNANT_STRING_T), bannerZ);
  string.rotation.z = Math.PI / 2;
  string.rotation.x = 0.03;
  scene.add(string);

  for (let i = 0; i < PENNANT_COUNT; i++) {
    const flag = new Mesh(new CircleGeometry(PENNANT_FLAG_RADIUS, 3), createFeltMaterial(`hub_pennantMat${i}`, pennantColors[i]));
    flag.name = `pennant${i}`;
    const xPos = PENNANT_START_X + i * PENNANT_SPACING;
    const droop = Math.sin((i / (PENNANT_COUNT - 1)) * Math.PI) * PENNANT_DROOP;
    flag.position.set(xPos, wallY(PENNANT_FLAG_T) - droop, flagZ);
    flag.rotation.z = Math.PI;
    scene.add(flag);
  }
}

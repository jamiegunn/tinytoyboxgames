import { Group, Mesh, CylinderGeometry, SphereGeometry, type Scene } from 'three';
import { createFeltMaterial, getOrCreateMaterial } from '@app/utils/materialFactory';
import { seededRng, placementSeed } from '@app/utils/seededRng';
import { createEntityRoot, type EntityPlacement } from '@scenes/immersive-toybox-scenes/naturescene/types';
import {
  STEM_TOP_RADIUS,
  STEM_BOTTOM_RADIUS,
  STEM_HEIGHT,
  STEM_Y,
  STEM_COLOR,
  CAP_RADIUS,
  CAP_Y,
  CAP_COLOR_LIGHT,
  CAP_COLOR_DARK,
  CAP_COLOR_THRESHOLD,
} from './constants';

function addStem(parent: Group): void {
  const mat = getOrCreateMaterial('toadstoolStemMat', () => createFeltMaterial('toadstoolStemMat', STEM_COLOR));
  const stem = new Mesh(new CylinderGeometry(STEM_TOP_RADIUS, STEM_BOTTOM_RADIUS, STEM_HEIGHT, 6), mat);
  stem.name = 'toadstoolStem';
  stem.position.y = STEM_Y;
  parent.add(stem);
}

function addCap(parent: Group, rand: () => number): void {
  const capColor = rand() > CAP_COLOR_THRESHOLD ? CAP_COLOR_LIGHT : CAP_COLOR_DARK;
  const matName = `toadstoolCapMat_#${capColor.getHexString()}`;
  const mat = getOrCreateMaterial(matName, () => createFeltMaterial(matName, capColor));
  const cap = new Mesh(new SphereGeometry(CAP_RADIUS, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat);
  cap.name = 'toadstoolCap';
  cap.position.y = CAP_Y;
  parent.add(cap);
}

/**
 * Creates a tiny decorative toadstool (non-interactive, smaller than the main mushrooms).
 *
 * @param scene - The Three.js scene to add the toadstool to.
 * @param placement - World-space placement for the toadstool root.
 * @returns The root group that owns the toadstool meshes.
 */
export function createToadstool(scene: Scene, placement: EntityPlacement): Group {
  const rand = seededRng(placementSeed(placement.position, 'toadstool'));
  const root = createEntityRoot('toadstool', placement, scene);

  addStem(root);
  addCap(root, rand);

  return root;
}

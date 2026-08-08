/**
 * Builds the infield: a dirt diamond with three base cushions, home plate,
 * and the pitcher's mound.
 *
 * Local coordinates match world axes (the staging entry uses rotY 0): home
 * plate is the -Z corner nearest the camera, second base the +Z corner, and
 * first base the -X corner — which is the child's RIGHT, because +X is screen
 * left (see the axes note in `environment.ts`).
 */

import { BoxGeometry, CylinderGeometry, Group, Mesh, PlaneGeometry, type Scene } from 'three';
import { createEntityRoot, type EntityPlacement } from '../../../../types';
import type { ImmersiveSceneMaterials } from '../../../../materials';
import {
  BASE_HEIGHT,
  BASE_INSET,
  BASE_SIZE,
  DIRT_LIFT,
  DIRT_SIDE,
  HALF_DIAGONAL,
  HOME_PLATE_HEIGHT,
  HOME_PLATE_RADIUS,
  MOUND_BOTTOM_RADIUS,
  MOUND_HEIGHT,
  MOUND_TOP_RADIUS,
  RUBBER_DEPTH,
  RUBBER_HEIGHT,
  RUBBER_WIDTH,
} from './constants';

/** Shared dependencies required to build the infield. */
export interface InfieldBuildOptions {
  materials: Pick<ImmersiveSceneMaterials, 'infieldDirt' | 'moundClay' | 'plateWhite'>;
}

/**
 * Creates the infield at its staged placement.
 *
 * @param scene - Scene that should receive the created prop.
 * @param placement - World placement authored in `staging/infield.ts`.
 * @param options - Shared materials used by the prop.
 * @returns The root group for the created infield.
 */
export function createInfield(scene: Scene, placement: EntityPlacement, options: InfieldBuildOptions): Group {
  const root = createEntityRoot('baseball_infield', placement, scene);

  // Dirt square, laid flat and spun 45° so its corners are the bases. Euler
  // order XYZ applies Z first, so rotation.z turns the square within its own
  // plane and rotation.x then lays it onto the floor.
  const dirt = new Mesh(new PlaneGeometry(DIRT_SIDE, DIRT_SIDE), options.materials.infieldDirt);
  dirt.name = 'baseball_infield_dirt';
  dirt.rotation.x = -Math.PI / 2;
  dirt.rotation.z = Math.PI / 4;
  dirt.position.y = DIRT_LIFT;
  dirt.receiveShadow = true;
  root.add(dirt);

  // First (-X, the child's right), second (+Z, deep) and third (+X) bases.
  const corners: Array<{ name: string; x: number; z: number }> = [
    { name: 'baseball_first_base', x: -(HALF_DIAGONAL - BASE_INSET), z: 0 },
    { name: 'baseball_second_base', x: 0, z: HALF_DIAGONAL - BASE_INSET },
    { name: 'baseball_third_base', x: HALF_DIAGONAL - BASE_INSET, z: 0 },
  ];
  corners.forEach((corner) => {
    const cushion = new Mesh(new BoxGeometry(BASE_SIZE, BASE_HEIGHT, BASE_SIZE), options.materials.plateWhite);
    cushion.name = corner.name;
    cushion.position.set(corner.x, BASE_HEIGHT / 2 + DIRT_LIFT, corner.z);
    cushion.rotation.y = Math.PI / 4;
    cushion.castShadow = true;
    cushion.receiveShadow = true;
    root.add(cushion);
  });

  // Home plate: a shallow five-sided disc at the near corner.
  const homePlate = new Mesh(new CylinderGeometry(HOME_PLATE_RADIUS, HOME_PLATE_RADIUS, HOME_PLATE_HEIGHT, 5), options.materials.plateWhite);
  homePlate.name = 'baseball_home_plate';
  homePlate.position.set(0, HOME_PLATE_HEIGHT / 2 + DIRT_LIFT, -(HALF_DIAGONAL - BASE_INSET));
  homePlate.castShadow = true;
  homePlate.receiveShadow = true;
  root.add(homePlate);

  // Pitcher's mound at the diamond's centre, with the rubber on top.
  const mound = new Mesh(new CylinderGeometry(MOUND_TOP_RADIUS, MOUND_BOTTOM_RADIUS, MOUND_HEIGHT, 20), options.materials.moundClay);
  mound.name = 'baseball_pitchers_mound';
  mound.position.y = MOUND_HEIGHT / 2 + DIRT_LIFT;
  mound.castShadow = true;
  mound.receiveShadow = true;
  root.add(mound);

  const rubber = new Mesh(new BoxGeometry(RUBBER_WIDTH, RUBBER_HEIGHT, RUBBER_DEPTH), options.materials.plateWhite);
  rubber.name = 'baseball_pitchers_rubber';
  rubber.position.y = MOUND_HEIGHT + RUBBER_HEIGHT / 2 + DIRT_LIFT;
  rubber.castShadow = true;
  root.add(rubber);

  return root;
}

import { BoxGeometry, Color, Mesh, type Scene } from 'three';
import { createPlasticMaterial, createWoodMaterial } from '@app/utils/materialFactory';
import {
  CROWN_Y,
  CHAIR_RAIL_Y,
  ROOM_DEPTH,
  BASEBOARD_HEIGHT,
  BASEBOARD_DEPTH,
  BASEBOARD_Y,
  CROWN_HEIGHT,
  CROWN_DEPTH,
  CHAIR_RAIL_HEIGHT,
  CHAIR_RAIL_DEPTH,
  BACK_TRIM,
} from '@app/scenes/world/places/house/subplaces/playroom/layout';

/**
 * Creates the back wall baseboard, crown molding, and chair rail.
 * @param scene - The Three.js scene to add the trim to
 */
export function createBackWallTrim(scene: Scene): void {
  // Baseboard
  const baseboardMat = createWoodMaterial('hub_bbBackMat', new Color(0.4, 0.28, 0.18));
  const bb = new Mesh(new BoxGeometry(ROOM_DEPTH, BASEBOARD_HEIGHT, BASEBOARD_DEPTH), baseboardMat);
  bb.name = 'bbBack';
  bb.position.set(0, BASEBOARD_Y, BACK_TRIM.baseboard);
  scene.add(bb);

  // Crown molding
  const trimMat = createPlasticMaterial('hub_crownBackMat', new Color(0.96, 0.96, 0.98));
  const crown = new Mesh(new BoxGeometry(ROOM_DEPTH, CROWN_HEIGHT, CROWN_DEPTH), trimMat);
  crown.name = 'crownBack';
  crown.position.set(0, CROWN_Y, BACK_TRIM.crown);
  scene.add(crown);

  // Chair rail
  const rail = new Mesh(new BoxGeometry(ROOM_DEPTH, CHAIR_RAIL_HEIGHT, CHAIR_RAIL_DEPTH), trimMat);
  rail.name = 'railBack';
  rail.position.set(0, CHAIR_RAIL_Y, BACK_TRIM.chairRail);
  scene.add(rail);
}

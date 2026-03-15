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
  LEFT_TRIM,
} from '@app/scenes/world/places/house/subplaces/playroom/layout';

/**
 * Creates the left wall baseboard, crown molding, and chair rail.
 * @param scene - The Three.js scene to add the trim to
 */
export function createLeftWallTrim(scene: Scene): void {
  // Baseboard
  const baseboardMat = createWoodMaterial('hub_bbLeftMat', new Color(0.4, 0.28, 0.18));
  const bb = new Mesh(new BoxGeometry(ROOM_DEPTH, BASEBOARD_HEIGHT, BASEBOARD_DEPTH), baseboardMat);
  bb.name = 'bbLeft';
  bb.position.set(LEFT_TRIM.baseboard, BASEBOARD_Y, 0);
  bb.rotation.y = -Math.PI / 2;
  scene.add(bb);

  // Crown molding
  const trimMat = createPlasticMaterial('hub_crownLeftMat', new Color(0.96, 0.96, 0.98));
  const crown = new Mesh(new BoxGeometry(ROOM_DEPTH, CROWN_HEIGHT, CROWN_DEPTH), trimMat);
  crown.name = 'crownLeft';
  crown.position.set(LEFT_TRIM.crown, CROWN_Y, 0);
  crown.rotation.y = -Math.PI / 2;
  scene.add(crown);

  // Chair rail
  const rail = new Mesh(new BoxGeometry(ROOM_DEPTH, CHAIR_RAIL_HEIGHT, CHAIR_RAIL_DEPTH), trimMat);
  rail.name = 'railLeft';
  rail.position.set(LEFT_TRIM.chairRail, CHAIR_RAIL_Y, 0);
  rail.rotation.y = -Math.PI / 2;
  scene.add(rail);
}

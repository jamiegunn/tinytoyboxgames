import { BoxGeometry, Color, Mesh, type Scene } from 'three';
import { createPlasticMaterial } from '@app/utils/materialFactory';
import { WALL_HEIGHT, WALL_THICKNESS, ROOM_DEPTH, RIGHT_WALL_X, CEILING_Y } from '@app/scenes/world/places/house/subplaces/playroom/layout';

/** Door opening dimensions (must match door.ts). */
const DOOR_WIDTH = 2.0;
const DOOR_HEIGHT = 3.8;
const DOOR_CENTER_Z = 0;

/**
 * Creates the right wall panel with a door opening.
 * @param scene - The Three.js scene to add the panel to
 */
export function createRightWallPanel(scene: Scene): void {
  const wallMat = createPlasticMaterial('hub_rightWallMat', new Color(0.6, 0.82, 0.88));

  const doorHalfW = DOOR_WIDTH / 2;
  const halfDepth = ROOM_DEPTH / 2;

  // Segment below-Z of door (Z from -halfDepth to door left edge)
  const segALen = halfDepth + (DOOR_CENTER_Z - doorHalfW);
  const segAZ = -halfDepth + segALen / 2;
  const segA = new Mesh(new BoxGeometry(WALL_THICKNESS, WALL_HEIGHT, segALen), wallMat);
  segA.name = 'rightWallA';
  segA.position.set(RIGHT_WALL_X, CEILING_Y / 2, segAZ);
  scene.add(segA);

  // Segment above-Z of door (Z from door right edge to +halfDepth)
  const segBLen = halfDepth - (DOOR_CENTER_Z + doorHalfW);
  const segBZ = DOOR_CENTER_Z + doorHalfW + segBLen / 2;
  const segB = new Mesh(new BoxGeometry(WALL_THICKNESS, WALL_HEIGHT, segBLen), wallMat);
  segB.name = 'rightWallB';
  segB.position.set(RIGHT_WALL_X, CEILING_Y / 2, segBZ);
  scene.add(segB);

  // Segment above the door (fills gap from door top to ceiling)
  const aboveH = CEILING_Y - DOOR_HEIGHT;
  if (aboveH > 0) {
    const segC = new Mesh(new BoxGeometry(WALL_THICKNESS, aboveH, DOOR_WIDTH), wallMat);
    segC.name = 'rightWallAboveDoor';
    segC.position.set(RIGHT_WALL_X, DOOR_HEIGHT + aboveH / 2, DOOR_CENTER_Z);
    scene.add(segC);
  }
}

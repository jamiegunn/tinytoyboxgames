import { BoxGeometry, Color, Mesh, type MeshStandardMaterial, type Scene } from 'three';
import { createPlasticMaterial, createWoodMaterial } from '@app/utils/materialFactory';
import {
  BACK_WALL_CENTER_Z,
  BACK_WALL_FACE_Z,
  CEILING_Y,
  KITCHEN_DOOR_Z,
  LEFT_WALL_X,
  LEFT_WALL_FACE_X,
  PLAYROOM_DOOR_Z,
  RIGHT_WALL_X,
  RIGHT_WALL_FACE_X,
  ROOM_DEPTH,
  ROOM_SPAN_X,
  WALL_HEIGHT,
  WALL_THICKNESS,
} from '../layout';

/** Z center shared by both side walls (matches the shell footprint). */
const SIDE_WALL_CENTER_Z = -1.2;

/** Baseboard cross-section. */
const BASEBOARD_HEIGHT = 0.24;
const BASEBOARD_DEPTH = 0.14;

/** Wainscoting proportions, echoing the Playroom's lower-wall rhythm. */
const WAINSCOT_HEIGHT = 1.32;
const WAINSCOT_DEPTH = 0.06;
const PANEL_INSET = 0.04;
const RAIL_HEIGHT = 0.09;
const RAIL_DEPTH = 0.09;

/** Half-width of the doorway exclusion zones (door slab plus casing). */
const DOOR_CLEARANCE = 1.28;

/** Grouped wainscot materials passed between the segment builders. */
interface WainscotMaterials {
  /** Flat backing board. */
  base: MeshStandardMaterial;
  /** Top rail cap. */
  rail: MeshStandardMaterial;
  /** Recessed panel insets. */
  panel: MeshStandardMaterial;
}

/**
 * Creates one wainscot segment along the back wall: backing board, top rail,
 * and evenly spaced recessed panels spanning `[startX, endX]`.
 *
 * @param scene - The Three.js scene that receives the segment meshes.
 * @param materials - Shared wainscot materials.
 * @param startX - Segment start along the wall.
 * @param endX - Segment end along the wall.
 * @param key - Unique mesh-name prefix for this segment.
 */
function createBackWainscotSegment(scene: Scene, materials: WainscotMaterials, startX: number, endX: number, key: string): void {
  const length = endX - startX;
  const centerX = startX + length / 2;

  const base = new Mesh(new BoxGeometry(length, WAINSCOT_HEIGHT, WAINSCOT_DEPTH), materials.base);
  base.name = `${key}Base`;
  base.position.set(centerX, WAINSCOT_HEIGHT / 2, BACK_WALL_FACE_Z - WAINSCOT_DEPTH / 2);
  scene.add(base);

  const rail = new Mesh(new BoxGeometry(length, RAIL_HEIGHT, RAIL_DEPTH), materials.rail);
  rail.name = `${key}Rail`;
  rail.position.set(centerX, WAINSCOT_HEIGHT + RAIL_HEIGHT / 2, BACK_WALL_FACE_Z - RAIL_DEPTH / 2);
  scene.add(rail);

  const panelCount = Math.max(1, Math.round(length / 1.15));
  const panelWidth = (length - 0.3) / panelCount;
  for (let i = 0; i < panelCount; i++) {
    const panelX = startX + 0.15 + panelWidth * (i + 0.5);
    const panel = new Mesh(new BoxGeometry(panelWidth - 0.14, WAINSCOT_HEIGHT - 0.36, PANEL_INSET), materials.panel);
    panel.name = `${key}Panel${i}`;
    panel.position.set(panelX, WAINSCOT_HEIGHT / 2, BACK_WALL_FACE_Z - WAINSCOT_DEPTH - PANEL_INSET / 2 + 0.01);
    scene.add(panel);
  }
}

/**
 * Creates one wainscot segment along a side wall: backing board, top rail,
 * and evenly spaced recessed panels spanning `[startZ, endZ]`.
 *
 * @param scene - The Three.js scene that receives the segment meshes.
 * @param materials - Shared wainscot materials.
 * @param wallFaceX - Interior wall face the segment mounts on.
 * @param inward - Direction sign pointing into the room (-1 for left wall, +1 for right wall).
 * @param startZ - Segment start along the wall.
 * @param endZ - Segment end along the wall.
 * @param key - Unique mesh-name prefix for this segment.
 */
function createSideWainscotSegment(
  scene: Scene,
  materials: WainscotMaterials,
  wallFaceX: number,
  inward: number,
  startZ: number,
  endZ: number,
  key: string,
): void {
  const length = endZ - startZ;
  const centerZ = startZ + length / 2;

  const base = new Mesh(new BoxGeometry(WAINSCOT_DEPTH, WAINSCOT_HEIGHT, length), materials.base);
  base.name = `${key}Base`;
  base.position.set(wallFaceX + inward * (WAINSCOT_DEPTH / 2), WAINSCOT_HEIGHT / 2, centerZ);
  scene.add(base);

  const rail = new Mesh(new BoxGeometry(RAIL_DEPTH, RAIL_HEIGHT, length), materials.rail);
  rail.name = `${key}Rail`;
  rail.position.set(wallFaceX + inward * (RAIL_DEPTH / 2), WAINSCOT_HEIGHT + RAIL_HEIGHT / 2, centerZ);
  scene.add(rail);

  const panelCount = Math.max(1, Math.round(length / 1.15));
  const panelDepth = (length - 0.3) / panelCount;
  for (let i = 0; i < panelCount; i++) {
    const panelZ = startZ + 0.15 + panelDepth * (i + 0.5);
    const panel = new Mesh(new BoxGeometry(PANEL_INSET, WAINSCOT_HEIGHT - 0.36, panelDepth - 0.14), materials.panel);
    panel.name = `${key}Panel${i}`;
    panel.position.set(wallFaceX + inward * (WAINSCOT_DEPTH + PANEL_INSET / 2 - 0.01), WAINSCOT_HEIGHT / 2, panelZ);
    scene.add(panel);
  }
}

/**
 * Creates the Living Room's three-wall shell: warm butter-cream paint over
 * cream wainscoting panels with a top rail — the Playroom's two-tone wall
 * rhythm in the Living Room's warmer palette — plus a soft wooden baseboard.
 * Wainscot segments skip the three doorway openings.
 *
 * @param scene - The Three.js scene that receives the wall meshes.
 */
export function createWalls(scene: Scene): void {
  const wallMaterial = createPlasticMaterial('livingRoom_wallMat', new Color(0.95, 0.84, 0.64));
  wallMaterial.roughness = 0.6;
  const baseboardMaterial = createWoodMaterial('livingRoom_baseboardMat', new Color(0.78, 0.64, 0.47));

  const wainscot: WainscotMaterials = {
    base: createWoodMaterial('livingRoom_wainscotMat', new Color(0.88, 0.76, 0.58)),
    rail: createWoodMaterial('livingRoom_wainscotRailMat', new Color(0.93, 0.83, 0.66)),
    panel: createWoodMaterial('livingRoom_wainscotPanelMat', new Color(0.83, 0.7, 0.52)),
  };

  const backWall = new Mesh(new BoxGeometry(ROOM_SPAN_X, WALL_HEIGHT, WALL_THICKNESS), wallMaterial);
  backWall.name = 'livingRoom_backWall';
  backWall.position.set(0, CEILING_Y / 2, BACK_WALL_CENTER_Z);
  backWall.receiveShadow = true;
  scene.add(backWall);

  const leftWall = new Mesh(new BoxGeometry(WALL_THICKNESS, WALL_HEIGHT, ROOM_DEPTH), wallMaterial);
  leftWall.name = 'livingRoom_leftWall';
  leftWall.position.set(LEFT_WALL_X, CEILING_Y / 2, SIDE_WALL_CENTER_Z);
  leftWall.receiveShadow = true;
  scene.add(leftWall);

  const rightWall = new Mesh(new BoxGeometry(WALL_THICKNESS, WALL_HEIGHT, ROOM_DEPTH), wallMaterial);
  rightWall.name = 'livingRoom_rightWall';
  rightWall.position.set(RIGHT_WALL_X, CEILING_Y / 2, SIDE_WALL_CENTER_Z);
  rightWall.receiveShadow = true;
  scene.add(rightWall);

  // Wainscoting on the back wall, split around the outside doorway at X = 0.
  const spanHalf = ROOM_SPAN_X / 2;
  const outsideDoorClearance = 1.1;
  createBackWainscotSegment(scene, wainscot, -spanHalf, -outsideDoorClearance, 'livingRoom_wainscotBackR');
  createBackWainscotSegment(scene, wainscot, outsideDoorClearance, spanHalf, 'livingRoom_wainscotBackL');

  // Wainscoting on the side walls, split around each doorway.
  const sideStartZ = SIDE_WALL_CENTER_Z - ROOM_DEPTH / 2;
  const sideEndZ = SIDE_WALL_CENTER_Z + ROOM_DEPTH / 2;
  createSideWainscotSegment(scene, wainscot, LEFT_WALL_FACE_X, -1, sideStartZ, PLAYROOM_DOOR_Z - DOOR_CLEARANCE, 'livingRoom_wainscotLeft1');
  createSideWainscotSegment(scene, wainscot, LEFT_WALL_FACE_X, -1, PLAYROOM_DOOR_Z + DOOR_CLEARANCE, sideEndZ, 'livingRoom_wainscotLeft2');
  createSideWainscotSegment(scene, wainscot, RIGHT_WALL_FACE_X, 1, sideStartZ, KITCHEN_DOOR_Z - DOOR_CLEARANCE, 'livingRoom_wainscotRight1');
  createSideWainscotSegment(scene, wainscot, RIGHT_WALL_FACE_X, 1, KITCHEN_DOOR_Z + DOOR_CLEARANCE, sideEndZ, 'livingRoom_wainscotRight2');

  // Baseboards: one along the back wall, one along each side wall.
  const backBaseboard = new Mesh(new BoxGeometry(ROOM_SPAN_X, BASEBOARD_HEIGHT, BASEBOARD_DEPTH), baseboardMaterial);
  backBaseboard.name = 'livingRoom_backBaseboard';
  backBaseboard.position.set(0, BASEBOARD_HEIGHT / 2, BACK_WALL_FACE_Z - BASEBOARD_DEPTH / 2 + 0.05);
  scene.add(backBaseboard);

  const leftBaseboard = new Mesh(new BoxGeometry(BASEBOARD_DEPTH, BASEBOARD_HEIGHT, ROOM_DEPTH), baseboardMaterial);
  leftBaseboard.name = 'livingRoom_leftBaseboard';
  leftBaseboard.position.set(LEFT_WALL_FACE_X - BASEBOARD_DEPTH / 2 + 0.05, BASEBOARD_HEIGHT / 2, SIDE_WALL_CENTER_Z);
  scene.add(leftBaseboard);

  const rightBaseboard = new Mesh(new BoxGeometry(BASEBOARD_DEPTH, BASEBOARD_HEIGHT, ROOM_DEPTH), baseboardMaterial);
  rightBaseboard.name = 'livingRoom_rightBaseboard';
  rightBaseboard.position.set(RIGHT_WALL_FACE_X + BASEBOARD_DEPTH / 2 - 0.05, BASEBOARD_HEIGHT / 2, SIDE_WALL_CENTER_Z);
  scene.add(rightBaseboard);
}

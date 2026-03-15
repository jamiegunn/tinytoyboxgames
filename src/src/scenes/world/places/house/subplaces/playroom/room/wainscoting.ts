import { BoxGeometry, Color, Mesh, type Scene } from 'three';
import { createWoodMaterial } from '@app/utils/materialFactory';
import {
  BACK_WALL_FACE_Z,
  RIGHT_WALL_FACE_X,
  LEFT_WALL_FACE_X,
  ROOM_DEPTH,
  ROOM_SPAN_X,
  CEILING_Y,
} from '@app/scenes/world/places/house/subplaces/playroom/layout';

/** Wainscoting height — roughly lower quarter of the wall. */
const WAINSCOT_HEIGHT = CEILING_Y * 0.2; // 1.8
const WAINSCOT_DEPTH = 0.06;
const PANEL_INSET = 0.04;
const RAIL_HEIGHT = 0.1;
const RAIL_DEPTH = 0.08;

/** Door exclusion zone on the right wall (Z range to skip). */
const DOOR_Z_MIN = -1.2;
const DOOR_Z_MAX = 1.2;

/**
 * Creates brown wainscoting panels with a top rail around all three walls, skipping the door opening.
 * @param scene - The Three.js scene to add the wainscoting to
 */
export function createWainscoting(scene: Scene): void {
  const wainscotMat = createWoodMaterial('hub_wainscotMat', new Color(0.62, 0.48, 0.32));
  const railMat = createWoodMaterial('hub_wainscotRailMat', new Color(0.65, 0.52, 0.36));
  const panelMat = createWoodMaterial('hub_wainscotPanelMat', new Color(0.58, 0.44, 0.28));

  // ── Back wall wainscoting ──
  const backBase = new Mesh(new BoxGeometry(ROOM_SPAN_X, WAINSCOT_HEIGHT, WAINSCOT_DEPTH), wainscotMat);
  backBase.name = 'wainscotBack';
  backBase.position.set(0, WAINSCOT_HEIGHT / 2, BACK_WALL_FACE_Z - WAINSCOT_DEPTH / 2);
  scene.add(backBase);

  const backRail = new Mesh(new BoxGeometry(ROOM_SPAN_X, RAIL_HEIGHT, RAIL_DEPTH), railMat);
  backRail.name = 'wainscotBackRail';
  backRail.position.set(0, WAINSCOT_HEIGHT + RAIL_HEIGHT / 2, BACK_WALL_FACE_Z - RAIL_DEPTH / 2);
  scene.add(backRail);

  const backPanelCount = 8;
  const backPanelWidth = (ROOM_SPAN_X - 0.6) / backPanelCount;
  for (let i = 0; i < backPanelCount; i++) {
    const px = -ROOM_SPAN_X / 2 + 0.3 + backPanelWidth * (i + 0.5);
    const panel = new Mesh(new BoxGeometry(backPanelWidth - 0.12, WAINSCOT_HEIGHT - 0.3, PANEL_INSET), panelMat);
    panel.name = `wainscotBackPanel${i}`;
    panel.position.set(px, WAINSCOT_HEIGHT / 2, BACK_WALL_FACE_Z - WAINSCOT_DEPTH - PANEL_INSET / 2 + 0.01);
    scene.add(panel);
  }

  // ── Right wall wainscoting — split into two segments around the door ──
  const rightHalfDepth = ROOM_DEPTH / 2;

  // Segment before door (Z < DOOR_Z_MIN)
  const seg1Length = rightHalfDepth + DOOR_Z_MIN; // from -ROOM_DEPTH/2 to DOOR_Z_MIN
  const seg1CenterZ = -rightHalfDepth + seg1Length / 2;

  const rightBase1 = new Mesh(new BoxGeometry(WAINSCOT_DEPTH, WAINSCOT_HEIGHT, seg1Length), wainscotMat);
  rightBase1.name = 'wainscotRight1';
  rightBase1.position.set(RIGHT_WALL_FACE_X + WAINSCOT_DEPTH / 2, WAINSCOT_HEIGHT / 2, seg1CenterZ);
  scene.add(rightBase1);

  const rightRail1 = new Mesh(new BoxGeometry(RAIL_DEPTH, RAIL_HEIGHT, seg1Length), railMat);
  rightRail1.name = 'wainscotRightRail1';
  rightRail1.position.set(RIGHT_WALL_FACE_X + RAIL_DEPTH / 2, WAINSCOT_HEIGHT + RAIL_HEIGHT / 2, seg1CenterZ);
  scene.add(rightRail1);

  // Segment after door (Z > DOOR_Z_MAX)
  const seg2Length = rightHalfDepth - DOOR_Z_MAX; // from DOOR_Z_MAX to ROOM_DEPTH/2
  const seg2CenterZ = DOOR_Z_MAX + seg2Length / 2;

  const rightBase2 = new Mesh(new BoxGeometry(WAINSCOT_DEPTH, WAINSCOT_HEIGHT, seg2Length), wainscotMat);
  rightBase2.name = 'wainscotRight2';
  rightBase2.position.set(RIGHT_WALL_FACE_X + WAINSCOT_DEPTH / 2, WAINSCOT_HEIGHT / 2, seg2CenterZ);
  scene.add(rightBase2);

  const rightRail2 = new Mesh(new BoxGeometry(RAIL_DEPTH, RAIL_HEIGHT, seg2Length), railMat);
  rightRail2.name = 'wainscotRightRail2';
  rightRail2.position.set(RIGHT_WALL_FACE_X + RAIL_DEPTH / 2, WAINSCOT_HEIGHT + RAIL_HEIGHT / 2, seg2CenterZ);
  scene.add(rightRail2);

  // Panels on right wall — skip panels that overlap the door
  const sidePanelCount = 10;
  const sidePanelDepth = (ROOM_DEPTH - 0.6) / sidePanelCount;
  for (let i = 0; i < sidePanelCount; i++) {
    const pz = -ROOM_DEPTH / 2 + 0.3 + sidePanelDepth * (i + 0.5);
    // Skip panels in the door zone
    if (pz > DOOR_Z_MIN && pz < DOOR_Z_MAX) continue;
    const panel = new Mesh(new BoxGeometry(PANEL_INSET, WAINSCOT_HEIGHT - 0.3, sidePanelDepth - 0.12), panelMat);
    panel.name = `wainscotRightPanel${i}`;
    panel.position.set(RIGHT_WALL_FACE_X + WAINSCOT_DEPTH + PANEL_INSET / 2 - 0.01, WAINSCOT_HEIGHT / 2, pz);
    scene.add(panel);
  }

  // ── Left wall wainscoting ──
  const leftBase = new Mesh(new BoxGeometry(WAINSCOT_DEPTH, WAINSCOT_HEIGHT, ROOM_DEPTH), wainscotMat);
  leftBase.name = 'wainscotLeft';
  leftBase.position.set(LEFT_WALL_FACE_X - WAINSCOT_DEPTH / 2, WAINSCOT_HEIGHT / 2, 0);
  scene.add(leftBase);

  const leftRail = new Mesh(new BoxGeometry(RAIL_DEPTH, RAIL_HEIGHT, ROOM_DEPTH), railMat);
  leftRail.name = 'wainscotLeftRail';
  leftRail.position.set(LEFT_WALL_FACE_X - RAIL_DEPTH / 2, WAINSCOT_HEIGHT + RAIL_HEIGHT / 2, 0);
  scene.add(leftRail);

  for (let i = 0; i < sidePanelCount; i++) {
    const pz = -ROOM_DEPTH / 2 + 0.3 + sidePanelDepth * (i + 0.5);
    const panel = new Mesh(new BoxGeometry(PANEL_INSET, WAINSCOT_HEIGHT - 0.3, sidePanelDepth - 0.12), panelMat);
    panel.name = `wainscotLeftPanel${i}`;
    panel.position.set(LEFT_WALL_FACE_X - WAINSCOT_DEPTH - PANEL_INSET / 2 + 0.01, WAINSCOT_HEIGHT / 2, pz);
    scene.add(panel);
  }
}

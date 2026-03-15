import { BoxGeometry, Color, CylinderGeometry, Group, Mesh, PlaneGeometry, SphereGeometry, type Scene } from 'three';
import { createWoodMaterial, createToyMetalMaterial } from '@app/utils/materialFactory';
import { RIGHT_WALL_FACE_X } from '@app/scenes/world/places/house/subplaces/playroom/layout';

/** Door dimensions. */
const DOOR_WIDTH = 2.0;
const DOOR_HEIGHT = 3.8;
const DOOR_THICKNESS = 0.12;
const DOOR_CENTER_Z = 0;
const DOOR_OPEN_ANGLE = 0.12; // slightly ajar inward

/**
 * Creates a slightly-open paneled door on the right wall with knob on the left side.
 * @param scene - The Three.js scene to add the door to
 */
export function createDoor(scene: Scene): void {
  const doorMat = createWoodMaterial('hub_doorMat', new Color(0.55, 0.38, 0.22));
  const frameMat = createWoodMaterial('hub_doorFrameMat', new Color(0.9, 0.88, 0.85));
  const knobMat = createToyMetalMaterial('hub_doorKnobMat', new Color(0.75, 0.65, 0.4));

  const wallX = RIGHT_WALL_FACE_X;

  // ── Door frame — flush with wall, receding into wall thickness ──
  const frameBar = 0.12;
  const frameDepth = 0.18;

  const topBar = new Mesh(new BoxGeometry(frameDepth, frameBar, DOOR_WIDTH + 2 * frameBar), frameMat);
  topBar.name = 'doorFrameTop';
  topBar.position.set(wallX - frameDepth / 2, DOOR_HEIGHT + frameBar / 2, DOOR_CENTER_Z);
  scene.add(topBar);

  [-1, 1].forEach((side, i) => {
    const sideBar = new Mesh(new BoxGeometry(frameDepth, DOOR_HEIGHT + frameBar, frameBar), frameMat);
    sideBar.name = `doorFrameSide${i}`;
    sideBar.position.set(wallX - frameDepth / 2, (DOOR_HEIGHT + frameBar) / 2, DOOR_CENTER_Z + side * (DOOR_WIDTH / 2 + frameBar / 2));
    scene.add(sideBar);
  });

  // ── Dark opening behind the door ──
  const gapMat = createWoodMaterial('hub_doorGapMat', new Color(0.08, 0.06, 0.05));
  const gap = new Mesh(new PlaneGeometry(DOOR_WIDTH, DOOR_HEIGHT), gapMat);
  gap.name = 'doorGap';
  gap.position.set(wallX - 0.02, DOOR_HEIGHT / 2, DOOR_CENTER_Z);
  gap.rotation.y = -Math.PI / 2;
  scene.add(gap);

  // ── Door panel — hinge on -Z edge, swings slightly inward (toward room interior, +X) ──
  const doorPivot = new Group();
  doorPivot.name = 'doorPivot';
  doorPivot.position.set(wallX - frameDepth / 2, 0, DOOR_CENTER_Z - DOOR_WIDTH / 2);
  doorPivot.rotation.y = DOOR_OPEN_ANGLE;
  scene.add(doorPivot);

  const doorPanel = new Mesh(new BoxGeometry(DOOR_THICKNESS, DOOR_HEIGHT, DOOR_WIDTH), doorMat);
  doorPanel.name = 'doorPanel';
  doorPanel.position.set(0, DOOR_HEIGHT / 2, DOOR_WIDTH / 2);
  doorPanel.castShadow = true;
  doorPivot.add(doorPanel);

  // ── Classic 4-panel door ──
  // Panels are recessed grooves — slightly darker inset rectangles
  const panelInsetMat = createWoodMaterial('hub_doorPanelInsetMat', new Color(0.48, 0.32, 0.18));
  const panelRailMat = createWoodMaterial('hub_doorPanelRailMat', new Color(0.52, 0.36, 0.2));

  const panelMarginZ = 0.2; // side margin from door edge
  const panelGapY = 0.12; // gap between panels
  const panelInsetW = DOOR_WIDTH - 2 * panelMarginZ; // panel width (Z)

  // Horizontal rails (stiles) — the cross-pieces between panels
  const railThick = 0.1;
  const midRailY = DOOR_HEIGHT * 0.48; // middle rail position

  // Mid rail
  const midRail = new Mesh(new BoxGeometry(DOOR_THICKNESS + 0.01, railThick, panelInsetW + 0.04), panelRailMat);
  midRail.name = 'doorMidRail';
  midRail.position.set(0, midRailY - DOOR_HEIGHT / 2, 0);
  doorPanel.add(midRail);

  // Four recessed panels (2 top, 2 bottom of mid rail)
  const topPanelH = (DOOR_HEIGHT - midRailY - railThick / 2 - panelGapY * 2) / 2;
  const botPanelH = (midRailY - railThick / 2 - panelGapY * 2) / 2;
  const panelInsetDepth = 0.02;

  // Top two panels
  const topPanelCenterY = midRailY + railThick / 2 + panelGapY;
  [topPanelCenterY + topPanelH / 2, topPanelCenterY + topPanelH + panelGapY + topPanelH / 2].forEach((py, i) => {
    // Single wide panel per row for a classic look
    const panel = new Mesh(new BoxGeometry(panelInsetDepth, topPanelH - 0.04, panelInsetW - 0.08), panelInsetMat);
    panel.name = `doorTopPanel${i}`;
    panel.position.set(DOOR_THICKNESS / 2 - panelInsetDepth / 2 + 0.002, py - DOOR_HEIGHT / 2, 0);
    doorPanel.add(panel);

    // Matching panel on back side
    const panelBack = new Mesh(new BoxGeometry(panelInsetDepth, topPanelH - 0.04, panelInsetW - 0.08), panelInsetMat);
    panelBack.name = `doorTopPanelBack${i}`;
    panelBack.position.set(-DOOR_THICKNESS / 2 + panelInsetDepth / 2 - 0.002, py - DOOR_HEIGHT / 2, 0);
    doorPanel.add(panelBack);
  });

  // Bottom two panels (taller than top panels — classic proportions)
  const botPanelCenterY = panelGapY;
  [botPanelCenterY + botPanelH / 2, botPanelCenterY + botPanelH + panelGapY + botPanelH / 2].forEach((py, i) => {
    const panel = new Mesh(new BoxGeometry(panelInsetDepth, botPanelH - 0.04, panelInsetW - 0.08), panelInsetMat);
    panel.name = `doorBotPanel${i}`;
    panel.position.set(DOOR_THICKNESS / 2 - panelInsetDepth / 2 + 0.002, py - DOOR_HEIGHT / 2, 0);
    doorPanel.add(panel);

    const panelBack = new Mesh(new BoxGeometry(panelInsetDepth, botPanelH - 0.04, panelInsetW - 0.08), panelInsetMat);
    panelBack.name = `doorBotPanelBack${i}`;
    panelBack.position.set(-DOOR_THICKNESS / 2 + panelInsetDepth / 2 - 0.002, py - DOOR_HEIGHT / 2, 0);
    doorPanel.add(panelBack);
  });

  // ── Door knob — on the left side (+Z end, viewer's left) ──
  // Knob plate (escutcheon)
  const plateMat = createToyMetalMaterial('hub_doorPlateMat', new Color(0.7, 0.6, 0.38));
  const plate = new Mesh(new BoxGeometry(0.008, 0.18, 0.07), plateMat);
  plate.name = 'doorKnobPlate';
  plate.position.set(DOOR_THICKNESS / 2 + 0.004, midRailY - DOOR_HEIGHT / 2, DOOR_WIDTH * 0.35);
  doorPanel.add(plate);

  // Round knob
  const knob = new Mesh(new SphereGeometry(0.05, 10, 10), knobMat);
  knob.name = 'doorKnob';
  knob.position.set(DOOR_THICKNESS / 2 + 0.04, midRailY - DOOR_HEIGHT / 2, DOOR_WIDTH * 0.35);
  doorPanel.add(knob);

  // Knob stem
  const stem = new Mesh(new CylinderGeometry(0.015, 0.015, 0.04, 8), knobMat);
  stem.name = 'doorKnobStem';
  stem.position.set(-0.02, 0, 0);
  stem.rotation.z = Math.PI / 2;
  knob.add(stem);

  // Back side knob
  const knobBack = new Mesh(new SphereGeometry(0.05, 10, 10), knobMat);
  knobBack.name = 'doorKnobBack';
  knobBack.position.set(-DOOR_THICKNESS / 2 - 0.04, midRailY - DOOR_HEIGHT / 2, DOOR_WIDTH * 0.35);
  doorPanel.add(knobBack);

  const stemBack = new Mesh(new CylinderGeometry(0.015, 0.015, 0.04, 8), knobMat);
  stemBack.name = 'doorKnobStemBack';
  stemBack.position.set(0.02, 0, 0);
  stemBack.rotation.z = Math.PI / 2;
  knobBack.add(stemBack);
}

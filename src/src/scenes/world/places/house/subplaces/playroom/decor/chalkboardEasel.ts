import { BoxGeometry, Color, CylinderGeometry, Group, Mesh, type DirectionalLight, type Scene } from 'three';
import { createWoodMaterial, createPlasticMaterial } from '@app/utils/materialFactory';

/**
 * Creates a chalkboard on a wooden easel in the front-right corner of the room.
 * @param scene - The Three.js scene to add the easel to
 * @param _keyLight - The directional light (unused)
 */
export function createChalkboardEasel(scene: Scene, _keyLight: DirectionalLight): void {
  const root = new Group();
  root.name = 'chalkboardEasel_root';
  root.position.set(-5.0, 0, -5.0);
  root.rotation.y = Math.PI / 4 + 0.2; // angled into the corner
  scene.add(root);

  const woodMat = createWoodMaterial('hub_easelWoodMat', new Color(0.6, 0.42, 0.22));
  const boardMat = createPlasticMaterial('hub_chalkboardMat', new Color(0.12, 0.22, 0.15));
  const frameMat = createWoodMaterial('hub_chalkFrameMat', new Color(0.45, 0.3, 0.15));
  const trayMat = createWoodMaterial('hub_chalkTrayMat', new Color(0.5, 0.35, 0.18));
  const chalkWhite = createPlasticMaterial('hub_chalkWhiteMat', new Color(0.92, 0.9, 0.86));
  const chalkYellow = createPlasticMaterial('hub_chalkYellowMat', new Color(0.95, 0.88, 0.3));
  const chalkPink = createPlasticMaterial('hub_chalkPinkMat', new Color(0.92, 0.5, 0.6));

  // ── Easel legs ──
  // Front two legs (A-frame)
  [-1, 1].forEach((side) => {
    const leg = new Mesh(new CylinderGeometry(0.025, 0.03, 1.8, 8), woodMat);
    leg.name = `easelFrontLeg${side}`;
    leg.position.set(0, 0.9, side * 0.35);
    leg.rotation.z = 0.08; // slight forward lean
    leg.castShadow = true;
    root.add(leg);
  });

  // Back support leg
  const backLeg = new Mesh(new CylinderGeometry(0.02, 0.025, 1.7, 8), woodMat);
  backLeg.name = 'easelBackLeg';
  backLeg.position.set(-0.5, 0.85, 0);
  backLeg.rotation.z = -0.35;
  backLeg.castShadow = true;
  root.add(backLeg);

  // Cross brace between front legs
  const brace = new Mesh(new CylinderGeometry(0.015, 0.015, 0.65, 6), woodMat);
  brace.name = 'easelBrace';
  brace.position.set(0, 0.45, 0);
  brace.rotation.x = Math.PI / 2;
  root.add(brace);

  // ── Chalkboard ──
  const boardGroup = new Group();
  boardGroup.name = 'chalkboard_group';
  boardGroup.position.set(0.04, 1.2, 0);
  boardGroup.rotation.z = 0.08; // leaning back slightly on easel
  root.add(boardGroup);

  // Board surface — dark green
  const board = new Mesh(new BoxGeometry(0.04, 0.7, 0.9), boardMat);
  board.name = 'chalkboard_surface';
  board.castShadow = true;
  boardGroup.add(board);

  // Wooden frame
  // Top
  const frameTop = new Mesh(new BoxGeometry(0.05, 0.04, 0.94), frameMat);
  frameTop.name = 'chalkboard_frameTop';
  frameTop.position.y = 0.37;
  boardGroup.add(frameTop);

  // Bottom
  const frameBottom = new Mesh(new BoxGeometry(0.05, 0.04, 0.94), frameMat);
  frameBottom.name = 'chalkboard_frameBottom';
  frameBottom.position.y = -0.37;
  boardGroup.add(frameBottom);

  // Left
  const frameLeft = new Mesh(new BoxGeometry(0.05, 0.74, 0.04), frameMat);
  frameLeft.name = 'chalkboard_frameLeft';
  frameLeft.position.z = -0.47;
  boardGroup.add(frameLeft);

  // Right
  const frameRight = new Mesh(new BoxGeometry(0.05, 0.74, 0.04), frameMat);
  frameRight.name = 'chalkboard_frameRight';
  frameRight.position.z = 0.47;
  boardGroup.add(frameRight);

  // Chalk tray at bottom
  const tray = new Mesh(new BoxGeometry(0.08, 0.03, 0.7), trayMat);
  tray.name = 'chalkboard_tray';
  tray.position.set(0.04, -0.36, 0);
  boardGroup.add(tray);

  // Chalk pieces in tray
  const chalkPieces = [
    { mat: chalkWhite, z: -0.1 },
    { mat: chalkYellow, z: 0.05 },
    { mat: chalkPink, z: 0.18 },
  ];
  chalkPieces.forEach(({ mat, z }) => {
    const chalk = new Mesh(new CylinderGeometry(0.012, 0.012, 0.08, 6), mat);
    chalk.name = `chalk_${z}`;
    chalk.position.set(0.04, -0.33, z);
    chalk.rotation.x = Math.PI / 2;
    chalk.rotation.z = Math.random() * 0.3 - 0.15;
    boardGroup.add(chalk);
  });

  // Simple chalk drawings on the board — a few lines to suggest doodles
  // Smiley face circle (simplified as a thin box ring)
  const smileMat = chalkWhite;
  const smileyRing = new Mesh(new BoxGeometry(0.006, 0.2, 0.2), smileMat);
  smileyRing.name = 'chalk_smileyRing';
  smileyRing.position.set(0.025, 0.08, -0.12);
  boardGroup.add(smileyRing);

  // Eyes (dots)
  [-1, 1].forEach((side) => {
    const eye = new Mesh(new BoxGeometry(0.006, 0.025, 0.025), smileMat);
    eye.name = `chalk_smileyEye${side}`;
    eye.position.set(0.025, 0.12, -0.12 + side * 0.05);
    boardGroup.add(eye);
  });

  // Smile (line)
  const smile = new Mesh(new BoxGeometry(0.006, 0.015, 0.1), smileMat);
  smile.name = 'chalk_smile';
  smile.position.set(0.025, 0.02, -0.12);
  boardGroup.add(smile);

  // Yellow star doodle (upper right)
  const starLine1 = new Mesh(new BoxGeometry(0.006, 0.12, 0.01), chalkYellow);
  starLine1.name = 'chalk_starLine1';
  starLine1.position.set(0.025, 0.15, 0.2);
  boardGroup.add(starLine1);

  const starLine2 = new Mesh(new BoxGeometry(0.006, 0.01, 0.12), chalkYellow);
  starLine2.name = 'chalk_starLine2';
  starLine2.position.set(0.025, 0.15, 0.2);
  boardGroup.add(starLine2);
}

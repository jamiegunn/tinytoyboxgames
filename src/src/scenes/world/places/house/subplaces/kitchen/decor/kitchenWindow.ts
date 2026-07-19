import { BoxGeometry, CircleGeometry, Color, CylinderGeometry, Mesh, PlaneGeometry, SphereGeometry, type Scene } from 'three';
import { createFeltMaterial, createPlasticMaterial, createToyMetalMaterial, createWoodMaterial } from '@app/utils/materialFactory';
import { BACK_WALL_FACE_Z, KITCHEN_WINDOW_BOTTOM_Y, KITCHEN_WINDOW_HEIGHT, KITCHEN_WINDOW_WIDTH, KITCHEN_WINDOW_X } from '../layout';

/** Frame bar thickness. */
const FRAME_BAR = 0.12;

/**
 * Creates the sunny outdoor scene visible through the window opening: an
 * emissive blue sky, a grass strip, and a simple puffball tree, following the
 * Playroom's window pattern.
 *
 * @param scene - The Three.js scene that receives the view planes.
 * @param centerY - Vertical center of the window opening.
 * @param wallZ - Z position of the pane, just in front of the wall face.
 */
function createOutdoorView(scene: Scene, centerY: number, wallZ: number): void {
  const skyMat = createPlasticMaterial('kitchen_winSkyMat', new Color(0.52, 0.73, 0.94));
  skyMat.emissive = new Color(0.2, 0.3, 0.44);
  const sky = new Mesh(new PlaneGeometry(KITCHEN_WINDOW_WIDTH, KITCHEN_WINDOW_HEIGHT), skyMat);
  sky.name = 'kitchen_windowSky';
  sky.position.set(KITCHEN_WINDOW_X, centerY, wallZ);
  sky.rotation.y = Math.PI;
  scene.add(sky);

  const grassMat = createPlasticMaterial('kitchen_winGrassMat', new Color(0.32, 0.6, 0.22));
  grassMat.emissive = new Color(0.05, 0.1, 0.03);
  const grassHeight = KITCHEN_WINDOW_HEIGHT * 0.25;
  const grass = new Mesh(new PlaneGeometry(KITCHEN_WINDOW_WIDTH, grassHeight), grassMat);
  grass.name = 'kitchen_windowGrass';
  grass.position.set(KITCHEN_WINDOW_X, centerY - KITCHEN_WINDOW_HEIGHT / 2 + grassHeight / 2, wallZ + 0.005);
  grass.rotation.y = Math.PI;
  scene.add(grass);

  const trunkMat = createPlasticMaterial('kitchen_winTrunkMat', new Color(0.45, 0.3, 0.15));
  const trunk = new Mesh(new PlaneGeometry(KITCHEN_WINDOW_WIDTH * 0.07, KITCHEN_WINDOW_HEIGHT * 0.5), trunkMat);
  trunk.name = 'kitchen_windowTrunk';
  trunk.position.set(KITCHEN_WINDOW_X - 0.45, centerY - KITCHEN_WINDOW_HEIGHT * 0.12, wallZ + 0.008);
  trunk.rotation.y = Math.PI;
  scene.add(trunk);

  const canopyMat = createPlasticMaterial('kitchen_winCanopyMat', new Color(0.22, 0.55, 0.16));
  canopyMat.emissive = new Color(0.03, 0.08, 0.02);
  const puffs = [
    { dx: -0.45, dy: 0.32, radius: 0.3 },
    { dx: -0.62, dy: 0.18, radius: 0.22 },
    { dx: -0.28, dy: 0.2, radius: 0.24 },
  ];
  puffs.forEach((puff, index) => {
    const canopy = new Mesh(new CircleGeometry(puff.radius, 12), canopyMat);
    canopy.name = `kitchen_windowCanopy${index}`;
    canopy.position.set(KITCHEN_WINDOW_X + puff.dx, centerY + puff.dy, wallZ + 0.01 + index * 0.002);
    canopy.rotation.y = Math.PI;
    scene.add(canopy);
  });
}

/**
 * Creates the kitchen window over the counter run: a sunny outdoor view,
 * wooden frame with cross mullions, tilted gingham-yellow curtains on a rod
 * with finials, and a soft sun patch on the floor — matching the Playroom's
 * window construction.
 *
 * @param scene - The Three.js scene that receives the window meshes.
 */
export function createKitchenWindow(scene: Scene): void {
  const frameMat = createWoodMaterial('kitchen_windowFrameMat', new Color(0.92, 0.9, 0.86));
  const centerY = KITCHEN_WINDOW_BOTTOM_Y + KITCHEN_WINDOW_HEIGHT / 2;
  const topY = KITCHEN_WINDOW_BOTTOM_Y + KITCHEN_WINDOW_HEIGHT;
  const wallZ = BACK_WALL_FACE_Z - 0.03;

  createOutdoorView(scene, centerY, wallZ + 0.01);

  // Frame: top, bottom (sill), and side bars.
  [KITCHEN_WINDOW_BOTTOM_Y - FRAME_BAR / 2, topY + FRAME_BAR / 2].forEach((y, index) => {
    const bar = new Mesh(new BoxGeometry(KITCHEN_WINDOW_WIDTH + 2 * FRAME_BAR, FRAME_BAR, 0.1), frameMat);
    bar.name = `kitchen_windowBarH${index}`;
    bar.position.set(KITCHEN_WINDOW_X, y, wallZ - 0.02);
    scene.add(bar);
  });

  [-1, 1].forEach((side, index) => {
    const bar = new Mesh(new BoxGeometry(FRAME_BAR, KITCHEN_WINDOW_HEIGHT + 2 * FRAME_BAR, 0.1), frameMat);
    bar.name = `kitchen_windowBarV${index}`;
    bar.position.set(KITCHEN_WINDOW_X + side * (KITCHEN_WINDOW_WIDTH / 2 + FRAME_BAR / 2), centerY, wallZ - 0.02);
    scene.add(bar);
  });

  // Cross mullions.
  const mullionH = new Mesh(new BoxGeometry(KITCHEN_WINDOW_WIDTH, 0.05, 0.06), frameMat);
  mullionH.name = 'kitchen_windowMullionH';
  mullionH.position.set(KITCHEN_WINDOW_X, centerY, wallZ - 0.01);
  scene.add(mullionH);

  const mullionV = new Mesh(new BoxGeometry(0.05, KITCHEN_WINDOW_HEIGHT, 0.06), frameMat);
  mullionV.name = 'kitchen_windowMullionV';
  mullionV.position.set(KITCHEN_WINDOW_X, centerY, wallZ - 0.01);
  scene.add(mullionV);

  // Butter-yellow curtains hanging on either side, gently tilted outward.
  const curtainMat = createFeltMaterial('kitchen_curtainMat', new Color(0.97, 0.85, 0.55));
  [-1, 1].forEach((side, index) => {
    const curtain = new Mesh(new BoxGeometry(0.42, KITCHEN_WINDOW_HEIGHT + 0.55, 0.08), curtainMat);
    curtain.name = `kitchen_curtain${index}`;
    curtain.position.set(KITCHEN_WINDOW_X + side * (KITCHEN_WINDOW_WIDTH / 2 + 0.32), centerY + 0.12, wallZ - 0.07);
    curtain.rotation.y = side * 0.08;
    scene.add(curtain);
  });

  // Curtain rod with ball finials.
  const rodMat = createToyMetalMaterial('kitchen_curtainRodMat', new Color(0.7, 0.6, 0.45));
  const rodLength = KITCHEN_WINDOW_WIDTH + 1.5;
  const rod = new Mesh(new CylinderGeometry(0.025, 0.025, rodLength, 8), rodMat);
  rod.name = 'kitchen_curtainRod';
  rod.position.set(KITCHEN_WINDOW_X, topY + 0.32, wallZ - 0.08);
  rod.rotation.z = Math.PI / 2;
  scene.add(rod);

  [-1, 1].forEach((side) => {
    const finial = new Mesh(new SphereGeometry(0.05, 8, 8), rodMat);
    finial.name = `kitchen_rodFinial${side > 0 ? 'L' : 'R'}`;
    finial.position.set(KITCHEN_WINDOW_X + side * (rodLength / 2), topY + 0.32, wallZ - 0.08);
    scene.add(finial);
  });

  // Sun patch: a warm translucent pool of light on the floor by the counter.
  const sunGeometry = new PlaneGeometry(2.4, 1.8);
  sunGeometry.rotateX(-Math.PI / 2);
  const sunMat = createPlasticMaterial('kitchen_sunPatchMat', new Color(1.0, 0.95, 0.8));
  sunMat.opacity = 0.28;
  sunMat.transparent = true;
  const sunPatch = new Mesh(sunGeometry, sunMat);
  sunPatch.name = 'kitchen_sunPatch';
  sunPatch.position.set(KITCHEN_WINDOW_X, 0.02, 5.6);
  sunPatch.rotation.y = 0.12;
  scene.add(sunPatch);
}

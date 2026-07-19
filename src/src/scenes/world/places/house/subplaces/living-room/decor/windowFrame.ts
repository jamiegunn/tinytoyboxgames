import { BoxGeometry, Color, Mesh, MeshStandardMaterial, PlaneGeometry, type Scene } from 'three';
import { createFeltMaterial, createWoodMaterial, getOrCreateMaterial } from '@app/utils/materialFactory';
import { BACK_WALL_FACE_Z, WINDOW_BOTTOM_Y, WINDOW_HEIGHT, WINDOW_WIDTH, WINDOW_X } from '../layout';

/** Frame bar thickness. */
const FRAME_BAR = 0.12;

/**
 * Creates the window on the back wall: a warm dusk sky pane, wooden frame
 * with a cross mullion, and simple curtains. The sky pane is softly emissive
 * so the window reads as evening light without another scene light.
 *
 * @param scene - The Three.js scene that receives the window meshes.
 */
export function createWindowFrame(scene: Scene): void {
  const frameMat = createWoodMaterial('livingRoom_windowFrameMat', new Color(0.86, 0.78, 0.64));
  const curtainMat = createFeltMaterial('livingRoom_curtainMat', new Color(0.72, 0.5, 0.46));
  const skyMat = getOrCreateMaterial('livingRoom_windowSkyMat', () => {
    const material = new MeshStandardMaterial({ color: new Color(0.45, 0.52, 0.72), roughness: 1, metalness: 0 });
    material.emissive = new Color(0.5, 0.45, 0.55);
    material.emissiveIntensity = 0.45;
    return material;
  });

  const centerY = WINDOW_BOTTOM_Y + WINDOW_HEIGHT / 2;
  const paneZ = BACK_WALL_FACE_Z - 0.02;

  // Dusk sky pane.
  const sky = new Mesh(new PlaneGeometry(WINDOW_WIDTH, WINDOW_HEIGHT), skyMat);
  sky.name = 'livingRoom_windowSky';
  sky.position.set(WINDOW_X, centerY, paneZ);
  sky.rotation.y = Math.PI;
  scene.add(sky);

  // Frame: top, bottom, and side bars.
  const horizontalBar = new BoxGeometry(WINDOW_WIDTH + 2 * FRAME_BAR, FRAME_BAR, 0.1);
  const verticalBar = new BoxGeometry(FRAME_BAR, WINDOW_HEIGHT, 0.1);

  [WINDOW_BOTTOM_Y - FRAME_BAR / 2, WINDOW_BOTTOM_Y + WINDOW_HEIGHT + FRAME_BAR / 2].forEach((y, index) => {
    const bar = new Mesh(horizontalBar, frameMat);
    bar.name = `livingRoom_windowBarH${index}`;
    bar.position.set(WINDOW_X, y, paneZ - 0.03);
    scene.add(bar);
  });

  [-1, 1].forEach((side, index) => {
    const bar = new Mesh(verticalBar, frameMat);
    bar.name = `livingRoom_windowBarV${index}`;
    bar.position.set(WINDOW_X + side * (WINDOW_WIDTH / 2 + FRAME_BAR / 2), centerY, paneZ - 0.03);
    scene.add(bar);
  });

  // Cross mullion.
  const mullionH = new Mesh(new BoxGeometry(WINDOW_WIDTH, 0.05, 0.06), frameMat);
  mullionH.name = 'livingRoom_windowMullionH';
  mullionH.position.set(WINDOW_X, centerY, paneZ - 0.02);
  scene.add(mullionH);

  const mullionV = new Mesh(new BoxGeometry(0.05, WINDOW_HEIGHT, 0.06), frameMat);
  mullionV.name = 'livingRoom_windowMullionV';
  mullionV.position.set(WINDOW_X, centerY, paneZ - 0.02);
  scene.add(mullionV);

  // Curtains hanging on either side.
  [-1, 1].forEach((side, index) => {
    const curtain = new Mesh(new BoxGeometry(0.45, WINDOW_HEIGHT + 0.7, 0.08), curtainMat);
    curtain.name = `livingRoom_curtain${index}`;
    curtain.position.set(WINDOW_X + side * (WINDOW_WIDTH / 2 + 0.35), centerY + 0.1, paneZ - 0.08);
    curtain.rotation.y = side * 0.06;
    scene.add(curtain);
  });
}

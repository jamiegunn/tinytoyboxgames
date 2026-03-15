import { BoxGeometry, CircleGeometry, Color, CylinderGeometry, Mesh, PlaneGeometry, SphereGeometry, type Scene, Vector3 } from 'three';
import { createFeltMaterial, createPlasticMaterial, createToyMetalMaterial, createWoodMaterial } from '@app/utils/materialFactory';
import {
  wallY,
  BACK_WALL_FACE_Z,
  LEFT_WALL_FACE_X,
  WINDOW_CENTER_X,
  WINDOW_WIDTH,
  WINDOW_TOP_T,
  WINDOW_BOTTOM_T,
  WINDOW_CENTER_T,
  WINDOW_FRAME_BAR,
  WINDOW_FRAME_DEPTH,
  WINDOW_MULLION_BAR,
  WINDOW_MULLION_DEPTH,
  CURTAIN_WIDTH,
  CURTAIN_ROD_DIAMETER,
  CURTAIN_ROD_LENGTH,
  CURTAIN_ROD_OFFSET_Y,
  ROD_FINIAL_DIAMETER,
  ROD_FINIAL_OFFSET,
  CURTAIN_TILT,
} from './layout';

/**
 * Creates an outdoor scene visible through a window opening: blue sky, tree, grass.
 * All elements face toward the camera from the wall plane.
 * @param scene - The Three.js scene
 * @param cx - Center X position of the window
 * @param cy - Center Y position of the window
 * @param cz - Center Z position of the window
 * @param w - Window width
 * @param h - Window height
 * @param faceRotY - Y rotation to face the camera
 */
function createOutdoorView(scene: Scene, cx: number, cy: number, cz: number, w: number, h: number, faceRotY: number): void {
  // Sky
  const skyMat = createPlasticMaterial('hub_winSkyMat', new Color(0.5, 0.72, 0.95));
  skyMat.emissive = new Color(0.2, 0.3, 0.45);
  const sky = new Mesh(new PlaneGeometry(w, h), skyMat);
  sky.name = 'windowSky';
  sky.position.set(cx, cy, cz);
  sky.rotation.y = faceRotY;
  scene.add(sky);

  // Grass strip at bottom
  const grassMat = createPlasticMaterial('hub_winGrassMat', new Color(0.3, 0.6, 0.2));
  grassMat.emissive = new Color(0.05, 0.1, 0.03);
  const grassH = h * 0.25;
  const grass = new Mesh(new PlaneGeometry(w, grassH), grassMat);
  grass.name = 'windowGrass';
  grass.position.set(cx, cy - h / 2 + grassH / 2, cz - 0.005 * Math.cos(faceRotY));
  grass.rotation.y = faceRotY;
  if (Math.abs(faceRotY) > 1) {
    // Side wall — adjust Z offset along X instead
    grass.position.z = cz;
    grass.position.x = cx - 0.005 * Math.sign(faceRotY);
  }
  scene.add(grass);

  // Tree trunk
  const trunkMat = createPlasticMaterial('hub_winTrunkMat', new Color(0.45, 0.3, 0.15));
  const trunkW = w * 0.06;
  const trunkH = h * 0.55;
  const trunk = new Mesh(new PlaneGeometry(trunkW, trunkH), trunkMat);
  trunk.name = 'windowTrunk';
  trunk.position.set(cx + w * 0.15 * Math.cos(faceRotY), cy - h * 0.1, cz - 0.008 * Math.cos(faceRotY));
  trunk.rotation.y = faceRotY;
  if (Math.abs(faceRotY) > 1) {
    trunk.position.x = cx - 0.008 * Math.sign(faceRotY);
    trunk.position.z = cz + w * 0.15 * Math.sign(faceRotY) * -1;
  }
  scene.add(trunk);

  // Tree canopy — overlapping green circles
  const canopyMat = createPlasticMaterial('hub_winCanopyMat', new Color(0.2, 0.55, 0.15));
  canopyMat.emissive = new Color(0.03, 0.08, 0.02);
  const canopyPuffs = [
    { dx: 0, dy: 0.3, r: 0.35 },
    { dx: -0.25, dy: 0.2, r: 0.28 },
    { dx: 0.22, dy: 0.25, r: 0.3 },
    { dx: -0.1, dy: 0.45, r: 0.22 },
    { dx: 0.15, dy: 0.42, r: 0.2 },
  ];
  for (let pi = 0; pi < canopyPuffs.length; pi++) {
    const p = canopyPuffs[pi];
    const puff = new Mesh(new CircleGeometry(p.r * (w / 2), 12), canopyMat);
    puff.name = `windowCanopy${pi}`;
    puff.rotation.y = faceRotY;
    if (Math.abs(faceRotY) < 1) {
      puff.position.set(cx + p.dx * w * 0.5, cy + p.dy * h, cz - 0.01);
    } else {
      puff.position.set(cx - 0.01 * Math.sign(faceRotY), cy + p.dy * h, cz + p.dx * w * 0.5 * Math.sign(faceRotY) * -1);
    }
    scene.add(puff);
  }
}

/**
 * Creates the framed back window with outdoor view, curtains, rod, finials, and sunbeam.
 * @param scene - The Three.js scene to add the window to
 */
export function createWindow(scene: Scene): void {
  const frameMat = createWoodMaterial('hub_windowFrameMat', new Color(0.9, 0.88, 0.85));
  const wallZ = BACK_WALL_FACE_Z - 0.01;

  const winCenter = wallY(WINDOW_CENTER_T);
  const winTop = wallY(WINDOW_TOP_T);
  const winBottom = wallY(WINDOW_BOTTOM_T);
  const winHeight = winTop - winBottom;
  const winHalfH = winHeight / 2;

  // Outdoor scene visible through the window (positioned in front of wall face, behind frame)
  createOutdoorView(scene, WINDOW_CENTER_X, winCenter, wallZ - 0.03, WINDOW_WIDTH, winHeight, Math.PI);

  // Frame — 4 bars around the opening
  const frameW = WINDOW_WIDTH + 2 * WINDOW_FRAME_BAR + 0.1;
  const bars: { w: number; h: number; pos: Vector3 }[] = [
    { w: frameW, h: WINDOW_FRAME_BAR, pos: new Vector3(WINDOW_CENTER_X, winTop, wallZ) },
    { w: frameW, h: WINDOW_FRAME_BAR, pos: new Vector3(WINDOW_CENTER_X, winBottom, wallZ) },
    {
      w: WINDOW_FRAME_BAR,
      h: winHalfH * 2 + WINDOW_FRAME_BAR,
      pos: new Vector3(WINDOW_CENTER_X - WINDOW_WIDTH / 2 - WINDOW_FRAME_BAR / 2, winCenter, wallZ),
    },
    {
      w: WINDOW_FRAME_BAR,
      h: winHalfH * 2 + WINDOW_FRAME_BAR,
      pos: new Vector3(WINDOW_CENTER_X + WINDOW_WIDTH / 2 + WINDOW_FRAME_BAR / 2, winCenter, wallZ),
    },
  ];
  for (let i = 0; i < bars.length; i++) {
    const bar = new Mesh(new BoxGeometry(bars[i].w, bars[i].h, WINDOW_FRAME_DEPTH), frameMat);
    bar.name = `windowBar${i}`;
    bar.position.copy(bars[i].pos);
    scene.add(bar);
  }

  // Cross-bars (mullions)
  const crossH = new Mesh(new BoxGeometry(WINDOW_WIDTH, WINDOW_MULLION_BAR, WINDOW_MULLION_DEPTH), frameMat);
  crossH.name = 'windowCrossH';
  crossH.position.set(WINDOW_CENTER_X, winCenter, wallZ);
  scene.add(crossH);
  const crossV = new Mesh(new BoxGeometry(WINDOW_MULLION_BAR, winHeight, WINDOW_MULLION_DEPTH), frameMat);
  crossV.name = 'windowCrossV';
  crossV.position.set(WINDOW_CENTER_X, winCenter, wallZ);
  scene.add(crossV);

  // Curtains
  const curtainMat = createFeltMaterial('hub_curtainMat', new Color(0.95, 0.8, 0.65));
  const curtainH = winHeight + 0.4;
  const curtainHalfSpan = WINDOW_WIDTH / 2 + CURTAIN_WIDTH / 2 + WINDOW_FRAME_BAR;

  const curtainL = new Mesh(new BoxGeometry(CURTAIN_WIDTH, curtainH, 0.08), curtainMat);
  curtainL.name = 'curtainL';
  curtainL.position.set(WINDOW_CENTER_X - curtainHalfSpan, winCenter, wallZ - 0.04);
  curtainL.rotation.y = CURTAIN_TILT;
  scene.add(curtainL);

  const curtainR = new Mesh(new BoxGeometry(CURTAIN_WIDTH, curtainH, 0.08), curtainMat);
  curtainR.name = 'curtainR';
  curtainR.position.set(WINDOW_CENTER_X + curtainHalfSpan, winCenter, wallZ - 0.04);
  curtainR.rotation.y = -CURTAIN_TILT;
  scene.add(curtainR);

  // Curtain rod
  const rodMat = createToyMetalMaterial('hub_curtainRodMat', new Color(0.7, 0.6, 0.45));
  const rod = new Mesh(new CylinderGeometry(CURTAIN_ROD_DIAMETER / 2, CURTAIN_ROD_DIAMETER / 2, CURTAIN_ROD_LENGTH, 8), rodMat);
  rod.name = 'curtainRod';
  rod.position.set(WINDOW_CENTER_X, winTop + CURTAIN_ROD_OFFSET_Y, wallZ - 0.06);
  rod.rotation.z = Math.PI / 2;
  scene.add(rod);

  // Rod finials
  [-1, 1].forEach((side) => {
    const finial = new Mesh(new SphereGeometry(ROD_FINIAL_DIAMETER / 2, 8, 8), rodMat);
    finial.name = `rodFinial${side}`;
    finial.position.set(WINDOW_CENTER_X + side * ROD_FINIAL_OFFSET, winTop + CURTAIN_ROD_OFFSET_Y, wallZ - 0.06);
    scene.add(finial);
  });

  // Sunbeam — warm light patch on the floor
  const sunGeo = new PlaneGeometry(3, 2.5);
  sunGeo.rotateX(-Math.PI / 2);
  const sunPatchMat = createPlasticMaterial('hub_sunPatchMat', new Color(1.0, 0.95, 0.82));
  sunPatchMat.opacity = 0.35;
  sunPatchMat.transparent = true;
  const sunPatch = new Mesh(sunGeo, sunPatchMat);
  sunPatch.name = 'sunPatch';
  sunPatch.position.set(WINDOW_CENTER_X - 0.5, 0.025, 5.5);
  sunPatch.rotation.y = 0.15;
  scene.add(sunPatch);

  // Sunlight rays — subtle angled planes from window to floor
  const rayMat = createPlasticMaterial('hub_sunRayMat', new Color(1.0, 0.95, 0.8));
  rayMat.opacity = 0.08;
  rayMat.transparent = true;
  for (let ri = 0; ri < 3; ri++) {
    const ray = new Mesh(new PlaneGeometry(0.6, 4.5), rayMat);
    ray.name = `sunRay${ri}`;
    ray.position.set(WINDOW_CENTER_X - 0.6 + ri * 0.5, winCenter - 1.0, wallZ - 2.5);
    ray.rotation.x = -0.45;
    ray.rotation.y = Math.PI + 0.05 * (ri - 1);
    scene.add(ray);
  }
}

/**
 * Creates a window on the left wall (exterior) with outdoor view.
 * @param scene - The Three.js scene to add the left wall window to
 */
export function createLeftWallWindow(scene: Scene): void {
  const frameMat = createWoodMaterial('hub_leftWinFrameMat', new Color(0.9, 0.88, 0.85));
  const wallX = LEFT_WALL_FACE_X;

  // Position window on left wall away from corkboard (Z=-5)
  const winCenterZ = -5.0;
  const winW = 1.8;
  const winH = 1.6;
  const winCenterY = wallY(0.55);
  const winTop = winCenterY + winH / 2;
  const winBottom = winCenterY - winH / 2;

  // Outdoor scene
  createOutdoorView(scene, wallX - 0.02, winCenterY, winCenterZ, winW, winH, -Math.PI / 2);

  // Frame bars — sit flush in the wall
  const fb = 0.12;
  const fd = 0.1;

  // Top/bottom
  [winTop, winBottom].forEach((y, i) => {
    const bar = new Mesh(new BoxGeometry(fd, fb, winW + 2 * fb), frameMat);
    bar.name = `leftWinFrame${i === 0 ? 'Top' : 'Bot'}`;
    bar.position.set(wallX - fd / 2, y, winCenterZ);
    scene.add(bar);
  });

  // Sides
  [-1, 1].forEach((side, i) => {
    const bar = new Mesh(new BoxGeometry(fd, winH + fb, fb), frameMat);
    bar.name = `leftWinFrameSide${i}`;
    bar.position.set(wallX - fd / 2, winCenterY, winCenterZ + side * (winW / 2 + fb / 2));
    scene.add(bar);
  });

  // Mullions
  const mBar = 0.05;
  const mDepth = 0.06;
  const crossH = new Mesh(new BoxGeometry(mDepth, mBar, winW), frameMat);
  crossH.name = 'leftWinCrossH';
  crossH.position.set(wallX - mDepth / 2, winCenterY, winCenterZ);
  scene.add(crossH);

  const crossV = new Mesh(new BoxGeometry(mDepth, winH, mBar), frameMat);
  crossV.name = 'leftWinCrossV';
  crossV.position.set(wallX - mDepth / 2, winCenterY, winCenterZ);
  scene.add(crossV);

  // Simple curtains
  const curtainMat = createFeltMaterial('hub_leftWinCurtainMat', new Color(0.95, 0.8, 0.65));
  const curtainH = winH + 0.3;
  [-1, 1].forEach((side, i) => {
    const curtain = new Mesh(new BoxGeometry(0.06, curtainH, 0.35), curtainMat);
    curtain.name = `leftWinCurtain${i}`;
    curtain.position.set(wallX - 0.04, winCenterY, winCenterZ + side * (winW / 2 + 0.3));
    scene.add(curtain);
  });

  // Curtain rod
  const rodMat = createToyMetalMaterial('hub_leftWinRodMat', new Color(0.7, 0.6, 0.45));
  const rod = new Mesh(new CylinderGeometry(0.025, 0.025, winW + 1.0, 8), rodMat);
  rod.name = 'leftWinRod';
  rod.position.set(wallX - 0.05, winTop + 0.15, winCenterZ);
  rod.rotation.x = Math.PI / 2;
  scene.add(rod);

  // Sun patch on floor from left window
  const sunGeo = new PlaneGeometry(2.0, 1.5);
  sunGeo.rotateX(-Math.PI / 2);
  const sunMat = createPlasticMaterial('hub_leftWinSunMat', new Color(1.0, 0.95, 0.82));
  sunMat.opacity = 0.25;
  sunMat.transparent = true;
  const sunPatch = new Mesh(sunGeo, sunMat);
  sunPatch.name = 'leftWinSunPatch';
  sunPatch.position.set(wallX - 2.5, 0.025, winCenterZ);
  sunPatch.rotation.y = 0.3;
  scene.add(sunPatch);
}

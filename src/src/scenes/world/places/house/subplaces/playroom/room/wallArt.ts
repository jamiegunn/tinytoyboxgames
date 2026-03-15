import { BoxGeometry, CircleGeometry, Color, CylinderGeometry, Mesh, PlaneGeometry, SphereGeometry, type Scene } from 'three';
import { createGlossyPaintMaterial, createPaperMaterial, createPlasticMaterial, createWoodMaterial } from '@app/utils/materialFactory';
import { BACK_WALL_FACE_Z, BOOKSHELF_CENTER_X, LEFT_WALL_FACE_X, CEILING_Y } from '@app/scenes/world/places/house/subplaces/playroom/layout';

/**
 * Creates the framed picture above the bookshelf and Andy's art wall on the left.
 * @param scene - The Three.js scene to add wall art to
 */
export function createWallArt(scene: Scene): void {
  createBookshelfPicture(scene);
  createAndysWall(scene);
}

// ── Framed picture above bookshelf ──────────────────────────────────────────

/**
 * Creates a framed picture centered above the bookshelf on the back wall.
 * @param scene - The Three.js scene to add the picture to
 */
function createBookshelfPicture(scene: Scene): void {
  const wallZ = BACK_WALL_FACE_Z - 0.08; // in front of wall face
  const picY = CEILING_Y * 0.45 + 1.1; // moved up ~2 feet
  const picW = 1.8;
  const picH = 1.3;

  // Frame
  const frameMat = createWoodMaterial('hub_picFrameMat', new Color(0.55, 0.38, 0.22));
  const frameThick = 0.1;
  const frameDepth = 0.06;

  // Top/bottom bars
  [picH / 2, -picH / 2].forEach((yOff, i) => {
    const bar = new Mesh(new BoxGeometry(picW + frameThick * 2, frameThick, frameDepth), frameMat);
    bar.name = `picFrame${i === 0 ? 'Top' : 'Bot'}`;
    bar.position.set(BOOKSHELF_CENTER_X, picY + yOff, wallZ);
    scene.add(bar);
  });

  // Side bars
  [-1, 1].forEach((side, i) => {
    const bar = new Mesh(new BoxGeometry(frameThick, picH, frameDepth), frameMat);
    bar.name = `picFrameSide${i}`;
    bar.position.set(BOOKSHELF_CENTER_X + side * (picW / 2 + frameThick / 2), picY, wallZ);
    scene.add(bar);
  });

  // Canvas — a simple landscape: green ground, blue sky, yellow sun
  // All flat meshes face +Z by default; rotate to face -Z (toward camera)
  const canvasMat = createPlasticMaterial('hub_picCanvasMat', new Color(0.55, 0.78, 0.95));
  const canvas = new Mesh(new PlaneGeometry(picW, picH), canvasMat);
  canvas.name = 'picCanvas';
  canvas.position.set(BOOKSHELF_CENTER_X, picY, wallZ - 0.01);
  canvas.rotation.y = Math.PI;
  scene.add(canvas);

  // Ground strip — green hills
  const groundMat = createPlasticMaterial('hub_picGroundMat', new Color(0.35, 0.65, 0.25));
  const ground = new Mesh(new PlaneGeometry(picW, picH * 0.35), groundMat);
  ground.name = 'picGround';
  ground.position.set(BOOKSHELF_CENTER_X, picY - picH * 0.325, wallZ - 0.015);
  ground.rotation.y = Math.PI;
  scene.add(ground);

  // Sun — yellow circle
  const sunMat = createGlossyPaintMaterial('hub_picSunMat', new Color(1.0, 0.9, 0.3));
  sunMat.emissive = new Color(0.15, 0.12, 0.02);
  const sun = new Mesh(new CircleGeometry(0.15, 12), sunMat);
  sun.name = 'picSun';
  sun.position.set(BOOKSHELF_CENTER_X + 0.5, picY + 0.35, wallZ - 0.02);
  sun.rotation.y = Math.PI;
  scene.add(sun);

  // Simple hill bumps
  const hillMat = createPlasticMaterial('hub_picHillMat', new Color(0.3, 0.55, 0.2));
  const hills = [
    { x: -0.4, r: 0.3 },
    { x: 0.2, r: 0.25 },
    { x: 0.6, r: 0.22 },
  ];
  for (let i = 0; i < hills.length; i++) {
    const hill = new Mesh(new CircleGeometry(hills[i].r, 12), hillMat);
    hill.name = `picHill${i}`;
    hill.position.set(BOOKSHELF_CENTER_X + hills[i].x, picY - picH * 0.15, wallZ - 0.018);
    hill.rotation.y = Math.PI;
    scene.add(hill);
  }
}

// ── Andy's art wall ─────────────────────────────────────────────────────────

interface PictureConfig {
  z: number;
  y: number;
  w: number;
  h: number;
  rot: number;
  color: Color;
  frameColor: Color;
}

/**
 * Creates a collage of pinned pictures on a framed corkboard on the left wall.
 * @param scene - The Three.js scene to add the corkboard to
 */
function createAndysWall(scene: Scene): void {
  const wallX = LEFT_WALL_FACE_X - 0.03;

  // ── Corkboard — sized to contain all posters with padding ──
  const DROP = 1.1; // ~2 feet down
  // Poster extents: Z from -1.5 to 4.5, Y from 3.1 to 5.4 (plus poster sizes)
  const boardSpanZ = 7.5; // width along Z (covers all poster Z positions)
  const boardSpanY = 3.8; // height along Y (covers all poster Y positions)
  const boardCenterZ = 1.5;
  const boardCenterY = 4.3;

  // Cork surface — PlaneGeometry(width, height): after rotation.y=-PI/2, width→Z, height→Y
  const corkMat = createPaperMaterial('hub_corkMat', new Color(0.76, 0.6, 0.4));
  const cork = new Mesh(new PlaneGeometry(boardSpanZ, boardSpanY), corkMat);
  cork.name = 'corkBoard';
  cork.position.set(wallX, boardCenterY, boardCenterZ);
  cork.rotation.y = -Math.PI / 2;
  scene.add(cork);

  // Frame — four wood bars around the cork
  const frameMat = createWoodMaterial('hub_corkFrameMat', new Color(0.5, 0.35, 0.2));
  const frameThick = 0.12;
  const frameDepth = 0.08;

  // Top/bottom bars (run along Z)
  [boardSpanY / 2, -boardSpanY / 2].forEach((yOff, i) => {
    const bar = new Mesh(new BoxGeometry(frameDepth, frameThick, boardSpanZ + frameThick * 2), frameMat);
    bar.name = `corkFrame${i === 0 ? 'Top' : 'Bot'}`;
    bar.position.set(wallX - 0.01, boardCenterY + yOff, boardCenterZ);
    scene.add(bar);
  });

  // Side bars (run along Y)
  [boardSpanZ / 2, -boardSpanZ / 2].forEach((zOff, i) => {
    const bar = new Mesh(new BoxGeometry(frameDepth, boardSpanY + frameThick * 2, frameThick), frameMat);
    bar.name = `corkFrameSide${i}`;
    bar.position.set(wallX - 0.01, boardCenterY, boardCenterZ + zOff);
    scene.add(bar);
  });

  // ── Pictures — shifted down by DROP ──
  const pictures: PictureConfig[] = [
    {
      z: 2.0,
      y: 5.5 - DROP,
      w: 1.4,
      h: 1.0,
      rot: 0.03,
      color: new Color(0.95, 0.93, 0.88),
      frameColor: new Color(0, 0, 0),
    },
    {
      z: 0.5,
      y: 5.0 - DROP,
      w: 0.7,
      h: 0.9,
      rot: -0.12,
      color: new Color(0.98, 0.97, 0.95),
      frameColor: new Color(0.3, 0.3, 0.3),
    },
    {
      z: 3.5,
      y: 5.8 - DROP,
      w: 1.0,
      h: 0.8,
      rot: 0.08,
      color: new Color(0.9, 0.95, 0.88),
      frameColor: new Color(0, 0, 0),
    },
    {
      z: 1.5,
      y: 5.9 - DROP,
      w: 0.8,
      h: 0.6,
      rot: -0.15,
      color: new Color(1.0, 0.95, 0.85),
      frameColor: new Color(0, 0, 0),
    },
    {
      z: 4.5,
      y: 6.5 - DROP,
      w: 0.9,
      h: 0.7,
      rot: 0.2,
      color: new Color(0.92, 0.9, 0.98),
      frameColor: new Color(0, 0, 0),
    },
    {
      z: -0.5,
      y: 4.5 - DROP,
      w: 1.1,
      h: 0.8,
      rot: 0.0,
      color: new Color(0.95, 0.92, 0.85),
      frameColor: new Color(0, 0, 0),
    },
    {
      z: 2.8,
      y: 5.2 - DROP,
      w: 0.6,
      h: 0.5,
      rot: -0.08,
      color: new Color(0.88, 0.95, 0.92),
      frameColor: new Color(0, 0, 0),
    },
    {
      z: -1.5,
      y: 5.5 - DROP,
      w: 0.7,
      h: 1.2,
      rot: 0.05,
      color: new Color(0.98, 0.9, 0.85),
      frameColor: new Color(0, 0, 0),
    },
    {
      z: 3.0,
      y: 6.5 - DROP,
      w: 0.5,
      h: 0.4,
      rot: 0.18,
      color: new Color(0.95, 0.95, 0.98),
      frameColor: new Color(0, 0, 0),
    },
    {
      z: 0.8,
      y: 6.2 - DROP,
      w: 1.3,
      h: 0.6,
      rot: -0.06,
      color: new Color(0.9, 0.88, 0.95),
      frameColor: new Color(0, 0, 0),
    },
    {
      z: 4.0,
      y: 5.0 - DROP,
      w: 0.8,
      h: 0.7,
      rot: -0.2,
      color: new Color(0.96, 0.94, 0.88),
      frameColor: new Color(0, 0, 0),
    },
    {
      z: 1.0,
      y: 4.2 - DROP,
      w: 0.9,
      h: 0.7,
      rot: 0.1,
      color: new Color(0.92, 0.96, 0.9),
      frameColor: new Color(0, 0, 0),
    },
  ];

  // Kid drawing colors for scribbles on each picture
  const drawingColors = [
    new Color(0.9, 0.2, 0.2), // red
    new Color(0.2, 0.5, 0.9), // blue
    new Color(0.2, 0.75, 0.3), // green
    new Color(1.0, 0.7, 0.0), // orange
    new Color(0.7, 0.3, 0.8), // purple
    new Color(1.0, 0.85, 0.15), // yellow
  ];

  for (let i = 0; i < pictures.length; i++) {
    const pic = pictures[i];
    const paperMat = createPaperMaterial(`hub_andyPaper${i}`, pic.color);

    // Paper sheet — in front of corkboard (toward room centre = smaller X)
    const paper = new Mesh(new PlaneGeometry(pic.h, pic.w), paperMat);
    paper.name = `andyPic${i}`;
    paper.position.set(wallX - 0.02, pic.y, pic.z);
    paper.rotation.y = -Math.PI / 2;
    paper.rotation.z = pic.rot;
    scene.add(paper);

    // Crayon scribble — simple colored rectangles and circles on the paper
    const scribbleCount = 2 + (Math.floor(i * 0.7) % 3);
    for (let si = 0; si < scribbleCount; si++) {
      const col = drawingColors[(i + si) % drawingColors.length];
      const scribbleMat = createGlossyPaintMaterial(`hub_andyScribble${i}_${si}`, col);

      // Mix of shapes: rectangles and circles
      if ((i + si) % 2 === 0) {
        const scW = pic.w * (0.15 + si * 0.1);
        const scH = pic.h * (0.08 + si * 0.05);
        const scribble = new Mesh(new PlaneGeometry(scH, scW), scribbleMat);
        scribble.name = `andyScribble${i}_${si}`;
        const offZ = (si - scribbleCount / 2) * pic.w * 0.2;
        const offY = (si % 2 === 0 ? 0.05 : -0.08) * pic.h;
        scribble.position.set(wallX - 0.025, pic.y + offY, pic.z + offZ);
        scribble.rotation.y = -Math.PI / 2;
        scribble.rotation.z = pic.rot + (si * 0.15 - 0.1);
        scene.add(scribble);
      } else {
        const r = pic.w * 0.08;
        const scribble = new Mesh(new CircleGeometry(r, 8), scribbleMat);
        scribble.name = `andyScribble${i}_${si}`;
        const offZ = (si - 1) * pic.w * 0.15;
        const offY = (si % 2 === 0 ? -0.1 : 0.05) * pic.h;
        scribble.position.set(wallX - 0.025, pic.y + offY, pic.z + offZ);
        scribble.rotation.y = -Math.PI / 2;
        scene.add(scribble);
      }
    }

    // Pushpin — colorful round head with a short stem
    const pinColors = [new Color(0.85, 0.2, 0.2), new Color(0.2, 0.5, 0.85), new Color(0.2, 0.7, 0.3), new Color(1.0, 0.7, 0.0), new Color(0.7, 0.3, 0.8)];
    const pinHeadMat = createGlossyPaintMaterial(`hub_andyPin${i}`, pinColors[i % pinColors.length]);
    const pinHead = new Mesh(new SphereGeometry(0.04, 8, 8), pinHeadMat);
    pinHead.name = `andyPin${i}`;
    pinHead.position.set(wallX - 0.06, pic.y + pic.h * 0.35, pic.z);
    scene.add(pinHead);

    const pinStem = new Mesh(new CylinderGeometry(0.008, 0.008, 0.04, 6), createPlasticMaterial(`hub_andyPinStem${i}`, new Color(0.7, 0.7, 0.7)));
    pinStem.name = `andyPinStem${i}`;
    pinStem.position.set(0.03, 0, 0);
    pinStem.rotation.z = Math.PI / 2;
    pinHead.add(pinStem);
  }
}

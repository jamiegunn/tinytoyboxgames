import { BoxGeometry, CircleGeometry, Color, Group, Mesh, PlaneGeometry, type Scene } from 'three';
import { createGlossyPaintMaterial, createPaperMaterial, createWoodMaterial } from '@app/utils/materialFactory';
import { BACK_WALL_FACE_Z, WALL_ART_ABOVE_MANTEL, WALL_ART_RIGHT } from '../layout';

/** Uniform enlargement so the framed prints read clearly at camera distance. */
const FRAME_SCALE = 1.55;

/**
 * Creates one framed picture facing into the room, uniformly enlarged by
 * {@link FRAME_SCALE} so it reads at distance (children added to the returned
 * group inherit the enlargement).
 *
 * @param scene - The Three.js scene that receives the frame group.
 * @param name - Group name and material key prefix.
 * @param x - Center X on the back wall.
 * @param y - Center Y on the back wall.
 * @param width - Frame outer width before enlargement.
 * @param height - Frame outer height before enlargement.
 * @param canvasColor - Paper canvas tint.
 * @returns The frame group so callers can add picture contents.
 */
function createFrame(scene: Scene, name: string, x: number, y: number, width: number, height: number, canvasColor: Color): Group {
  const group = new Group();
  group.name = name;
  group.position.set(x, y, BACK_WALL_FACE_Z - 0.05);
  group.rotation.y = Math.PI;
  group.scale.setScalar(FRAME_SCALE);
  scene.add(group);

  const frameMat = createWoodMaterial(`${name}_frameMat`, new Color(0.6, 0.44, 0.28));
  const border = 0.08;

  const frame = new Mesh(new BoxGeometry(width, height, 0.06), frameMat);
  frame.name = `${name}_frame`;
  group.add(frame);

  const canvas = new Mesh(new PlaneGeometry(width - 2 * border, height - 2 * border), createPaperMaterial(`${name}_canvasMat`, canvasColor));
  canvas.name = `${name}_canvas`;
  canvas.position.z = 0.035;
  group.add(canvas);

  return group;
}

/**
 * Creates the framed pictures on the hearth wall: a little sun over hills
 * above the mantel and a crescent-moon print near the right corner. Flat
 * poster-style shapes, matching the Playroom's decal language, enlarged so
 * they hold their own next to the fireplace at camera distance.
 *
 * @param scene - The Three.js scene that receives the wall art.
 */
export function createWallArt(scene: Scene): void {
  // Sun-over-hills picture above the mantel.
  const sunPicture = createFrame(scene, 'livingRoom_artSun', WALL_ART_ABOVE_MANTEL.x, WALL_ART_ABOVE_MANTEL.y, 1.2, 0.9, new Color(0.93, 0.9, 0.78));

  const sun = new Mesh(new CircleGeometry(0.14, 20), createGlossyPaintMaterial('livingRoom_artSunDiscMat', new Color(0.98, 0.78, 0.3)));
  sun.name = 'artSunDisc';
  sun.position.set(-0.22, 0.14, 0.04);
  sunPicture.add(sun);

  const hillColors = [new Color(0.5, 0.7, 0.42), new Color(0.4, 0.6, 0.36)];
  hillColors.forEach((color, index) => {
    const hill = new Mesh(new CircleGeometry(0.3, 20), createGlossyPaintMaterial(`livingRoom_artHillMat${index}`, color));
    hill.name = `artHill${index}`;
    hill.position.set(-0.15 + index * 0.35, -0.32, 0.045 + index * 0.002);
    hill.scale.y = 0.55;
    sunPicture.add(hill);
  });

  // Crescent-moon print near the right corner.
  const moonPicture = createFrame(scene, 'livingRoom_artMoon', WALL_ART_RIGHT.x, WALL_ART_RIGHT.y, 0.75, 0.95, new Color(0.35, 0.4, 0.58));

  const moon = new Mesh(new CircleGeometry(0.16, 20), createGlossyPaintMaterial('livingRoom_artMoonDiscMat', new Color(0.96, 0.92, 0.72)));
  moon.name = 'artMoonDisc';
  moon.position.set(0.04, 0.1, 0.04);
  moonPicture.add(moon);

  const moonShadow = new Mesh(new CircleGeometry(0.14, 20), createGlossyPaintMaterial('livingRoom_artMoonShadowMat', new Color(0.35, 0.4, 0.58)));
  moonShadow.name = 'artMoonShadow';
  moonShadow.position.set(0.12, 0.14, 0.045);
  moonPicture.add(moonShadow);

  [-0.2, 0.18, -0.05].forEach((x, index) => {
    const star = new Mesh(new CircleGeometry(0.025, 8), createGlossyPaintMaterial('livingRoom_artStarMat', new Color(0.95, 0.9, 0.7)));
    star.name = `artStar${index}`;
    star.position.set(x, -0.2 + index * 0.06, 0.04);
    moonPicture.add(star);
  });
}

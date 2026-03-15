import { CircleGeometry, Color, Mesh, type Scene, Vector3 } from 'three';
import { createFeltMaterial, createGlossyPaintMaterial, createPlasticMaterial } from '@app/utils/materialFactory';
import { wallY, LEFT_DECAL_X } from '@app/scenes/world/places/house/subplaces/playroom/layout';

/**
 * Creates decorative decals on the left wall: clouds, stars, and baseboard sticker.
 * @param scene - The Three.js scene to add decals to
 */
export function createLeftWallDecals(scene: Scene): void {
  // Clouds
  const cloudMat = createPlasticMaterial('hub_leftCloudMat', new Color(0.92, 0.94, 0.98));
  cloudMat.emissive = new Color(0.05, 0.05, 0.06);
  const clouds = [
    { pos: new Vector3(LEFT_DECAL_X.layer1, wallY(0.45), 4.0), scale: 1.1 },
    { pos: new Vector3(LEFT_DECAL_X.layer1, wallY(0.6), 0.0), scale: 0.8 },
  ];
  const puffOffsets = [new Vector3(-0.2, 0, 0), new Vector3(0.1, 0.06, 0), new Vector3(0.3, -0.02, 0)];
  for (let ci = 0; ci < clouds.length; ci++) {
    const c = clouds[ci];
    for (let pi = 0; pi < puffOffsets.length; pi++) {
      const puff = new Mesh(new CircleGeometry(0.22 * c.scale, 10), cloudMat);
      puff.name = `leftCloud${ci}_${pi}`;
      puff.position.copy(c.pos);
      puff.rotation.y = -Math.PI / 2;
      puff.position.z += puffOffsets[pi].x * c.scale;
      puff.position.y += puffOffsets[pi].y * c.scale;
      scene.add(puff);
    }
  }

  // Stars
  const starMat = createFeltMaterial('hub_leftStarMat', new Color(1.0, 0.95, 0.7));
  starMat.emissive = new Color(0.08, 0.07, 0.04);
  const stars = [
    { pos: new Vector3(LEFT_DECAL_X.layer2, wallY(0.55), 2.5), r: 0.08, rotZ: 0.4 },
    { pos: new Vector3(LEFT_DECAL_X.layer2, wallY(0.7), 5.5), r: 0.05, rotZ: -0.1 },
  ];
  for (let si = 0; si < stars.length; si++) {
    const s = stars[si];
    const star = new Mesh(new CircleGeometry(s.r, 5), starMat);
    star.name = `leftStar${si}`;
    star.position.copy(s.pos);
    star.rotation.y = -Math.PI / 2;
    star.rotation.z = s.rotZ;
    scene.add(star);
  }

  // Star sticker near baseboard
  const baseStarMat = createGlossyPaintMaterial('hub_leftBaseStarMat', new Color(1.0, 0.9, 0.4));
  const bStar = new Mesh(new CircleGeometry(0.04, 5), baseStarMat);
  bStar.name = 'leftBaseStar0';
  bStar.position.set(LEFT_DECAL_X.layer1, 0.38, 2.0);
  bStar.rotation.y = -Math.PI / 2;
  bStar.rotation.z = 4 * 0.7;
  scene.add(bStar);
}

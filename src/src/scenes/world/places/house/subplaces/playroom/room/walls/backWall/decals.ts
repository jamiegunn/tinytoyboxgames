import { CircleGeometry, Color, Mesh, type MeshStandardMaterial, type Scene, Vector3 } from 'three';
import { createFeltMaterial, createGlossyPaintMaterial, createPlasticMaterial } from '@app/utils/materialFactory';
import { wallY, BACK_DECAL_Z } from '@app/scenes/world/places/house/subplaces/playroom/layout';

/**
 * Creates decorative decals on the back wall: clouds, stars, crescent moon, and baseboard stickers.
 * @param scene - The Three.js scene to add decals to
 * @param wallMat - The back wall material used for depth-offset alignment
 */
export function createBackWallDecals(scene: Scene, wallMat: MeshStandardMaterial): void {
  // Clouds — face camera with rotation.y = Math.PI
  const cloudMat = createPlasticMaterial('hub_backCloudMat', new Color(0.92, 0.94, 0.98));
  cloudMat.emissive = new Color(0.05, 0.05, 0.06);
  const clouds = [
    { pos: new Vector3(-2.5, wallY(0.55), BACK_DECAL_Z.layer1), scale: 1.6 },
    { pos: new Vector3(1.5, wallY(0.7), BACK_DECAL_Z.layer1), scale: 0.9 },
  ];
  const puffOffsets = [new Vector3(-0.2, 0, 0), new Vector3(0.1, 0.06, 0), new Vector3(0.3, -0.02, 0)];
  for (let ci = 0; ci < clouds.length; ci++) {
    const c = clouds[ci];
    for (let pi = 0; pi < puffOffsets.length; pi++) {
      const puff = new Mesh(new CircleGeometry(0.22 * c.scale, 10), cloudMat);
      puff.name = `backCloud${ci}_${pi}`;
      puff.position.copy(c.pos);
      puff.position.x += puffOffsets[pi].x * c.scale;
      puff.position.y += puffOffsets[pi].y * c.scale;
      puff.rotation.y = Math.PI;
      scene.add(puff);
    }
  }

  // Stars
  const starMat = createFeltMaterial('hub_backStarMat', new Color(1.0, 0.95, 0.7));
  starMat.emissive = new Color(0.08, 0.07, 0.04);
  const stars = [
    { pos: new Vector3(-1.0, wallY(0.65), BACK_DECAL_Z.layer2), r: 0.08, rotZ: 0.3 },
    { pos: new Vector3(1.5, wallY(0.58), BACK_DECAL_Z.layer2), r: 0.06, rotZ: -0.2 },
    { pos: new Vector3(5.0, wallY(0.7), BACK_DECAL_Z.layer2), r: 0.07, rotZ: 0.5 },
    { pos: new Vector3(-5.0, wallY(0.6), BACK_DECAL_Z.layer2), r: 0.09, rotZ: -0.4 },
    { pos: new Vector3(2.5, wallY(0.75), BACK_DECAL_Z.layer2), r: 0.05, rotZ: 0.1 },
    { pos: new Vector3(-3.5, wallY(0.72), BACK_DECAL_Z.layer2), r: 0.06, rotZ: 0.6 },
  ];
  for (let si = 0; si < stars.length; si++) {
    const s = stars[si];
    const star = new Mesh(new CircleGeometry(s.r, 5), starMat);
    star.name = `backStar${si}`;
    star.position.copy(s.pos);
    star.rotation.y = Math.PI;
    star.rotation.z = s.rotZ;
    scene.add(star);
  }

  // Crescent moon
  const moonMat = createFeltMaterial('hub_backMoonMat', new Color(1.0, 0.95, 0.75));
  moonMat.emissive = new Color(0.1, 0.08, 0.04);
  const moonFull = new Mesh(new CircleGeometry(0.2, 16), moonMat);
  moonFull.name = 'wallMoon';
  moonFull.position.set(4.5, wallY(0.68), BACK_DECAL_Z.layer2);
  moonFull.rotation.y = Math.PI;
  scene.add(moonFull);
  const moonCut = new Mesh(new CircleGeometry(0.18, 16), wallMat);
  moonCut.name = 'wallMoonCut';
  moonCut.position.set(4.6, wallY(0.69), BACK_DECAL_Z.layer2 - 0.005);
  moonCut.rotation.y = Math.PI;
  scene.add(moonCut);

  // Star stickers near baseboard
  const baseStarMat = createGlossyPaintMaterial('hub_backBaseStarMat', new Color(1.0, 0.9, 0.4));
  const baseStars = [new Vector3(-3.0, 0.4, BACK_DECAL_Z.layer1), new Vector3(1.0, 0.35, BACK_DECAL_Z.layer1), new Vector3(4.5, 0.45, BACK_DECAL_Z.layer1)];
  for (let bsi = 0; bsi < baseStars.length; bsi++) {
    const bStar = new Mesh(new CircleGeometry(0.04, 5), baseStarMat);
    bStar.name = `backBaseStar${bsi}`;
    bStar.position.copy(baseStars[bsi]);
    bStar.rotation.y = Math.PI;
    bStar.rotation.z = bsi * 0.7;
    scene.add(bStar);
  }
}

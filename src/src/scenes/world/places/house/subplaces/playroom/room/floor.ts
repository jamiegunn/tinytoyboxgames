import { Color, CylinderGeometry, Mesh, PlaneGeometry, RingGeometry, type Scene } from 'three';
import { createWoodMaterial, createWovenMaterial } from '@app/utils/materialFactory';
import {
  FLOOR_WIDTH,
  FLOOR_DEPTH,
  PLANK_SPACING,
  PLANK_HALF_COUNT,
  RUG_DIAMETER,
  RUG_THICKNESS,
  RUG_BAND_DIAMETERS,
} from '@app/scenes/world/places/house/subplaces/playroom/layout';

/**
 * Creates the wood floor, plank seams, and braided rug. Returns floor and rug meshes for click handling.
 * @param scene - The Three.js scene to add the floor to
 * @returns An object containing the floor and rug meshes
 */
export function createFloor(scene: Scene): { floor: Mesh; rug: Mesh } {
  const floorGeo = new PlaneGeometry(FLOOR_WIDTH, FLOOR_DEPTH);
  floorGeo.rotateX(-Math.PI / 2);
  const floor = new Mesh(floorGeo, createWoodMaterial('floorMat', new Color(0.72, 0.55, 0.35)));
  floor.name = 'floor';
  floor.receiveShadow = true;
  scene.add(floor);

  // Plank seams
  const seamMat = createWoodMaterial('hub_seamMat', new Color(0.58, 0.42, 0.26));
  for (let si = -PLANK_HALF_COUNT; si <= PLANK_HALF_COUNT; si++) {
    const seamGeo = new PlaneGeometry(FLOOR_DEPTH, 0.02);
    const seam = new Mesh(seamGeo, seamMat);
    seam.name = `floorSeam${si + PLANK_HALF_COUNT}`;
    seam.rotation.x = -Math.PI / 2;
    seam.position.set(si * PLANK_SPACING, 0.005, 0);
    seam.rotation.z = Math.PI / 2;
    scene.add(seam);
  }

  // Braided rug
  const rug = new Mesh(new CylinderGeometry(RUG_DIAMETER / 2, RUG_DIAMETER / 2, RUG_THICKNESS, 48), createWovenMaterial('rugMat', new Color(0.92, 0.85, 0.72)));
  rug.name = 'rug';
  rug.position.y = RUG_THICKNESS / 2;
  rug.receiveShadow = true;
  scene.add(rug);

  const rugBandColors: Color[] = [
    new Color(0.6, 0.35, 0.2),
    new Color(0.85, 0.25, 0.25),
    new Color(1.0, 0.6, 0.15),
    new Color(1.0, 0.85, 0.25),
    new Color(0.4, 0.75, 0.35),
    new Color(0.4, 0.6, 0.9),
    new Color(0.65, 0.4, 0.75),
  ];
  const bandWidth = 0.18;
  for (let ri = 0; ri < RUG_BAND_DIAMETERS.length; ri++) {
    const outerR = RUG_BAND_DIAMETERS[ri] / 2;
    const innerR = outerR - bandWidth;
    const ringGeo = new RingGeometry(innerR, outerR, 48);
    ringGeo.rotateX(-Math.PI / 2);
    const band = new Mesh(ringGeo, createWovenMaterial(`hub_rugBandMat${ri}`, rugBandColors[ri]));
    band.name = `rugBand${ri}`;
    band.position.y = RUG_THICKNESS + 0.005;
    scene.add(band);
  }

  return { floor, rug };
}

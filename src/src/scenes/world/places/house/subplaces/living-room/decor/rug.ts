import { Color, CylinderGeometry, Mesh, TorusGeometry, type Scene } from 'three';
import { createFeltMaterial } from '@app/utils/materialFactory';
import { RUG_RADIUS, RUG_X, RUG_Z } from '../layout';

/** Rug disc thickness. */
const RUG_THICKNESS = 0.05;

/** Concentric band radii, outer to inner. */
const BAND_RADII = [3.35, 2.65, 1.95] as const;

/**
 * Creates the round felt rug at the center of the Living Room: a soft rose
 * disc with concentric cream bands, echoing the Playroom's ringed rug.
 *
 * @param scene - The Three.js scene that receives the rug meshes.
 * @returns The rug disc mesh, registered as an owl floor-tap target.
 */
export function createRug(scene: Scene): Mesh {
  const rug = new Mesh(new CylinderGeometry(RUG_RADIUS, RUG_RADIUS, RUG_THICKNESS, 40), createFeltMaterial('livingRoom_rugMat', new Color(0.78, 0.5, 0.45)));
  rug.name = 'livingRoom_rug';
  rug.position.set(RUG_X, RUG_THICKNESS / 2, RUG_Z);
  rug.receiveShadow = true;
  scene.add(rug);

  const bandMaterial = createFeltMaterial('livingRoom_rugBandMat', new Color(0.93, 0.86, 0.74));
  BAND_RADII.forEach((radius, index) => {
    const band = new Mesh(new TorusGeometry(radius, 0.05, 8, 40), bandMaterial);
    band.name = `livingRoom_rugBand${index}`;
    band.position.set(RUG_X, RUG_THICKNESS + 0.005, RUG_Z);
    band.rotation.x = -Math.PI / 2;
    band.scale.z = 0.4;
    scene.add(band);
  });

  return rug;
}

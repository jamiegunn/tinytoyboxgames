import { Color, CylinderGeometry, Mesh, TorusGeometry, type Scene } from 'three';
import { createFeltMaterial } from '@app/utils/materialFactory';
import { RUG_X, RUG_Z } from '../layout';

/** Rug disc thickness. */
const RUG_THICKNESS = 0.05;

/** Base radius before the oval squash is applied. */
const RUG_RADIUS = 2.3;

/** Depth squash that turns the disc into an oval runner. */
const OVAL_SCALE_Z = 0.62;

/** Concentric band radii, outer to inner. */
const BAND_RADII = [2.1, 1.55] as const;

/**
 * Creates the oval sage rug in front of the counter run: a soft felt disc
 * squashed into a runner shape with two cream bands, echoing the Living
 * Room's ringed rug in the kitchen's green palette.
 *
 * @param scene - The Three.js scene that receives the rug meshes.
 * @returns The rug disc mesh, registered as an owl floor-tap target.
 */
export function createKitchenRug(scene: Scene): Mesh {
  const rug = new Mesh(new CylinderGeometry(RUG_RADIUS, RUG_RADIUS, RUG_THICKNESS, 40), createFeltMaterial('kitchen_rugMat', new Color(0.66, 0.72, 0.56)));
  rug.name = 'kitchen_rug';
  rug.position.set(RUG_X, RUG_THICKNESS / 2, RUG_Z);
  rug.scale.z = OVAL_SCALE_Z;
  rug.receiveShadow = true;
  scene.add(rug);

  const bandMaterial = createFeltMaterial('kitchen_rugBandMat', new Color(0.93, 0.88, 0.74));
  BAND_RADII.forEach((radius, index) => {
    const band = new Mesh(new TorusGeometry(radius, 0.05, 8, 40), bandMaterial);
    band.name = `kitchen_rugBand${index}`;
    band.position.set(RUG_X, RUG_THICKNESS + 0.005, RUG_Z);
    band.rotation.x = -Math.PI / 2;
    band.scale.y = OVAL_SCALE_Z;
    band.scale.z = 0.4;
    scene.add(band);
  });

  return rug;
}

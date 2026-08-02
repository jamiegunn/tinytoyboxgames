import type { PirateCoveMaterials } from '../../../../../materials';

/** Shared dependencies required to build one shipWheel. */
export interface ShipWheelBuildOptions {
  materials: Pick<PirateCoveMaterials, 'weatheredWood'>;
}

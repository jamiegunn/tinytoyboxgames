import type { PirateCoveMaterials } from '../../../../../materials';

/** Shared dependencies required to build one cannon. */
export interface CannonBuildOptions {
  materials: Pick<PirateCoveMaterials, 'metal' | 'weatheredWood'>;
}

import type { PirateCoveMaterials } from '../../../../../materials';

/** Shared dependencies required to build one treasureChest. */
export interface TreasureChestBuildOptions {
  materials: Pick<PirateCoveMaterials, 'chestWood' | 'gold' | 'metal'>;
}

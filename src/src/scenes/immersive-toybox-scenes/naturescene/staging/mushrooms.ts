import { Vector3 } from 'three';
import type { VariantStaging } from '../types';
import { MushroomVariant } from '../factory/props/interactive/mushrooms/config';

/** Casts 5 mushrooms in a cluster, each a different size and color variant. */
export const MUSHROOM_STAGING: readonly VariantStaging<MushroomVariant>[] = [
  { position: new Vector3(-1.5, 0, 1.5), variant: MushroomVariant.TallRed },
  { position: new Vector3(-2.0, 0, 1.0), variant: MushroomVariant.MediumRed },
  { position: new Vector3(-1.2, 0, 0.7), variant: MushroomVariant.Brown },
  { position: new Vector3(-1.8, 0, 2.2), variant: MushroomVariant.Cream },
  { position: new Vector3(3.5, 0, 2.5), variant: MushroomVariant.Pink },
];

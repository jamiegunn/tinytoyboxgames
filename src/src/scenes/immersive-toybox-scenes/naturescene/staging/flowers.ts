import { Vector3 } from 'three';
import type { VariantStaging } from '../types';
import { FlowerVariant } from '../factory/props/interactive/flowers/config';

/** Casts 5 flowers across the mid-ground, each a different color variant. */
export const FLOWER_STAGING: readonly VariantStaging<FlowerVariant>[] = [
  { position: new Vector3(2, 0, 2.5), variant: FlowerVariant.Blush },
  { position: new Vector3(2.8, 0, 1.8), variant: FlowerVariant.Violet },
  { position: new Vector3(1.5, 0, 3.0), variant: FlowerVariant.Marigold },
  { position: new Vector3(-3.5, 0, 1.5), variant: FlowerVariant.Rose },
  { position: new Vector3(4.0, 0, 0.5), variant: FlowerVariant.Bluebell },
];

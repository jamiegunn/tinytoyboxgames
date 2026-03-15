import { Vector3 } from 'three';
import type { VariantStaging } from '../types';
import { ButterflyVariant } from '../factory/props/interactive/butterflies/config';

/** Casts 4 butterflies hovering above the scene, each a different wing color variant. */
export const BUTTERFLY_STAGING: readonly VariantStaging<ButterflyVariant>[] = [
  { position: new Vector3(1.5, 1.5, 1), variant: ButterflyVariant.BlueMorpho },
  { position: new Vector3(-0.5, 1.8, 2), variant: ButterflyVariant.SunsetSkipper },
  { position: new Vector3(3.0, 1.3, -0.5), variant: ButterflyVariant.OrchidEmpress },
  { position: new Vector3(-2.5, 1.6, 0.5), variant: ButterflyVariant.MintSwallowtail },
];

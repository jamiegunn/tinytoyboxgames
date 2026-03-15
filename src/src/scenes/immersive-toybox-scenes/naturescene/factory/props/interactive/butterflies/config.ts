import { Color } from 'three';
import type { ButterflyConfig } from './types';

export const ButterflyVariant = {
  BlueMorpho: 'blueMorpho',
  SunsetSkipper: 'sunsetSkipper',
  OrchidEmpress: 'orchidEmpress',
  MintSwallowtail: 'mintSwallowtail',
} as const;

export type ButterflyVariant = (typeof ButterflyVariant)[keyof typeof ButterflyVariant];

const BUTTERFLY_CONFIGS: Record<ButterflyVariant, ButterflyConfig> = {
  [ButterflyVariant.BlueMorpho]: { wingColor: new Color(0.3, 0.6, 1) },
  [ButterflyVariant.SunsetSkipper]: { wingColor: new Color(1, 0.5, 0.2) },
  [ButterflyVariant.OrchidEmpress]: { wingColor: new Color(0.9, 0.3, 0.7) },
  [ButterflyVariant.MintSwallowtail]: { wingColor: new Color(0.3, 0.9, 0.5) },
};

/**
 * Retrieves the configuration for a specific butterfly variant.
 *
 * @param variant - The butterfly variant identifier.
 * @returns The butterfly configuration including wing color.
 */
export function getButterflyConfig(variant: ButterflyVariant): ButterflyConfig {
  return BUTTERFLY_CONFIGS[variant];
}

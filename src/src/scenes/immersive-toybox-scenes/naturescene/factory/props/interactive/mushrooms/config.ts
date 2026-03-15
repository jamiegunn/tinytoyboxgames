import { Color } from 'three';
import type { MushroomConfig } from './types';

export const MushroomVariant = {
  TallRed: 'tallRed',
  MediumRed: 'mediumRed',
  Brown: 'brown',
  Cream: 'cream',
  Pink: 'pink',
} as const;

export type MushroomVariant = (typeof MushroomVariant)[keyof typeof MushroomVariant];

const MUSHROOM_CONFIGS: Record<MushroomVariant, MushroomConfig> = {
  [MushroomVariant.TallRed]: { scale: 0.5, capColor: new Color(0.9, 0.2, 0.15) },
  [MushroomVariant.MediumRed]: { scale: 0.35, capColor: new Color(0.8, 0.15, 0.1) },
  [MushroomVariant.Brown]: { scale: 0.3, capColor: new Color(0.6, 0.4, 0.25) },
  [MushroomVariant.Cream]: { scale: 0.2, capColor: new Color(0.95, 0.85, 0.6) },
  [MushroomVariant.Pink]: { scale: 0.45, capColor: new Color(0.75, 0.25, 0.5) },
};

/**
 * Retrieves the configuration for a specific mushroom variant.
 *
 * @param variant - The mushroom variant identifier.
 * @returns The mushroom configuration including scale and cap color.
 */
export function getMushroomConfig(variant: MushroomVariant): MushroomConfig {
  return MUSHROOM_CONFIGS[variant];
}

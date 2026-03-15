import { Color } from 'three';
import type { FlowerConfig } from './types';

export const FlowerVariant = {
  Blush: 'blush',
  Violet: 'violet',
  Marigold: 'marigold',
  Rose: 'rose',
  Bluebell: 'bluebell',
} as const;

export type FlowerVariant = (typeof FlowerVariant)[keyof typeof FlowerVariant];

const FLOWER_CONFIGS: Record<FlowerVariant, FlowerConfig> = {
  [FlowerVariant.Blush]: { petalColor: new Color(1, 0.4, 0.6) },
  [FlowerVariant.Violet]: { petalColor: new Color(0.7, 0.4, 1) },
  [FlowerVariant.Marigold]: { petalColor: new Color(1, 0.8, 0.3) },
  [FlowerVariant.Rose]: { petalColor: new Color(1, 0.6, 0.8) },
  [FlowerVariant.Bluebell]: { petalColor: new Color(0.4, 0.6, 1) },
};

/**
 * Retrieves the configuration for a specific flower variant.
 *
 * @param variant - The flower variant identifier.
 * @returns The flower configuration including petal color.
 */
export function getFlowerConfig(variant: FlowerVariant): FlowerConfig {
  return FLOWER_CONFIGS[variant];
}

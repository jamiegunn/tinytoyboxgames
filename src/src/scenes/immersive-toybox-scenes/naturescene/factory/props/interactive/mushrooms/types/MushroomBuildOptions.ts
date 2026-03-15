import type { Material } from 'three';
import type { MushroomConfig } from './MushroomConfig';

export interface MushroomBuildOptions {
  config: MushroomConfig;
  materials: {
    stem: Material;
  };
}

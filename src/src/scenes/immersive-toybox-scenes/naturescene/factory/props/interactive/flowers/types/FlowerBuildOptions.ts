import type { Material } from 'three';
import type { FlowerConfig } from './FlowerConfig';

export interface FlowerBuildOptions {
  config: FlowerConfig;
  materials: {
    stem: Material;
  };
}

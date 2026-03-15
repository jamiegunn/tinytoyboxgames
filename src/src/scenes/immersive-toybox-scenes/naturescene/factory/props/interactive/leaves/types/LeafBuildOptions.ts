import type { Material } from 'three';

export interface LeafBuildOptions {
  materials: {
    body: Material;
    ladybug: Material;
    ladybugSpot: Material;
  };
}

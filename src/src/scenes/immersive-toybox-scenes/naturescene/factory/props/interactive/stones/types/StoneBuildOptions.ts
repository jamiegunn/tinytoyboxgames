import type { Material } from 'three';

export interface StoneBuildOptions {
  materials: {
    body: Material;
    grub: Material;
  };
}

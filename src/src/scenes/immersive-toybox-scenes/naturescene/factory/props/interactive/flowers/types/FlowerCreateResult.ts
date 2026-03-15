import type { Group, Mesh } from 'three';

export interface FlowerCreateResult {
  root: Group;
  tapTarget: Mesh;
  petals: Mesh[];
}

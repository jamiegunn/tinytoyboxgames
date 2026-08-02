import type { Group, Mesh } from 'three';

/** Typed handles returned to the interaction layer after mesh creation. */
export interface CannonCreateResult {
  root: Group;
  barrel: Mesh;
  tapTarget: Mesh;
}

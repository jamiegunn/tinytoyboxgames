import type { Group, Mesh } from 'three';

/** Typed handles returned to the interaction layer after mesh creation. */
export interface TreasureChestCreateResult {
  root: Group;
  lid: Group;
  tapTarget: Mesh;
}

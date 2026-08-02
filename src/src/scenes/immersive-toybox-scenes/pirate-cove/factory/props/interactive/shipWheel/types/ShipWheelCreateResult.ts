import type { Group, Mesh } from 'three';

/** Typed handles returned to the interaction layer after mesh creation. */
export interface ShipWheelCreateResult {
  root: Group;
  wheelGroup: Group;
  tapTarget: Mesh;
}

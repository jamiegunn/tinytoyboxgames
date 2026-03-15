import type { Group, Mesh } from 'three';
import type { LeafRevealHandle } from './LeafRevealHandle';

export interface LeafCreateResult {
  root: Group;
  tapTarget: Mesh;
  revealHandle: LeafRevealHandle;
}

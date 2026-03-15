import type { Group, Mesh } from 'three';
import type { StoneRevealHandle } from './StoneRevealHandle';

export interface StoneCreateResult {
  root: Group;
  tapTarget: Mesh;
  revealHandle: StoneRevealHandle;
}

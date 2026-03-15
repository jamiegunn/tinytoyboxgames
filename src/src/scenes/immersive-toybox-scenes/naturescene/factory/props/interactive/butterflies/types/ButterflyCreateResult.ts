import type { Group, Mesh } from 'three';
import type { IdleInterruptHandle } from '@app/utils/idleInterruptible';

export interface ButterflyCreateResult {
  root: Group;
  body: Mesh;
  fleeHandle: IdleInterruptHandle;
  killAnimations: () => void;
}

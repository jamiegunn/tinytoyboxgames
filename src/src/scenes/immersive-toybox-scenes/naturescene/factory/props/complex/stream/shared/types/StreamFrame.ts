import type { Vector3 } from 'three';

export interface StreamFrame {
  point: Vector3;
  tangent: Vector3;
  side: Vector3;
  waterWidth: number;
  bedWidth: number;
}

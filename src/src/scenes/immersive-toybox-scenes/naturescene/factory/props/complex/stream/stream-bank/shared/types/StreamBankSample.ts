import type { Vector3 } from 'three';
import type { StreamBankFrame } from './StreamBankFrame';

export interface StreamBankSample {
  t: number;
  sideSign: number;
  frame: StreamBankFrame;
  waterEdge: Vector3;
  wetEdge: Vector3;
  toe: Vector3;
  crest: Vector3;
  shoulder: Vector3;
}

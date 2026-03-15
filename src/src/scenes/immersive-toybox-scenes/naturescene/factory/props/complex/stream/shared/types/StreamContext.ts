import type { CatmullRomCurve3 } from 'three';
import type { StreamFrame } from './StreamFrame';

export interface StreamContext {
  curve: CatmullRomCurve3;
  curveLength: number;
  getFrame: (t: number) => StreamFrame;
  getWaterWidth: (t: number) => number;
  getBedWidth: (t: number) => number;
  getEndBlend: (t: number) => number;
}

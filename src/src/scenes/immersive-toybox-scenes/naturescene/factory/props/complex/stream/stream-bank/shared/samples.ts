import { Vector3 } from 'three';
import { fbm3 } from '@app/utils/noise3d';
import { getEndBlend, lerp } from './math';
import type { StreamBankFrame, StreamBankSample } from './types';

/**
 * @internal
 * @param frame - Stream bank frame at the current sample position.
 * @param sideSign - Side multiplier (-1 left, 1 right).
 * @param offset - Lateral offset from the stream centre.
 * @param height - Y-axis height of the bank point.
 * @param flowOffset - Longitudinal offset along the flow direction.
 * @returns A world-space Vector3 for the bank point.
 */
function createBankPoint(frame: StreamBankFrame, sideSign: number, offset: number, height: number, flowOffset: number): Vector3 {
  const point = frame.point.clone();
  point.addScaledVector(frame.side, sideSign * offset);
  point.addScaledVector(frame.tangent, flowOffset);
  point.y = height;
  return point;
}

/**
 * Generates an array of bank sample points along the stream for one side.
 * @param getFrame - Function returning a stream bank frame at parameter t
 * @param sideSign - Side multiplier (-1 for left, 1 for right)
 * @returns Array of StreamBankSample objects describing bank geometry at each row
 */
export function createBankSamples(getFrame: (t: number) => StreamBankFrame, sideSign: number): StreamBankSample[] {
  const samples: StreamBankSample[] = [];
  const rows = 40;

  for (let row = 0; row <= rows; row++) {
    const t = row / rows;
    const frame = getFrame(t);
    const endBlend = getEndBlend(t);
    const bankNoise = fbm3(t * 4.2 + sideSign * 1.3, 0.7, sideSign * 0.6, 4, 0.55, 2.0);
    const shoulderNoise = fbm3(t * 7.1 + 4.0, sideSign * 0.9, 1.8, 4, 0.5, 2.1);
    const crestNoise = fbm3(t * 9.3 + 8.0, sideSign * 1.4, 2.6, 4, 0.45, 2.2);
    const flowNoise = fbm3(t * 6.4 + 3.0, sideSign * 1.1, 4.2, 3, 0.55, 2.0);

    const waterEdgeOffset = frame.waterWidth * 0.5 + 0.014 + bankNoise * 0.01;
    const wetEdgeOffset = waterEdgeOffset + (0.05 + shoulderNoise * 0.014) * (0.45 + endBlend * 0.55);
    const toeOffset = wetEdgeOffset + (0.08 + crestNoise * 0.026) * (0.42 + endBlend * 0.58);
    const crestOffset = toeOffset + (0.16 + frame.bedWidth * 0.06 + bankNoise * 0.05 + shoulderNoise * 0.03) * (0.35 + endBlend * 0.65);
    const shoulderOffset = crestOffset + (0.12 + shoulderNoise * 0.055) * (0.3 + endBlend * 0.7);

    const waterEdgeHeight = 0.02 + bankNoise * 0.002;
    const wetEdgeHeight = lerp(0.022, 0.028 + shoulderNoise * 0.003, endBlend);
    const toeHeight = lerp(0.028, 0.047 + crestNoise * 0.009, endBlend);
    const crestHeight = lerp(0.048, 0.132 + bankNoise * 0.018 + shoulderNoise * 0.012, endBlend);
    const shoulderHeight = lerp(0.052, crestHeight + 0.008 - crestNoise * 0.006, endBlend);

    const flowOffset = flowNoise * 0.1;
    samples.push({
      t,
      sideSign,
      frame,
      waterEdge: createBankPoint(frame, sideSign, waterEdgeOffset, waterEdgeHeight, flowOffset * 0.35),
      wetEdge: createBankPoint(frame, sideSign, wetEdgeOffset, wetEdgeHeight, flowOffset * 0.5),
      toe: createBankPoint(frame, sideSign, toeOffset, toeHeight, flowOffset * 0.75),
      crest: createBankPoint(frame, sideSign, crestOffset, crestHeight, flowOffset * 0.45),
      shoulder: createBankPoint(frame, sideSign, shoulderOffset, shoulderHeight, flowOffset * 0.2),
    });
  }

  return samples;
}

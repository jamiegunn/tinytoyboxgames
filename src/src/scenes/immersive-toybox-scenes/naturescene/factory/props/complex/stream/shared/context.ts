import { CatmullRomCurve3, Vector3 } from 'three';
import { smooth01 } from '@app/utils/mathHelpers';
import { STREAM_POINTS } from './layout';
import type { StreamContext, StreamFrame } from './types';

function getStreamEndBlend(t: number): number {
  const start = smooth01(t / 0.09);
  const end = smooth01((1 - t) / 0.09);
  return Math.min(start, end);
}

function getBaseWaterWidth(t: number): number {
  return 1.05 + Math.sin(t * Math.PI * 1.35 + 0.3) * 0.16 + Math.sin(t * Math.PI * 4.6) * 0.05;
}

function getWaterWidth(t: number): number {
  return getBaseWaterWidth(t) * (0.18 + getStreamEndBlend(t) * 0.82);
}

function getBedWidth(t: number): number {
  return (getBaseWaterWidth(t) + 0.52 + Math.cos(t * Math.PI * 2.4 - 0.45) * 0.08) * (0.3 + getStreamEndBlend(t) * 0.7);
}

function getStreamFrame(curve: CatmullRomCurve3, t: number): StreamFrame {
  const safeT = Math.min(0.999, Math.max(0.001, t));
  const point = curve.getPointAt(t);
  const tangent = curve.getTangentAt(safeT).setY(0).normalize();
  const side = new Vector3(-tangent.z, 0, tangent.x).normalize();

  return {
    point,
    tangent,
    side,
    waterWidth: getWaterWidth(t),
    bedWidth: getBedWidth(t),
  };
}

/**
 * Creates the stream context containing the spline curve and width/frame lookup functions.
 * @returns A StreamContext with curve data, frame getter, and width functions
 */
export function createStreamContext(): StreamContext {
  const curve = new CatmullRomCurve3(STREAM_POINTS, false, 'catmullrom', 0.7);

  return {
    curve,
    curveLength: curve.getLength(),
    getFrame: (t) => getStreamFrame(curve, t),
    getWaterWidth,
    getBedWidth,
    getEndBlend: getStreamEndBlend,
  };
}

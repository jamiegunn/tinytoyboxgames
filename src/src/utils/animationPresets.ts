import { Vector3, Color } from 'three';
import type { PropertyAnimation } from './animationHelpers';

/**
 * Creates a squash-and-stretch bounce animation on the scale property.
 *
 * @param squashXZ - How much to widen on impact. @default 1.15
 * @param squashY - How much to compress Y on impact. @default 0.8
 * @param stretchXZ - How much XZ narrows on rebound. @default 0.9
 * @param stretchY - How much Y overshoots on rebound. @default 1.2
 * @param frames - Total animation duration in frames at 60 fps. @default 24
 * @returns A PropertyAnimation targeting 'scale'.
 */
export function createSquashBounce(squashXZ = 1.15, squashY = 0.8, stretchXZ = 0.9, stretchY = 1.2, frames = 24): PropertyAnimation {
  const f1 = Math.round(frames * 0.33);
  const f2 = Math.round(frames * 0.67);
  return {
    property: 'scale',
    keys: [
      { frame: 0, value: new Vector3(1, 1, 1) },
      { frame: f1, value: new Vector3(squashXZ, squashY, squashXZ) },
      { frame: f2, value: new Vector3(stretchXZ, stretchY, stretchXZ) },
      { frame: frames, value: new Vector3(1, 1, 1) },
    ],
  };
}

/**
 * Creates a damped oscillation (wiggle) animation on rotation.z.
 *
 * @param amplitude - Peak rotation in radians on the first swing. @default 0.15
 * @param decay - Multiplier applied each half-cycle (0..1). @default 0.7
 * @param frames - Total animation duration in frames at 60 fps. @default 16
 * @returns A PropertyAnimation targeting 'rotation.z'.
 */
export function createDampedWiggle(amplitude = 0.15, decay = 0.7, frames = 16): PropertyAnimation {
  const q = Math.round(frames / 4);
  return {
    property: 'rotation.z',
    keys: [
      { frame: 0, value: 0 },
      { frame: q, value: amplitude },
      { frame: q * 2, value: -(amplitude * decay) },
      { frame: q * 3, value: amplitude * decay * decay },
      { frame: frames, value: 0 },
    ],
  };
}

/**
 * Creates a hop (vertical arc) animation on position.y.
 *
 * @param baseY - Starting Y position. @default 0
 * @param height - How high the hop reaches above baseY. @default 0.4
 * @param settleY - Final Y (allows overshoot-settle). @default baseY
 * @param frames - Total animation duration in frames at 60 fps. @default 16
 * @returns A PropertyAnimation targeting 'position.y'.
 */
export function createHopArc(baseY = 0, height = 0.4, settleY?: number, frames = 16): PropertyAnimation {
  const peak = Math.round(frames * 0.5);
  return {
    property: 'position.y',
    keys: [
      { frame: 0, value: baseY },
      { frame: peak, value: baseY + height },
      { frame: frames, value: settleY ?? baseY },
    ],
  };
}

/**
 * Creates an emissive glow pulse animation on material.emissive.
 *
 * @param color - Peak emissive colour.
 * @param frames - Total animation duration in frames at 60 fps. @default 30
 * @returns A PropertyAnimation targeting 'material.emissive'.
 */
export function createGlowPulse(color: Color, frames = 30): PropertyAnimation {
  const peak = Math.round(frames * 0.33);
  return {
    property: 'material.emissive',
    keys: [
      { frame: 0, value: new Color(0, 0, 0) },
      { frame: peak, value: color },
      { frame: frames, value: new Color(0, 0, 0) },
    ],
  };
}

/**
 * Creates a looping idle sway animation on rotation.z.
 *
 * @param amplitude - Peak rotation in radians. @default 0.04
 * @param periodFrames - Full-cycle duration in frames at 60 fps. @default 135
 * @returns A PropertyAnimation targeting 'rotation.z'.
 */
export function createIdleSway(amplitude = 0.04, periodFrames = 135): PropertyAnimation {
  const q = Math.round(periodFrames / 3);
  return {
    property: 'rotation.z',
    keys: [
      { frame: 0, value: 0 },
      { frame: q, value: amplitude },
      { frame: q * 2, value: -amplitude },
      { frame: periodFrames, value: 0 },
    ],
  };
}

/**
 * Creates a full or partial spin animation on the specified rotation axis.
 *
 * @param axis - Rotation axis: 'x', 'y', or 'z'. @default 'y'
 * @param revolutions - Number of full rotations. @default 1
 * @param frames - Total animation duration in frames at 60 fps. @default 20
 * @returns A PropertyAnimation targeting 'rotation.{axis}'.
 */
export function createSpin(axis: 'x' | 'y' | 'z' = 'y', revolutions = 1, frames = 20): PropertyAnimation {
  return {
    property: `rotation.${axis}`,
    keys: [
      { frame: 0, value: 0 },
      { frame: frames, value: Math.PI * 2 * revolutions },
    ],
  };
}

/**
 * Creates a splat/flatten animation on the scale property.
 *
 * @param spreadXZ - Final XZ scale. @default 1.5
 * @param crushY - Final Y scale. @default 0.4
 * @param overshootXZ - Peak XZ before settling. @default spreadXZ * 1.2
 * @param frames - Total animation duration in frames at 60 fps. @default 20
 * @returns A PropertyAnimation targeting 'scale'.
 */
export function createSplatSpread(spreadXZ = 1.5, crushY = 0.4, overshootXZ?: number, frames = 20): PropertyAnimation {
  const ov = overshootXZ ?? spreadXZ * 1.2;
  const peak = Math.round(frames * 0.6);
  return {
    property: 'scale',
    keys: [
      { frame: 0, value: new Vector3(1, 1, 1) },
      { frame: peak, value: new Vector3(ov, crushY * 0.75, ov) },
      { frame: frames, value: new Vector3(spreadXZ, crushY, spreadXZ) },
    ],
  };
}

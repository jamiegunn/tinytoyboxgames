import type { Group, Mesh, Vector3 } from 'three';

export type OwlCleanup = () => void;

export interface OwlEyeParts {
  eyeGroup: Mesh;
  upperLid: Mesh;
  lowerLid: Mesh;
}

export interface OwlBuildParts {
  root: Group;
  body: Mesh;
  head: Mesh;
  leftEye: OwlEyeParts;
  rightEye: OwlEyeParts;
  wingL: Group;
  wingR: Group;
  legL: Group;
  legR: Group;
}

export interface OwlRuntimeDisposer {
  isDisposed: () => boolean;
  schedule: (fn: OwlCleanup, delayMs: number) => void;
  addCleanup: (cleanup: OwlCleanup) => void;
  removeCleanup: (cleanup: OwlCleanup) => void;
  disposeAll: () => void;
}

export interface OwlIdleHandle {
  doBlink: (closeMs: number) => void;
  acquirePoseControl: () => OwlCleanup;
  acquireBreathingPause: () => OwlCleanup;
}

export interface OwlActions {
  flyTo: (target: Vector3, onLand?: () => void) => void;
  tapReaction: () => void;
}

/** World-space volume that keeps owl flight inside the authored play area. */
export interface OwlFlightBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  minY: number;
  maxY: number;
}

/** Optional scene-owned overrides for perch orientation and flight limits. */
export interface OwlCompanionOptions {
  restFacingY?: number;
  flightBounds?: OwlFlightBounds;
}

/** Handle returned by createOwlCompanion for controlling the owl's behavior and lifecycle. */
export interface OwlCompanion {
  /** The root transform group - use for positioning and parenting. */
  root: Group;
  /** Commands the owl to fly along an arc to the target position with wing-flap animation. */
  flyTo: (target: Vector3, onLand?: () => void) => void;
  /** Plays the alert response: blink, head tilt, posture lift, and sparkle burst. */
  tapReaction: () => void;
  /** Stops all animations, clears timers, and disposes all owl meshes and materials. */
  dispose: () => void;
}

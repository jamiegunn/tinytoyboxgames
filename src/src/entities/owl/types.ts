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
  setSurfaceYAt: (resolve: ((x: number, z: number, floorY: number, bodyHeight: number) => number) | null) => void;
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
  /**
   * Where the owl's feet should meet the world at `(x, z)`, given the height the
   * tap resolved to and how tall the owl is.
   *
   * WITHOUT THIS THE OWL LANDS INSIDE THE FURNITURE. A tap's raycast only tests
   * REGISTERED targets and the only registered target on the floor-tap path is
   * the floor itself, so the ray goes straight through the fridge and returns a
   * point on the planking underneath it. Supplying this lets the landing code
   * ask what is actually at that spot.
   *
   * It takes the owl's BODY HEIGHT because the question is whether anything is
   * in the way, not what the tallest thing overhead is — a bird on the grass
   * under a tree is not inside the tree. See `@app/utils/scene/perchSurfaces`.
   */
  surfaceYAt?: (x: number, z: number, floorY: number, bodyHeight: number) => number;
}

/** Handle returned by createOwlCompanion for controlling the owl's behavior and lifecycle. */
export interface OwlCompanion {
  /** The root transform group - use for positioning and parenting. */
  root: Group;
  /** Commands the owl to fly along an arc to the target position with wing-flap animation. */
  flyTo: (target: Vector3, onLand?: () => void) => void;
  /** Plays the alert response: blink, head tilt, posture lift, and sparkle burst. */
  tapReaction: () => void;
  /**
   * Supplies (or clears) the surface-height lookup used when landing.
   *
   * IT HAS TO BE SETTABLE, AND THAT IS NOT A CONVENIENCE. `createRoomScene`
   * builds the owl BEFORE it builds the room's contents — the toyboxes need an
   * owl to fly at their lids — so at construction time the scene holds a floor
   * and nothing else. An owl that could only be told about surfaces in its
   * constructor would be told about an empty room, which is precisely how this
   * fix was dead in all three rooms until a mutation test asked whether removing
   * the wiring changed anything. It did not.
   */
  setSurfaceYAt: (resolve: ((x: number, z: number, floorY: number, bodyHeight: number) => number) | null) => void;
  /** Stops all animations, clears timers, and disposes all owl meshes and materials. */
  dispose: () => void;
}

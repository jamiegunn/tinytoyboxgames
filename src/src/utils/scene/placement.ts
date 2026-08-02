/**
 * Vocabulary for placing things in a scene by intent instead of by raw axis
 * literals.
 *
 * WHY THIS EXISTS
 * ---------------
 * Every scene in this repo positions props with hand-authored `Vector3(x, y, z)`
 * literals, and the axis convention behind them is easy to get backwards:
 *
 *     +X  ->  screen LEFT      (not right)
 *     +Y  ->  screen UP
 *     +Z  ->  AWAY from the camera, deeper into the scene
 *
 * +X reads LEFT because every scene camera looks ALONG +Z with +Y up, which
 * makes the screen-right vector -X. Measured, not assumed — see
 * `tests/framework/sceneAxes.test.mjs`, which projects the unit axes at each
 * scene's own opening pose and fails if any of the three flips.
 *
 * `onFloor({ side: 'left', across: 2.6, depth: -1.8 })` says what the author
 * means. `new Vector3(2.6, 0, -1.8)` requires the reader to remember which way
 * 2.6 points, and a reader who guesses gets a mirrored scene.
 *
 * THE FAILURE THIS VOCABULARY EXISTS TO PREVENT
 * ---------------------------------------------- Pirate Cove's ship wheel sits at
 * (0, 0, -5.0) and its Cannonball Splash portal sat at (0, 0, -1.5): same X,
 * different Z, and the eye is on x = 0 too. Three collinear points, so the
 * wheel stood directly in front of the only thing in that scene a child could
 * tap to start a game — measured at 72% covered at square aspect.
 *
 * The stage solver that placed the wheel DID check clearance. It checked deck
 * FOOTPRINT overlap: two props whose outlines do not intersect on the deck
 * plane. Footprint clearance and line-of-sight clearance are different
 * questions, and the second one is the one a player experiences.
 */

import { Vector3 } from 'three';

/**
 * Which side of the frame something should appear on.
 *
 * `'left'` and `'right'` are what the PLAYER sees, so the mapping to X is
 * inverted on purpose: screen left is +X.
 */
export type ScreenSide = 'left' | 'centre' | 'right';

/** Options for {@link onFloor}. */
export interface FloorPlacement {
  /** Which side of the frame. Defaults to `'centre'`. */
  side?: ScreenSide;
  /** How far to that side, in world units. Ignored for `'centre'`. Defaults to 0. */
  across?: number;
  /**
   * Depth relative to the scene origin. NEGATIVE is nearer the camera (nearer
   * the child); POSITIVE is deeper into the scene.
   */
  depth: number;
  /** Height above the floor. Defaults to 0. */
  height?: number;
}

/**
 * Builds a floor position from screen-relative intent.
 *
 * @param placement - Side of frame, distance across, depth, and height.
 * @returns The world position.
 */
export function onFloor({ side = 'centre', across = 0, depth, height = 0 }: FloorPlacement): Vector3 {
  const magnitude = side === 'centre' ? 0 : Math.abs(across);
  // Screen left is +X; screen right is -X. This single line is the whole
  // reason this function exists.
  const x = side === 'right' ? -magnitude : magnitude;
  return new Vector3(x, height, depth);
}

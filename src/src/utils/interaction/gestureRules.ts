/**
 * Interaction rules — the child-UX tap math, in one place.
 *
 * See architecture-standards.md#interactioncontroller. The two rules that
 * previously lived in only the mini-game dispatcher are centralised here so
 * every surface (scene props, mini-games, toyboxes, rooms) shares them:
 *
 * - **Toddler smear-tap forgiveness.** A tap that wobbles is still a tap. A
 *   gesture under {@link DRAG_THRESHOLD_PX} is always a tap; between the drag
 *   threshold and {@link WOBBLE_TAP_TOLERANCE_PX} it is still a tap *unless* the
 *   target actually supports dragging (then the wobble is a real drag).
 * - **Proximity fallback.** A tap that misses every mesh but lands within
 *   {@link PROXIMITY_PX} of a small target's screen projection still fires it.
 *
 * These are pure functions so they can be unit-tested exhaustively — the
 * controller wiring around them (raycast, pointer events, audio) is not where
 * the child-UX logic should be able to drift.
 */

/** Pointer path length (px) below which a gesture is unambiguously a tap. */
export const DRAG_THRESHOLD_PX = 10;

/**
 * Pointer path length (px) up to which a gesture on a *non-draggable* target is
 * still forgiven as a tap. Small children routinely smear 10–24px while tapping.
 */
export const WOBBLE_TAP_TOLERANCE_PX = 28;

/** Screen-space radius (px) for the small-target proximity fallback. */
export const PROXIMITY_PX = 70;

/** A classified pointer gesture. */
export type Gesture = 'tap' | 'drag';

/**
 * Classifies a finished pointer gesture as a tap or a drag, applying toddler
 * smear-tap forgiveness.
 *
 * @param totalDistancePx - Accumulated pointer path length in pixels.
 * @param targetSupportsDrag - Whether the target (or surface) handles dragging.
 * @returns `'tap'` or `'drag'`.
 */
export function classifyGesture(totalDistancePx: number, targetSupportsDrag: boolean): Gesture {
  if (totalDistancePx < DRAG_THRESHOLD_PX) return 'tap';
  // A draggable target treats anything past the drag threshold as a drag.
  if (targetSupportsDrag) return 'drag';
  // Non-draggable: a small wobble is still an intended tap.
  return totalDistancePx < WOBBLE_TAP_TOLERANCE_PX ? 'tap' : 'drag';
}

/** A registered target's screen-space projection (pixels). */
export interface ScreenPoint {
  x: number;
  y: number;
}

/**
 * Returns the index of the nearest screen point within `radiusPx` of a tap, or
 * -1 if none qualifies. Used for the small-target proximity fallback.
 *
 * @param tapX - Tap X in pixels.
 * @param tapY - Tap Y in pixels.
 * @param points - Candidate screen points (registered target projections).
 * @param radiusPx - Maximum distance in pixels to qualify.
 * @returns The nearest qualifying index, or -1.
 */
export function nearestPointWithin(tapX: number, tapY: number, points: readonly ScreenPoint[], radiusPx: number): number {
  let best = -1;
  let bestDistSq = radiusPx * radiusPx;
  for (let i = 0; i < points.length; i++) {
    const dx = points[i].x - tapX;
    const dy = points[i].y - tapY;
    const distSq = dx * dx + dy * dy;
    if (distSq <= bestDistSq) {
      bestDistSq = distSq;
      best = i;
    }
  }
  return best;
}

/**
 * Interaction system — public surface.
 *
 * See architecture-standards.md#interactioncontroller.
 */

export { createInteractionController } from './interactionController';
export type { InteractionController, TapHit, TapOptions, InteractionAudio } from './interactionController';
export { classifyGesture, nearestPointWithin, DRAG_THRESHOLD_PX, WOBBLE_TAP_TOLERANCE_PX, PROXIMITY_PX } from './gestureRules';
export type { Gesture, ScreenPoint } from './gestureRules';

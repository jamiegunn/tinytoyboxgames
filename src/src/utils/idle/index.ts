/**
 * Idle animation system — public surface.
 *
 * See architecture-standards.md#idleanimator. Import the animator, its option
 * types, and the per-scene registry from here.
 */

export { createIdleAnimator } from './idleAnimator';
export type { IdleAnimator, IdleHandle, BreatheOpts, SwingOpts, SpinOpts, FlickerOpts, Axis } from './idleAnimator';
export { getIdleAnimator, setSceneIdleAnimator } from './registry';

/**
 * Per-scene IdleAnimator registry.
 *
 * See architecture-standards.md#idleanimator. Deep decor/critter files receive
 * the `Scene` they build into but not its disposal scope (that threading arrives
 * with SceneDescriptor in Phase 7). Until then, the lifecycle owner
 * (`MiniGameShell` / `SceneFrame`) creates one animator per scene, bound to that
 * scene's scope, and registers it here; call sites reach it with
 * `getIdleAnimator(scene)`. Mirrors the particle-engine registry exactly.
 */

import type { Scene } from 'three';
import { createIdleAnimator, type IdleAnimator } from './idleAnimator';
import type { DisposalScope } from '@app/utils/disposal';

const registry = new WeakMap<Scene, IdleAnimator>();

/** No-op animator returned when a scene has no registered animator (dev warning path). */
const NOOP: IdleAnimator = {
  breathe: () => ({ stop() {} }),
  sway: () => ({ stop() {} }),
  bob: () => ({ stop() {} }),
  spin: () => ({ stop() {} }),
  flicker: () => ({ stop() {} }),
  loop: () => ({ stop() {} }),
  register: (t) => t,
};

/**
 * Creates an idle animator for a scene and registers it for `getIdleAnimator`.
 * Call once per scene instance from the lifecycle owner.
 *
 * @param scene - The scene to bind the animator to.
 * @param scope - The scene's DisposalScope (kills every idle tween on teardown).
 * @returns The created animator.
 */
export function setSceneIdleAnimator(scene: Scene, scope: DisposalScope): IdleAnimator {
  const animator = createIdleAnimator(scope);
  registry.set(scene, animator);
  scope.add(() => {
    if (registry.get(scene) === animator) registry.delete(scene);
  });
  return animator;
}

/**
 * Returns the IdleAnimator registered for a scene.
 *
 * If none is registered, returns a no-op animator and warns rather than
 * throwing — a missing idle wobble must never crash a scene.
 *
 * @param scene - The scene to look up.
 * @returns The scene's animator, or a no-op animator.
 */
export function getIdleAnimator(scene: Scene): IdleAnimator {
  const animator = registry.get(scene);
  if (animator) return animator;
  console.warn('[idle] no animator registered for scene; idle animation skipped');
  return NOOP;
}

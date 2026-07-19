/**
 * Per-scene runtime registry — the FrameClock and DisposalScope for a scene,
 * reachable by deep call sites that only hold the `Scene`.
 *
 * See architecture-standards.md#frameclock and #disposalscope. This is the same
 * pattern as the particle-engine and idle-animator registries: the lifecycle
 * owner (`SceneFrame` / `MiniGameShell`) publishes the scene's clock and scope
 * here, so an effect buried in a prop factory can subscribe to the *shared*
 * per-frame pump and register its teardown instead of starting a private
 * `requestAnimationFrame` loop that outlives the scene.
 */

import type { Scene } from 'three';
import type { FrameClock } from '@app/utils/frameClock';
import type { DisposalScope } from '@app/utils/disposal';

const clocks = new WeakMap<Scene, FrameClock>();
const scopes = new WeakMap<Scene, DisposalScope>();

/**
 * Publishes a scene's clock and disposal scope. Called once per scene instance
 * by the lifecycle owner; the entries are cleared when the scope disposes.
 *
 * @param scene - The scene to bind.
 * @param clock - The scene's FrameClock.
 * @param scope - The scene's DisposalScope.
 */
export function setSceneRuntime(scene: Scene, clock: FrameClock, scope: DisposalScope): void {
  clocks.set(scene, clock);
  scopes.set(scene, scope);
  scope.add(() => {
    if (clocks.get(scene) === clock) clocks.delete(scene);
    if (scopes.get(scene) === scope) scopes.delete(scene);
  });
}

/**
 * Returns the scene's FrameClock, or null if none is registered.
 *
 * @param scene - The scene to look up.
 * @returns The FrameClock, or null.
 */
export function getSceneClock(scene: Scene): FrameClock | null {
  return clocks.get(scene) ?? null;
}

/**
 * Returns the scene's DisposalScope, or null if none is registered.
 *
 * @param scene - The scene to look up.
 * @returns The DisposalScope, or null.
 */
export function getSceneDisposal(scene: Scene): DisposalScope | null {
  return scopes.get(scene) ?? null;
}

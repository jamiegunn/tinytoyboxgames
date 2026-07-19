/**
 * Per-scene ParticleEngine registry.
 *
 * See architecture-standards.md#particleengine. Deep prop/interaction call
 * sites already receive the `Scene` they draw into but not the scene's clock or
 * disposal scope (that threading arrives with SceneDescriptor in Phase 7). Until
 * then, the lifecycle owner (`MiniGameShell` / `SceneFrame`) creates one engine
 * per scene and registers it here; call sites reach it with
 * `getParticleEngine(scene)`.
 *
 * Keyed weakly on the Scene, so an engine entry is collected when its scene is.
 * `SceneFrame` reuses one Scene across room switches, so it re-registers a fresh
 * engine (bound to the new clock+scope) on each load, overwriting the entry.
 */

import type { Scene } from 'three';
import { createParticleEngine, type ParticleEngine } from './engine';
import type { FrameClock } from '@app/utils/frameClock';
import type { DisposalScope } from '@app/utils/disposal';

const registry = new WeakMap<Scene, ParticleEngine>();

/** A no-op engine returned when a scene has no registered engine (dev warning path). */
const NOOP_ENGINE: ParticleEngine = {
  emit() {},
  stream() {
    return { stop() {}, start() {}, setRate() {} };
  },
};

/**
 * Creates a ParticleEngine for a scene and registers it for `getParticleEngine`.
 * Call once per scene instance from the lifecycle owner.
 *
 * @param scene - The scene to bind the engine to.
 * @param clock - The scene's FrameClock.
 * @param scope - The scene's DisposalScope (tears the engine down).
 * @returns The created engine.
 */
export function setSceneParticleEngine(scene: Scene, clock: FrameClock, scope: DisposalScope): ParticleEngine {
  const engine = createParticleEngine(scene, clock, scope);
  registry.set(scene, engine);
  // The engine's own teardown is registered on `scope`; also drop the registry
  // entry so a stale engine is never handed out after disposal.
  scope.add(() => {
    if (registry.get(scene) === engine) registry.delete(scene);
  });
  return engine;
}

/**
 * Returns the ParticleEngine registered for a scene.
 *
 * If none is registered (a scene that never called `setSceneParticleEngine`),
 * returns a no-op engine and warns, rather than throwing — a missing sparkle
 * must never crash gameplay for a toddler.
 *
 * @param scene - The scene to look up.
 * @returns The scene's engine, or a no-op engine.
 */
export function getParticleEngine(scene: Scene): ParticleEngine {
  const engine = registry.get(scene);
  if (engine) return engine;
  console.warn('[particles] no engine registered for scene; effect dropped');
  return NOOP_ENGINE;
}

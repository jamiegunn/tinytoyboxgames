import { Vector3, type Scene } from 'three';
import { getParticleEngine } from '@app/utils/particles/registry';
import { PARTICLES, OWL_TRAIL_RATE } from '@app/utils/particles/presets';

/**
 * Owl particle effects, backed by the per-scene ParticleEngine.
 *
 * See architecture-standards.md#particleengine. Previously each effect built
 * its own `SimpleParticleSystem` and scheduled a manual dispose through the owl
 * runtime; now the engine owns particle lifetime (particles fade on their own,
 * the shared batch is freed by the scene's disposal scope), so bursts are
 * fire-and-forget and the trail exposes only stop/dispose.
 */

/** Handle for stopping or force-disposing the owl's flight trail. */
export interface OwlFlightTrailHandle {
  stop: () => void;
  dispose: () => void;
}

/**
 * Spawns the short sparkle burst used by the owl's tap reaction.
 *
 * @param scene - The scene that owns the particle engine.
 * @param origin - World-space origin of the burst.
 */
export function spawnAlertBurst(scene: Scene, origin: Vector3): void {
  getParticleEngine(scene).emit(PARTICLES.owlAlert, origin);
}

/**
 * Starts the continuous sparkle trail used while the owl is flying. The stream
 * reads the emitter position every tick, so the trail follows the owl.
 *
 * @param scene - The scene that owns the particle engine.
 * @param getEmitterPosition - Callback returning the current emitter position.
 * @returns Handle for stopping or force-disposing the trail.
 */
export function startFlightTrail(scene: Scene, getEmitterPosition: () => Vector3): OwlFlightTrailHandle {
  const stream = getParticleEngine(scene).stream(PARTICLES.owlTrail, getEmitterPosition, OWL_TRAIL_RATE);
  // stop and dispose both just stop emitting — the shared batch is released by
  // the scene's disposal scope, so there is nothing per-trail to free.
  return { stop: () => stream.stop(), dispose: () => stream.stop() };
}

/**
 * Spawns the celebratory landing burst at the owl's feet.
 *
 * @param scene - The scene that owns the particle engine.
 * @param origin - World-space origin of the burst.
 */
export function spawnLandingBurst(scene: Scene, origin: Vector3): void {
  getParticleEngine(scene).emit(PARTICLES.owlLanding, origin);
}

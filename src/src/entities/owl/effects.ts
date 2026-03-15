import gsap from 'gsap';
import { Color, Vector3, type Scene } from 'three';
import { SimpleParticleSystem } from '@app/utils/particles';
import type { OwlRuntimeDisposer } from './types';

const ALERT_BURST_DISPOSE_MS = 700;
const FLIGHT_TRAIL_DISPOSE_MS = 500;
const LANDING_BURST_DISPOSE_MS = 800;

export interface OwlFlightTrailHandle {
  stop: () => void;
  dispose: () => void;
}

/**
 * Registers a particle system cleanup with the shared owl runtime.
 *
 * @param runtime - Runtime cleanup registry for teardown.
 * @param system - Particle system instance to clean up.
 * @param extraCleanup - Optional callback for related tween or timer cleanup.
 * @returns Cleanup function that can be scheduled or called immediately.
 */
function registerParticleCleanup(runtime: OwlRuntimeDisposer, system: SimpleParticleSystem, extraCleanup?: () => void): () => void {
  let disposed = false;

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    extraCleanup?.();
    system.stop();
    system.dispose();
    runtime.removeCleanup(dispose);
  };

  runtime.addCleanup(dispose);
  return dispose;
}

/**
 * Spawns the short sparkle burst used by the owl's tap reaction.
 *
 * @param scene - The scene that should receive the particle system.
 * @param origin - World-space origin of the burst.
 * @param runtime - Runtime cleanup registry for teardown and delayed disposal.
 */
export function spawnAlertBurst(scene: Scene, origin: Vector3, runtime: OwlRuntimeDisposer): void {
  const burst = new SimpleParticleSystem(10, 'additive');
  burst.configure({
    emitterPosition: origin,
    minLifeTime: 0.25,
    maxLifeTime: 0.45,
    minSize: 0.012,
    maxSize: 0.035,
    color1: new Color(1, 0.95, 0.8),
    alpha1: 0.7,
    color2: new Color(1, 0.88, 0.6),
    alpha2: 0.4,
    gravity: new Vector3(0, -0.2, 0),
    direction1: new Vector3(-0.3, 0.5, -0.3),
    direction2: new Vector3(0.3, 1.0, 0.3),
    minEmitPower: 0.15,
    maxEmitPower: 0.5,
  });
  burst.burst(8);
  burst.stop();
  burst.start(scene);

  const dispose = registerParticleCleanup(runtime, burst);
  runtime.schedule(dispose, ALERT_BURST_DISPOSE_MS);
}

/**
 * Starts the continuous sparkle trail used while the owl is flying.
 *
 * @param scene - The scene that should receive the particle system.
 * @param getEmitterPosition - Callback returning the current emitter position.
 * @param durationSec - Planned flight duration used to scope the updater tween.
 * @param runtime - Runtime cleanup registry for teardown and delayed disposal.
 * @returns Handle for stopping or force-disposing the trail.
 */
export function startFlightTrail(scene: Scene, getEmitterPosition: () => Vector3, durationSec: number, runtime: OwlRuntimeDisposer): OwlFlightTrailHandle {
  const trail = new SimpleParticleSystem(16, 'additive');
  trail.configure({
    emitterPosition: getEmitterPosition(),
    emitRate: 12,
    minLifeTime: 0.2,
    maxLifeTime: 0.45,
    minSize: 0.01,
    maxSize: 0.03,
    color1: new Color(1, 0.95, 0.8),
    alpha1: 0.45,
    color2: new Color(1, 0.88, 0.6),
    alpha2: 0.25,
    gravity: new Vector3(0, -0.15, 0),
    direction1: new Vector3(-0.12, -0.08, -0.12),
    direction2: new Vector3(0.12, 0.08, 0.12),
    minEmitPower: 0.06,
    maxEmitPower: 0.18,
  });
  trail.start(scene);

  const updateTween = gsap.to(
    {},
    {
      duration: durationSec,
      onUpdate: () => {
        trail.configure({ emitterPosition: getEmitterPosition() });
      },
    },
  );

  const dispose = registerParticleCleanup(runtime, trail, () => {
    updateTween.kill();
  });

  let stopped = false;
  return {
    stop: () => {
      if (stopped) return;
      stopped = true;
      updateTween.kill();
      trail.stop();
      runtime.schedule(dispose, FLIGHT_TRAIL_DISPOSE_MS);
    },
    dispose,
  };
}

/**
 * Spawns the celebratory landing burst at the owl's feet.
 *
 * @param scene - The scene that should receive the particle system.
 * @param origin - World-space origin of the burst.
 * @param runtime - Runtime cleanup registry for teardown and delayed disposal.
 */
export function spawnLandingBurst(scene: Scene, origin: Vector3, runtime: OwlRuntimeDisposer): void {
  const burst = new SimpleParticleSystem(24, 'additive');
  burst.configure({
    emitterPosition: origin,
    emitRate: 0,
    minLifeTime: 0.3,
    maxLifeTime: 0.6,
    minSize: 0.015,
    maxSize: 0.04,
    color1: new Color(1, 0.95, 0.7),
    alpha1: 0.8,
    color2: new Color(1, 0.8, 0.4),
    alpha2: 0.3,
    gravity: new Vector3(0, -0.1, 0),
    direction1: new Vector3(-0.5, 0.3, -0.5),
    direction2: new Vector3(0.5, 0.8, 0.5),
    minEmitPower: 0.15,
    maxEmitPower: 0.4,
  });
  burst.burst(18);
  burst.stop();
  burst.start(scene);

  const dispose = registerParticleCleanup(runtime, burst);
  runtime.schedule(dispose, LANDING_BURST_DISPOSE_MS);
}

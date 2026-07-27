import { Vector3 } from 'three';
import type { EnvironmentObjects } from '../types';
import { tmpColor } from '../tempPool';

/**
 * Per-frame environment animation and event-driven responses — star twinkle,
 * star pulse on pop, and moon glow pulse/decay.
 */

/**
 * Per-frame environment update: twinkle stars.
 * @param env - The environment objects.
 * @param time - Elapsed time in seconds.
 */
export function updateEnvironment(env: EnvironmentObjects, time: number): void {
  for (const star of env.stars) {
    const twinkle = Math.sin(time * star.twinkleSpeed + star.twinklePhase);
    const intensity = star.baseIntensity + twinkle * 0.25;
    const scale = Math.max(0.1, intensity);
    star.mat.emissive.setRGB(star.color.r * scale, star.color.g * scale, star.color.b * scale);
    star.mat.opacity = 0.4 + intensity * 0.4;
  }
}

/**
 * Pulses nearby stars in response to a bubble pop.
 * @param env - The environment objects.
 * @param popPosition - World position of the popped bubble.
 */
export function pulseNearbyStars(env: EnvironmentObjects, popPosition: Vector3): void {
  let pulsed = 0;
  for (const star of env.stars) {
    if (pulsed >= 3) break;
    const dist = star.mesh.position.distanceTo(popPosition);
    if (dist < 6) {
      star.baseIntensity = Math.min(1.2, star.baseIntensity + 0.4);
      pulsed++;
    }
  }
}

/**
 * Decays star intensities back toward resting values each frame.
 * @param env - The environment objects.
 * @param deltaTime - Frame delta time.
 */
export function decayStarPulses(env: EnvironmentObjects, deltaTime: number): void {
  for (const star of env.stars) {
    if (star.baseIntensity > 0.8) {
      star.baseIntensity -= deltaTime * 0.5;
      const restingFloor = 0.3 + Math.random() * 0.5;
      if (star.baseIntensity < restingFloor) {
        star.baseIntensity = restingFloor;
      }
    }
  }
}

/**
 * Resting moon tint. The moon's materials are unlit and their `color` is a
 * plain multiplier over the disc/glow textures, which already carry the moon's
 * shading and warm-to-cool tint — so at rest the multiplier is exactly 1 and
 * the moon looks the way it was painted. It used to be (0.6, 0.55, 0.35),
 * dimming an emissive term rather than scaling a finished image.
 */
const MOON_REST_R = 1.0;
const MOON_REST_G = 1.0;
const MOON_REST_B = 1.0;

/**
 * Pulses the moon briefly brighter.
 *
 * The renderer tone-maps with ACES at exposure 1.15, which compresses hard
 * near 1.0, so a small multiplier would not register: the disc texture peaks
 * at 206/255 (linear 0.617) precisely to leave room, and 1.8x lifts that to
 * 1.11 linear — a clearly visible lift, still short of a harsh white flash.
 * The glow is pushed further (2.2x) because a spreading halo is what actually
 * reads as "the moon noticed" from across the room.
 *
 * @param env - The environment objects.
 */
export function pulseMoon(env: EnvironmentObjects): void {
  env.moonMat?.color.setRGB(1.8, 1.74, 1.55);
  env.moonGlowMat?.color.setRGB(2.2, 2.1, 1.85);
}

/**
 * Decays the moon pulse back to its resting tint each frame.
 * @param env - The environment objects.
 * @param deltaTime - Frame delta time.
 */
export function decayMoonPulse(env: EnvironmentObjects, deltaTime: number): void {
  const rest = tmpColor(0).setRGB(MOON_REST_R, MOON_REST_G, MOON_REST_B);
  // deltaTime * 2 is a ~0.5s time constant: long enough to see, short enough
  // that the next pulse (every MOON_PULSE_INTERVAL pops) starts from rest.
  env.moonMat?.color.lerp(rest, deltaTime * 2);
  env.moonGlowMat?.color.lerp(rest, deltaTime * 2);
}

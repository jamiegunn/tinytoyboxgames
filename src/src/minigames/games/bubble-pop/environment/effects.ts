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

/** Resting moon emissive color. */
const MOON_REST_R = 0.6;
const MOON_REST_G = 0.55;
const MOON_REST_B = 0.35;

/**
 * Pulses the moon glow briefly brighter.
 * @param env - The environment objects.
 */
export function pulseMoon(env: EnvironmentObjects): void {
  if (!env.moonMat) return;
  env.moonMat.emissive.setRGB(0.9, 0.85, 0.55);
}

/**
 * Decays moon glow back to its resting color each frame.
 * @param env - The environment objects.
 * @param deltaTime - Frame delta time.
 */
export function decayMoonPulse(env: EnvironmentObjects, deltaTime: number): void {
  if (!env.moonMat) return;
  const t = tmpColor(0).setRGB(MOON_REST_R, MOON_REST_G, MOON_REST_B);
  env.moonMat.emissive.lerp(t, deltaTime * 2);
}

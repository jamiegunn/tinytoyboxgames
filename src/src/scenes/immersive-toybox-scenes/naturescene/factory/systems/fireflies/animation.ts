/**
 * Drift and blink animation logic for individual fireflies.
 *
 * Both startDrift and startBlink use gsap.context() for scoped cleanup —
 * all tweens created inside a context are killed automatically by
 * ctx.revert(), eliminating the need for manual tween tracking or
 * killed-flag bookkeeping.
 */
import { Vector3, type Color, type Mesh, type PointLight, type MeshStandardMaterial } from 'three';
import gsap from 'gsap';
import { rand } from '@app/utils/randomHelpers';
import type { FireflyConfig } from './types';

/**
 * Generates a random drift destination near a home position.
 * @param home - The firefly's home position.
 * @param range - Maximum drift distance from home.
 * @returns A new Vector3 near the home position.
 */
function randomDrift(home: Vector3, range: number): Vector3 {
  return new Vector3(rand.spread(home.x, range), Math.max(0.4, rand.spread(home.y, range * 0.6)), rand.spread(home.z, range));
}

/**
 * Starts a looping drift animation that moves a firefly between
 * random waypoints near its home position.
 *
 * @param fly - The firefly mesh to animate.
 * @param home - The firefly's home position.
 * @returns A cleanup function that kills the drift tween chain.
 */
export function startDrift(fly: Mesh, home: Vector3): () => void {
  const ctx = gsap.context(() => {});
  const driftRange = rand.range(1.5, 3.0);

  const driftToNext = () => {
    const dest = randomDrift(home, driftRange);
    const dist = fly.position.distanceTo(dest);
    const duration = rand.range(2.5, 4.5) + dist * 1.2;

    ctx.add(() => {
      gsap.to(fly.position, {
        x: dest.x,
        y: dest.y,
        z: dest.z,
        duration,
        ease: 'sine.inOut',
        onComplete: () => {
          ctx.add(() => {
            gsap.delayedCall(rand.range(0.3, 1.8), driftToNext);
          });
        },
      });
    });
  };
  ctx.add(() => {
    gsap.delayedCall(rand.range(0, 3), driftToNext);
  });

  return () => ctx.revert();
}

/**
 * Starts a looping blink cycle that fades the firefly's emissive color
 * and point light between glow and dim states with organic timing.
 *
 * @param mat - The firefly mesh's standard material.
 * @param glow - The point light parented to the firefly.
 * @param config - Firefly config providing glow and dim colors.
 * @returns A cleanup function that kills the blink tween chain.
 */
export function startBlink(mat: MeshStandardMaterial, glow: PointLight, config: FireflyConfig): () => void {
  const ctx = gsap.context(() => {});

  const blinkCycle = () => {
    const onDuration = rand.range(1.0, 3.5);
    const offDuration = rand.range(0.4, 1.6);
    const fadeDuration = rand.range(0.3, 0.8);

    ctx.add(() => {
      gsap.to(mat.emissive, {
        r: config.dimColor.r,
        g: config.dimColor.g,
        b: config.dimColor.b,
        duration: fadeDuration,
        ease: 'power2.in',
        delay: onDuration,
        onComplete: () => {
          ctx.add(() => {
            gsap.to(glow, { intensity: 0.02, duration: fadeDuration * 0.5 });
          });
        },
      });

      gsap.delayedCall(onDuration + fadeDuration + offDuration, () => {
        ctx.add(() => {
          gsap.to(mat.emissive, {
            r: config.glowColor.r,
            g: config.glowColor.g,
            b: config.glowColor.b,
            duration: fadeDuration,
            ease: 'power2.out',
          });
          gsap.to(glow, { intensity: 0.15, duration: fadeDuration });
          gsap.delayedCall(fadeDuration + 0.1, blinkCycle);
        });
      });
    });
  };
  ctx.add(() => {
    gsap.delayedCall(rand.range(0, 4), blinkCycle);
  });

  return () => ctx.revert();
}

/**
 * Triggers a bright glow flash on a firefly, then fades back to resting intensity.
 * Called by the tap interaction handler.
 *
 * @param mat - The firefly mesh's standard material.
 * @param glow - The point light parented to the firefly.
 * @param glowColor - The firefly's glow color to flash.
 */
export function triggerGlowFlash(mat: MeshStandardMaterial, glow: PointLight, glowColor: Color): void {
  mat.emissive.copy(glowColor);
  glow.intensity = 0.4;
  gsap.to(glow, { intensity: 0.15, duration: 0.6, ease: 'power2.out' });
}

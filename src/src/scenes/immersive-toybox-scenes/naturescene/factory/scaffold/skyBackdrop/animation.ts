import type { Group } from 'three';
import gsap from 'gsap';

/**
 * Starts idle drift animations on cloud groups.
 * @param clouds - Array of cloud group and their home X positions.
 * @returns A cleanup function that kills all cloud drift tweens.
 */
export function animateCloudDrift(clouds: { group: Group; homeX: number; index: number }[]): () => void {
  const tweens = clouds.map(({ group, homeX, index }) =>
    gsap.to(group.position, {
      x: homeX + 1.5,
      duration: 30 + index * 8,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
    }),
  );
  return () => tweens.forEach((t) => t.kill());
}

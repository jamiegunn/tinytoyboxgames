/**
 * Idle animations for the raccoon — gentle head bob and ear twitches.
 */
import type { Mesh } from 'three';
import gsap from 'gsap';

/**
 * Attaches idle GSAP animations to the raccoon's head and ears.
 *
 * @param head - The raccoon head mesh.
 * @param ears - Direct references to the left and right ear meshes.
 * @returns A cleanup function that kills all raccoon idle tweens.
 */
export function animateRaccoonIdle(head: Mesh, ears: { left: Mesh; right: Mesh }): () => void {
  const headTween = gsap.to(head.rotation, {
    x: 0.06,
    duration: 3.5,
    repeat: -1,
    yoyo: true,
    ease: 'sine.inOut',
  });

  const leftEarTween = gsap.to(ears.left.rotation, {
    z: -0.15,
    duration: 1.8,
    repeat: -1,
    yoyo: true,
    ease: 'sine.inOut',
    delay: 0.5,
  });

  const rightEarTween = gsap.to(ears.right.rotation, {
    z: 0.35,
    duration: 2.2,
    repeat: -1,
    yoyo: true,
    ease: 'sine.inOut',
    delay: 1.2,
  });

  return () => {
    headTween.kill();
    leftEarTween.kill();
    rightEarTween.kill();
  };
}

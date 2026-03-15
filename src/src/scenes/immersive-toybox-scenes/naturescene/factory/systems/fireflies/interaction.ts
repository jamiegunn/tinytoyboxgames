import { Vector3, type Scene } from 'three';
import type { WorldTapDispatcher } from '@app/utils/worldTapDispatcher';
import { createSparkleBurst } from '@app/utils/particles';
import type { FireflyInstance } from './types';
import { triggerGlowFlash } from './animation';

/**
 * Registers tap interactions on each firefly that trigger a sparkle burst and glow flash.
 *
 * @param scene - The Three.js scene for particle effects.
 * @param dispatcher - The world tap dispatcher.
 * @param instances - Typed firefly instances from createFireflies.
 * @returns A cleanup function that removes all firefly tap listeners.
 */
export function setupFireflyTap(scene: Scene, dispatcher: WorldTapDispatcher, instances: FireflyInstance[]): () => void {
  const cleanups: (() => void)[] = [];

  instances.forEach(({ mesh, material, glow, glowColor }) => {
    const cleanup = dispatcher.register(mesh, () => {
      createSparkleBurst(scene, mesh.getWorldPosition(new Vector3()));
      triggerGlowFlash(material, glow, glowColor);
    });
    cleanups.push(cleanup);
  });

  return () => cleanups.forEach((fn) => fn());
}

import { Vector3, type Scene } from 'three';
import type { WorldTapDispatcher } from '@app/utils/worldTapDispatcher';
import { getParticleEngine } from '@app/utils/particles/registry';
import { PARTICLES } from '@app/utils/particles/presets';
import { triggerSound } from '@app/assets/audio/sceneBridge';
import type { FireflyInstance } from './types';
import { triggerGlowFlash } from './animation';

/**
 * Registers tap interactions on each firefly that trigger a twinkle, a sparkle
 * burst and a glow flash.
 *
 * `sfx_nature_firefly_twinkle` was authored in Round 5 of
 * `docs/reviews/2026-07-30-rooms-five-rounds.md`: a short rising sweep off
 * `pentatonicScale(96)` with a soft octave above it, matched to the glow flash
 * the tap already triggers — the sound rises as the light does.
 *
 * IT IS DELIBERATELY THE QUIETEST CUE IN THE BANK (peak 0.07, octave 0.02).
 * There are fourteen fireflies and they drift within reach of one another, so
 * this is the one prop in the scene a child can plausibly fire four or five
 * times in two seconds. A cue at normal level would have stacked into noise.
 *
 * `sfx_shared_chime` was rejected: it is a near-twin of `sfx_shared_star_chime`,
 * and `sfx_shared_star_chime` is the voice Round 4 gave the GAME PORTALS. A
 * firefly that sounds like the door into a minigame is precisely the confusion
 * soul.md's Promise forbids.
 *
 * @param scene - The Three.js scene for particle effects.
 * @param dispatcher - The world tap dispatcher.
 * @param instances - Typed firefly instances from createFireflies.
 * @returns A cleanup function that removes all firefly tap listeners.
 */
export function setupFireflyTap(scene: Scene, dispatcher: WorldTapDispatcher, instances: FireflyInstance[]): () => void {
  const cleanups: (() => void)[] = [];

  instances.forEach(({ mesh, material, glowMaterial, glowColor }) => {
    const cleanup = dispatcher.register(mesh, () => {
      triggerSound('sfx_nature_firefly_twinkle');
      getParticleEngine(scene).emit(PARTICLES.sceneSparkle, mesh.getWorldPosition(new Vector3()));
      triggerGlowFlash(material, glowMaterial, glowColor);
    });
    cleanups.push(cleanup);
  });

  return () => cleanups.forEach((fn) => fn());
}

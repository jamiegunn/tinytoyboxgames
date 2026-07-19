/**
 * Tap interaction for the toy parrot.
 *
 * The parrot was decorative — tapping it did nothing, which breaks the
 * "every tap matters" rule (soul.md). On tap it now gives a happy little
 * squawk: two quick wing flaps, a head bob, a cheerful chime, and a sparkle.
 */

import gsap from 'gsap';
import { Vector3, type Group, type Object3D, type Scene } from 'three';
import { triggerSound } from '@app/assets/audio/sceneBridge';
import type { WorldTapDispatcher } from '@app/utils/worldTapDispatcher';
import { getParticleEngine } from '@app/utils/particles/registry';
import { PARTICLES } from '@app/utils/particles/presets';

/**
 * Registers the parrot's tap reaction on the whole parrot group.
 *
 * @param scene - Scene used to reach the particle engine.
 * @param dispatcher - Shared world tap dispatcher.
 * @param root - The parrot root group returned by `createParrot`.
 * @returns Cleanup that unregisters the tap and kills any in-flight tweens.
 */
export function setupParrotTap(scene: Scene, dispatcher: WorldTapDispatcher, root: Group): () => void {
  const head = root.getObjectByName('parrot_head') ?? null;
  const wings = [root.getObjectByName('parrot_wing_0'), root.getObjectByName('parrot_wing_1')].filter(Boolean) as Object3D[];
  const wingBaseZ = wings.map((w) => w.rotation.z);
  const headBaseY = head ? head.position.y : 0;
  let animating = false;

  const unregister = dispatcher.register(root, () => {
    if (animating) return;
    animating = true;
    triggerSound('sfx_shared_chime');

    const tl = gsap.timeline({
      onComplete: () => {
        animating = false;
      },
    });

    // Two quick wing flaps (each wing swings outward and back, twice).
    wings.forEach((wing, i) => {
      const out = wingBaseZ[i] + (i === 0 ? -0.6 : 0.6);
      tl.to(wing.rotation, { z: out, duration: 0.08, ease: 'power1.out' }, 0)
        .to(wing.rotation, { z: wingBaseZ[i], duration: 0.1, ease: 'power1.in' }, 0.12)
        .to(wing.rotation, { z: out * 0.85, duration: 0.08, ease: 'power1.out' }, 0.24)
        .to(wing.rotation, { z: wingBaseZ[i], duration: 0.12, ease: 'power1.in' }, 0.34);
    });

    // Head bob.
    if (head) {
      tl.to(head.position, { y: headBaseY + 0.06, duration: 0.1, ease: 'power2.out' }, 0).to(
        head.position,
        { y: headBaseY, duration: 0.18, ease: 'bounce.out' },
        0.1,
      );
    }

    const burst = root.getWorldPosition(new Vector3());
    burst.y += 0.55;
    getParticleEngine(scene).emit(PARTICLES.sceneSparkle, burst);
  });

  return () => {
    unregister();
    wings.forEach((wing) => gsap.killTweensOf(wing.rotation));
    if (head) gsap.killTweensOf(head.position);
  };
}

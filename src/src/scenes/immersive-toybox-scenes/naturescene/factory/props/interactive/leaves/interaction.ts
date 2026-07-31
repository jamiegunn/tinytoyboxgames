import { Scene, Vector3, type Mesh } from 'three';
import type { WorldTapDispatcher } from '@app/utils/worldTapDispatcher';
import { getParticleEngine } from '@app/utils/particles/registry';
import { PARTICLES } from '@app/utils/particles/presets';
import { createRevealInteraction } from '@app/utils/revealInteraction';
import type { LeafRevealHandle } from './types';
import {
  LEAF_FLIP_END_FRAME,
  LADYBUG_REVEAL_Y,
  LADYBUG_ESCAPE_END_FRAME,
  LADYBUG_ESCAPE_OFFSET_X,
  LADYBUG_ESCAPE_OFFSET_Z,
  LEAF_PARTICLE_OFFSET_Y,
} from './constants';

/**
 * Registers a tap interaction on a leaf that flips it over and reveals a ladybug.
 *
 * TWO CUES, BECAUSE THERE ARE TWO EVENTS AND THEY ARE NOT SIMULTANEOUS. The
 * papery `sfx_nature_leaf_flip` — written for this prop, and uncalled until
 * Round 5 — plays on the frame the finger lands, with the leaf. The ladybug
 * does not exist yet at that moment; it is spawned in `playAnimation`'s `onEnd`,
 * a flip later, and `sfx_shared_critter_scurry` plays there, with it.
 *
 * AND TWO BURSTS, BECAUSE THE FIRST CUE COST THIS PROP ITS PICTURE AND THE
 * MEASUREMENT SAID SO. Gaining a voice makes `interactionController.fire`
 * withhold its shared acknowledgement sparkle, and this leaf's own particles are
 * deferred into `onEnd`, so for one round the frame the finger landed on answered
 * in nothing at all: bar (b) of Round 5 measured `leaf_cover` at 0.89 of the
 * sparkle it had given up, a regression, and it was pre-registered to catch
 * exactly this. The default `tapParticleFn` in `revealInteraction.ts` now draws
 * that sparkle back at tap time. It is left at the default here rather than
 * overridden — a leaf turning over does not raise dust the way the stone does,
 * and inventing a leaf-specific burst to look thorough would be decorating a
 * frame instead of answering it.
 *
 * @param scene - The Three.js scene for adding revealed creatures.
 * @param dispatcher - The world tap dispatcher.
 * @param tapTarget - The leaf cover mesh used as the tap target.
 * @param revealHandle - The reveal handle containing the ladybug mesh.
 * @returns A cleanup function to unregister the tap handler.
 */
export function setupLeafTap(scene: Scene, dispatcher: WorldTapDispatcher, tapTarget: Mesh, revealHandle: LeafRevealHandle): () => void {
  return createRevealInteraction(scene, dispatcher, {
    coverMesh: tapTarget,
    coverAnimation: {
      property: 'rotation.z',
      keys: [
        { frame: 0, value: tapTarget.rotation.z },
        { frame: LEAF_FLIP_END_FRAME, value: tapTarget.rotation.z + Math.PI },
      ],
    },
    creatureFactory: (pos: Vector3) => {
      revealHandle.ladybug.position.copy(pos);
      revealHandle.ladybug.position.y = LADYBUG_REVEAL_Y;
      return revealHandle.ladybug;
    },
    escapeKeys: (pos: Vector3) => [
      { frame: 0, value: pos.clone() },
      { frame: LADYBUG_ESCAPE_END_FRAME, value: new Vector3(pos.x + LADYBUG_ESCAPE_OFFSET_X, pos.y, pos.z + LADYBUG_ESCAPE_OFFSET_Z) },
    ],
    particleFn: (s, p) => getParticleEngine(s).emit(PARTICLES.sceneSparkle, p),
    particleOffset: new Vector3(0, LEAF_PARTICLE_OFFSET_Y, 0),
    // A flipped leaf has nothing left to give, so later taps stay silent on
    // purpose and fall to the controller's shared acknowledgement. See the
    // `repeatOnTap` branch in `revealInteraction.ts` for why that is the honest
    // answer rather than a gap.
    repeatOnTap: false,
    tapSoundId: 'sfx_nature_leaf_flip',
    revealSoundId: 'sfx_shared_critter_scurry',
  });
}

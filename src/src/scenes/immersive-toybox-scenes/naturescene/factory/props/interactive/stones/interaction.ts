import { Scene, Vector3, type Mesh } from 'three';
import type { WorldTapDispatcher } from '@app/utils/worldTapDispatcher';
import { getParticleEngine } from '@app/utils/particles/registry';
import { PARTICLES } from '@app/utils/particles/presets';
import { createRevealInteraction } from '@app/utils/revealInteraction';
import { rand } from '@app/utils/randomHelpers';
import type { StoneRevealHandle } from './types';
import {
  STONE_REVEAL_SHIFT_RANGE,
  STONE_REVEAL_END_FRAME,
  GRUB_REVEAL_OFFSET_X,
  GRUB_REVEAL_OFFSET_Y,
  GRUB_ESCAPE_END_FRAME,
  GRUB_ESCAPE_OFFSET_X,
  GRUB_ESCAPE_OFFSET_Z,
} from './constants';

/**
 * Registers a tap interaction on a stone that shifts it aside and reveals a grub.
 *
 * TWO CUES, ON THEIR OWN FRAMES. `sfx_nature_stone_shift` — authored in Round 5
 * because nothing in the shared catalogue is made of earth — plays with the
 * stone's own movement. `sfx_shared_critter_scurry` plays a beat later, when the
 * grub is actually spawned in `playAnimation`'s `onEnd` and starts crawling
 * away. It is the same cue the leaf's ladybug gets, on purpose: the forest
 * should say the same thing whenever a small thing runs from under something,
 * and a rule is worth more here than two separately clever choices.
 *
 * Unlike the leaf, this reveal keeps `repeatOnTap` at its default, so a later
 * tap still nudges dust from the stone and still gets the shift cue — the prop
 * has something left to give, so it gives it.
 *
 * @param scene - The Three.js scene for adding revealed creatures.
 * @param dispatcher - The world tap dispatcher.
 * @param tapTarget - The stone mesh used as the tap target.
 * @param revealHandle - The reveal handle containing the grub mesh.
 * @returns A cleanup function to unregister the tap handler.
 */
export function setupStoneTap(scene: Scene, dispatcher: WorldTapDispatcher, tapTarget: Mesh, revealHandle: StoneRevealHandle): () => void {
  const dir = new Vector3(rand.bipolar(STONE_REVEAL_SHIFT_RANGE), 0, rand.bipolar(STONE_REVEAL_SHIFT_RANGE));

  return createRevealInteraction(scene, dispatcher, {
    coverMesh: tapTarget,
    coverAnimation: {
      property: 'position',
      keys: [
        { frame: 0, value: tapTarget.position.clone() },
        { frame: STONE_REVEAL_END_FRAME, value: tapTarget.position.clone().add(dir) },
      ],
    },
    creatureFactory: (pos: Vector3) => {
      revealHandle.grub.position.copy(pos);
      revealHandle.grub.position.x += GRUB_REVEAL_OFFSET_X;
      revealHandle.grub.position.y = GRUB_REVEAL_OFFSET_Y;
      return revealHandle.grub;
    },
    escapeKeys: (pos: Vector3) => [
      { frame: 0, value: pos.clone() },
      { frame: GRUB_ESCAPE_END_FRAME, value: new Vector3(pos.x + GRUB_ESCAPE_OFFSET_X, pos.y, pos.z + GRUB_ESCAPE_OFFSET_Z) },
    ],
    particleFn: (s, p) => getParticleEngine(s).emit(PARTICLES.sceneDust, p),
    // BOTH BURSTS ON THE TAP FRAME, AND THE SECOND ONE IS HERE BECAUSE A
    // MEASUREMENT SAID SO RATHER THAN BECAUSE TWO LOOKS BETTER THAN ONE.
    //
    // The dust is the truthful half: this is the one cover in the scene whose
    // movement genuinely raises any, and it grinds through soil for the whole
    // shift. The first version of this fix drew dust ALONE, on exactly that
    // reasoning, and Round 5's new fourth pass measured what it cost:
    //
    //   sceneDust  replayed alone, in the miss's own crop:  42–50 px
    //   sceneSparkle, the burst it displaced, same crop:   417–506 px
    //
    // A tenth. And the preset arithmetic predicts it without any framebuffer —
    // sparkle is `count: 40, opacity: [0.8, 1]`, ADDITIVE, bright yellow; dust is
    // `count: 12, opacity: [0.25, 0.4]`, NORMAL-blended, brown, on a brown forest
    // floor. Two independent methods agreeing is worth more than either alone.
    //
    // The framing that matters: `propHigh` — the stone's shift — is on BOTH sides
    // of the comparison, because the shift happened before Round 5 too. What the
    // round actually changed at tap time is which burst is drawn, so the honest
    // statement of the regression is not "one stone instance scored 0.93" but
    // "every stone traded a 460-pixel answer for a 45-pixel one". The instance
    // split in the ratio was an artefact of how far each stone happens to slide.
    //
    // `interactionController.fire` withholds its shared sparkle from any handler
    // that made a sound, and that rule is a PROXY: it takes "answered somehow" for
    // "answered enough". For a prop whose own burst is a tenth of the
    // acknowledgement it displaced, the proxy is simply wrong, and the prop has to
    // pay the difference itself. So the stone draws the acknowledgement it would
    // have been given, and then its own dust on top — keep what you had, add what
    // you earned. That also makes the no-regression claim a DEDUCTION rather than a
    // hope: this emit set contains the miss's preset unmodified, so the answer
    // contains the miss's answer and cannot be smaller than it.
    //
    // Rejected: brightening `sceneDust` itself. It is used elsewhere as an ambient
    // puff, and a tenfold gap is not closeable by the only overrides `emit` takes
    // (`count` is capped by `capacity: 24`, and opacity and blending are not
    // overridable at all) — so "make the dust louder" means authoring a second
    // dust preset to satisfy an instrument, which is the tail wagging the dog.
    tapParticleFn: (s, p) => {
      const engine = getParticleEngine(s);
      engine.emit(PARTICLES.sceneSparkle, p);
      engine.emit(PARTICLES.sceneDust, p);
    },
    tapSoundId: 'sfx_nature_stone_shift',
    revealSoundId: 'sfx_shared_critter_scurry',
  });
}

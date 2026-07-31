import { Vector3, type Mesh, type Scene, type DirectionalLight } from 'three';
import type { WorldTapDispatcher } from '@app/utils/worldTapDispatcher';
import { triggerSound } from '@app/assets/audio/sceneBridge';
import { playAnimation, type AnimKey } from './animationHelpers';
import { getParticleEngine } from './particles/registry';
import { PARTICLES } from './particles/presets';

/**
 * Specifies how the cover object animates when tapped (e.g. shrink, flip, roll, slide).
 */
export interface CoverAnimationSpec {
  /** The property to animate on the cover mesh (e.g. 'scale', 'rotation.z', 'position'). */
  property: string;
  /** Keyframes for the cover animation. */
  keys: AnimKey[];
}

/**
 * Configuration for a reveal interaction: tap a cover object to reveal a hidden creature.
 */
export interface RevealConfig {
  /** The cover mesh to attach the tap handler to. */
  coverMesh: Mesh;
  /** How the cover animates on first tap. */
  coverAnimation: CoverAnimationSpec;
  /** Factory function to create the revealed creature at the cover's position. */
  creatureFactory: (position: Vector3) => Mesh;
  /** Keyframes for the creature's escape animation. Property is always 'position'. */
  escapeKeys: (creaturePos: Vector3) => AnimKey[];
  /** Whether to register the creature as a shadow caster. @default true */
  castShadow?: boolean;
  /** Key light for shadow casting. Required if castShadow is true. */
  keyLight?: DirectionalLight;
  /** Particle effect on reveal. @default a sceneSparkle burst via getParticleEngine */
  particleFn?: (scene: Scene, position: Vector3) => void;
  /**
   * Particle effect on the frame the finger lands, for the COVER's own movement.
   * @default a sceneSparkle burst — the same burst the controller would have drawn.
   *
   * DELIBERATELY NOT `particleFn`. That one is the creature's arrival burst, and
   * drawing it at tap time would announce the payoff before the payoff, which is
   * the exact defect Round 4 found in the portal's audio and Round 5 must not
   * reintroduce in pixels. The stone overrides this with its dust because a stone
   * grinding aside really does raise dust as it moves; the leaf leaves it at the
   * default because a leaf turning over does not, and the honest thing to draw is
   * the acknowledgement the controller stopped drawing.
   */
  tapParticleFn?: (scene: Scene, position: Vector3) => void;
  /** Offset from cover position for the particle emission. @default Vector3(0, 0.2, 0) */
  particleOffset?: Vector3;
  /** Particle effect on subsequent taps (after already revealed). @default same as particleFn */
  repeatParticleFn?: (scene: Scene, position: Vector3) => void;
  /** Whether subsequent taps (after reveal) also produce a particle effect. @default true */
  repeatOnTap?: boolean;
  /**
   * Cue played on the frame the finger lands, for the COVER's own movement —
   * the leaf turning over, the stone grinding aside. Omit and the tap is
   * answered by the controller's shared acknowledgement instead, which is the
   * cue for having touched nothing.
   */
  tapSoundId?: string;
  /**
   * Cue played when the creature actually APPEARS, at the end of the cover
   * animation — not at the tap.
   *
   * The split is Round 4's lesson applied here before it could be relearned.
   * The portal used to fire its arrival cue on the frame of the tap, with
   * nothing having opened yet, and the review's verdict was that a payoff cue
   * played before the payoff is a lie the child can hear. A reveal has exactly
   * that shape: the cover moves first and the creature is spawned inside
   * `playAnimation`'s `onEnd`, several hundred milliseconds later. One cue for
   * the cover, one for the creature, each on its own frame.
   */
  revealSoundId?: string;
}

/**
 * Creates a reveal interaction on a cover mesh via the centralized dispatcher.
 * On first tap: plays `tapSoundId` and emits `tapParticleFn` on that same frame,
 * animates the cover, then — at the end of that animation — spawns a creature,
 * animates it away, emits `particleFn` and plays `revealSoundId`.
 *
 * TWO BURSTS AND TWO CUES, PAIRED BY FRAME RATHER THAN BY KIND. The cover moves
 * when the finger lands and the creature appears a flip later; each event gets
 * one sound and one picture, on its own frame. The split is the same one Round 4
 * argued for in audio, applied to particles in Round 5 once bar (b) showed the
 * tap-time frame had gone empty.
 * On subsequent taps: optionally replays `tapSoundId` and emits particles.
 *
 * @param scene - The Three.js scene.
 * @param dispatcher - The world tap dispatcher.
 * @param config - The reveal interaction configuration.
 * @returns A cleanup function to unregister the tap handler.
 */
export function createRevealInteraction(scene: Scene, dispatcher: WorldTapDispatcher, config: RevealConfig): () => void {
  let revealed = false;
  const emitParticle = config.particleFn ?? ((s: Scene, position: Vector3) => getParticleEngine(s).emit(PARTICLES.sceneSparkle, position));
  const particleOffset = config.particleOffset ?? new Vector3(0, 0.2, 0);
  const repeatOnTap = config.repeatOnTap ?? true;
  const getCoverWorldPosition = () => config.coverMesh.getWorldPosition(new Vector3());

  return dispatcher.register(config.coverMesh, () => {
    if (revealed) {
      if (repeatOnTap) {
        // The cover still moves dust or sparkles, so it still owes a sound.
        if (config.tapSoundId) triggerSound(config.tapSoundId);
        const repeatFn = config.repeatParticleFn ?? emitParticle;
        repeatFn(scene, getCoverWorldPosition().add(particleOffset));
      }
      // DELIBERATELY SILENT WHEN `repeatOnTap` IS FALSE. This branch does
      // nothing at all — the leaf is already turned over and the ladybug is
      // gone — so the honest answer is the controller's shared acknowledgement,
      // which `fire` supplies precisely because this handler made no sound.
      // Playing the flip cue here would announce a flip that does not happen,
      // which is the same species of lie as playing a payoff cue early.
      return;
    }
    revealed = true;

    // The cover's own cue, on the frame the finger lands — and, on the same
    // frame, the cover's own burst.
    //
    // THE CONDITION IS NOT A CONVENIENCE, IT IS THE WHOLE ARGUMENT. Round 5 gave
    // these props a voice, and `interactionController.fire` withholds its shared
    // acknowledgement sparkle from any handler that made a sound:
    //
    //     const before = ...soundCount();
    //     entry.handler(...);
    //     if (...soundCount() === before) acknowledgeTap(clientX, clientY);
    //
    // Every other Nature prop pays that back out of particles it already emitted
    // at tap time. These two did not: their only particles live in `onEnd`,
    // hundreds of milliseconds later, so they bought a voice with the picture and
    // the child's finger landed on a frame that answered in nothing. Bar (b) of
    // Round 5 exists to forbid that trade, and it caught it — `leaf_cover` at
    // 0.89 and `stone_cover` at 0.27 against the sparkle they gave up.
    //
    // So the emit is gated on `tapSoundId` for the reason the debt is: a cue at
    // tap time is exactly when the controller stops paying, and the frames where
    // it still pays must not be paid twice. A cover configured with no
    // `tapSoundId` is silent on this frame, so `fire` still draws its sparkle and
    // this branch must stay out of the way — which is why the emit sits inside
    // the `if` rather than beside it.
    if (config.tapSoundId) {
      triggerSound(config.tapSoundId);
      const tapFn = config.tapParticleFn ?? ((s: Scene, position: Vector3) => getParticleEngine(s).emit(PARTICLES.sceneSparkle, position));
      tapFn(scene, getCoverWorldPosition().add(particleOffset));
    }

    // Animate the cover object
    playAnimation(config.coverMesh, config.coverAnimation.property, config.coverAnimation.keys, {
      onEnd: () => {
        // Spawn the creature
        const creaturePos = getCoverWorldPosition();
        const creature = config.creatureFactory(creaturePos);
        scene.add(creature);

        // Enable shadow casting
        if ((config.castShadow ?? true) && config.keyLight) {
          creature.castShadow = true;
        }

        // Animate the creature escaping
        const escKeys = config.escapeKeys(creature.position);
        playAnimation(creature, 'position', escKeys);

        // Emit particles
        emitParticle(scene, getCoverWorldPosition().add(particleOffset));

        // The creature's cue, on the frame it appears and starts moving away.
        if (config.revealSoundId) triggerSound(config.revealSoundId);
      },
    });
  });
}

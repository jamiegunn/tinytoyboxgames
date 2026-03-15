import { Vector3, type Mesh, type Scene, type DirectionalLight } from 'three';
import type { WorldTapDispatcher } from '@app/utils/worldTapDispatcher';
import { playAnimation, type AnimKey } from './animationHelpers';
import { createSparkleBurst } from './particles';

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
  /** Particle effect on reveal. @default createSparkleBurst */
  particleFn?: (scene: Scene, position: Vector3) => void;
  /** Offset from cover position for the particle emission. @default Vector3(0, 0.2, 0) */
  particleOffset?: Vector3;
  /** Particle effect on subsequent taps (after already revealed). @default same as particleFn */
  repeatParticleFn?: (scene: Scene, position: Vector3) => void;
  /** Whether subsequent taps (after reveal) also produce a particle effect. @default true */
  repeatOnTap?: boolean;
}

/**
 * Creates a reveal interaction on a cover mesh via the centralized dispatcher.
 * On first tap: animates the cover, spawns a creature, animates the creature away, and emits particles.
 * On subsequent taps: optionally emits particles.
 *
 * @param scene - The Three.js scene.
 * @param dispatcher - The world tap dispatcher.
 * @param config - The reveal interaction configuration.
 * @returns A cleanup function to unregister the tap handler.
 */
export function createRevealInteraction(scene: Scene, dispatcher: WorldTapDispatcher, config: RevealConfig): () => void {
  let revealed = false;
  const emitParticle = config.particleFn ?? createSparkleBurst;
  const particleOffset = config.particleOffset ?? new Vector3(0, 0.2, 0);
  const repeatOnTap = config.repeatOnTap ?? true;
  const getCoverWorldPosition = () => config.coverMesh.getWorldPosition(new Vector3());

  return dispatcher.register(config.coverMesh, () => {
    if (revealed) {
      if (repeatOnTap) {
        const repeatFn = config.repeatParticleFn ?? emitParticle;
        repeatFn(scene, getCoverWorldPosition().add(particleOffset));
      }
      return;
    }
    revealed = true;

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
      },
    });
  });
}

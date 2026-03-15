import { Vector3, type Object3D } from 'three';
import { startIdleLoop, playAnimations, type AnimKey, type IdleHandle, type PropertyAnimation } from './animationHelpers';
import type { Scene } from 'three';

/**
 * Configuration for an idle animation that can be interrupted by a tap reaction,
 * then automatically resumed.
 */
export interface IdleInterruptConfig {
  /** The animated property path for the idle loop (e.g. 'rotation.z', 'position.y'). */
  idleProperty: string;
  /** Keyframes for the idle loop. */
  idleKeys: AnimKey[];
  /**
   * Reaction animations to play on tap (interrupts idle).
   * May be a static array or a function that computes animations at trigger time
   * (useful when the reaction depends on the current position or random direction).
   */
  reactionAnimations: PropertyAnimation[] | (() => PropertyAnimation[]);
  /** Particle effect to play on tap. */
  particleFn?: (scene: Scene, position: Vector3) => void;
  /** World-space position for the particle emission. Defaults to target position if not specified. */
  particleOffset?: Vector3;
  /** If true, subsequent triggers are ignored while a reaction is playing. Default: false. */
  lockDuringReaction?: boolean;
}

/**
 * Handle returned by {@link idleWithInterrupt} for external control.
 */
export interface IdleInterruptHandle {
  /** The underlying idle handle for direct control. */
  idle: IdleHandle;
  /** Triggers the tap reaction: stops idle, plays reaction, resumes idle. */
  trigger: () => void;
}

/**
 * Creates an idle animation loop on a target node with a tap-triggered reaction.
 * When triggered, the idle stops, the reaction animations play, and the idle
 * resumes automatically after the reaction completes.
 *
 * @param target - The Object3D to animate.
 * @param config - Idle and reaction animation configuration.
 * @param scene - Optional Three.js scene for particle effects.
 * @returns A handle for triggering the reaction and controlling the idle.
 */
export function idleWithInterrupt(target: Object3D, config: IdleInterruptConfig, scene?: Scene): IdleInterruptHandle {
  const idle = startIdleLoop(target, config.idleProperty, config.idleKeys);

  let busy = false;

  const trigger = () => {
    if (config.lockDuringReaction && busy) return;
    busy = true;
    idle.stop();

    const anims = typeof config.reactionAnimations === 'function' ? config.reactionAnimations() : config.reactionAnimations;

    playAnimations(target, anims, {
      onEnd: () => {
        busy = false;
        idle.restart();
      },
    });

    if (config.particleFn && scene) {
      const pos = (target as unknown as { position: Vector3 }).position;
      const emitPos = config.particleOffset ? pos.clone().add(config.particleOffset) : pos.clone();
      config.particleFn(scene, emitPos);
    }
  };

  return { idle, trigger };
}

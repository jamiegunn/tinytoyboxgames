import { type Object3D, Mesh, Scene, Vector3, Color } from 'three';
import { createBubblePopEffect, createSparkleBurst } from '@app/minigames/shared/particleFx';
import type { SharkAnimState } from './shark';
import { triggerHappySquint, triggerBarrelRoll } from './shark';
import { SHARK_BODY_SCALE_X } from './types';
import type { MiniGameContext } from '../../framework/types';

/** A scheduled effect to fire after a delay. */
interface PendingEffect {
  timeRemaining: number;
  action: () => void;
}

/** Parameters for the eat celebration sequence. */
export interface EatCelebrationParams {
  scene: Scene;
  fishPos: Vector3;
  fishColor: Color;
  fishKind: 'standard' | 'golden';
  sharkBody: Object3D | null;
  sharkRoot: Mesh | null;
  sharkAnim: SharkAnimState;
  comboStreak: number;
  isFirstCatch: boolean;
  context: MiniGameContext;
}

/** Session-scoped celebration system that manages delayed visual effects. */
export interface CelebrationQueue {
  /**
   * Orchestrates the 600ms eat celebration sequence.
   * @param params - Celebration parameters.
   */
  playEatCelebration(params: EatCelebrationParams): void;

  /**
   * Ticks all pending effects. Call from the main update loop.
   * @param dt - Frame delta time in seconds.
   */
  update(dt: number): void;

  /** Clears all pending celebration effects. */
  clear(): void;
}

/**
 * Creates a session-scoped celebration queue. Each game instance should
 * create its own queue so stale effects never leak between sessions.
 * @returns A new CelebrationQueue.
 */
export function createCelebrationQueue(): CelebrationQueue {
  const pendingEffects: PendingEffect[] = [];

  /**
   * Schedules an effect to fire after a delay.
   * @param delay - Seconds to wait.
   * @param action - Callback to execute.
   */
  function scheduleEffect(delay: number, action: () => void): void {
    if (delay <= 0) {
      action();
    } else {
      pendingEffects.push({ timeRemaining: delay, action });
    }
  }

  return {
    playEatCelebration(params: EatCelebrationParams): void {
      const { scene, fishPos, fishKind, sharkBody, sharkAnim, comboStreak, isFirstCatch, context } = params;

      // 0ms: Shark body squash-stretch (use canonical constants, not live values,
      // to avoid compounding scale drift when eating rapidly)
      if (sharkBody) {
        const baseX = SHARK_BODY_SCALE_X;
        const baseZ = 1.0;
        sharkBody.scale.z = baseZ * 1.2;
        sharkBody.scale.x = baseX * 0.85;

        // 100-200ms: Spring back
        scheduleEffect(0.1, () => {
          if (sharkBody) {
            sharkBody.scale.z = baseZ * 1.05;
            sharkBody.scale.x = baseX * 0.95;
          }
        });
        scheduleEffect(0.2, () => {
          if (sharkBody) {
            sharkBody.scale.z = baseZ;
            sharkBody.scale.x = baseX;
          }
        });
      }

      // 50ms: Gulp sound
      scheduleEffect(0.05, () => {
        context.audio.playSound('shark-gulp');
      });

      // 100ms: Bubble burst at fish position
      scheduleEffect(0.1, () => {
        createBubblePopEffect(scene, fishPos, new Color(0.4, 0.7, 1.0), 20);
      });

      // 150ms: Belly flash (emissive pulse)
      if (sharkBody && sharkBody instanceof Mesh && sharkBody.material && 'emissive' in (sharkBody.material as object)) {
        const mat = sharkBody.material as import('three').MeshStandardMaterial;
        const origEmissive = mat.emissive.clone();
        scheduleEffect(0.15, () => {
          mat.emissive = new Color(0.2, 0.25, 0.3);
        });
        scheduleEffect(0.5, () => {
          mat.emissive = origEmissive;
        });
      }

      // 200ms: Happy squint
      scheduleEffect(0.2, () => {
        triggerHappySquint(sharkAnim);
      });

      // Combo effects at 200ms
      if (comboStreak >= 2) {
        scheduleEffect(0.2, () => {
          playComboReaction(comboStreak, fishPos, scene);
        });
      }

      // Golden fish extras
      if (fishKind === 'golden') {
        scheduleEffect(0.1, () => {
          createSparkleBurst(scene, fishPos, new Color(1.0, 0.85, 0.2), 60);
        });
        scheduleEffect(0.3, () => {
          context.audio.playSound('golden-catch');
        });
        scheduleEffect(0.6, () => {
          context.celebration.milestone(0, 0, 'large');
        });
      }

      // First catch extras
      if (isFirstCatch) {
        triggerBarrelRoll(sharkAnim);
        scheduleEffect(0.1, () => {
          createSparkleBurst(scene, fishPos, new Color(1.0, 0.9, 0.5), 45);
        });
        context.audio.playSound('shark-happy');
      }
    },

    update(dt: number): void {
      for (let i = pendingEffects.length - 1; i >= 0; i--) {
        pendingEffects[i].timeRemaining -= dt;
        if (pendingEffects[i].timeRemaining <= 0) {
          pendingEffects[i].action();
          pendingEffects.splice(i, 1);
        }
      }
    },

    clear(): void {
      pendingEffects.length = 0;
    },
  };
}

/**
 * Creates combo-scaled visual effects.
 * @param combo - Current combo streak count.
 * @param pos - World position for effects.
 * @param scene - The Three.js scene.
 */
export function playComboReaction(combo: number, pos: Vector3, scene: Scene): void {
  const count = Math.min(10 + combo * 5, 40);
  const color =
    combo >= 5 ? new Color(1.0, 0.5, 1.0) : combo >= 4 ? new Color(0.5, 1.0, 0.5) : combo >= 3 ? new Color(1.0, 0.9, 0.3) : new Color(1.0, 0.7, 0.3);
  createSparkleBurst(scene, pos, color, count);
}

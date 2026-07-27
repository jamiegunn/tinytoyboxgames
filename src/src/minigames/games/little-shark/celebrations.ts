import { type Object3D, Mesh, Scene, Vector3, Color } from 'three';
import { getParticleEngine } from '@app/utils/particles/registry';
import { PARTICLES } from '@app/utils/particles/presets';
import type { SharkAnimState } from './shark';
import { triggerHappySquint, triggerBarrelRoll } from './shark';
import { SHARK_BODY_SCALE_X } from './types';
import type { MiniGameContext } from '../../framework/types';

/**
 * How much brighter than its resting emissive the shark glows on a catch.
 *
 * `recolourShark` (fish/lifecycle.ts) sets the resting emissive to albedo x
 * 0.04, so this is a multiple of the same derivation: 4.5x the resting glow,
 * not an absolute colour. Deriving it from `mat.color` means it keeps the
 * shark's hue and survives any future recolour.
 *
 * The value is measured, not chosen. A frozen in-game session (the shark pinned
 * via `isBeingDragged` so every frame is pixel-aligned) was screenshotted at
 * gains 0.04 / 0.10 / 0.18 / 0.30 / 0.50 / 0.80 plus the old absolute
 * rgb(0.2, 0.25, 0.3), at camera distance 9.9. Three quantities, over the
 * shark's `_skinMat` interior (mask eroded 2 px so material boundaries and the
 * silhouette edge cannot pose as shading):
 *
 *   gain   dE2000 vs rest   L* spread kept   |dL*| shark vs water
 *   0.04    -- (0.4 noise)          100%                    18.0
 *   0.10        5.3                  83%                    14.7
 *   0.18        7.9                  62%                    10.6
 *   0.30       10.0                  41%                     5.9
 *   0.50       14.8                  31%                     0.8
 *   0.80       20.4                  52%                     7.6
 *   absolute   27.3                  69%                    12.5
 *
 * The old absolute value is larger than the albedo itself, and emissive is
 * normal-independent, so it did not brighten the shading -- it replaced it. At
 * gain 0.50 the shark's lightness matches the water it swims in to within 0.8
 * L*: the silhouette dissolves. The three bars are: clearly perceptible through
 * FogExp2 0.058 (dE2000 >= 6, well over the 2.3 JND), shading preserved
 * (>= 60%), and figure/ground held (|dL*| >= 10). 0.18 is the smallest gain
 * that clears all three; every larger one fails at least one.
 *
 * The non-monotonic "spread kept" above 0.5 is real and is not form returning:
 * past that point the remaining contrast is between flat colour patches, which
 * is why the 0.2/0.25/0.3 frame reads as a white mass with a detached dark fin.
 */
const EAT_FLASH_GAIN = 0.18;

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

  // The shark's TRUE emissive, captured once, before any belly flash has run.
  //
  // The belly flash used to read the baseline off the live material at the
  // moment the celebration was queued and write it back 0.5 s later. Catches
  // land far closer together than 0.5 s -- that is the entire point of the combo
  // and the frenzy -- and when two overlap the second one reads the FIRST one's
  // flash colour as its "original" and then restores that. The shark's emissive
  // latches at rgb(0.2, 0.25, 0.3) and never comes back.
  //
  // `recolourShark` sets emissive to the body albedo x 0.04, which is
  // (0.006, 0.009, 0.013). The latched value is twenty to thirty-five times
  // brighter, and `_skinMat` is shared across the body, mid-body, peduncle, both
  // pectorals and the ventral fin, so almost the whole animal washes out. It is
  // why a watched playthrough showed a dark navy reef shark at t=41 s and a pale
  // blue-white one by t=100 s, and why the deliberate counter-shading in
  // fish/lifecycle.ts stopped reading at all.
  //
  // Keyed on the material and captured on first use, so every restore writes the
  // same correct value no matter how the flashes interleave. Overlapping flashes
  // can now only cut each other short by a frame or two, which is invisible;
  // they can no longer make the change permanent.
  const emissiveBaseline = new WeakMap<object, Color>();

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
        getParticleEngine(scene).emit(PARTICLES.bubblePop, fishPos, { colors: [new Color(0.4, 0.7, 1.0)], count: 20 });
      });

      // 150ms: Belly flash (emissive pulse)
      if (sharkBody && sharkBody instanceof Mesh && sharkBody.material && 'emissive' in (sharkBody.material as object)) {
        const mat = sharkBody.material as import('three').MeshStandardMaterial;
        if (!emissiveBaseline.has(mat)) emissiveBaseline.set(mat, mat.emissive.clone());
        scheduleEffect(0.15, () => {
          // Written through the existing Color instance, not `mat.emissive = new
          // Color(...)`. Reassigning allocates a Color on every catch and swaps
          // out the object three.js may already hold a reference to; `setRGB`
          // here and `copy` on the restore below do neither.
          mat.emissive.copy(mat.color).multiplyScalar(EAT_FLASH_GAIN);
        });
        scheduleEffect(0.5, () => {
          const base = emissiveBaseline.get(mat);
          if (base) mat.emissive.copy(base);
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
          getParticleEngine(scene).emit(PARTICLES.sparkle, fishPos, { colors: [new Color(1.0, 0.85, 0.2)], count: 60 });
        });
        scheduleEffect(0.3, () => {
          context.audio.playSound('golden-catch');
        });
        scheduleEffect(0.6, () => {
          // Centre of the view, not (0, 0) — the follow camera keeps the shark
          // there, and now that celebrations render, a corner burst would be
          // half off-screen.
          context.celebration.milestone(context.viewport.width / 2, context.viewport.height / 2, 'large');
        });
      }

      // First catch extras
      if (isFirstCatch) {
        triggerBarrelRoll(sharkAnim);
        scheduleEffect(0.1, () => {
          getParticleEngine(scene).emit(PARTICLES.sparkle, fishPos, { colors: [new Color(1.0, 0.9, 0.5)], count: 45 });
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
  getParticleEngine(scene).emit(PARTICLES.sparkle, pos, { colors: [color], count });
}

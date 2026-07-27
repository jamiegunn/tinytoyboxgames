/**
 * Root orchestration file for the generated Star Catcher minigame.
 *
 * This is the minigame equivalent of the scene `index.ts` files used elsewhere
 * in the repo. It owns the lifecycle contract expected by `MiniGameShell`,
 * wires together environment/entities/rules, and keeps teardown explicit.
 *
 * The goal of this file is not to hide work. The goal is to make the reading
 * model predictable:
 *
 * - environment setup lives in `environment/`
 * - target construction and local effects live in `entities/`
 * - gameplay rules live in `rules/`
 * - this file orchestrates those pieces
 */

import { Vector3, type PerspectiveCamera, type Scene } from 'three';
import type { EntityPool, IMiniGame, MiniGameContext, MiniGameTapEvent, ViewportInfo } from '../../framework/types';
import { unprojectTapToPlane } from './helpers';
import { findTappedTwinklePoint, setupTemplateEnvironment, teardownTemplateEnvironment, updateTemplateEnvironment } from './environment';
import { beginCatch, createTarget, disposeTarget, resetTarget } from './entities';
import {
  createMissPulse,
  createTransientEffects,
  disposeTransientEffects,
  emitTwinkle,
  releaseTransientPulses,
  updateTransientPulses,
} from './entities/effects';
import { recycleTargetAtIndex } from './entities/lifecycle';
import { applyMissTap, applySuccessfulTap } from './rules/scoring';
import { findNearestCatchableTargetIndex, findTappedTargetIndex, spawnNextTarget, updateActiveTargets } from './rules';
import { computeMaxActiveTargets, computeSpawnIntervalSeconds, getSpawnBand, PLAY_PLANE_Z, TEMPLATE_PLAY_FIELD } from './rules/spawning';
import type { TemplateEnvironmentRig, TemplateTargetState, TransientEffectRig } from './types';

/** Sound used to acknowledge a tap on the moon or the background starfield. */
const AMBIENT_TWINKLE_SOUND = 'sfx_shared_star_chime';

/**
 * NDC rows the opening stars are seeded at, top to bottom.
 *
 * The run used to open with three stars all placed above the top of the frame,
 * so for the first second and a half the screen was empty and for the next few
 * only its top edge had anything in it. A four-second measurement of the very
 * start of a run therefore recorded all of the game's motion in the top sixth
 * of the frame — which is exactly what the harness saw. Seeding the field the
 * way it looks in steady state removes the cold start entirely: from the first
 * rendered frame there are stars spread down the whole picture.
 */
const OPENING_ENTRY_ROWS = [0.85, 0.5, 0.15, -0.15, -0.45, -0.7];

/**
 * Creates the generated Star Catcher minigame.
 *
 * @param context - Shell-provided minigame context with the shared runtime systems.
 * @returns An `IMiniGame` implementation consumed by `MiniGameShell`.
 */
export function createGame(context: MiniGameContext): IMiniGame {
  const scene = context.scene as Scene;
  const camera = context.camera as PerspectiveCamera;

  let environment: TemplateEnvironmentRig | null = null;
  let effects: TransientEffectRig | null = null;
  let targetPool: EntityPool<TemplateTargetState> | null = null;
  const activeTargets: TemplateTargetState[] = [];

  /** Scratch vector for the miss-pulse world point, so taps allocate nothing. */
  const missPoint = new Vector3();

  let paused = false;
  let elapsedTime = 0;
  let successfulHits = 0;
  let spawnRegistrationId: string | null = null;
  let spawnBand = getSpawnBand(context.difficulty.level);

  /** Returns every active target to the pool so restarts stay clean. */
  function releaseAllActiveTargets(): void {
    if (!targetPool) return;

    while (activeTargets.length > 0) {
      recycleTargetAtIndex(targetPool, activeTargets, activeTargets.length - 1);
    }
  }

  /**
   * Ensures the scheduler matches the current difficulty band.
   *
   * The shared scheduler uses a fixed interval per registration, so whenever
   * the coarse difficulty band changes we re-register with a new authored
   * interval instead of trying to mutate the scheduler in place.
   */
  function ensureSpawnerRegistration(): void {
    const nextBand = getSpawnBand(context.difficulty.level);
    if (spawnRegistrationId && nextBand === spawnBand) {
      return;
    }

    if (spawnRegistrationId) {
      context.spawner.cancel(spawnRegistrationId);
      spawnRegistrationId = null;
    }

    spawnBand = nextBand;
    spawnRegistrationId = context.spawner.register({
      spawn: () => {
        if (!targetPool) return;

        const maxActive = computeMaxActiveTargets(context.difficulty.level);
        if (activeTargets.length >= maxActive) return;

        spawnNextTarget(targetPool, activeTargets, camera, TEMPLATE_PLAY_FIELD, context.difficulty.level);
      },
      intervalSeconds: computeSpawnIntervalSeconds(context.difficulty.level),
      jitterSeconds: 0.2,
      // Above the hardest band's cap of 10, so the scheduler never becomes the
      // thing limiting the field; `computeMaxActiveTargets` owns that.
      maxCount: 14,
      activeCount: () => activeTargets.length,
    });
  }

  const game: IMiniGame = {
    id: 'star-catcher',

    async setup(): Promise<void> {
      environment = setupTemplateEnvironment(scene, camera, context.disposal);
      effects = createTransientEffects();

      targetPool = context.createPool<TemplateTargetState>({
        create: () => createTarget(scene),
        reset: resetTarget,
        dispose: disposeTarget,
        // 10 concurrent catchable stars at the top difficulty band, plus the
        // handful mid catch-or-fade animation, plus headroom.
        maxPoolSize: 24,
      });
      targetPool.prewarm(12);
    },

    start(): void {
      paused = false;
      elapsedTime = 0;
      successfulHits = 0;
      spawnBand = getSpawnBand(context.difficulty.level);

      context.score.reset();
      context.combo.reset();
      context.spawner.clearAll();
      spawnRegistrationId = null;
      releaseAllActiveTargets();

      if (effects) {
        releaseTransientPulses(effects);
      }

      if (targetPool) {
        const maxActive = computeMaxActiveTargets(context.difficulty.level);
        for (const entryRow of OPENING_ENTRY_ROWS) {
          if (activeTargets.length >= maxActive) break;
          spawnNextTarget(targetPool, activeTargets, camera, TEMPLATE_PLAY_FIELD, context.difficulty.level, entryRow);
        }
      }

      ensureSpawnerRegistration();
    },

    update(deltaTime: number): void {
      if (paused || !targetPool || !environment || !effects) return;

      elapsedTime += deltaTime;
      ensureSpawnerRegistration();

      updateTemplateEnvironment(environment, elapsedTime);
      // Targets are recycled here, once their catch or fade animation has
      // finished playing — not on the frame they are tapped (defect 2).
      updateActiveTargets(targetPool, activeTargets, elapsedTime, deltaTime);
      updateTransientPulses(effects, deltaTime);
    },

    pause(): void {
      paused = true;
      context.spawner.pauseAll();
    },

    resume(): void {
      paused = false;
      context.spawner.resumeAll();
    },

    teardown(): void {
      if (spawnRegistrationId) {
        context.spawner.cancel(spawnRegistrationId);
        spawnRegistrationId = null;
      }
      context.spawner.clearAll();

      disposeTransientEffects(effects);
      effects = null;
      releaseAllActiveTargets();

      if (targetPool) {
        targetPool.dispose();
        targetPool = null;
      }

      teardownTemplateEnvironment(environment);
      environment = null;
    },

    /**
     * Resize needs no work in this game.
     *
     * Nothing here is authored in viewport units: the shell owns the camera
     * aspect, and every screen-space test (catch forgiveness, the night-sky
     * twinkle, the miss pulse) reads the canvas rectangle at tap time, so a
     * cached size could never go stale. The hook stays because the lifecycle
     * contract requires it.
     *
     * @param _viewport - Unused; the game holds no viewport-derived state.
     */
    onResize(_viewport: ViewportInfo): void {
      // Intentionally empty — see the note above.
    },

    onTap(event: MiniGameTapEvent): void {
      if (paused || !targetPool || !environment || !effects) return;

      // Read fresh rather than cached: the canvas can move (layout, scroll)
      // without a resize ever firing, and every test below is in pixels.
      const rect = context.canvas.getBoundingClientRect();

      let targetIndex = event.pickResult?.hit && event.pickResult.pickedMesh ? findTappedTargetIndex(activeTargets, event.pickResult.pickedMesh) : -1;

      // Defect 3: an exact-mesh raycast on a falling, tumbling 0.68-unit star is
      // far finer aim than a 3-year-old has. When the ray missed — or landed on
      // scenery — fall back to the nearest star within a generous screen radius
      // so a tap that *looks* like a catch scores like one.
      if (targetIndex === -1) {
        targetIndex = findNearestCatchableTargetIndex(activeTargets, camera, rect, event.screenX, event.screenY);
      }

      if (targetIndex !== -1) {
        const target = activeTargets[targetIndex];
        // `milestone` places its shower in canvas space, so hand it canvas-relative
        // coordinates rather than the raw client pixels the shell reports.
        applySuccessfulTap(context, target, event.screenX - rect.left, event.screenY - rect.top, successfulHits);
        successfulHits += 1;
        // Defect 2: the star used to be hidden and teleported to (0, -10, 0) on
        // this very frame, so the reward for the one action the game asks for was
        // the star vanishing. It now plays a short pop-spin-rise instead and is
        // recycled by `updateActiveTargets` when that finishes.
        beginCatch(target);
        return;
      }

      // Defect 4: the moon and the 110-instance starfield are decorative props in
      // a game called Star Catcher, so a tap on them used to do nothing at all.
      // They now twinkle and chime — friendly, but deliberately scoreless and
      // visually distinct from a real catch.
      const twinkle = findTappedTwinklePoint(environment, camera, rect, event.screenX, event.screenY);
      if (twinkle) {
        emitTwinkle(scene, twinkle.position, twinkle.sparkleCount);
        context.audio.playSound(AMBIENT_TWINKLE_SOUND);
        return;
      }

      applyMissTap(context);
      unprojectTapToPlane(camera, rect, event.screenX, event.screenY, PLAY_PLANE_Z, missPoint);
      createMissPulse(scene, effects, missPoint, camera);
    },
  };

  return game;
}

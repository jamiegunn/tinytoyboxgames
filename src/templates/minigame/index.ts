/**
 * Root orchestration file for the generated __GAME_DISPLAY_NAME__ minigame.
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

import { PerspectiveCamera, Scene, Vector3 } from 'three';
import type { EntityPool, IMiniGame, MiniGameContext, MiniGameDragEndEvent, MiniGameDragEvent, MiniGameTapEvent, ViewportInfo } from '../../framework/types';
import { approximateMissWorldPoint } from './helpers';
import { setupTemplateEnvironment, teardownTemplateEnvironment, updateTemplateEnvironment } from './environment';
import { createTarget, disposeTarget, resetTarget } from './entities';
import { createMissPulse, disposeTransientPulses, updateTransientPulses } from './entities/effects';
import { recycleTargetAtIndex } from './entities/lifecycle';
import { applyMissTap, applySuccessfulTap } from './rules/scoring';
import { findTappedTargetIndex, spawnNextTarget, updateActiveTargets } from './rules';
import { computeMaxActiveTargets, computeSpawnIntervalSeconds, getSpawnBand, TEMPLATE_SPAWN_BOUNDS } from './rules/spawning';
import type { RuntimeViewportSnapshot, TemplateEnvironmentRig, TemplateTargetState, TransientPulseState } from './types';

/**
 * Creates the generated __GAME_DISPLAY_NAME__ minigame.
 *
 * @param context - Shell-provided minigame context with the shared runtime systems.
 * @returns An `IMiniGame` implementation consumed by `MiniGameShell`.
 */
export function createGame(context: MiniGameContext): IMiniGame {
  const scene = context.scene as Scene;
  const shellCamera = context.camera as PerspectiveCamera;

  let environment: TemplateEnvironmentRig | null = null;
  let targetPool: EntityPool<TemplateTargetState> | null = null;
  const activeTargets: TemplateTargetState[] = [];
  const missPulses: TransientPulseState[] = [];

  let paused = false;
  let elapsedTime = 0;
  let successfulHits = 0;
  let spawnRegistrationId: string | null = null;
  let spawnBand = getSpawnBand(context.difficulty.level);
  let viewportSnapshot: RuntimeViewportSnapshot = {
    width: context.viewport.width,
    height: context.viewport.height,
  };

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

        spawnNextTarget(targetPool, activeTargets, TEMPLATE_SPAWN_BOUNDS, context.difficulty.level);
      },
      intervalSeconds: computeSpawnIntervalSeconds(context.difficulty.level),
      jitterSeconds: 0.2,
      maxCount: 12,
      activeCount: () => activeTargets.length,
    });
  }

  const game: IMiniGame = {
    id: '__GAME_ID__',

    async setup(): Promise<void> {
      environment = setupTemplateEnvironment(scene, shellCamera);

      targetPool = context.createPool<TemplateTargetState>({
        create: () => createTarget(scene),
        reset: resetTarget,
        dispose: disposeTarget,
        maxPoolSize: 18,
      });
      targetPool.prewarm(8);
    },

    start(): void {
      paused = false;
      elapsedTime = 0;
      successfulHits = 0;
      spawnBand = getSpawnBand(context.difficulty.level);
      viewportSnapshot = {
        width: context.viewport.width,
        height: context.viewport.height,
      };

      context.score.reset();
      context.combo.reset();
      context.spawner.clearAll();
      spawnRegistrationId = null;
      releaseAllActiveTargets();
      disposeTransientPulses(missPulses);

      if (targetPool) {
        for (let count = 0; count < 3; count += 1) {
          spawnNextTarget(targetPool, activeTargets, TEMPLATE_SPAWN_BOUNDS, context.difficulty.level);
        }
      }

      ensureSpawnerRegistration();
    },

    update(deltaTime: number): void {
      if (paused || !targetPool || !environment) return;

      elapsedTime += deltaTime;
      ensureSpawnerRegistration();

      updateTemplateEnvironment(environment, elapsedTime);
      updateActiveTargets(targetPool, activeTargets, elapsedTime, deltaTime);
      updateTransientPulses(missPulses, deltaTime);
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

      disposeTransientPulses(missPulses);
      releaseAllActiveTargets();

      if (targetPool) {
        targetPool.dispose();
        targetPool = null;
      }

      teardownTemplateEnvironment(environment);
      environment = null;
    },

    onResize(viewport: ViewportInfo): void {
      viewportSnapshot = {
        width: viewport.width,
        height: viewport.height,
      };
    },

    onTap(event: MiniGameTapEvent): void {
      if (paused || !targetPool) return;

      const targetIndex = event.pickResult?.hit && event.pickResult.pickedMesh ? findTappedTargetIndex(activeTargets, event.pickResult.pickedMesh) : -1;

      if (targetIndex !== -1) {
        const target = activeTargets[targetIndex];
        applySuccessfulTap(context, target, event.screenX, event.screenY, successfulHits);
        successfulHits += 1;
        recycleTargetAtIndex(targetPool, activeTargets, targetIndex);
        return;
      }

      applyMissTap(context);

      const effectPoint =
        event.pickResult?.hit && event.pickResult.pickedPoint
          ? new Vector3(event.pickResult.pickedPoint.x, TEMPLATE_SPAWN_BOUNDS.y, event.pickResult.pickedPoint.z)
          : approximateMissWorldPoint(event.screenX, event.screenY, viewportSnapshot, TEMPLATE_SPAWN_BOUNDS);

      createMissPulse(scene, effectPoint, missPulses);
    },

    /**
     * Drag is intentionally dormant in the baseline template.
     *
     * The shell lifecycle supports it, and future generated games may turn it
     * on by changing the manifest entry to include `'drag'`. Keeping the method
     * here makes that future extension obvious without forcing the default game
     * to simulate drag behavior it does not need yet.
     *
     * @param _event - Unused drag event preserved to keep the lifecycle shape explicit.
     */
    onDrag(_event: MiniGameDragEvent): void {
      // Intentionally unused in the default tap-first generated baseline.
    },

    /**
     * Complements the dormant drag hook with an equally explicit end handler.
     *
     * @param _event - Unused drag-end event preserved for future drag-capable games.
     */
    onDragEnd(_event: MiniGameDragEndEvent): void {
      // Intentionally unused in the default tap-first generated baseline.
    },
  };

  return game;
}

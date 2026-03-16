/**
 * Root orchestration for the Cannonball Splash minigame.
 *
 * Implements IMiniGame lifecycle. Wires environment, entities, and rules.
 */

import { PerspectiveCamera, Scene } from 'three';
import type { IMiniGame, MiniGameContext, MiniGameDragEndEvent, MiniGameDragEvent, MiniGameTapEvent, ViewportInfo } from '../../framework/types';
import { C, type EnvironmentRig, type GameState } from './types';
import { createGameEnvironment } from './environment';
import { aimCannon, fireCannonAnimation, getCannonMouthPosition, spawnMuzzleFlash, spawnTarget } from './entities';
import {
  updateGameFrame,
  resolveTap,
  pickSpawnPosition,
  selectTargetKind,
  selectSpecialKind,
  shouldSpawnSpecial,
  getSpawnBand,
  getSpawnCapacity,
  getSpawnInterval,
  randomDriftVector,
} from './rules';
import { computeFlightDuration, computeArcHeight, randomRange } from './helpers';
import { spawnCannonball } from './entities/lifecycle';

/**
 * Creates the Cannonball Splash minigame.
 */
export function createGame(context: MiniGameContext): IMiniGame {
  const scene = context.scene as Scene;
  const camera = context.camera as PerspectiveCamera;

  let env: EnvironmentRig | null = null;
  let paused = false;
  let spawnRegistrationId: string | null = null;
  let specialSpawnRegistrationId: string | null = null;
  let currentBand = 0;

  const state: GameState = {
    targets: [],
    cannonballs: [],
    splashParticles: [],
    fragments: [],
    coins: [],
    cannon: null,
    lastFireTime: -C.FIRE_COOLDOWN,
    elapsedTime: 0,
    milestoneScores: new Set(),
    pendingChainHits: [],
    oceanMesh: null,
    cameraShakeTimer: 0,
    cameraShakeOffset: { x: 0, y: 0 },
  };

  /** Spawns a single standard target. */
  function spawnStandardTarget(): void {
    const maxActive = getSpawnCapacity(context.difficulty.level);
    const standardCount = state.targets.filter((t) => t.kind !== 'golden-barrel' && t.kind !== 'rainbow-bottle').length;
    if (standardCount >= maxActive) return;

    const kind = selectTargetKind(context.difficulty.level);
    const { position, side } = pickSpawnPosition();
    const drift = randomDriftVector(side, context.difficulty.level);
    spawnTarget(kind, position, drift.vx, drift.vz, scene, state.targets, context.difficulty.level);
  }

  /** Spawns a special target if conditions are met. */
  function spawnSpecialTarget(): void {
    if (!shouldSpawnSpecial(context.difficulty.level)) return;
    // Only one special active at a time
    const hasSpecial = state.targets.some((t) => (t.kind === 'golden-barrel' || t.kind === 'rainbow-bottle') && t.state !== 'hit');
    if (hasSpecial) return;

    const kind = selectSpecialKind(context.difficulty.level);
    const { position, side } = pickSpawnPosition();
    const drift = randomDriftVector(side, context.difficulty.level);
    spawnTarget(kind, position, drift.vx, drift.vz, scene, state.targets, context.difficulty.level);
    context.celebration.celebrationSound('chime');
  }

  /** Re-registers spawner when difficulty band changes. */
  function ensureSpawnerRegistration(): void {
    const nextBand = getSpawnBand(context.difficulty.level);
    if (spawnRegistrationId && nextBand === currentBand) return;

    if (spawnRegistrationId) {
      context.spawner.cancel(spawnRegistrationId);
    }
    if (specialSpawnRegistrationId) {
      context.spawner.cancel(specialSpawnRegistrationId);
    }

    currentBand = nextBand;
    const interval = getSpawnInterval(context.difficulty.level);

    spawnRegistrationId = context.spawner.register({
      spawn: spawnStandardTarget,
      intervalSeconds: interval,
      jitterSeconds: 0.5,
      maxCount: 15,
      activeCount: () => state.targets.length,
    });

    specialSpawnRegistrationId = context.spawner.register({
      spawn: spawnSpecialTarget,
      intervalSeconds: 8.0,
      jitterSeconds: 2.0,
      maxCount: 1,
      activeCount: () => state.targets.filter((t) => (t.kind === 'golden-barrel' || t.kind === 'rainbow-bottle') && t.state !== 'hit').length,
    });
  }

  const game: IMiniGame = {
    id: 'cannonball-splash',

    async setup(): Promise<void> {
      env = createGameEnvironment(scene, camera);
      state.cannon = env.cannon;
      state.oceanMesh = env.ocean;
    },

    start(): void {
      paused = false;
      state.elapsedTime = 0;
      state.lastFireTime = -C.FIRE_COOLDOWN;
      state.milestoneScores.clear();
      state.pendingChainHits.length = 0;
      state.cameraShakeTimer = 0;
      state.cameraShakeOffset = { x: 0, y: 0 };

      context.score.reset();
      context.combo.reset();
      context.spawner.clearAll();
      spawnRegistrationId = null;
      specialSpawnRegistrationId = null;

      // Spawn initial 2 targets
      for (let i = 0; i < 2; i++) {
        spawnStandardTarget();
      }

      ensureSpawnerRegistration();
    },

    update(deltaTime: number): void {
      if (paused || !env) return;

      // Clamp deltaTime to prevent huge jumps after resume
      const dt = Math.min(deltaTime, 0.05);

      ensureSpawnerRegistration();
      updateGameFrame(state, dt, context, env, scene, camera);
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
      // Cancel spawners
      if (spawnRegistrationId) {
        context.spawner.cancel(spawnRegistrationId);
        spawnRegistrationId = null;
      }
      if (specialSpawnRegistrationId) {
        context.spawner.cancel(specialSpawnRegistrationId);
        specialSpawnRegistrationId = null;
      }
      context.spawner.clearAll();

      // Clean up active entities
      for (let i = state.targets.length - 1; i >= 0; i--) {
        const t = state.targets[i];
        t.root.traverse((child) => {
          const mesh = child as import('three').Mesh;
          if (mesh.geometry) mesh.geometry.dispose();
          if (mesh.material) {
            if (Array.isArray(mesh.material)) {
              mesh.material.forEach((m) => m.dispose());
            } else {
              (mesh.material as import('three').MeshStandardMaterial).dispose();
            }
          }
        });
        t.root.removeFromParent();
      }
      state.targets.length = 0;

      for (const ball of state.cannonballs) {
        ball.mesh.geometry.dispose();
        // Note: cannonballMat is shared — do NOT dispose it here
        ball.mesh.removeFromParent();
        if (ball.shadow) {
          ball.shadow.geometry.dispose();
          // Note: shadowMat is shared — do NOT dispose it here
          ball.shadow.removeFromParent();
        }
      }
      state.cannonballs.length = 0;

      for (const p of state.splashParticles) {
        p.mesh.geometry.dispose();
        (p.mesh.material as import('three').MeshStandardMaterial).dispose();
        p.mesh.removeFromParent();
      }
      state.splashParticles.length = 0;

      for (const f of state.fragments) {
        f.mesh.geometry.dispose();
        (f.mesh.material as import('three').MeshStandardMaterial).dispose();
        f.mesh.removeFromParent();
      }
      state.fragments.length = 0;

      for (const c of state.coins) {
        c.mesh.geometry.dispose();
        // Note: coinMat is shared — do NOT dispose it here
        c.mesh.removeFromParent();
      }
      state.coins.length = 0;

      state.pendingChainHits.length = 0;

      // Dispose environment
      if (env) {
        env.dispose();
        env = null;
      }

      state.cannon = null;
      state.oceanMesh = null;
    },

    onResize(viewport: ViewportInfo): void {
      camera.aspect = viewport.width / viewport.height;
      camera.updateProjectionMatrix();
    },

    onTap(event: MiniGameTapEvent): void {
      if (paused || !state.cannon) return;

      // Fire cooldown
      const now = state.elapsedTime;
      if (now - state.lastFireTime < C.FIRE_COOLDOWN) return;
      state.lastFireTime = now;

      // Resolve tap
      const resolution = resolveTap(event, state.targets, camera, context.canvas);

      // Aim cannon
      aimCannon(state.cannon, resolution.worldPoint);

      // Fire animation
      fireCannonAnimation(state.cannon);

      // Camera shake
      state.cameraShakeTimer = C.CAMERA_SHAKE_DURATION;
      state.cameraShakeOffset = {
        x: randomRange(-C.CAMERA_SHAKE_MAGNITUDE, C.CAMERA_SHAKE_MAGNITUDE),
        y: randomRange(-C.CAMERA_SHAKE_MAGNITUDE, C.CAMERA_SHAKE_MAGNITUDE),
      };

      // Muzzle flash
      const mouthPos = getCannonMouthPosition(state.cannon);
      const fireDir = resolution.worldPoint.clone().sub(mouthPos).normalize();
      spawnMuzzleFlash(scene, mouthPos, fireDir, state.splashParticles);

      // Spawn cannonball
      const targetZ = resolution.worldPoint.z;
      const flightDuration = computeFlightDuration(targetZ);
      const arcHeight = computeArcHeight(targetZ);

      spawnCannonball(mouthPos, resolution.worldPoint, flightDuration, arcHeight, resolution.target, scene, state.cannonballs);

      // Play fire sound
      context.audio.playSound('sfx_cannonball_fire');
    },

    onDrag(_event: MiniGameDragEvent): void {
      // Tap-only game
    },

    onDragEnd(_event: MiniGameDragEndEvent): void {
      // Tap-only game
    },
  };

  return game;
}

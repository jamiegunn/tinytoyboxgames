/**
 * Root orchestration for the Cannonball Splash minigame.
 *
 * Implements IMiniGame lifecycle. Wires environment, entities, and rules.
 */

import { PerspectiveCamera, Scene, Vector3 } from 'three';
import type { IMiniGame, MiniGameContext, MiniGameDragEndEvent, MiniGameDragEvent, MiniGameTapEvent, ViewportInfo } from '../../framework/types';
import { C, type EnvironmentRig, type GameState } from './types';
import { createGameEnvironment } from './environment';
import {
  aimCannon,
  aimCannonAlong,
  disposeCannonballMaterials,
  disposeEffectMaterials,
  disposeTargetMaterials,
  fireCannonAnimation,
  getCannonMouthPosition,
  recycleTarget,
  spawnMuzzleFlash,
  spawnTarget,
} from './entities';
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
import { computeFlightDuration, solveBallisticVelocity } from './helpers';
import { spawnCannonball } from './entities/lifecycle';

/**
 * Creates the Cannonball Splash minigame.
 * @param context - Framework-provided scene, camera, difficulty and services.
 * @returns An IMiniGame object literal whose methods the framework calls through the game lifecycle.
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
    elapsedTime: 0,
    milestoneScores: new Set(),
    pendingChainHits: [],
    cameraShakeTimer: 0,
    cameraShakeDir: { x: 0, y: 0 },
  };

  // Reused by onTap so firing never allocates.
  const launchVelocity = new Vector3();

  /** Spawns a single standard target. */
  function spawnStandardTarget(): void {
    const maxActive = getSpawnCapacity(context.difficulty.level);
    const standardCount = state.targets.filter((t) => t.kind !== 'golden-barrel' && t.kind !== 'rainbow-bottle').length;
    if (standardCount >= maxActive) return;

    const kind = selectTargetKind(context.difficulty.level);
    const { position, side } = pickSpawnPosition(camera, state.targets);
    const drift = randomDriftVector(side, context.difficulty.level);
    spawnTarget(kind, position, drift.vx, drift.vz, scene, state.targets);
  }

  /** Spawns a special target if conditions are met. */
  function spawnSpecialTarget(): void {
    if (!shouldSpawnSpecial(context.difficulty.thresholds)) return;
    // Only one special active at a time
    const hasSpecial = state.targets.some((t) => (t.kind === 'golden-barrel' || t.kind === 'rainbow-bottle') && t.state !== 'hit');
    if (hasSpecial) return;

    const kind = selectSpecialKind(context.difficulty.level);
    const { position, side } = pickSpawnPosition(camera, state.targets);
    const drift = randomDriftVector(side, context.difficulty.level);
    spawnTarget(kind, position, drift.vx, drift.vz, scene, state.targets);
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
    },

    start(): void {
      paused = false;
      state.elapsedTime = 0;
      state.milestoneScores.clear();
      state.pendingChainHits.length = 0;
      state.cameraShakeTimer = 0;
      state.cameraShakeDir = { x: 0, y: 0 };

      context.score.reset();
      context.combo.reset();
      context.spawner.clearAll();
      spawnRegistrationId = null;
      specialSpawnRegistrationId = null;

      // Open with a full pond rather than two lonely barrels. getSpawnCapacity
      // at difficulty 0 is 5, and the first scheduled spawn is a whole
      // SPAWN_INTERVAL_MAX away, so anything less than the capacity means the
      // child's opening shots are aimed at emptier water than the game ever
      // shows again. pickSpawnPosition keeps them apart.
      const initialTargets = getSpawnCapacity(context.difficulty.level);
      for (let i = 0; i < initialTargets; i++) {
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

      // Clean up active entities. recycleTarget owns the "what does a target
      // own?" rule (its geometry and its cloned materials); duplicating that
      // walk here is how shared materials got freed twice in the first place.
      for (let i = state.targets.length - 1; i >= 0; i--) {
        recycleTarget(state.targets, i);
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

      // Shared material templates are disposed exactly once, here, after every
      // instance that borrowed a clone of them is gone.
      disposeTargetMaterials();
      disposeCannonballMaterials();
      disposeEffectMaterials();

      // Dispose environment
      if (env) {
        env.dispose();
        env = null;
      }

      state.cannon = null;
    },

    onResize(viewport: ViewportInfo): void {
      camera.aspect = viewport.width / viewport.height;
      camera.updateProjectionMatrix();
    },

    // Every tap fires. There used to be a silent 0.5s cooldown here that simply
    // discarded taps arriving too soon, with no cannon movement, no sound and no
    // spark — a three-year-old taps faster than that and learns the game is
    // broken. There is nothing to protect: balls are cheap, targets can't be
    // over-hit (a hit target leaves the 'active' set immediately), and the
    // recoil animation already paces the firing visually.
    onTap(event: MiniGameTapEvent): void {
      if (paused || !state.cannon) return;

      const rig = state.cannon;
      const aimPoint = resolveTap(event, state.targets, camera, context.canvas);
      const flightDuration = computeFlightDuration(aimPoint.z);

      // Two passes, because the barrel must point along the ball's *launch*
      // direction, not along the straight line to the aim point — under gravity
      // those differ by the launch angle. Pass 1 swings the barrel roughly on
      // target so the muzzle is in the right place; pass 2 re-aims along the
      // solved velocity and re-solves from the corrected muzzle, so the ball
      // really does leave the mouth of the barrel the child can see.
      aimCannon(rig, aimPoint);
      solveBallisticVelocity(getCannonMouthPosition(rig), aimPoint, flightDuration, launchVelocity);
      aimCannonAlong(rig, launchVelocity);
      const mouthPos = getCannonMouthPosition(rig);
      solveBallisticVelocity(mouthPos, aimPoint, flightDuration, launchVelocity);

      fireCannonAnimation(rig);

      // Camera shake — a fresh wobble direction per shot.
      state.cameraShakeTimer = C.CAMERA_SHAKE_DURATION;
      const shakeAngle = Math.random() * Math.PI * 2;
      state.cameraShakeDir = { x: Math.cos(shakeAngle), y: Math.sin(shakeAngle) };

      // Muzzle flash, blown out along the barrel.
      const fireDir = launchVelocity.clone().normalize();
      spawnMuzzleFlash(scene, mouthPos, fireDir, state.splashParticles);

      spawnCannonball(mouthPos, launchVelocity, flightDuration, scene, state.cannonballs);

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

/**
 * Update orchestration for Cannonball Splash.
 *
 * Called once per frame from the root game update.
 */

import { type Scene, type PerspectiveCamera, type MeshStandardMaterial } from 'three';
import type { MiniGameContext } from '../../../framework/types';
import type { GameState, EnvironmentRig } from '../types';
import { C } from '../types';
import { lerp } from '../helpers';
import { updateEnvironment } from '../environment';
import {
  updateCannonball,
  updateCannonIdle,
  updateSpecialTargetVisuals,
  updateParticles,
  updateFragments,
  updateCoins,
  spawnTargetExplosion,
  spawnWaterSplash,
  spawnGoldenSparkle,
  spawnRainbowRing,
  spawnBonusCoins,
  spawnOceanSparkle,
  spawnTrailParticle,
  spawnScoreIndicator,
  recycleTarget,
  recycleCannonball,
} from '../entities';
import { handleTargetHit, handleWaterMiss } from './scoring';
import { resolveChainReaction } from './collision';

let oceanSparkleTimer = 0;

/**
 * Main per-frame update orchestrator.
 */
export function updateGameFrame(state: GameState, dt: number, context: MiniGameContext, env: EnvironmentRig, scene: Scene, camera: PerspectiveCamera): void {
  state.elapsedTime += dt;
  const time = state.elapsedTime;

  // 1. Update environment animations
  updateEnvironment(env, time);

  // 2. Update target positions + state machines
  updateTargets(state, dt, time, scene, context.difficulty.level, env.ocean.position.y);

  // 3. Update cannonball arcs + arrival checks
  updateCannonballs(state, dt, scene, context, camera);

  // 4. Update all particle effects
  updateParticles(state.splashParticles, dt);
  updateFragments(state.fragments, dt);
  updateCoins(state.coins, dt, scene, state.splashParticles);

  // 5. Process pending chain hits
  processChainHits(state, dt, scene, context, camera);

  // 6. Update cannon idle animation
  if (state.cannon) {
    updateCannonIdle(state.cannon, dt, time);
  }

  // 7. Update camera shake
  updateCameraShake(state, dt, camera);

  // 8. Ocean ambient sparkle
  oceanSparkleTimer += dt;
  if (oceanSparkleTimer >= C.OCEAN_SPARKLE_INTERVAL) {
    oceanSparkleTimer -= C.OCEAN_SPARKLE_INTERVAL;
    if (state.splashParticles.length < 60) {
      spawnOceanSparkle(scene, state.splashParticles);
    }
  }
}

/** Updates all active targets — spawning animation, bob/drift, boundary recycling. */
function updateTargets(state: GameState, dt: number, time: number, scene: Scene, difficulty: number, oceanY: number = 0): void {
  // Difficulty-scaled bob amplitude
  const bobAmplitude = lerp(0.06, 0.08, difficulty);

  for (let i = state.targets.length - 1; i >= 0; i--) {
    const t = state.targets[i];
    t.stateTimer += dt;

    if (t.state === 'spawning') {
      const progress = Math.min(1, t.stateTimer / C.SPAWN_ANIM_DURATION);
      const easeOut = 1 - (1 - progress) * (1 - progress);
      const targetScale = t.root.userData.targetScale ?? 1;
      t.root.scale.setScalar(easeOut * targetScale);
      t.root.position.y = oceanY + t.baseY + (1 - easeOut) * -0.3;

      if (progress >= 1) {
        t.state = 'active';
        t.stateTimer = 0;
      }
      continue;
    }

    if (t.state === 'hit') {
      const progress = Math.min(1, t.stateTimer / C.HIT_ANIM_DURATION);
      const targetScale = t.root.userData.targetScale ?? 1;
      t.root.scale.setScalar(targetScale * (1 - progress));

      if (progress >= 1) {
        recycleTarget(state.targets, i);
      }
      continue;
    }

    if (t.state === 'active') {
      // Drift
      t.root.position.x += t.driftVx * dt;
      t.root.position.z += t.driftVz * dt;

      // Bob — difficulty-scaled amplitude + ocean surface offset
      t.root.position.y = oceanY + t.baseY + bobAmplitude * Math.sin(time * t.bobSpeed + t.bobPhase);
      t.root.rotation.z = C.ROLL_AMPLITUDE * Math.sin(time * t.bobSpeed * 0.7 + t.bobPhase + 1.0);

      // Special target visuals
      if (t.kind === 'golden-barrel' || t.kind === 'rainbow-bottle') {
        updateSpecialTargetVisuals(t.root, t.kind, time);
      }

      // Edge warning — pulse emissive red when nearing boundary
      if (Math.abs(t.root.position.x) > 7) {
        t.root.traverse((child) => {
          const mesh = child as import('three').Mesh;
          if (mesh.material && (mesh.material as MeshStandardMaterial).emissive) {
            const pulse = 0.5 + 0.5 * Math.sin(time * 8);
            (mesh.material as MeshStandardMaterial).emissive.setRGB(pulse, 0, 0);
          }
        });
      } else if (t.kind !== 'golden-barrel' && t.kind !== 'rainbow-bottle') {
        t.root.traverse((child) => {
          const mesh = child as import('three').Mesh;
          if (mesh.material && (mesh.material as MeshStandardMaterial).emissive) {
            (mesh.material as MeshStandardMaterial).emissive.setRGB(0, 0, 0);
          }
        });
      }

      // Boundary check
      if (Math.abs(t.root.position.x) > C.SPAWN_X_EDGE) {
        t.state = 'drifted-off';
        recycleTarget(state.targets, i);
      }
    }
  }
}

/** Updates cannonball arcs and handles arrival (hit or miss effects). */
function updateCannonballs(state: GameState, dt: number, scene: Scene, context: MiniGameContext, _camera: PerspectiveCamera): void {
  for (let i = state.cannonballs.length - 1; i >= 0; i--) {
    const ball = state.cannonballs[i];
    const arrived = updateCannonball(ball, dt);

    // Trail particles
    ball.trailTimer += dt;
    if (ball.trailTimer >= C.TRAIL_SPAWN_INTERVAL && state.splashParticles.length < 80) {
      ball.trailTimer -= C.TRAIL_SPAWN_INTERVAL;
      spawnTrailParticle(scene, ball.mesh.position.clone(), state.splashParticles);
    }

    if (arrived) {
      const impactPos = ball.mesh.position.clone();
      const target = ball.target;

      if (target !== null && target.state === 'active') {
        // Target hit
        target.state = 'hit';
        target.stateTimer = 0;

        const screenX = context.viewport.width / 2;
        const screenY = context.viewport.height / 2;
        handleTargetHit(target, screenX, screenY, state, context);

        spawnTargetExplosion(scene, impactPos, target.kind, state.fragments, state.splashParticles);
        spawnScoreIndicator(scene, impactPos, state.splashParticles);

        // Golden barrel bonus
        if (target.kind === 'golden-barrel') {
          spawnGoldenSparkle(scene, impactPos, state.splashParticles);
          spawnBonusCoins(scene, impactPos, state.coins);
          context.score.addPoints(C.SCORE_COIN * C.BONUS_COIN_COUNT);
        }

        // Rainbow bottle chain reaction
        if (target.kind === 'rainbow-bottle') {
          spawnRainbowRing(scene, impactPos, state.splashParticles);
          const chainHits = resolveChainReaction(target, state.targets);
          for (const ch of chainHits) {
            state.pendingChainHits.push(ch);
          }
        }
      } else {
        // Water miss (target gone or no target)
        handleWaterMiss(context);
        spawnWaterSplash(scene, impactPos, state.splashParticles);
      }

      recycleCannonball(state.cannonballs, i);
    }
  }
}

/** Processes pending chain reaction hits. */
function processChainHits(state: GameState, dt: number, scene: Scene, context: MiniGameContext, _camera: PerspectiveCamera): void {
  for (let i = state.pendingChainHits.length - 1; i >= 0; i--) {
    const ch = state.pendingChainHits[i];
    ch.delay -= dt;

    if (ch.delay <= 0) {
      // Execute chain hit — use direct reference, check state
      const target = ch.target;
      if (target.state === 'active') {
        target.state = 'hit';
        target.stateTimer = 0;

        const screenX = context.viewport.width / 2;
        const screenY = context.viewport.height / 2;
        handleTargetHit(target, screenX, screenY, state, context, true);

        spawnTargetExplosion(scene, target.root.position.clone(), target.kind, state.fragments, state.splashParticles);
        spawnScoreIndicator(scene, target.root.position.clone(), state.splashParticles);
      }

      // Remove from pending
      const last = state.pendingChainHits.length - 1;
      if (i !== last) state.pendingChainHits[i] = state.pendingChainHits[last];
      state.pendingChainHits.pop();
    }
  }
}

/** Updates camera shake after cannon fire. */
function updateCameraShake(state: GameState, dt: number, camera: PerspectiveCamera): void {
  if (state.cameraShakeTimer > 0) {
    state.cameraShakeTimer -= dt;
    const progress = Math.max(0, state.cameraShakeTimer / C.CAMERA_SHAKE_DURATION);

    // Apply shake offset
    camera.position.x = C.CAMERA_POS_X + state.cameraShakeOffset.x * progress;
    camera.position.y = C.CAMERA_POS_Y + state.cameraShakeOffset.y * progress;
  } else {
    // Idle sway — ship breathing
    const time = state.elapsedTime;
    camera.position.x = C.CAMERA_POS_X + 0.02 * Math.sin(time * 0.4);
    camera.position.y = C.CAMERA_POS_Y + 0.015 * Math.sin(time * 0.55 + 1.2);
    state.cameraShakeOffset.x = 0;
    state.cameraShakeOffset.y = 0;
  }
}

export { resolveTap, resolveChainReaction } from './collision';
export { handleTargetHit, handleWaterMiss } from './scoring';
export {
  pickSpawnPosition,
  shouldSpawnSpecial,
  selectSpecialKind,
  getSpawnBand,
  getSpawnCapacity,
  getSpawnInterval,
  selectTargetKind,
  randomDriftVector,
} from './spawning';

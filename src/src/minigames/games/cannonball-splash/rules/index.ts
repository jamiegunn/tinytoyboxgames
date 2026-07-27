/**
 * Update orchestration for Cannonball Splash.
 *
 * Called once per frame from the root game update.
 */

import { type Scene, type PerspectiveCamera } from 'three';
import type { MiniGameContext } from '../../../framework/types';
import type { GameState, Target, EnvironmentRig } from '../types';
import { C } from '../types';
import { lerp, nearestTarget, playHalfWidthAt } from '../helpers';
import { updateEnvironment, sampleOceanHeight } from '../environment';
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
 * @param state - Mutable game state.
 * @param dt - Frame delta time in seconds.
 * @param context - Framework services.
 * @param env - The environment rig.
 * @param scene - The scene entities live in.
 * @param camera - The game camera.
 */
export function updateGameFrame(state: GameState, dt: number, context: MiniGameContext, env: EnvironmentRig, scene: Scene, camera: PerspectiveCamera): void {
  state.elapsedTime += dt;
  const time = state.elapsedTime;

  // 1. Update environment animations
  updateEnvironment(env, time, dt);

  // 2. Update target positions + state machines
  updateTargets(state, dt, time, context.difficulty.level, camera);

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
      spawnOceanSparkle(scene, camera, state.splashParticles);
    }
  }
}

// Paints (or clears) a target's own "I'm about to float away" warning.
//
// The warning used to traverse the meshes and write emissive on whatever
// material it found — which were module-level singletons, so one barrel nearing
// the edge turned every barrel, bottle and duck in the scene red. It now writes
// only to the materials this target owns, and every material restores the
// baseEmissive it was built with, including the golden barrel's glow (which had
// no reset branch at all and stayed red forever once warned).
//
// Red on black is also not a colour a three-year-old reads as "hurry" so much as
// "danger"; the warning brightens the target's own colour instead of repainting
// it, so a barrel about to leave looks lit up rather than broken.
function applyExpiryWarning(target: Target, warning: boolean, time: number): void {
  const pulse = 0.18 + 0.18 * Math.sin(time * 7);
  for (const m of target.materials) {
    if (warning) {
      m.emissive.copy(m.color).multiplyScalar(pulse);
    } else {
      m.emissive.setHex((m.userData.baseEmissive as number | undefined) ?? 0);
    }
  }
}

// Keeps a drifting target inside the visible trapezoid by reflecting it off the
// boundary instead of letting it walk out of frame.
//
// Bouncing rather than despawning is what makes the play area feel like a pond
// with sides: the old rule spawned at |x| = 9 (off-screen at every z the camera
// shows near the bow) and despawned at |x| > 9, so a target's whole life could
// be spent outside the frame. Because the half-width grows with depth, the
// bound is recomputed at the target's current z every frame.
function constrainDrift(target: Target, camera: PerspectiveCamera): void {
  const pos = target.root.position;

  if (pos.z < C.PLAY_Z_MIN) {
    pos.z = C.PLAY_Z_MIN;
    target.driftVz = Math.abs(target.driftVz);
  } else if (pos.z > C.PLAY_Z_MAX) {
    pos.z = C.PLAY_Z_MAX;
    target.driftVz = -Math.abs(target.driftVz);
  }

  const halfWidth = playHalfWidthAt(camera, pos.z);
  if (pos.x < -halfWidth) {
    pos.x = -halfWidth;
    target.driftVx = Math.abs(target.driftVx);
  } else if (pos.x > halfWidth) {
    pos.x = halfWidth;
    target.driftVx = -Math.abs(target.driftVx);
  }
}

/**
 * Updates all active targets — spawn animation, bob/drift, expiry and recycling.
 * @param state - Mutable game state.
 * @param dt - Frame delta time in seconds.
 * @param time - Total elapsed game time in seconds.
 * @param difficulty - Normalized difficulty in [0, 1].
 * @param camera - Live game camera, used to derive the play boundary per depth.
 */
function updateTargets(state: GameState, dt: number, time: number, difficulty: number, camera: PerspectiveCamera): void {
  // Difficulty-scaled bob amplitude
  const bobAmplitude = lerp(0.06, 0.08, difficulty);

  for (let i = state.targets.length - 1; i >= 0; i--) {
    const t = state.targets[i];
    t.stateTimer += dt;
    // Targets ride the actual water surface under them, not one global offset.
    const waterY = sampleOceanHeight(t.root.position.x, t.root.position.z, time);

    if (t.state === 'spawning') {
      const progress = Math.min(1, t.stateTimer / C.SPAWN_ANIM_DURATION);
      const easeOut = 1 - (1 - progress) * (1 - progress);
      t.root.scale.setScalar(easeOut * C.TARGET_SCALE);
      t.root.position.y = waterY + t.baseY + (1 - easeOut) * -0.3;

      if (progress >= 1) {
        t.state = 'active';
        t.stateTimer = 0;
      }
      continue;
    }

    // 'hit' and 'drifted-off' are both "shrink away and go", and share the
    // animation. They differ only in how they were reached: one was earned.
    if (t.state === 'hit' || t.state === 'drifted-off') {
      const progress = Math.min(1, t.stateTimer / C.HIT_ANIM_DURATION);
      t.root.scale.setScalar(C.TARGET_SCALE * (1 - progress));
      t.root.position.y = waterY + t.baseY;

      if (progress >= 1) {
        recycleTarget(state.targets, i);
      }
      continue;
    }

    if (t.state === 'active') {
      // Drift, then reflect off the visible play boundary.
      t.root.position.x += t.driftVx * dt;
      t.root.position.z += t.driftVz * dt;
      constrainDrift(t, camera);

      // Bob — difficulty-scaled amplitude on top of the swell
      t.root.position.y = waterY + t.baseY + bobAmplitude * Math.sin(time * t.bobSpeed + t.bobPhase);
      t.root.rotation.z = C.ROLL_AMPLITUDE * Math.sin(time * t.bobSpeed * 0.7 + t.bobPhase + 1.0);

      // Special target visuals
      if (t.kind === 'golden-barrel' || t.kind === 'rainbow-bottle') {
        updateSpecialTargetVisuals(t.root, t.kind, time);
      }

      // Turnover is now driven by time in play, not by leaving through the side.
      // Targets bounce off the frustum edge, so without a lifetime the water
      // would silently fill to the spawn cap and stay there.
      applyExpiryWarning(t, t.stateTimer > C.TARGET_LIFETIME - C.TARGET_WARN_TIME, time);

      if (t.stateTimer >= C.TARGET_LIFETIME) {
        applyExpiryWarning(t, false, time);
        t.state = 'drifted-off';
        t.stateTimer = 0;
      }
    }
  }
}

/**
 * Updates cannonball flight and handles splashdown (hit or miss effects).
 * @param state - Mutable game state.
 * @param dt - Frame delta time in seconds.
 * @param scene - The scene entities live in.
 * @param context - Framework services.
 * @param _camera - Unused; kept for signature symmetry with the other passes.
 */
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
      const splashPos = ball.mesh.position.clone();

      // Hits are decided here, by where the ball came down — not by a target
      // reference captured at fire time. A target that drifted away in the
      // meantime is genuinely missed, and a shot into empty water splashes.
      const hitIndex = nearestTarget(state.targets, splashPos, C.HIT_RADIUS);
      const target = hitIndex !== null ? state.targets[hitIndex] : null;

      if (target !== null) {
        target.state = 'hit';
        target.stateTimer = 0;

        // The explosion plays where the target actually is. It used to play at
        // the frozen aim point sampled when the child tapped, so a drifting
        // barrel burst up to a body-width away from itself.
        const impactPos = target.root.position.clone();

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
        // Nothing in range — a real miss, with a real splash where it landed.
        handleWaterMiss(context);
        spawnWaterSplash(scene, splashPos, state.splashParticles);
      }

      recycleCannonball(state.cannonballs, i);
    }
  }
}

/**
 * Processes pending chain reaction hits.
 * @param state
 * @param dt
 * @param scene
 * @param context
 * @param _camera
 */
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

/**
 * Updates camera shake after cannon fire.
 *
 * The shake used to be one random offset that decayed back to zero — a single
 * lurch and a slow slide home, which reads as the camera being nudged rather
 * than the boom hitting it. It is now a real oscillation: a decaying wobble at
 * ~9Hz along a direction re-rolled per shot, always settling into the idle sway.
 * @param state - Mutable game state.
 * @param dt - Frame delta time in seconds.
 * @param camera - The game camera.
 */
function updateCameraShake(state: GameState, dt: number, camera: PerspectiveCamera): void {
  const time = state.elapsedTime;

  // Idle sway — the ship breathing on the swell.
  let x = C.CAMERA_POS_X + 0.02 * Math.sin(time * 0.4);
  let y = C.CAMERA_POS_Y + 0.015 * Math.sin(time * 0.55 + 1.2);

  if (state.cameraShakeTimer > 0) {
    state.cameraShakeTimer = Math.max(0, state.cameraShakeTimer - dt);
    const remaining = state.cameraShakeTimer / C.CAMERA_SHAKE_DURATION;
    const elapsed = C.CAMERA_SHAKE_DURATION - state.cameraShakeTimer;
    // Amplitude falls off quadratically so the last wobble lands softly.
    const wobble = C.CAMERA_SHAKE_MAGNITUDE * remaining * remaining * Math.sin(elapsed * C.CAMERA_SHAKE_FREQUENCY);
    x += state.cameraShakeDir.x * wobble;
    y += state.cameraShakeDir.y * wobble;
  }

  camera.position.x = x;
  camera.position.y = y;
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

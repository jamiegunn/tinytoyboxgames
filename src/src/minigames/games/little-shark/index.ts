import { Scene, Vector3, Color, PerspectiveCamera, type Object3D } from 'three';
import type { Mesh } from 'three';
import type { IMiniGame, MiniGameContext, MiniGameTapEvent, MiniGameDragEvent, MiniGameDragEndEvent, ViewportInfo } from '../../framework/types';
import { clamp, getSpeedMultiplier } from './helpers';
import {
  buildSharkEntity,
  createFish,
  resetFishForSpawn,
  deactivateFish,
  disposeFish,
  resetMeshIndex,
  updateFishDrift,
  updateGoldenDodge,
  updateDespawnAnimation,
  updateEatAnimation,
} from './fish';
import {
  setupScene,
  teardownScene,
  updateCausticLights,
  updateSeaweedSway,
  updateAnemoneSway,
  updateEnvironmentReactions,
  createAmbientCreatures,
  updateAmbientCreatures,
  disposeAmbientCreatures,
  type SceneEnvironment,
  type AmbientCreatures,
} from './environment';
import {
  BOUNDS,
  FISH_HIT_RADIUS,
  GOLDEN_HIT_RADIUS,
  EAT_ANIM_DURATION,
  FISH_DESPAWN_SCALE_DURATION,
  FISH_POINTS,
  FISH_COLORS,
  GOLDEN_COLOR,
  MILESTONE_SCHEDULE,
  MILESTONE_REPEAT_INTERVAL,
  type FishState,
  type FishKind,
} from './types';
import {
  createSharkAnimState,
  updateTailWag,
  updateBodyWobble,
  updateBreathing,
  updateEyeBlink,
  updateBarrelRoll,
  updateHeadLook,
  triggerHeadLook,
  triggerBarrelRoll,
  type SharkAnimState,
  createSharkMoveState,
  updateSpringFollow,
  updateIdleDrift,
  updateSwim,
  startLunge,
  updateRotation,
  getSpeed,
  applyToMesh,
  type SharkMoveState,
  // Hunt FSM
  createHuntFSMState,
  updateHuntFSM,
  triggerHunt,
  cancelHunt,
  getHuntPhase,
  type HuntFSMState,
  // Expressions
  createExpressionState,
  updateExpressions,
  setMood,
  getMoodParams,
  getMoodForPhase,
  type ExpressionState,
  // Spline body — available for future use when integrated into shark mesh
  // createSplineBody, updateSplineBody, disposeSplineBody, type SplineBodyState,
} from './shark';
import { classifyPickedMesh, handleWaterTap, handleRockTap, handleSharkTap, createInteractionState, type InteractionState } from './interactions';
import { createCelebrationQueue } from './celebrations';
import { createProximitySpawnState, updateProximitySpawning, notifyFishEaten, CAMERA_VIEW_RADIUS, CULL_DISTANCE, type ProximitySpawnState } from './waves';
import { createSurpriseState, updateSurprises, type SurpriseState } from './surprises';
import { disposeMeshDeep } from '@app/minigames/shared/disposal';
import type { createGlowTrail } from '@app/minigames/shared/particleFx';

// Phase 6 — Camera, VFX, Screen effects
import { createCameraState, updateFollowCamera, triggerCatchZoom, triggerScreenShake, resetCamera, type CameraState } from './camera/followCamera';
import { createBubbleTrail, createCatchExplosion, type BubbleTrail } from './effects/particles';
import {
  createVignette,
  updateVignette,
  triggerVignette,
  createSpeedLines,
  updateSpeedLines,
  triggerSpeedLines,
  createColorFlash,
  updateColorFlash,
  triggerColorFlash,
  disposeScreenFx,
  type VignetteState,
  type SpeedLineState,
  type ColorFlashState,
} from './effects/screenFx';

/**
 * Checks if a mesh is a descendant of (or is) a root object.
 * @param child - The object to check.
 * @param root - The potential ancestor object.
 * @returns True if child is root or a descendant of root.
 */
function isDescendantOf(child: Object3D, root: Object3D): boolean {
  let current: Object3D | null = child;
  while (current) {
    if (current === root) return true;
    current = current.parent;
  }
  return false;
}

/**
 * Creates the Little Shark mini-game.
 * @param context - Shell-provided context with shared systems.
 * @returns An IMiniGame implementation for the little-shark game.
 */
export function createGame(context: MiniGameContext): IMiniGame {
  const scene = context.scene as Scene;
  const shellCam = context.camera as PerspectiveCamera;
  let env: SceneEnvironment | null = null;
  let ambientCreatures: AmbientCreatures | null = null;
  let sharkRoot: Mesh | null = null;
  let sharkBody: Object3D | null = null;
  let sharkGlowTrail: ReturnType<typeof createGlowTrail> | null = null;
  let tailMeshes: Object3D[] = [];
  let eyeMeshes: Object3D[] = [];
  let sharkAnim: SharkAnimState = createSharkAnimState();
  let sharkMove: SharkMoveState = createSharkMoveState();
  const sharkPos = new Vector3(0, 0, 0);
  let paused = false;
  let elapsedTime = 0;
  let eatAnimTimer = -1;
  let firstCatchDone = false;
  const fishArray: FishState[] = [];
  let goldenFish: FishState | null = null;
  let spawnState: ProximitySpawnState | null = null;
  let surpriseState: SurpriseState | null = null;
  let unsubScore: (() => void) | null = null;
  const celebrations = createCelebrationQueue();
  let interactionState: InteractionState = createInteractionState();

  // Phase 3 — Hunt FSM, Expressions
  let huntState: HuntFSMState = createHuntFSMState();
  let expressionState: ExpressionState = createExpressionState();

  // Phase 6 — Camera, VFX, Screen effects
  let cameraState: CameraState | null = null;
  let vignetteState: VignetteState | null = null;
  let speedLineState: SpeedLineState | null = null;
  let colorFlashState: ColorFlashState | null = null;
  const activeBubbleTrails: BubbleTrail[] = [];

  function eatFishAction(fish: FishState): void {
    fish.active = false;
    fish.despawnTimer = FISH_DESPAWN_SCALE_DURATION;
    context.score.addPoints(FISH_POINTS[fish.kind]);
    context.combo.registerHit();
    celebrations.playEatCelebration({
      scene,
      fishPos: fish.root.position.clone(),
      fishColor: fish.kind === 'golden' ? GOLDEN_COLOR : FISH_COLORS[0],
      fishKind: fish.kind,
      sharkBody,
      sharkRoot,
      sharkAnim,
      comboStreak: context.combo.streak,
      isFirstCatch: !firstCatchDone,
      context,
    });
    if (!firstCatchDone) firstCatchDone = true;
    eatAnimTimer = EAT_ANIM_DURATION;

    // Camera catch zoom + screen shake
    if (cameraState) {
      triggerCatchZoom(cameraState, fish.kind === 'golden' ? 5.0 : 3.0);
      triggerScreenShake(cameraState, 0.12, fish.kind === 'golden' ? 0.06 : 0.03);
    }

    // Catch explosion VFX scaled by combo
    createCatchExplosion(scene, fish.root.position.clone(), fish.kind === 'golden' ? GOLDEN_COLOR : FISH_COLORS[0], context.combo.streak);

    // Golden catch: vignette + color flash
    if (fish.kind === 'golden') {
      if (vignetteState) triggerVignette(vignetteState, 0.4, 0.2);
      if (colorFlashState) triggerColorFlash(colorFlashState, new Color(1.0, 0.85, 0.2), 0.3, 0.12);
    }

    // Cancel hunt if we ate the hunted fish
    if (huntState.targetFishRoot === fish.root) {
      cancelHunt(huntState);
    }

    // Notify proximity spawner to queue replacements
    if (spawnState) notifyFishEaten(spawnState, fish.kind === 'golden');
  }

  // ── Entity pool helpers ─────────────────────────────────────────────

  /**
   * Acquires a fish from the pool or creates a new one.
   * Reuses inactive fish of matching kind before allocating.
   * @param kind - The fish kind to acquire.
   * @returns A ready-to-use FishState.
   */
  function acquireFish(kind: FishKind): FishState {
    const pooled = fishArray.find((f) => !f.active && f.despawnTimer <= 0 && f.kind === kind);
    if (pooled) {
      resetFishForSpawn(pooled, sharkPos);
      return pooled;
    }
    const fish = createFish(scene, sharkPos, kind);
    fishArray.push(fish);
    return fish;
  }

  // ── Update subsystems ───────────────────────────────────────────────

  /** Updates shark movement, rotation, hunt FSM, and applies to mesh. */
  let _dbgTimer = 0;
  function updateSharkMovement(dt: number): void {
    const huntPhase = getHuntPhase(huntState);
    _dbgTimer += dt;
    if (_dbgTimer > 1.0) {
      _dbgTimer = 0;
      console.log(
        '[SHARK-DBG] movement tick: huntPhase=',
        huntPhase,
        '| swimPhase=',
        sharkMove.swimPhase,
        '| pos=',
        { x: sharkMove.posX.toFixed(2), z: sharkMove.posZ.toFixed(2) },
        '| dest=',
        { x: sharkMove.swimDestX.toFixed(2), z: sharkMove.swimDestZ.toFixed(2) },
        '| dragging=',
        sharkMove.isBeingDragged,
      );
    }

    // Hunt FSM drives movement when not idle
    if (huntPhase !== 'idle') {
      updateHuntFSM(huntState, sharkMove, dt, {
        onStrike: () => {
          // Speed lines on strike
          if (speedLineState) triggerSpeedLines(speedLineState, 0.25);
        },
        onCelebrate: () => {
          triggerBarrelRoll(sharkAnim);
        },
      });
      // Face the direction of travel during hunt — fast rotation
      if (Math.abs(sharkMove.velX) > 0.01 || Math.abs(sharkMove.velZ) > 0.01) {
        sharkMove.rotY = Math.atan2(-sharkMove.velZ, sharkMove.velX);
      }
      // Apply position from hunt FSM
      if (sharkRoot) applyToMesh(sharkMove, sharkRoot);
      sharkPos.x = sharkMove.posX;
      sharkPos.z = sharkMove.posZ;
    } else {
      // Normal movement when not hunting
      const wasLunging = sharkMove.isLunging;
      if (sharkMove.swimPhase !== 'idle') {
        updateSwim(sharkMove, dt);
      } else if (!sharkMove.isBeingDragged) {
        updateIdleDrift(sharkMove, dt);
      } else {
        updateSpringFollow(sharkMove, dt);
      }
      updateRotation(sharkMove, dt);
      if (sharkRoot) applyToMesh(sharkMove, sharkRoot);
      sharkPos.x = sharkMove.posX;
      sharkPos.z = sharkMove.posZ;

      if (!sharkMove.isLunging && wasLunging) {
        const near = fishArray.some((f) => f.active && Math.hypot(sharkMove.posX - f.root.position.x, sharkMove.posZ - f.root.position.z) < 2.0);
        if (!near) triggerHeadLook(sharkAnim);
      }
    }

    // Update expression mood based on hunt phase
    const targetMood = getMoodForPhase(huntPhase);
    setMood(expressionState, targetMood);
    updateExpressions(expressionState, dt);
  }

  /**
   * Updates all shark animations driven by mood and speed.
   * @param dt - Frame delta time in seconds.
   */
  function updateSharkAnimations(dt: number): void {
    const speed = getSpeed(sharkMove);
    const mood = getMoodParams(expressionState);

    // Tail wag modulated by mood
    if (tailMeshes.length > 0) {
      // Temporarily scale animation params by mood multipliers
      const origTailPhase = sharkAnim.tailPhase;
      updateTailWag(tailMeshes, sharkAnim, speed * mood.tailFreqMult, dt);
      // Apply amplitude modulation by scaling the result
      for (const tail of tailMeshes) {
        tail.rotation.y *= mood.tailAmpMult;
      }
      void origTailPhase; // used for type-checking only
    }

    if (sharkBody) {
      updateBodyWobble(sharkBody, elapsedTime, speed * mood.bodyWobbleMult);
      updateBreathing(sharkBody, elapsedTime);
    }

    // Eye scale driven by mood
    if (eyeMeshes.length > 0) {
      updateEyeBlink(eyeMeshes, sharkAnim, dt);
      for (const eye of eyeMeshes) {
        eye.scale.y *= mood.eyeScaleY;
      }
    }

    if (sharkRoot) {
      updateBarrelRoll(sharkRoot, sharkAnim, dt);
      updateHeadLook(sharkRoot, sharkAnim, dt);
    }
  }

  /**
   * Updates proximity-based spawning and culls distant fish.
   * @param dt - Frame delta time in seconds.
   */
  function updateSpawning(dt: number): void {
    if (!spawnState) return;

    updateProximitySpawning(spawnState, dt, sharkPos.x, sharkPos.z, {
      spawnFish: (edgeX: number, edgeZ: number, targetX: number, targetZ: number) => {
        const fish = acquireFish('standard');
        fish.root.position.set(edgeX, 0, edgeZ);
        fish.spawning = true;
        fish.spawnTimer = 1.5;
        fish.spawnEdgeX = edgeX;
        fish.spawnEdgeZ = edgeZ;
        fish.driftCenterX = targetX;
        fish.driftCenterZ = targetZ;
      },
      spawnGoldenFish: () => {
        if (!goldenFish) goldenFish = createFish(scene, sharkPos, 'golden');
      },
      countNearbyFish: () => {
        let count = 0;
        for (const f of fishArray) {
          if (!f.active || f.spawning) continue;
          const dx = f.root.position.x - sharkPos.x;
          const dz = f.root.position.z - sharkPos.z;
          if (dx * dx + dz * dz < CAMERA_VIEW_RADIUS * CAMERA_VIEW_RADIUS) count++;
        }
        return count;
      },
    });

    // Silently cull fish that have drifted far from the shark
    for (const fish of fishArray) {
      if (!fish.active || fish.spawning) continue;
      const dx = fish.root.position.x - sharkPos.x;
      const dz = fish.root.position.z - sharkPos.z;
      if (dx * dx + dz * dz > CULL_DISTANCE * CULL_DISTANCE) {
        deactivateFish(fish);
      }
    }
  }

  /**
   * Updates all environment systems (caustics, sway, reactions, ambient, surprises).
   * @param dt - Frame delta time in seconds.
   */
  function updateEnvironmentSystems(dt: number): void {
    if (env) {
      updateCausticLights(env.causticLights, elapsedTime);
      updateSeaweedSway(env.seaweeds, elapsedTime);
      updateAnemoneSway(env.anemones, elapsedTime);
      updateEnvironmentReactions(sharkPos.x, sharkPos.z, env, dt, elapsedTime);
      env.waterSurface.position.y = 2.5 + Math.sin(elapsedTime * 0.15) * 0.03;
    }
    if (ambientCreatures) updateAmbientCreatures(ambientCreatures, dt, elapsedTime, sharkPos.x, sharkPos.z);
    if (surpriseState && env) updateSurprises(surpriseState, elapsedTime, dt, env, scene);
  }

  /**
   * Updates all fish (drift, dodge, spawn, despawn) and checks collisions.
   * @param dt - Frame delta time in seconds.
   * @param speedMultiplier - Difficulty-driven speed multiplier.
   */
  function updateFishAndCollisions(dt: number, speedMultiplier: number): void {
    const allFish: FishState[] = [...fishArray];
    if (goldenFish) allFish.push(goldenFish);
    for (const fish of allFish) {
      if (!fish.active) {
        if (fish.despawnTimer > 0) {
          const done = updateDespawnAnimation(fish, dt);
          if (done) {
            if (fish === goldenFish) {
              disposeFish(fish);
              goldenFish = null;
            } else {
              deactivateFish(fish);
            }
          }
        }
        continue;
      }
      if (fish.spawning) {
        fish.spawnTimer -= dt;
        const t = clamp(1.0 - fish.spawnTimer / 1.5, 0, 1);
        const eased = t * t * (3 - 2 * t);
        fish.root.position.x = fish.spawnEdgeX + (fish.driftCenterX - fish.spawnEdgeX) * eased;
        fish.root.position.z = fish.spawnEdgeZ + (fish.driftCenterZ - fish.spawnEdgeZ) * eased;
        if (fish.spawnTimer <= 0) fish.spawning = false;
        continue;
      }
      updateFishDrift(fish, dt, speedMultiplier, sharkPos.x, sharkPos.z);
      if (fish.kind === 'golden') updateGoldenDodge(fish, sharkPos.x, sharkPos.z, dt);
    }

    // Collision detection — standard fish
    for (let i = fishArray.length - 1; i >= 0; i--) {
      const fish = fishArray[i];
      if (!fish.active || fish.spawning) continue;
      const ex = sharkPos.x - fish.root.position.x;
      const ez = sharkPos.z - fish.root.position.z;
      if (Math.sqrt(ex * ex + ez * ez) < FISH_HIT_RADIUS) eatFishAction(fish);
    }
    // Collision detection — golden fish
    if (goldenFish && goldenFish.active && !goldenFish.spawning) {
      const gx = sharkPos.x - goldenFish.root.position.x;
      const gz = sharkPos.z - goldenFish.root.position.z;
      if (Math.sqrt(gx * gx + gz * gz) < GOLDEN_HIT_RADIUS) {
        eatFishAction(goldenFish);
        context.celebration.milestone(0, 0, 'large');
      }
    }
  }

  /**
   * Updates camera follow, VFX, and screen effects.
   * @param dt - Frame delta time in seconds.
   */
  function updateCameraAndEffects(dt: number): void {
    // Follow camera
    if (cameraState) {
      updateFollowCamera(cameraState, shellCam, sharkPos.x, sharkPos.z, dt);
    }

    // Screen effects
    if (vignetteState) updateVignette(vignetteState, dt);
    if (speedLineState) updateSpeedLines(speedLineState, dt);
    if (colorFlashState) updateColorFlash(colorFlashState, dt);

    // Bubble trails — tick active trails, remove expired
    for (let i = activeBubbleTrails.length - 1; i >= 0; i--) {
      const alive = activeBubbleTrails[i].update(dt);
      if (!alive) {
        activeBubbleTrails[i].dispose();
        activeBubbleTrails.splice(i, 1);
      }
    }

    // Spawn bubble trail behind swimming shark periodically
    if (getSpeed(sharkMove) > 1.0 && sharkRoot && Math.random() < dt * 3.0) {
      const dir = new Vector3(-Math.sin(sharkMove.rotY) * 0.5, 0.3, -Math.cos(sharkMove.rotY) * 0.5);
      const trail = createBubbleTrail(scene, sharkRoot.position.clone(), dir);
      activeBubbleTrails.push(trail);
    }
  }

  // ── Game implementation ─────────────────────────────────────────────

  const game: IMiniGame = {
    id: 'little-shark',

    async setup(): Promise<void> {
      env = setupScene(scene);

      // Copy game camera settings onto the shell's camera so rendering and raycasting align
      if (env.camera && context.camera) {
        shellCam.position.copy(env.camera.position);
        shellCam.rotation.copy(env.camera.rotation);
        shellCam.fov = env.camera.fov;
        shellCam.near = env.camera.near;
        shellCam.far = env.camera.far;
        shellCam.updateProjectionMatrix();
      }

      // Add lights to scene
      if (env.lights) {
        scene.add(env.lights.directionalLight);
        scene.add(env.lights.ambientLight);
        scene.add(env.lights.pointLight);
      }

      ambientCreatures = createAmbientCreatures(scene);
      const sharkResult = buildSharkEntity(scene, sharkPos);
      sharkRoot = sharkResult.sharkRoot;
      sharkBody = sharkResult.sharkBody;
      sharkGlowTrail = sharkResult.sharkGlowTrail;
      tailMeshes = sharkResult.tailFins;
      eyeMeshes = sharkResult.eyes;

      // Initialize camera system
      cameraState = createCameraState(shellCam);

      // Initialize screen effects (parented to camera)
      vignetteState = createVignette(shellCam);
      speedLineState = createSpeedLines(shellCam);
      colorFlashState = createColorFlash(shellCam);
    },

    start(): void {
      paused = false;
      elapsedTime = 0;
      eatAnimTimer = -1;
      firstCatchDone = false;
      sharkAnim = createSharkAnimState();
      sharkMove = createSharkMoveState();
      sharkPos.set(0, 0, 0);
      context.score.reset();
      context.combo.reset();
      for (const f of fishArray) disposeFish(f);
      fishArray.length = 0;
      if (goldenFish) {
        disposeFish(goldenFish);
        goldenFish = null;
      }
      spawnState = createProximitySpawnState();
      surpriseState = createSurpriseState();
      celebrations.clear();
      interactionState.clear();
      interactionState = createInteractionState();

      // Reset Phase 3 systems
      huntState = createHuntFSMState();
      expressionState = createExpressionState();

      // Reset camera
      if (cameraState) resetCamera(cameraState, shellCam);

      let lastMilestoneScore = 0;
      const maxScheduled = MILESTONE_SCHEDULE.length > 0 ? MILESTONE_SCHEDULE[MILESTONE_SCHEDULE.length - 1].score : 0;
      unsubScore = context.score.onScoreChanged((newScore: number) => {
        for (const ms of MILESTONE_SCHEDULE) {
          if (newScore >= ms.score && lastMilestoneScore < ms.score) {
            context.celebration.milestone(0, 0, ms.size);
            lastMilestoneScore = ms.score;
          }
        }
        if (newScore > maxScheduled) {
          const rm = maxScheduled + Math.floor((newScore - maxScheduled) / MILESTONE_REPEAT_INTERVAL) * MILESTONE_REPEAT_INTERVAL;
          if (rm > lastMilestoneScore) {
            context.celebration.milestone(0, 0, 'medium');
            lastMilestoneScore = rm;
          }
        }
      });
      context.audio.playMusic('ocean-ambient');
    },

    update(deltaTime: number): void {
      if (paused) return;
      const dt = deltaTime;
      elapsedTime += dt;
      const speedMultiplier = getSpeedMultiplier(context.difficulty.level);

      if (eatAnimTimer > 0 && sharkBody) eatAnimTimer = updateEatAnimation(sharkBody, eatAnimTimer, dt);

      updateSharkMovement(dt);
      updateSharkAnimations(dt);
      updateSpawning(dt);
      updateEnvironmentSystems(dt);
      updateFishAndCollisions(dt, speedMultiplier * 0.5);
      celebrations.update(dt);
      interactionState.update(dt);
      updateCameraAndEffects(dt);
    },

    pause(): void {
      paused = true;
    },

    resume(): void {
      paused = false;
    },

    teardown(): void {
      unsubScore?.();
      unsubScore = null;
      celebrations.clear();
      interactionState.clear();
      context.audio.stopMusic();

      // Dispose bubble trails
      for (const trail of activeBubbleTrails) trail.dispose();
      activeBubbleTrails.length = 0;

      // Dispose screen effects
      if (vignetteState && speedLineState && colorFlashState) {
        disposeScreenFx(vignetteState, speedLineState, colorFlashState);
        vignetteState = null;
        speedLineState = null;
        colorFlashState = null;
      }

      cameraState = null;

      if (sharkGlowTrail) {
        sharkGlowTrail.dispose();
        sharkGlowTrail = null;
      }
      for (const f of fishArray) disposeFish(f);
      fishArray.length = 0;
      if (goldenFish) {
        disposeFish(goldenFish);
        goldenFish = null;
      }
      if (sharkRoot) {
        disposeMeshDeep(sharkRoot);
        sharkRoot = null;
        sharkBody = null;
        tailMeshes = [];
        eyeMeshes = [];
      }
      if (ambientCreatures) {
        disposeAmbientCreatures(ambientCreatures);
        ambientCreatures = null;
      }
      if (env) {
        teardownScene(env);
        env = null;
      }
      spawnState = null;
      surpriseState = null;
      huntState = createHuntFSMState();
      expressionState = createExpressionState();
      resetMeshIndex();
    },

    onResize(_viewport: ViewportInfo): void {
      if (!env) return;
    },

    onTap(event: MiniGameTapEvent): void {
      if (paused) return;
      const pick = event.pickResult;
      console.log('[SHARK-DBG] onTap pick:', {
        hit: pick?.hit,
        meshName: (pick?.pickedMesh as Object3D)?.name,
        pickedPoint: pick?.pickedPoint,
        screenX: event.screenX,
        screenY: event.screenY,
      });
      if (!pick || !pick.hit || !pick.pickedMesh) {
        console.log('[SHARK-DBG] onTap: no pick, bailing');
        return;
      }
      const pickedMesh = pick.pickedMesh as Object3D;
      const kind = classifyPickedMesh(pickedMesh.name);
      console.log('[SHARK-DBG] classified as:', kind, '| mesh:', pickedMesh.name);
      switch (kind) {
        case 'fish': {
          const fish = fishArray.find((f) => f.active && !f.spawning && isDescendantOf(pickedMesh, f.root));
          if (fish) {
            fish.isTargeted = true;
            // Use hunt FSM instead of direct lunge
            if (getHuntPhase(huntState) === 'idle') {
              triggerHunt(huntState, fish.root);
              setMood(expressionState, 'curious');
            } else {
              // Fallback to direct lunge if already hunting
              startLunge(sharkMove, fish.root.position.x, fish.root.position.z, 6.0);
            }
          }
          break;
        }
        case 'golden': {
          if (goldenFish && goldenFish.active && !goldenFish.spawning) {
            if (isDescendantOf(pickedMesh, goldenFish.root)) {
              goldenFish.isTargeted = true;
              if (getHuntPhase(huntState) === 'idle') {
                triggerHunt(huntState, goldenFish.root);
                setMood(expressionState, 'excited');
              } else {
                startLunge(sharkMove, goldenFish.root.position.x, goldenFish.root.position.z, 6.0);
              }
            }
          }
          break;
        }
        case 'shark': {
          if (sharkRoot) {
            handleSharkTap(sharkAnim, scene, sharkRoot, context.audio);
            setMood(expressionState, 'playful');
          }
          break;
        }
        case 'coral': {
          interactionState.handleCoralTap(pickedMesh, scene, context.audio);
          break;
        }
        case 'seaweed': {
          interactionState.handleSeaweedTap(pickedMesh, context.audio);
          break;
        }
        case 'treasure': {
          interactionState.handleTreasureChestTap(pickedMesh, scene, context.audio);
          break;
        }
        case 'rock': {
          handleRockTap(pickedMesh, scene, context.audio);
          break;
        }
        case 'water':
        default: {
          const wp = pick.pickedPoint;
          console.log('[SHARK-DBG] water tap: pickedPoint=', wp, '| sharkPos=', { x: sharkPos.x, z: sharkPos.z });
          if (wp) {
            // Cancel any active hunt so the shark goes where you tap
            if (getHuntPhase(huntState) !== 'idle') {
              cancelHunt(huntState);
              sharkMove.velX = 0;
              sharkMove.velZ = 0;
            }
            const cx = clamp(wp.x, -BOUNDS, BOUNDS);
            const cz = clamp(wp.z, -BOUNDS, BOUNDS);
            console.log('[SHARK-DBG] startLunge to:', { cx, cz }, '| BOUNDS:', BOUNDS);
            startLunge(sharkMove, cx, cz, BOUNDS * 3);
            console.log('[SHARK-DBG] after startLunge: swimPhase=', sharkMove.swimPhase, '| dest=', {
              x: sharkMove.swimDestX,
              z: sharkMove.swimDestZ,
            });
            handleWaterTap(scene, new Vector3(cx, 0, cz), context.audio);
          }
          break;
        }
      }
    },

    onDrag(event: MiniGameDragEvent): void {
      if (paused) return;
      // Cancel hunt when player drags — they want manual control
      if (getHuntPhase(huntState) !== 'idle') {
        cancelHunt(huntState);
        sharkMove.velX = 0;
        sharkMove.velZ = 0;
      }
      sharkMove.isBeingDragged = true;
      const pick = event.pickResult;
      if (pick && pick.hit && pick.pickedPoint) {
        sharkMove.targetX = clamp(pick.pickedPoint.x, -BOUNDS, BOUNDS);
        sharkMove.targetZ = clamp(pick.pickedPoint.z, -BOUNDS, BOUNDS);
      }
    },

    onDragEnd(_event: MiniGameDragEndEvent): void {
      sharkMove.isBeingDragged = false;
    },
  };

  return game;
}

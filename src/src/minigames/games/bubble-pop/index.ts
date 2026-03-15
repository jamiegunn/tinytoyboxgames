import { Scene, Vector3, type Mesh } from 'three';
import type { IMiniGame, MiniGameContext, MiniGameTapEvent, ViewportInfo, EntityPool } from '../../framework/types';
import type { BubbleState, BubbleKind, EnvironmentObjects } from './types';
import {
  MAX_BUBBLES,
  RECYCLE_Y,
  MOON_PULSE_INTERVAL,
  BUBBLE_POINTS,
  SPAWN_JITTER,
  POOL_BUFFER,
  SCREEN_PROJECTION_SCALE,
  POP_SOUNDS,
  SIZE_VARIANTS,
  FALLBACK_X_EXTENT,
  FALLBACK_Y_EXTENT,
  FALLBACK_Y_OFFSET,
} from './types';
import { randomRange } from './helpers';
import {
  applyBubbleMaterial,
  positionBubbleAtSpawn,
  createBubble,
  resetBubble,
  disposeBubble,
  spawnGoldenBurst,
  disposeSharedShineMat,
  resetBubbleIndex,
  updateBubbleMotion,
  updateBubbleWobble,
  updateIridescence,
  popBubbleEffect,
  tickPopAnimations,
  clearPopAnimations,
  createTapFallbackSparkle,
  disposePopTexture,
  triggerChainPop,
  triggerWobbleChain,
  tapGiantBubble,
} from './bubbles';
import {
  setupSceneLighting,
  buildEnvironment,
  updateEnvironment,
  pulseNearbyStars,
  decayStarPulses,
  pulseMoon,
  decayMoonPulse,
  type SceneLightingRig,
} from './environment';
import { disposeMeshDeep } from '@app/minigames/shared/disposal';
import { tmpVec3 } from './tempPool';
import { createSpatialHash, applySoftBodyRepulsion, applyPopPressureWave } from './physics';
import type { SpatialHash } from './physics';
import {
  createPlayerProfile,
  recordTap,
  updatePlayerProfile,
  computeEffectiveDifficulty,
  createPhaseState,
  recordPopForEnergy,
  updatePhaseEnergy,
  WARMUP_DURATION,
  COOLDOWN_IDLE_THRESHOLD,
  type SessionAct,
} from './adaptive';
import {
  targetBubbleCount,
  spawnInterval,
  bubbleSpeedRange,
  giantTapsRequired,
  showerInterval,
  showerCount,
  showerSpawnStagger,
  pickBubbleKindBalanced,
  nextMilestoneScore,
} from './balance';
import { disposeGameRig } from '@app/minigames/shared/sceneSetup';

/**
 * Factory function for the Bubble Pop mini-game.
 * @param context - Shell-provided context with shared systems.
 * @returns An IMiniGame object literal whose methods the framework calls through the game lifecycle.
 */
export function createGame(context: MiniGameContext): IMiniGame {
  const scene = context.scene as Scene;

  let lighting: SceneLightingRig | null = null;
  let pool: EntityPool<BubbleState> | null = null;
  const activeBubbles: BubbleState[] = [];

  let env: EnvironmentObjects | null = null;

  // Spatial hash for soft-body repulsion
  const spatialHash: SpatialHash<BubbleState> = createSpatialHash<BubbleState>(2.0);

  let paused = false;
  let elapsedTime = 0;
  let popCount = 0;

  const chainPopQueue: { bubble: BubbleState; delay: number }[] = [];
  const wobbleQueue: { bubble: BubbleState; timer: number }[] = [];

  // Adaptive systems
  const playerProfile = createPlayerProfile();
  const phaseState = createPhaseState();
  let effectiveDifficulty = 0;
  let sessionAct: SessionAct = 'warmup';
  let lastTapTime = 0;
  let milestoneIndex = 0;
  let lastMilestoneScore = 0;

  let showerSpawnerId: string | null = null;
  let unsubScore: (() => void) | null = null;

  function worldToApproxScreen(pos: Vector3): { screenX: number; screenY: number } {
    const halfW = context.viewport.width / 2;
    const halfH = context.viewport.height / 2;
    return { screenX: pos.x * SCREEN_PROJECTION_SCALE + halfW, screenY: -pos.y * SCREEN_PROJECTION_SCALE + halfH };
  }

  function spawnBubble(forceKind?: BubbleKind): void {
    if (!pool) return;
    const maxCount = targetBubbleCount(effectiveDifficulty);
    if (activeBubbles.length >= maxCount) return;

    const bubble = pool.acquire();
    const phase = phaseState.current;

    // During warm-up, only normal bubbles
    const kind = sessionAct === 'warmup' ? 'normal' : (forceKind ?? pickBubbleKindBalanced(effectiveDifficulty, phase));
    bubble.kind = kind;
    bubble.sizeVariant = Math.floor(Math.random() * SIZE_VARIANTS.length);
    bubble.tapsRemaining = kind === 'giant' ? giantTapsRequired(playerProfile.value) : 1;

    // Phase-aware speed range
    const [minSpeed, maxSpeed] = bubbleSpeedRange(effectiveDifficulty, phase);
    bubble.speed = randomRange(minSpeed, maxSpeed);

    // During calm, bias toward larger bubbles
    if (phase === 'calm' && kind === 'normal') {
      bubble.sizeVariant = Math.min(SIZE_VARIANTS.length - 1, bubble.sizeVariant + 1);
    }

    const { baseColor, colorIndex } = applyBubbleMaterial(scene, bubble.mesh, kind);
    bubble.baseColor = baseColor;
    bubble.colorIndex = colorIndex;
    positionBubbleAtSpawn(bubble);
    activeBubbles.push(bubble);

    context.audio.playSound('sfx_bubble_pop_appear');
  }

  function spawnShower(): void {
    if (showerSpawnerId) {
      context.spawner.cancel(showerSpawnerId);
    }
    const target = targetBubbleCount(effectiveDifficulty);
    let remaining = showerCount(effectiveDifficulty, activeBubbles.length, target);
    if (remaining <= 0) return;

    showerSpawnerId = context.spawner.register({
      spawn: () => {
        spawnBubble('normal');
        remaining--;
        if (remaining <= 0 && showerSpawnerId) {
          context.spawner.cancel(showerSpawnerId);
          showerSpawnerId = null;
        }
      },
      intervalSeconds: showerSpawnStagger(effectiveDifficulty),
      maxCount: MAX_BUBBLES,
      activeCount: () => activeBubbles.length,
    });
  }

  /**
   * Removes a bubble from activeBubbles using swap-remove (O(1), no splice).
   * @param index - The index of the bubble to remove.
   */
  function recycleBubble(index: number): void {
    const bubble = activeBubbles[index];
    const last = activeBubbles.length - 1;
    if (index !== last) {
      activeBubbles[index] = activeBubbles[last];
    }
    activeBubbles.pop();
    if (pool) pool.release(bubble);
  }

  function popBubble(bubble: BubbleState, screenX: number, screenY: number): void {
    bubble.active = false;
    popCount++;

    // Track pop for energy-based phase transitions
    recordPopForEnergy(phaseState);

    context.combo.registerHit();
    const basePoints = BUBBLE_POINTS[bubble.kind] ?? BUBBLE_POINTS.normal;
    context.score.addPoints(basePoints);

    // Use tmpVec3 to avoid per-pop allocation
    const popPos = tmpVec3(3).copy(bubble.mesh.position);

    if (bubble.kind === 'golden' && pool) {
      spawnGoldenBurst(scene, pool, activeBubbles, popPos);
      context.celebration.celebrationSound('whoosh');
    } else if (bubble.kind === 'rainbow') {
      triggerChainPop(bubble, activeBubbles, chainPopQueue);
      context.celebration.celebrationSound('chime');
    }

    triggerWobbleChain(bubble, activeBubbles, wobbleQueue);

    // Push nearby bubbles away from the pop (pressure wave)
    applyPopPressureWave(activeBubbles, popPos.x, popPos.y, 1 / 60);

    popBubbleEffect(scene, bubble, () => {
      const idx = activeBubbles.indexOf(bubble);
      if (idx !== -1) {
        recycleBubble(idx);
      } else if (pool) {
        pool.release(bubble);
      }
    });

    context.audio.playSound(POP_SOUNDS[bubble.sizeVariant] ?? POP_SOUNDS[1]);

    if (env) {
      pulseNearbyStars(env, popPos);
      if (popCount % MOON_PULSE_INTERVAL === 0) {
        pulseMoon(env);
      }
      const showerTrigger = showerInterval(effectiveDifficulty);
      if (popCount % showerTrigger === 0 && popCount > 0) {
        spawnShower();
      }
    }

    context.celebration.confetti(screenX, screenY);
    context.celebration.celebrationSound('pop');
  }

  /** Initial bubble count for warm-up (starts low, ramps up). */
  const WARMUP_INITIAL = 3;

  const game: IMiniGame = {
    id: 'bubble-pop',

    async setup(): Promise<void> {
      lighting = setupSceneLighting(scene);

      pool = context.createPool<BubbleState>({
        create: () => createBubble(scene),
        reset: (bubble) => resetBubble(scene, bubble),
        dispose: disposeBubble,
        maxPoolSize: MAX_BUBBLES + POOL_BUFFER,
      });
      pool.prewarm(MAX_BUBBLES);

      env = buildEnvironment(scene);
    },

    start(): void {
      paused = false;
      elapsedTime = 0;
      popCount = 0;
      chainPopQueue.length = 0;
      wobbleQueue.length = 0;
      clearPopAnimations();
      milestoneIndex = 0;
      lastMilestoneScore = 0;
      lastTapTime = 0;
      sessionAct = 'warmup';

      // Reset adaptive systems
      Object.assign(playerProfile, createPlayerProfile());
      Object.assign(phaseState, createPhaseState());
      effectiveDifficulty = 0;

      context.score.reset();
      context.combo.reset();

      // Warm-up: start with fewer bubbles
      for (let i = 0; i < WARMUP_INITIAL; i++) {
        spawnBubble('normal');
      }

      // Register main spawn loop with dynamic interval
      context.spawner.register({
        spawn: () => spawnBubble(),
        intervalSeconds: spawnInterval(effectiveDifficulty),
        jitterSeconds: SPAWN_JITTER,
        maxCount: MAX_BUBBLES,
        activeCount: () => activeBubbles.length,
      });

      // Escalating milestone schedule
      unsubScore = context.score.onScoreChanged((newScore) => {
        const nextThreshold = nextMilestoneScore(milestoneIndex, lastMilestoneScore);
        if (newScore >= nextThreshold) {
          lastMilestoneScore = nextThreshold;
          milestoneIndex++;
          const halfW = context.viewport.width / 2;
          const halfH = context.viewport.height / 2;
          context.celebration.milestone(halfW, halfH, 'large');
        }
      });

      context.audio.playMusic('mus_bubble_pop_background');
    },

    update(deltaTime: number): void {
      if (paused) return;

      elapsedTime += deltaTime;

      // Update adaptive systems
      updatePlayerProfile(playerProfile, elapsedTime);
      effectiveDifficulty = computeEffectiveDifficulty(context.difficulty.level, playerProfile.value);
      updatePhaseEnergy(phaseState, deltaTime, effectiveDifficulty);

      // Session act transitions
      if (sessionAct === 'warmup' && elapsedTime > WARMUP_DURATION) {
        sessionAct = 'engagement';
      }
      if (sessionAct === 'engagement' && lastTapTime > 0 && elapsedTime - lastTapTime > COOLDOWN_IDLE_THRESHOLD) {
        sessionAct = 'cooldown';
      }

      const phase = phaseState.current;

      // Iridescence update
      updateIridescence(activeBubbles);

      // Tick pop animations inside the game loop
      tickPopAnimations(deltaTime);

      // Process chain pop queue (swap-remove pattern)
      for (let i = chainPopQueue.length - 1; i >= 0; i--) {
        chainPopQueue[i].delay -= deltaTime;
        if (chainPopQueue[i].delay <= 0) {
          const { bubble } = chainPopQueue[i];
          chainPopQueue[i] = chainPopQueue[chainPopQueue.length - 1];
          chainPopQueue.pop();
          if (bubble.active) {
            context.audio.playSound('sfx_bubble_pop_chain_pop');
            const { screenX, screenY } = worldToApproxScreen(bubble.mesh.position);
            popBubble(bubble, screenX, screenY);
          }
        }
      }

      // Process wobble auto-pop queue (swap-remove pattern)
      for (let i = wobbleQueue.length - 1; i >= 0; i--) {
        wobbleQueue[i].timer -= deltaTime;
        if (wobbleQueue[i].timer <= 0) {
          const { bubble } = wobbleQueue[i];
          wobbleQueue[i] = wobbleQueue[wobbleQueue.length - 1];
          wobbleQueue.pop();
          if (bubble.active) {
            const { screenX, screenY } = worldToApproxScreen(bubble.mesh.position);
            popBubble(bubble, screenX, screenY);
          }
        }
      }

      // Populate spatial hash for soft-body repulsion
      spatialHash.clear();
      for (let i = 0; i < activeBubbles.length; i++) {
        const b = activeBubbles[i];
        if (b.active && !b.spawning) {
          spatialHash.insert(b, b.mesh.position.x, b.mesh.position.y);
        }
      }

      for (let i = activeBubbles.length - 1; i >= 0; i--) {
        const bubble = activeBubbles[i];
        if (!bubble.active && !bubble.spawning) continue;

        updateBubbleMotion(bubble, elapsedTime, deltaTime);
        updateBubbleWobble(bubble, elapsedTime, deltaTime);

        if (bubble.mesh.position.y > RECYCLE_Y && !bubble.spawning) {
          recycleBubble(i);
        }
      }

      // Soft-body repulsion — prevents bubble overlap
      applySoftBodyRepulsion(activeBubbles, spatialHash, deltaTime);

      if (env) {
        updateEnvironment(env, elapsedTime);
        decayStarPulses(env, deltaTime);
        decayMoonPulse(env, deltaTime);
      }

      // Crescendo events
      if (phase === 'crescendo') {
        spawnShower();
        if (env) pulseMoon(env);
      }
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
      unsubScore?.();
      unsubScore = null;

      context.spawner.clearAll();
      showerSpawnerId = null;

      activeBubbles.length = 0;
      chainPopQueue.length = 0;
      wobbleQueue.length = 0;
      clearPopAnimations();

      if (pool) {
        pool.dispose();
        pool = null;
      }
      disposeSharedShineMat();
      disposePopTexture();
      resetBubbleIndex();

      if (env) {
        for (const mesh of env.meshes) {
          disposeMeshDeep(mesh);
        }
        env = null;
      }

      if (lighting) {
        disposeGameRig(lighting.camera, lighting.lights);
        lighting = null;
      }

      context.audio.stopMusic();
    },

    onResize(_viewport: ViewportInfo): void {
      if (!lighting) return;
      // Camera resize handled by camera system
    },

    onTap(event: MiniGameTapEvent): void {
      if (paused) return;

      lastTapTime = elapsedTime;

      // If in cool-down, snap back to engagement with a return burst
      if (sessionAct === 'cooldown') {
        sessionAct = 'engagement';
        // Spawn a few welcoming bubbles near the tap
        for (let i = 0; i < 3; i++) {
          spawnBubble('normal');
        }
      }

      const pickResult = event.pickResult;
      let hitBubble = false;

      if (pickResult?.hit && pickResult.pickedMesh) {
        const pickedMesh = pickResult.pickedMesh as Mesh;
        for (let i = 0; i < activeBubbles.length; i++) {
          const bubble = activeBubbles[i];
          if (bubble.active && !bubble.spawning && (bubble.mesh === pickedMesh || pickedMesh.parent === bubble.mesh)) {
            hitBubble = true;
            if (bubble.kind === 'giant' && bubble.tapsRemaining > 1) {
              tapGiantBubble(bubble);
              context.audio.playSound('sfx_bubble_pop_pop_large');
            } else {
              popBubble(bubble, event.screenX, event.screenY);
            }
            break;
          }
        }
      }

      // Record tap for player profiling
      recordTap(playerProfile, elapsedTime, hitBubble);

      if (hitBubble) return;

      // First-tap fallback — reuse tmpVec3 to avoid per-tap allocation
      if (pickResult?.hit && pickResult.pickedPoint) {
        const pos = tmpVec3(4).set(pickResult.pickedPoint.x, pickResult.pickedPoint.y, pickResult.pickedPoint.z);
        createTapFallbackSparkle(scene, pos);
      } else {
        const pos = tmpVec3(4).set(
          (event.screenX / context.viewport.width - 0.5) * FALLBACK_X_EXTENT,
          (0.5 - event.screenY / context.viewport.height) * FALLBACK_Y_EXTENT + FALLBACK_Y_OFFSET,
          0,
        );
        createTapFallbackSparkle(scene, pos);
      }
      context.audio.playSound('sfx_bubble_pop_twinkle');
    },
  };

  return game;
}

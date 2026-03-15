import {
  Scene,
  PerspectiveCamera,
  MeshStandardMaterial,
  Vector3,
  type Mesh,
  type Object3D,
  SpriteMaterial,
  Sprite,
  PointLight,
  AdditiveBlending,
  CanvasTexture,
  Color,
} from 'three';
import type { IMiniGame, MiniGameContext, MiniGameTapEvent } from '../../framework/types';
import { createGameCamera, createGameLighting, disposeGameRig, type GameLightingRig } from '@app/minigames/shared/sceneSetup';
import { createSparkleBurst, createStarCollect } from '@app/minigames/shared/particleFx';
import type { FireflyData } from './types';
import {
  JAR_POS,
  JAR_SCALE,
  JAR_BODY_HEIGHT,
  BOUNDS,
  FOREGROUND_Z,
  HIT_RADIUS_PX,
  RESPAWN_DELAY,
  GOLDEN_UNLOCK_SCORE,
  GOLDEN_SPAWN_INTERVAL,
  FLASH_DURATION,
  ARC_DURATION,
  MILESTONE_COUNT,
  FIREFLY_COLOR,
  GOLDEN_COLOR,
} from './types';
import { getDifficultyTier, randomSpawnPos, foregroundSpawnPos, updateFireflyBehavior } from './helpers';
import { createEnvironment } from './environment';
import { createFirefly, resetFirefly } from './entities';
import { createIlluminationController, collectMaterials, type IlluminationController } from './illumination';
import { createFirefliesAudio, type FirefliesAudio } from './audio';
import { createSurpriseEvents, type SurpriseEventController } from './events';
import { createTapHint, type TapHint } from './tapHint';
import type { Points } from 'three';

// ── Jar orbit firefly system ──────────────────────────────────────────────────

/** State for a captured firefly orbiting the jar. */
interface JarOrbitFirefly {
  sprite: Sprite;
  material: SpriteMaterial;
  light: PointLight;
  angle: number;
  height: number;
  orbitRadius: number;
  speed: number;
  bobPhase: number;
}

/** Cached glow texture for orbit sprites. */
let orbitGlowTex: CanvasTexture | null = null;

/**
 * Returns a cached 32x32 soft glow texture for jar orbit sprites.
 * @returns The cached CanvasTexture for orbit glow.
 */
function getOrbitGlowTexture(): CanvasTexture {
  if (orbitGlowTex) return orbitGlowTex;
  const s = 32;
  const c = document.createElement('canvas');
  c.width = s;
  c.height = s;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255, 255, 255, 1)');
  g.addColorStop(0.3, 'rgba(255, 255, 255, 0.5)');
  g.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  orbitGlowTex = new CanvasTexture(c);
  return orbitGlowTex;
}

/** Scaled jar dimensions for orbit placement (inside the jar). */
const JAR_SCALED_HEIGHT = JAR_BODY_HEIGHT * JAR_SCALE;
const JAR_SCALED_RADIUS = 0.55 * JAR_SCALE; // jar body max radius, scaled
const JAR_ORBIT_RADIUS_MIN = 0.08;
const JAR_ORBIT_RADIUS_MAX = JAR_SCALED_RADIUS * 0.75;

/**
 * Creates a small glowing sprite that orbits the jar permanently.
 * @param scene - The Three.js scene.
 * @param color - The firefly color to use.
 * @returns A JarOrbitFirefly ready for animation.
 */
function createJarOrbitFirefly(scene: Scene, color: Color): JarOrbitFirefly {
  const mat = new SpriteMaterial({
    map: getOrbitGlowTexture(),
    color: color.clone(),
    transparent: true,
    opacity: 0.8,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  const sprite = new Sprite(mat);
  sprite.scale.setScalar(0.12);
  sprite.name = 'jar_orbit_firefly';
  scene.add(sprite);

  const light = new PointLight(color.clone(), 0.15, 1.5);
  light.name = 'jar_orbit_light';
  scene.add(light);

  const angle = Math.random() * Math.PI * 2;
  // Keep inside jar body: from just above base to shoulder
  const height = JAR_POS.y + 0.1 * JAR_SCALE + Math.random() * (JAR_SCALED_HEIGHT * 0.6);
  const orbitRadius = JAR_ORBIT_RADIUS_MIN + Math.random() * (JAR_ORBIT_RADIUS_MAX - JAR_ORBIT_RADIUS_MIN);
  const speed = 0.8 + Math.random() * 1.2;
  const bobPhase = Math.random() * Math.PI * 2;

  // Set initial position
  sprite.position.set(JAR_POS.x + Math.cos(angle) * orbitRadius, height, JAR_POS.z + Math.sin(angle) * orbitRadius);
  light.position.copy(sprite.position);

  return { sprite, material: mat, light, angle, height, orbitRadius, speed, bobPhase };
}

/**
 * Creates the Fireflies mini-game instance.
 * Players tap glowing fireflies to catch them and fill a jar.
 * @param context - Shell-provided mini-game context with shared systems.
 * @returns An IMiniGame implementation for the fireflies game.
 */
export function createGame(context: MiniGameContext): IMiniGame {
  const scene = context.scene as Scene;

  let paused = false;
  let collectedCount = 0;
  let milestoneTriggered = false;
  let goldenTimer = 0;
  let goldenActive = false;
  let elapsedTime = 0;

  const fireflies: FireflyData[] = [];
  let camera: ReturnType<typeof createGameCamera> | null = null;
  let lights: GameLightingRig | null = null;
  let groundMesh: Mesh | null = null;
  let jarBody: Mesh | null = null;
  let jarCap: Mesh | null = null;
  let moonMesh: Mesh | null = null;
  let skyMesh: Object3D | null = null;
  let illumination: IlluminationController | null = null;
  let audio: FirefliesAudio | null = null;
  let surpriseEvents: SurpriseEventController | null = null;
  let starField: Points | null = null;
  let starSizes: Float32Array | null = null;
  let starPhases: Float32Array | null = null;
  let tapHint: TapHint | null = null;
  let firstCatchDone = false;
  const jarOrbitFireflies: JarOrbitFirefly[] = [];
  const environmentMeshes: Object3D[] = [];
  const allMaterials: MeshStandardMaterial[] = [];
  const flowerRoots: Object3D[] = [];

  /**
   * Ensures the correct number of fireflies exist for the current difficulty tier.
   */
  function ensureFireflyCount(): void {
    const tier = getDifficultyTier(context.score.score);
    const targetCount = tier.maxFireflies;

    while (fireflies.length < targetCount) {
      const fd = createFirefly(scene, fireflies.length, false);
      fireflies.push(fd);
    }
  }

  /**
   * Attempts to spawn the golden firefly if conditions are met.
   */
  function trySpawnGolden(): void {
    if (context.score.score < GOLDEN_UNLOCK_SCORE) return;
    if (goldenActive) return;

    let goldenFd = fireflies.find((fd) => fd.isGolden && !fd.active);
    if (!goldenFd) {
      goldenFd = createFirefly(scene, fireflies.length, true);
      fireflies.push(goldenFd);
    }

    resetFirefly(goldenFd, scene);
    goldenFd.isGolden = true;
    goldenFd.spriteMaterial.color.copy(GOLDEN_COLOR);
    goldenFd.light.color.copy(GOLDEN_COLOR);
    goldenFd.light.intensity = 0.6;
    goldenActive = true;
  }

  const game: IMiniGame = {
    id: 'fireflies',

    async setup(): Promise<void> {
      // Camera & lights — intensities set to Tier 0 (dark); illumination controller will drive them
      camera = createGameCamera({
        name: 'fireflies',
        beta: 1.3,
        radius: 9.0,
        target: new Vector3(0, 1.5, 0),
        fov: 0.9,
      });
      lights = createGameLighting({
        name: 'fireflies',
        direction: new Vector3(-0.5, -1, 0.5),
        directionalIntensity: 0.04,
        hemisphericIntensity: 0.02,
        pointPosition: new Vector3(0, 4, 0),
        pointIntensity: 0.4,
      });

      // Environment
      const env = createEnvironment(scene);
      skyMesh = env.skyMesh;
      groundMesh = env.groundMesh;
      jarBody = env.jarBody;
      jarCap = env.jarCap;
      moonMesh = env.moonMesh;
      starField = env.starField;
      starSizes = env.starSizes;
      starPhases = env.starPhases;
      environmentMeshes.push(...env.environmentMeshes);
      allMaterials.push(...env.allMaterials);

      // Store flower refs for proximity interaction
      flowerRoots.push(...env.flowerMeshes);

      // Progressive illumination controller
      const flowerMaterials = collectMaterials(env.flowerMeshes);
      illumination = createIlluminationController(
        scene,
        {
          lights,
          moonMaterial: env.moonMaterial,
          groundMaterial: env.groundMaterial,
          jarMaterial: env.jarMaterial,
          flowerMaterials,
        },
        JAR_POS,
      );

      // Procedural audio
      audio = createFirefliesAudio(() => context.audio.isMuted);

      // Surprise events (shooting stars, etc.)
      surpriseEvents = createSurpriseEvents(scene);

      // Onboarding tap hint
      tapHint = createTapHint(scene);

      // Initial fireflies
      for (let i = 0; i < 5; i++) {
        fireflies.push(createFirefly(scene, fireflies.length, false));
      }
    },

    start(): void {
      paused = false;
      collectedCount = 0;
      milestoneTriggered = false;
      goldenTimer = 0;
      goldenActive = false;
      elapsedTime = 0;
      context.score.reset();
      context.combo.reset();
      audio?.start();
      firstCatchDone = false;
    },

    update(deltaTime: number): void {
      if (paused) return;

      elapsedTime += deltaTime;
      const tier = getDifficultyTier(context.score.score);

      // Drive progressive scene illumination and ambient audio
      illumination?.update(collectedCount, deltaTime);
      const currentTier = illumination?.getCurrentTier() ?? 0;
      audio?.updateAmbient(currentTier, deltaTime);
      surpriseEvents?.update(deltaTime, currentTier);

      // Star twinkling
      if (starField && starSizes && starPhases) {
        const geo = starField.geometry;
        const posAttr = geo.getAttribute('position');
        const count = starSizes.length;
        for (let i = 0; i < count; i++) {
          // Each star twinkles at its own phase and rate
          // Modulate the Y position very slightly for a shimmer effect
          const baseY = 2 + (starPhases[i] / (Math.PI * 2)) * 10;
          posAttr.setY(i, baseY + Math.sin(elapsedTime * 0.8 + starPhases[i]) * 0.02);
        }
        posAttr.needsUpdate = true;
        // Modulate overall opacity based on twinkling
        (starField.material as { opacity: number }).opacity = 0.5 + 0.2 * Math.sin(elapsedTime * 0.3);
      }

      const speedMult = tier.speedMultiplier;

      // Tap hint: track the nearest active firefly as a visual guide
      if (tapHint && !firstCatchDone) {
        const hintTarget = fireflies.find((fd) => fd.active && !fd.catching) ?? null;
        tapHint.update(deltaTime, hintTarget?.sprite ?? null);
      }

      // Animate captured fireflies orbiting inside the jar
      for (const orb of jarOrbitFireflies) {
        orb.angle += orb.speed * deltaTime;
        const bob = Math.sin(elapsedTime * 1.5 + orb.bobPhase) * 0.03;
        orb.sprite.position.set(JAR_POS.x + Math.cos(orb.angle) * orb.orbitRadius, orb.height + bob, JAR_POS.z + Math.sin(orb.angle) * orb.orbitRadius);
        orb.light.position.copy(orb.sprite.position);
        // Gentle pulse
        orb.material.opacity = 0.6 + 0.3 * Math.sin(elapsedTime * 2 + orb.bobPhase);
      }

      // Golden firefly spawn timer
      if (context.score.score >= GOLDEN_UNLOCK_SCORE) {
        goldenTimer += deltaTime;
        if (goldenTimer >= GOLDEN_SPAWN_INTERVAL) {
          goldenTimer = 0;
          trySpawnGolden();
        }
      }

      ensureFireflyCount();

      // Maintain minimum 5 active fireflies on screen at all times
      let activeCount = 0;
      for (const fd of fireflies) {
        if (fd.active && !fd.catching) activeCount++;
      }
      if (activeCount < 5) {
        for (const fd of fireflies) {
          if (!fd.active && !fd.isGolden) {
            fd.respawnTimer = 0;
            resetFirefly(fd, scene);
            activeCount++;
            if (activeCount >= 5) break;
          }
        }
      }

      // Ensure at least 2 fireflies are in the foreground (close to camera, easy to tap)
      let foregroundCount = 0;
      for (const fd of fireflies) {
        if (fd.active && !fd.catching && fd.sprite.position.z >= FOREGROUND_Z) foregroundCount++;
      }
      if (foregroundCount < 2) {
        for (const fd of fireflies) {
          if (fd.active && !fd.catching && fd.sprite.position.z < FOREGROUND_Z) {
            const pos = foregroundSpawnPos();
            fd.sprite.position.copy(pos);
            fd.light.position.copy(pos);
            fd.behaviorCenter.copy(pos);
            foregroundCount++;
            if (foregroundCount >= 2) break;
          }
        }
      }

      for (const fd of fireflies) {
        // Handle respawn timers
        if (!fd.active && !fd.catching) {
          if (fd.respawnTimer > 0) {
            fd.respawnTimer -= deltaTime;
            if (fd.respawnTimer <= 0) {
              resetFirefly(fd, scene);
            }
          }
          continue;
        }

        // Handle catch animation
        if (fd.catching) {
          const baseScale = fd.isGolden ? 0.45 : 0.3;

          if (fd.flashing) {
            fd.flashTimer -= deltaTime;
            if (fd.flashTimer <= 0) {
              fd.flashing = false;
              fd.catchProgress = 0;
              // Snap scale back to base when flash ends
              fd.sprite.scale.setScalar(baseScale);
            } else {
              // Scale pop: lerp up to 1.8x base during flash
              const flashT = 1.0 - fd.flashTimer / FLASH_DURATION;
              const popScale = baseScale * (1.0 + 0.8 * Math.sin(flashT * Math.PI));
              fd.sprite.scale.setScalar(popScale);

              // Color pulse from warm white to gold
              const gold = 0.85 + 0.15 * Math.sin(flashT * Math.PI * 2);
              fd.spriteMaterial.color.setRGB(1, 0.95 * gold, 0.7 * gold);
            }
            // Warm flash — brighten sprite and light
            fd.spriteMaterial.opacity = 1.0;
            fd.light.intensity = 1.5;
            continue;
          }

          // Boost glow trail during arc for a comet-like effect
          fd.glowTrail.configure({ emitRate: 20 });

          // Arc to jar animation
          fd.catchProgress += deltaTime / ARC_DURATION;
          if (fd.catchProgress >= 1.0) {
            // Sparkle burst at jar mouth on arrival
            const jarMouth = JAR_POS.clone().add(new Vector3(0, JAR_SCALED_HEIGHT, 0));
            createStarCollect(scene, jarMouth);

            // Spawn a permanent orbiting firefly around the jar
            const orbColor = fd.isGolden ? GOLDEN_COLOR : FIREFLY_COLOR;
            jarOrbitFireflies.push(createJarOrbitFirefly(scene, orbColor));

            fd.sprite.visible = false;
            fd.light.visible = false;
            fd.glowTrail.configure({ emitRate: 4 }); // restore normal rate
            fd.glowTrail.stop();
            fd.active = false;
            fd.catching = false;
            fd.sprite.scale.setScalar(baseScale);

            if (fd.isGolden) {
              goldenActive = false;
            }

            fd.respawnTimer = RESPAWN_DELAY;
            collectedCount++;

            if (collectedCount >= MILESTONE_COUNT && !milestoneTriggered) {
              milestoneTriggered = true;
              context.celebration.milestone(context.viewport.width / 2, context.viewport.height / 2, 'large');
            }
            continue;
          }

          // Compute arc position with easeOutCubic
          const rawT = fd.catchProgress;
          const t = 1 - (1 - rawT) * (1 - rawT) * (1 - rawT); // easeOutCubic
          const arcHeight = 2.0 * Math.sin(t * Math.PI);
          const jarTarget = JAR_POS.clone().add(new Vector3(0, JAR_SCALED_HEIGHT * 0.6, 0));
          const lerpPos = fd.catchStartPos.clone().lerp(jarTarget, t);
          lerpPos.y += arcHeight;

          // Spiral wobble that decreases as it approaches the jar
          const wobble = (1 - t) * 0.3;
          lerpPos.x += Math.sin(t * Math.PI * 3) * wobble;
          lerpPos.z += Math.cos(t * Math.PI * 3) * wobble;

          fd.sprite.position.copy(lerpPos);
          fd.light.position.copy(lerpPos);

          // Shrink from 1.0x to 0.3x base scale during arc
          const arcScale = baseScale * (1.0 - rawT * 0.7);
          fd.sprite.scale.setScalar(arcScale);

          // Fade during arc
          const fade = 1.0 - rawT * 0.7;
          fd.spriteMaterial.opacity = 0.85 * fade;
          // Light intensity with slight pulse
          const baseLightIntensity = (fd.isGolden ? 0.6 : 0.35) * fade;
          fd.light.intensity = baseLightIntensity + Math.sin(rawT * Math.PI * 4) * 0.1;
          continue;
        }

        // Behavior-driven movement (drift / circle / zigzag)
        updateFireflyBehavior(fd, deltaTime, speedMult);

        // Keep point light in sync
        fd.light.position.copy(fd.sprite.position);

        // Glow pulse animation
        let pulseVal: number;
        if (fd.isGolden) {
          // Golden: double-pulse heartbeat pattern (lub-dub)
          const pulsePeriod = 1.6;
          const pulseT = ((elapsedTime + fd.glowPhase) % pulsePeriod) / pulsePeriod;
          if (pulseT < 0.12) {
            pulseVal = pulseT / 0.12; // first beat rise
          } else if (pulseT < 0.24) {
            pulseVal = 1.0 - (pulseT - 0.12) / 0.12; // first beat fall
          } else if (pulseT < 0.32) {
            pulseVal = ((pulseT - 0.24) / 0.08) * 0.7; // second beat rise (shorter)
          } else if (pulseT < 0.48) {
            pulseVal = 0.7 * (1.0 - (pulseT - 0.32) / 0.16); // second beat fall
          } else {
            pulseVal = 0; // rest
          }
        } else {
          // Standard: asymmetric single pulse — quick brighten, slow fade
          const pulsePeriod = 2.0;
          const pulseT = ((elapsedTime + fd.glowPhase) % pulsePeriod) / pulsePeriod;
          const risePhase = 0.2;
          if (pulseT < risePhase) {
            pulseVal = pulseT / risePhase;
          } else {
            pulseVal = 1.0 - (pulseT - risePhase) / (1.0 - risePhase);
          }
        }

        const baseColor = fd.isGolden ? GOLDEN_COLOR : FIREFLY_COLOR;
        fd.spriteMaterial.opacity = fd.isGolden ? 0.4 + 0.6 * pulseVal : 0.25 + 0.65 * pulseVal;
        fd.spriteMaterial.color.copy(baseColor);
        fd.light.intensity = (fd.isGolden ? 0.8 : 0.35) * (0.15 + 0.85 * pulseVal);

        // Out-of-bounds check
        const pos = fd.sprite.position;
        if (pos.x < BOUNDS.xMin || pos.x > BOUNDS.xMax || pos.y < BOUNDS.yMin || pos.y > BOUNDS.yMax) {
          const newPos = randomSpawnPos();
          fd.sprite.position.copy(newPos);
          fd.light.position.copy(newPos);
          fd.time = Math.random() * 100;
        }
      }

      // Flower proximity glow: flowers brighten when a firefly is nearby
      const PROXIMITY_RADIUS = 2.5;
      const PROXIMITY_SQ = PROXIMITY_RADIUS * PROXIMITY_RADIUS;
      for (let fi = 0; fi < flowerRoots.length; fi++) {
        const flower = flowerRoots[fi];
        let closestDistSq = Infinity;
        for (const fd of fireflies) {
          if (!fd.active || fd.catching) continue;
          const dx = fd.sprite.position.x - flower.position.x;
          const dy = fd.sprite.position.y - flower.position.y;
          const dz = fd.sprite.position.z - flower.position.z;
          const distSq = dx * dx + dy * dy + dz * dz;
          if (distSq < closestDistSq) closestDistSq = distSq;
        }
        // Proximity factor: 1.0 when firefly is right on top, 0.0 when beyond radius
        const proximity = closestDistSq < PROXIMITY_SQ ? 1.0 - Math.sqrt(closestDistSq) / PROXIMITY_RADIUS : 0;
        // Gently sway the flower when a firefly is near
        flower.rotation.z = Math.sin(elapsedTime * 2 + fi) * 0.05 * proximity;
      }
    },

    pause(): void {
      paused = true;
    },

    resume(): void {
      paused = false;
    },

    teardown(): void {
      // Dispose firefly sprites, lights, and particle trails
      for (const fd of fireflies) {
        fd.glowTrail.stop();
        fd.glowTrail.dispose();
        fd.light.removeFromParent();
        fd.spriteMaterial.dispose();
        fd.sprite.removeFromParent();
      }
      fireflies.length = 0;

      for (const m of environmentMeshes) {
        m.removeFromParent();
      }
      environmentMeshes.length = 0;

      skyMesh?.removeFromParent();
      groundMesh?.removeFromParent();
      jarBody?.removeFromParent();
      jarCap?.removeFromParent();
      moonMesh?.removeFromParent();

      for (const mat of allMaterials) {
        mat.dispose();
      }
      allMaterials.length = 0;

      illumination?.dispose();
      illumination = null;

      audio?.dispose();
      audio = null;

      surpriseEvents?.dispose();
      surpriseEvents = null;

      starField?.removeFromParent();
      starField = null;
      starSizes = null;
      starPhases = null;

      tapHint?.dispose();
      tapHint = null;

      // Dispose orbiting jar fireflies
      for (const orb of jarOrbitFireflies) {
        orb.sprite.removeFromParent();
        orb.material.dispose();
        orb.light.removeFromParent();
      }
      jarOrbitFireflies.length = 0;

      disposeGameRig(camera, lights);
      camera = null;
      lights = null;
      groundMesh = null;
      jarBody = null;
      jarCap = null;
      moonMesh = null;
      skyMesh = null;
    },

    onResize(): void {
      // Camera FOV and positioning are fixed; no resize adjustments needed
    },

    onTap(event: MiniGameTapEvent): void {
      if (paused) return;

      // Screen-space hit detection
      const cam = context.camera as PerspectiveCamera;
      const rect = context.canvas.getBoundingClientRect();

      let nearestFd: FireflyData | null = null;
      let nearestDist = HIT_RADIUS_PX;

      for (const fd of fireflies) {
        if (!fd.active || fd.catching) continue;

        const projected = fd.sprite.position.clone().project(cam);
        if (projected.z > 1) continue;
        const sx = (projected.x * 0.5 + 0.5) * rect.width + rect.left;
        const sy = (-projected.y * 0.5 + 0.5) * rect.height + rect.top;

        const dx = sx - event.screenX;
        const dy = sy - event.screenY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestFd = fd;
        }
      }

      if (!nearestFd) {
        audio?.playTapSparkle();
        return;
      }

      const catchColor = nearestFd.isGolden ? GOLDEN_COLOR : FIREFLY_COLOR;
      createSparkleBurst(scene, nearestFd.sprite.position.clone(), catchColor, 15);

      if (nearestFd.isGolden) {
        audio?.playGoldenCatch();
      } else {
        audio?.playCatchChime();
      }

      // Dismiss tap hint on first successful catch
      if (!firstCatchDone) {
        firstCatchDone = true;
        tapHint?.dismiss();
      }

      nearestFd.catching = true;
      nearestFd.flashing = true;
      nearestFd.flashTimer = FLASH_DURATION;
      nearestFd.catchStartPos = nearestFd.sprite.position.clone();

      const points = nearestFd.isGolden ? 5 : 1;
      context.score.addPoints(points);
      context.combo.registerHit();

      context.celebration.confetti(event.screenX, event.screenY, 'small');
      context.celebration.celebrationSound('chime');
    },
  };

  return game;
}

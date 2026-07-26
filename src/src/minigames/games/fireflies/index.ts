import { Scene, PerspectiveCamera, MeshStandardMaterial, Vector3, Color, type Mesh, type Object3D, type Group } from 'three';
import type { IMiniGame, MiniGameContext, MiniGameTapEvent } from '../../framework/types';
import { createGameLighting, type GameLightingRig } from '@app/minigames/shared/sceneSetup';
import { getParticleEngine } from '@app/utils/particles/registry';
import { PARTICLES } from '@app/utils/particles/presets';
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
  FIREFLY_SPRITE_SCALE,
  GOLDEN_SPRITE_SCALE,
  FIREFLY_FLAP_HZ,
  GOLDEN_LIFETIME,
  GOLDEN_FADE_DURATION,
} from './types';
import { getDifficultyTier, randomSpawnPos, foregroundSpawnPos, updateFireflyBehavior } from './helpers';
import { createEnvironment } from './environment';
import { createFirefly, resetFirefly, getFireflyCreatureTextures } from './entities';
import { createIlluminationController, collectMaterials, type IlluminationController } from './illumination';
import { createFirefliesAudio, type FirefliesAudio } from './audio';
import { createSurpriseEvents, createTapRipples, type SurpriseEventController, type TapRipplePool } from './events';
import { createTapHint, type TapHint } from './tapHint';
import { createJarFill, type JarFillIndicator } from './jarFill';
import type { Points } from 'three';

// ── Jar fill ──────────────────────────────────────────────────────────────────
//
// Captured fireflies are shown by `jarFill.ts`, not by the sprite-per-catch
// "orbit" system that used to live here. That system added one unbounded
// additive Sprite (scale 0.12) per catch into a jar interior about 0.55 units
// across, so somewhere around a dozen catches the additive stack saturated and
// the jar became a featureless white blob — the game's only progress indicator
// erasing itself precisely when the child was doing best. `jarFill` is the
// better-looking option on every count: it is capped at MAX_JAR_DOTS = 30 and
// reveals dots with `setDrawRange`, so it can never saturate; it is one Points
// draw call instead of N sprites; and its dot positions are pre-scattered
// through the jar volume, which keeps individual dots countable ("look how many
// I caught!") rather than merging into a single smear. The only thing lost is
// per-dot orbiting, which was invisible inside a blown-out jar anyway; a gentle
// bob plus an arrival flare reads better at this size.

/** Scaled jar height, used to aim the catch arc at the jar mouth. */
const JAR_SCALED_HEIGHT = JAR_BODY_HEIGHT * JAR_SCALE;

/** Screen-space tap radius for scenery (moon, Saturn, shooting stars), CSS px. */
const SCENERY_HIT_RADIUS_PX = 95;

/** World z-plane the miss ripple is placed on — between camera and play area. */
const RIPPLE_PLANE_Z = 1.5;

/** Seconds a poked piece of scenery spends bouncing. */
const POKE_DURATION = 0.6;

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
  let lights: GameLightingRig | null = null;
  let groundMesh: Mesh | null = null;
  let jarBody: Mesh | null = null;
  let jarCap: Mesh | null = null;
  let moonMesh: Mesh | null = null;
  let saturnGroup: Group | null = null;
  let saturnRing: Mesh | null = null;
  let skyMesh: Object3D | null = null;
  let illumination: IlluminationController | null = null;
  let audio: FirefliesAudio | null = null;
  let surpriseEvents: SurpriseEventController | null = null;
  let tapRipples: TapRipplePool | null = null;
  let jarFill: JarFillIndicator | null = null;
  let starField: Points | null = null;
  let starSizes: Float32Array | null = null;
  let starPhases: Float32Array | null = null;
  let tapHint: TapHint | null = null;
  let firstCatchDone = false;
  const environmentMeshes: Object3D[] = [];
  const allMaterials: MeshStandardMaterial[] = [];
  const flowerRoots: Object3D[] = [];
  const treeRoots: Object3D[] = [];
  const grassRoots: Object3D[] = [];

  // Poke timers — a tapped piece of scenery bounces for POKE_DURATION seconds.
  // Nothing in this garden used to react to a tap at all.
  let moonPoke = 0;
  let saturnPoke = 0;
  let jarPoke = 0;

  /** Reusable scratch vectors so per-frame/per-tap work allocates nothing. */
  const _scratchA = new Vector3();
  const _scratchB = new Vector3();
  const _tapWorld = new Vector3();

  /**
   * Ensures the correct number of fireflies exist for the current difficulty tier.
   * @param tierCount - Target firefly count for the current difficulty tier.
   */
  function ensureFireflyCount(tierCount: number): void {
    while (fireflies.length < tierCount) {
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

    resetFirefly(goldenFd);
    goldenFd.isGolden = true;
    goldenFd.spriteMaterial.color.copy(GOLDEN_COLOR);
    goldenFd.sprite.scale.setScalar(GOLDEN_SPRITE_SCALE);
    // The golden now has a finite stay. `goldenActive` is a latch cleared only
    // when the golden LEAVES play; before this timer existed the only exit was
    // being caught, so one golden the child never tapped blocked every future
    // golden for the rest of the session.
    goldenFd.lifeTimer = GOLDEN_LIFETIME;
    goldenActive = true;
  }

  // Retires a golden that has run out its welcome, releasing the latch.
  function retireGolden(fd: FireflyData): void {
    fd.sprite.visible = false;
    fd.active = false;
    fd.catching = false;
    fd.lifeTimer = -1;
    fd.glowTrail.stop();
    // Deliberately NOT RESPAWN_DELAY: the generic respawn timer would bring the
    // golden straight back a half-second later with no lifetime, so it would
    // become a permanent fixture. A golden only ever returns via trySpawnGolden,
    // which is gated on GOLDEN_SPAWN_INTERVAL.
    fd.respawnTimer = 0;
    goldenActive = false;
  }

  // Converts a tap in CSS pixels to a world point on the RIPPLE_PLANE_Z plane.
  function tapToWorld(cam: PerspectiveCamera, rect: DOMRect, screenX: number, screenY: number): Vector3 {
    const ndcX = ((screenX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((screenY - rect.top) / rect.height) * 2 + 1;
    _scratchA.set(ndcX, ndcY, 0.5).unproject(cam);
    _scratchB.copy(_scratchA).sub(cam.position).normalize();
    // Guard the degenerate case of a ray parallel to the plane.
    const dist = Math.abs(_scratchB.z) < 1e-4 ? 5 : (RIPPLE_PLANE_Z - cam.position.z) / _scratchB.z;
    return _tapWorld.copy(cam.position).addScaledVector(_scratchB, dist);
  }

  // Decaying wobble factor for a poked object: 0 when the poke timer is spent,
  // a springy overshoot while it runs. Returns a multiplier around 1.
  function pokeScale(timer: number): number {
    if (timer <= 0) return 1;
    const k = timer / POKE_DURATION;
    return 1 + Math.sin(k * Math.PI * 3) * 0.24 * k;
  }

  // Idle life for every non-firefly thing in the garden, plus the bounce that
  // plays back when one of them is tapped. The whole world used to be static:
  // nothing swayed, nothing spun, and nothing at all reacted to a tap.
  function updateScenery(dt: number): void {
    moonPoke = Math.max(0, moonPoke - dt);
    saturnPoke = Math.max(0, saturnPoke - dt);
    jarPoke = Math.max(0, jarPoke - dt);

    if (moonMesh) {
      moonMesh.position.y = 4 + Math.sin(elapsedTime * 0.22) * 0.14;
      moonMesh.scale.setScalar(pokeScale(moonPoke));
    }

    if (saturnGroup) {
      saturnGroup.position.y = 3.6 + Math.sin(elapsedTime * 0.17 + 1.2) * 0.16;
      saturnGroup.rotation.y = Math.sin(elapsedTime * 0.12) * 0.25;
      saturnGroup.scale.setScalar(pokeScale(saturnPoke));
    }
    if (saturnRing) {
      // Nodding the ring tilt is the only Saturn motion that actually reads —
      // spinning an untextured sphere or a symmetric ring looks like nothing.
      saturnRing.rotation.x = -Math.PI * 0.35 + Math.sin(elapsedTime * 0.16) * 0.13;
    }

    // Breeze: big things move a little, small things move a lot.
    for (let i = 0; i < treeRoots.length; i++) {
      treeRoots[i].rotation.z = Math.sin(elapsedTime * 0.5 + i * 1.3) * 0.025;
    }
    for (let i = 0; i < grassRoots.length; i++) {
      grassRoots[i].rotation.z = Math.sin(elapsedTime * 1.4 + i * 0.9) * 0.1;
    }

    // The jar bumps when a firefly drops in, so the deposit lands physically.
    if (jarBody && jarCap) {
      const s = JAR_SCALE * pokeScale(jarPoke);
      jarBody.scale.setScalar(s);
      jarCap.scale.setScalar(s);
    }
  }

  // Screen-space distance in CSS pixels from a world point to a tap, or
  // Infinity if the point is behind the camera.
  function screenDistTo(worldPos: Vector3, cam: PerspectiveCamera, rect: DOMRect, screenX: number, screenY: number): number {
    _scratchB.copy(worldPos).project(cam);
    if (_scratchB.z > 1) return Infinity;
    const sx = (_scratchB.x * 0.5 + 0.5) * rect.width + rect.left;
    const sy = (-_scratchB.y * 0.5 + 0.5) * rect.height + rect.top;
    return Math.hypot(sx - screenX, sy - screenY);
  }

  const game: IMiniGame = {
    id: 'fireflies',

    async setup(): Promise<void> {
      // Lights — intensities set to Tier 0 (dark); illumination controller drives
      // them. The camera is the default fixed shell view (the old createGameCamera
      // here was never applied — dead code, removed). See #cameradescriptor.
      lights = createGameLighting(
        scene,
        {
          name: 'fireflies',
          direction: new Vector3(-0.5, -1, 0.5),
          directionalIntensity: 0.04,
          hemisphericIntensity: 0.02,
          pointPosition: new Vector3(0, 4, 0),
          pointIntensity: 0.4,
        },
        context.disposal,
      );

      // Environment
      const env = createEnvironment(scene);
      skyMesh = env.skyMesh;
      groundMesh = env.groundMesh;
      jarBody = env.jarBody;
      jarCap = env.jarCap;
      moonMesh = env.moonMesh;
      saturnGroup = env.saturnGroup;
      saturnRing = env.saturnRing;
      starField = env.starField;
      starSizes = env.starSizes;
      starPhases = env.starPhases;
      environmentMeshes.push(...env.environmentMeshes);
      allMaterials.push(...env.allMaterials);

      // Store scenery refs for proximity interaction and idle breeze sway
      flowerRoots.push(...env.flowerMeshes);
      treeRoots.push(...env.treeMeshes);
      grassRoots.push(...env.grassMeshes);

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

      // Surprise events (shooting stars, etc.) and miss-tap ripples
      surpriseEvents = createSurpriseEvents(scene);
      tapRipples = createTapRipples(scene);

      // Bounded jar fill indicator — see the module note at the top of this file
      jarFill = createJarFill(scene, JAR_POS);

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
      jarFill?.setCount(0);
      moonPoke = 0;
      saturnPoke = 0;
      jarPoke = 0;
    },

    update(deltaTime: number): void {
      if (paused) return;

      elapsedTime += deltaTime;
      // Read the shell's normalized difficulty (manifest ramp 5 → 45 points)
      // rather than the raw score, so the escalation curve actually spans the
      // session instead of topping out at the old hard-coded score-50 branch.
      const tier = getDifficultyTier(context.difficulty.level);

      // Drive progressive scene illumination and ambient audio
      illumination?.update(collectedCount, deltaTime);
      const currentTier = illumination?.getCurrentTier() ?? 0;
      audio?.updateAmbient(currentTier, deltaTime);
      surpriseEvents?.update(deltaTime, currentTier);
      tapRipples?.update(deltaTime);
      jarFill?.update(deltaTime);

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

      // Tap hint: track the nearest active firefly as a visual guide.
      // update() is called unconditionally — it used to be gated on
      // `!firstCatchDone`, but dismiss() only raises a flag that update()
      // consumes, so gating it meant the fade never ran and the hint froze on
      // screen for the whole session. After the first catch we pass a null
      // target so it fades in place.
      if (tapHint) {
        const hintTarget = firstCatchDone ? null : (fireflies.find((fd) => fd.active && !fd.catching) ?? null);
        tapHint.update(deltaTime, hintTarget?.sprite ?? null);
      }

      // ── Living world: idle motion and tap acknowledgements ──
      updateScenery(deltaTime);

      // Golden firefly spawn timer
      if (context.score.score >= GOLDEN_UNLOCK_SCORE) {
        goldenTimer += deltaTime;
        if (goldenTimer >= GOLDEN_SPAWN_INTERVAL) {
          goldenTimer = 0;
          trySpawnGolden();
        }
      }

      ensureFireflyCount(tier.maxFireflies);

      // Maintain minimum 5 active fireflies on screen at all times
      let activeCount = 0;
      for (const fd of fireflies) {
        if (fd.active && !fd.catching) activeCount++;
      }
      if (activeCount < 5) {
        for (const fd of fireflies) {
          if (!fd.active && !fd.isGolden) {
            fd.respawnTimer = 0;
            resetFirefly(fd);
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
            fd.behaviorCenter.copy(pos);
            foregroundCount++;
            if (foregroundCount >= 2) break;
          }
        }
      }

      // Cached wing-flap frame pair, fetched once per frame for the whole flock.
      const creatureTex = getFireflyCreatureTextures();

      for (const fd of fireflies) {
        // Handle respawn timers
        if (!fd.active && !fd.catching) {
          if (fd.respawnTimer > 0) {
            fd.respawnTimer -= deltaTime;
            if (fd.respawnTimer <= 0) {
              resetFirefly(fd);
            }
          }
          continue;
        }

        // Handle catch animation
        if (fd.catching) {
          // Derived from the shared sprite constants rather than re-hardcoded,
          // so the catch animation cannot drift away from the resting size the
          // creature billboard was authored against.
          const baseScale = fd.isGolden ? GOLDEN_SPRITE_SCALE : FIREFLY_SPRITE_SCALE;

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
            // Warm flash — brighten sprite
            fd.spriteMaterial.opacity = 1.0;
            fd.bodyMaterial.opacity = 0.95;
            continue;
          }

          // Boost glow trail during arc for a comet-like effect
          fd.glowTrail.setRate(20);

          // Arc to jar animation
          fd.catchProgress += deltaTime / ARC_DURATION;
          if (fd.catchProgress >= 1.0) {
            // Sparkle burst at jar mouth on arrival
            const jarMouth = JAR_POS.clone().add(new Vector3(0, JAR_SCALED_HEIGHT, 0));
            getParticleEngine(scene).emit(PARTICLES.starCollect, jarMouth);

            fd.sprite.visible = false;
            fd.glowTrail.setRate(4); // restore normal rate
            fd.glowTrail.stop();
            fd.active = false;
            fd.catching = false;
            fd.sprite.scale.setScalar(baseScale);

            if (fd.isGolden) {
              goldenActive = false;
            }

            // Same reasoning as retireGolden(): a caught golden must stay
            // dormant until the spawn interval elapses, or the rare reward
            // reappears every half second.
            fd.respawnTimer = fd.isGolden ? 0 : RESPAWN_DELAY;
            collectedCount++;

            // Show the catch in the jar via the bounded fill indicator, and
            // bump the jar so the deposit lands with some weight.
            jarFill?.setCount(collectedCount);
            jarPoke = POKE_DURATION;

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

          // Shrink from 1.0x to 0.3x base scale during arc
          const arcScale = baseScale * (1.0 - rawT * 0.7);
          fd.sprite.scale.setScalar(arcScale);

          // Fade during arc, with a slight shimmer pulse on the sprite
          const fade = 1.0 - rawT * 0.7;
          fd.spriteMaterial.opacity = Math.min(1, 0.85 * fade + Math.abs(Math.sin(rawT * Math.PI * 4)) * 0.1);
          // The creature rides its own halo, so it has to fade with it —
          // otherwise a solid little bug is left hanging over a faded glow.
          fd.bodyMaterial.opacity = 0.95 * fade;
          continue;
        }

        // Golden lifetime. `goldenActive` is a latch, and it used to be cleared
        // only on a successful catch — so the first golden a child failed to tap
        // permanently blocked every future golden. A golden now gives up and
        // leaves, releasing the latch through retireGolden().
        let lifeFade = 1;
        if (fd.isGolden && fd.lifeTimer > 0) {
          fd.lifeTimer -= deltaTime;
          if (fd.lifeTimer <= 0) {
            retireGolden(fd);
            continue;
          }
          if (fd.lifeTimer < GOLDEN_FADE_DURATION) {
            lifeFade = fd.lifeTimer / GOLDEN_FADE_DURATION;
          }
        }

        // Behavior-driven movement (drift / circle / zigzag)
        updateFireflyBehavior(fd, deltaTime, speedMult);

        // Two-frame wing flap. Both frames are cached module-level textures, so
        // swapping the map costs nothing per firefly and is what sells the
        // sprite as a living creature rather than a decal.
        fd.flapPhase += deltaTime * FIREFLY_FLAP_HZ;
        const flapTex = fd.flapPhase % 1 < 0.5 ? creatureTex.up : creatureTex.down;
        if (fd.bodyMaterial.map !== flapTex) {
          fd.bodyMaterial.map = flapTex;
          fd.bodyMaterial.needsUpdate = true;
        }

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
        fd.spriteMaterial.opacity = (fd.isGolden ? 0.4 + 0.6 * pulseVal : 0.25 + 0.65 * pulseVal) * lifeFade;
        fd.spriteMaterial.color.copy(baseColor);
        // The creature keeps a high floor opacity so its silhouette stays
        // readable at the dim end of the halo's pulse.
        fd.bodyMaterial.opacity = (0.7 + 0.25 * pulseVal) * lifeFade;

        // Floor: nudge a sinking firefly back up rather than teleporting it.
        // BOUNDS.yMin used to be -2, i.e. two units *under* the ground plane,
        // so fireflies really did fly through the meadow. A clamp reads as the
        // firefly skimming the grass; the old teleport read as a glitch.
        const pos = fd.sprite.position;
        if (pos.y < BOUNDS.yMin) {
          pos.y = BOUNDS.yMin;
          // Circle orbits set Y absolutely from behaviorCenter, so clamping the
          // sprite alone would be undone on the very next frame.
          if (fd.behaviorCenter.y < BOUNDS.yMin + 0.4) fd.behaviorCenter.y = BOUNDS.yMin + 0.8;
          fd.zigzagDir.y = Math.abs(fd.zigzagDir.y);
        }

        // Out-of-bounds check (horizontal escape or flying off the top)
        if (pos.x < BOUNDS.xMin || pos.x > BOUNDS.xMax || pos.y > BOUNDS.yMax) {
          const newPos = randomSpawnPos();
          fd.sprite.position.copy(newPos);
          fd.behaviorCenter.copy(newPos);
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
        // Sway. This used to be `sin(...) * 0.05 * proximity`, which maxes out
        // at 0.05 rad — under three degrees, and only ever when a firefly was
        // already on top of the flower, so the meadow looked frozen. There is
        // now an always-on breeze (~7 deg) that a nearby firefly boosts to a
        // clear ~23 deg nod, which is what makes the flower feel noticed.
        const breeze = Math.sin(elapsedTime * 1.1 + fi * 0.8) * 0.12;
        const excited = Math.sin(elapsedTime * 3.5 + fi) * 0.28 * proximity;
        flower.rotation.z = breeze + excited;
      }
    },

    pause(): void {
      paused = true;
    },

    resume(): void {
      paused = false;
    },

    teardown(): void {
      // Dispose firefly sprites and particle trails
      for (const fd of fireflies) {
        // Stop the stream; the shared glow batch is freed by the shell's
        // disposal scope after teardown. See architecture-standards.md#particleengine.
        fd.glowTrail.stop();
        fd.bodyMaterial.dispose();
        fd.bodySprite.removeFromParent();
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

      tapRipples?.dispose();
      tapRipples = null;

      jarFill?.dispose();
      jarFill = null;

      starField?.removeFromParent();
      starField = null;
      starSizes = null;
      starPhases = null;

      tapHint?.dispose();
      tapHint = null;

      flowerRoots.length = 0;
      treeRoots.length = 0;
      grassRoots.length = 0;

      // Lights are freed by the shell's disposal scope; the camera is the shell's.
      lights = null;
      groundMesh = null;
      jarBody = null;
      jarCap = null;
      moonMesh = null;
      saturnGroup = null;
      saturnRing = null;
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
        // A tap that missed every firefly used to produce a single near-silent
        // tick and nothing at all on screen, which to a 3-year-old is
        // indistinguishable from a broken game. Now the world always answers:
        // first check whether something in the sky was poked, and otherwise
        // ripple at the tap point. Neither path costs anything or punishes.
        const engine = getParticleEngine(scene);

        const moonDist = moonMesh ? screenDistTo(moonMesh.position, cam, rect, event.screenX, event.screenY) : Infinity;
        const saturnDist = saturnGroup ? screenDistTo(saturnGroup.position, cam, rect, event.screenX, event.screenY) : Infinity;
        const starHit = surpriseEvents?.tryTap(cam, rect, event.screenX, event.screenY, SCENERY_HIT_RADIUS_PX) ?? null;

        if (starHit) {
          audio?.playWorldPoke();
          context.celebration.confetti(event.screenX, event.screenY, 'small');
          return;
        }
        if (moonMesh && moonDist <= SCENERY_HIT_RADIUS_PX && moonDist <= saturnDist) {
          moonPoke = POKE_DURATION;
          engine.emit(PARTICLES.sparkle, moonMesh.position.clone(), { colors: [new Color(0.95, 0.95, 0.85)], count: 12 });
          audio?.playWorldPoke();
          return;
        }
        if (saturnGroup && saturnDist <= SCENERY_HIT_RADIUS_PX) {
          saturnPoke = POKE_DURATION;
          engine.emit(PARTICLES.sparkle, saturnGroup.position.clone(), { colors: [new Color(0.98, 0.85, 0.6)], count: 12 });
          audio?.playWorldPoke();
          return;
        }

        tapRipples?.play(tapToWorld(cam, rect, event.screenX, event.screenY), FIREFLY_COLOR);
        audio?.playTapSparkle();
        return;
      }

      const catchColor = nearestFd.isGolden ? GOLDEN_COLOR : FIREFLY_COLOR;
      getParticleEngine(scene).emit(PARTICLES.sparkle, nearestFd.sprite.position.clone(), { colors: [catchColor], count: 15 });

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

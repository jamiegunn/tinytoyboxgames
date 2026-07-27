import { Scene, Color, Vector3, Mesh, PlaneGeometry, MeshBasicMaterial, SphereGeometry, DoubleSide, type Object3D, type MeshStandardMaterial } from 'three';
import { getParticleEngine } from '@app/utils/particles/registry';
import { PARTICLES } from '@app/utils/particles/presets';
import { getTerrainHeight, type SceneEnvironment } from './environment';

/**
 * Serendipitous ambient events.
 *
 * Defect 9: every one of these used to play at hard-coded world coordinates
 * within a few units of the origin — the whale shadow swept x = -8 to +8, the
 * fish parade crossed from x = -9, the bubble column burst at exactly (0, 0, 0).
 * The shark roams ±50 with a follow camera, so from about ten seconds into a
 * session onward the child was being shown these events off-screen. Every
 * surprise now anchors to the shark's position at the moment it fires.
 */

/** Half-width of the sweep a travelling surprise makes across its staging point. */
const SURPRISE_SPAN = 9;

/** Only offer the treasure sparkle when the chest is at least this close. */
const TREASURE_VISIBLE_RANGE = 18;

/**
 * A sound sink, structurally the shell's audio service.
 *
 * Declared here rather than imported so this module keeps compiling in the
 * headless probe harness, which drives the real file without a shell.
 */
export interface SurpriseAudio {
  playSound(id: string): void;
}

/**
 * The sound each surprise announces itself with.
 *
 * F3, measured: this file contained ZERO `playSound` calls while every single
 * player-initiated interaction had one. So the five events that exist purely to
 * make the reef feel inhabited were the only silent things in the game, and a
 * child looking the other way when one fired had no cue to turn around. The IDs
 * are the existing little-shark bank -- no new synths, so no new failure mode.
 */
const SURPRISE_SOUND: Record<SurpriseType, string> = {
  bubbleColumn: 'water-bloop',
  colorShift: 'seaweed-rustle',
  whaleShadow: 'shark-barrel-roll',
  treasureSparkle: 'treasure-jingle',
  fishParade: 'crab-skitter',
};

/**
 * Pulls the next surprise forward so it lands inside a window the caller cares
 * about.
 *
 * This exists because of a regression the frenzy measurement caught rather than
 * a feature request. With the reef gathering during a frenzy, `monotonousFrac`
 * at the pessimistic arm rose from 0.074 to 0.133: the payoff was flooding the
 * trailing window with a great deal of ONE kind of event, and the perplexity
 * statistic correctly punished that. A frenzy should bring more KINDS of
 * things, not just more of the same, and the five surprises are the kinds the
 * game already has and was firing at an 8.3% duty cycle.
 *
 * It only ever moves the clock earlier, and never while a surprise is already
 * running, so it cannot be used to spam them.
 *
 * @param state - Surprise state to nudge.
 * @param within - Upper bound in seconds on the new wait.
 */
export function nudgeSurpriseSoon(state: SurpriseState, within = 2.5): void {
  if (state.activeSurprise) return;
  if (state.nextSurpriseTime <= within) return;
  state.nextSurpriseTime = Math.random() * within;
}

/**
 * Finds the first MeshStandardMaterial with an emissive property on an Object3D or its children.
 * @param obj - The Object3D to search.
 * @returns The first MeshStandardMaterial with emissive, or null.
 */
function findEmissiveMaterial(obj: Object3D): MeshStandardMaterial | null {
  if (obj instanceof Mesh && obj.material && 'emissive' in obj.material) {
    return obj.material as MeshStandardMaterial;
  }
  for (const child of obj.children) {
    const mat = findEmissiveMaterial(child);
    if (mat) return mat;
  }
  return null;
}

/** All available surprise types. */
type SurpriseType = 'bubbleColumn' | 'colorShift' | 'whaleShadow' | 'treasureSparkle' | 'fishParade';

/** All surprise type values for random selection. */
const ALL_SURPRISE_TYPES: SurpriseType[] = ['bubbleColumn', 'colorShift', 'whaleShadow', 'treasureSparkle', 'fishParade'];

/** Mutable state for the surprise system. */
export interface SurpriseState {
  /** Seconds until next surprise. */
  nextSurpriseTime: number;
  /** Currently active surprise type, or null. */
  activeSurprise: SurpriseType | null;
  /** Timer for active surprise animation. */
  surpriseTimer: number;
  /** Saved original coral emissive colors for color shift surprise. */
  originalEmissives: Color[];
  /** Whale shadow mesh reference for cleanup. */
  whaleShadowMesh: Mesh | null;
  /** Fish parade mesh references for cleanup. */
  paradeFish: Mesh[];
  /** Elapsed time when the surprise started (for animation). */
  surpriseStartTime: number;
  /** Scheduled sparkle burst times remaining for treasureSparkle. */
  sparkleBurstTimes: number[];
  /** World X the active surprise is staged around — the shark when it fired. */
  originX: number;
  /** World Z the active surprise is staged around — the shark when it fired. */
  originZ: number;
}

/**
 * Creates initial surprise state.
 *
 * @returns Fresh SurpriseState.
 */
export function createSurpriseState(): SurpriseState {
  return {
    nextSurpriseTime: 25 + Math.random() * 15,
    activeSurprise: null,
    surpriseTimer: 0,
    originalEmissives: [],
    whaleShadowMesh: null,
    paradeFish: [],
    surpriseStartTime: 0,
    sparkleBurstTimes: [],
    originX: 0,
    originZ: 0,
  };
}

/**
 * Cleans up whale shadow mesh from the scene.
 *
 * @param state - Surprise state.
 * @param scene - The Three.js scene.
 */
function cleanupWhaleShadow(state: SurpriseState, scene: Scene): void {
  if (state.whaleShadowMesh) {
    scene.remove(state.whaleShadowMesh);
    state.whaleShadowMesh.geometry.dispose();
    if (Array.isArray(state.whaleShadowMesh.material)) {
      state.whaleShadowMesh.material.forEach((m) => m.dispose());
    } else {
      state.whaleShadowMesh.material.dispose();
    }
    state.whaleShadowMesh = null;
  }
}

/**
 * Cleans up fish parade meshes from the scene.
 *
 * @param state - Surprise state.
 * @param scene - The Three.js scene.
 */
function cleanupParadeFish(state: SurpriseState, scene: Scene): void {
  for (const fish of state.paradeFish) {
    scene.remove(fish);
    fish.geometry.dispose();
    if (Array.isArray(fish.material)) {
      fish.material.forEach((m) => m.dispose());
    } else {
      fish.material.dispose();
    }
  }
  state.paradeFish = [];
}

// Height for the whale shadow at (x, z) — hovers just clear of the seabed so it
// does not z-fight or sink into the terrain relief added by defect 11
function shadowY(x: number, z: number): number {
  return getTerrainHeight(x, z) + 0.18;
}

/**
 * Starts the whale shadow surprise: a large dark ellipse sliding across the floor.
 *
 * @param state - Surprise state.
 * @param scene - The Three.js scene.
 * @param elapsedTime - Current elapsed game time.
 */
function startWhaleShadow(state: SurpriseState, scene: Scene, elapsedTime: number): void {
  const geometry = new PlaneGeometry(3.0, 1.5);
  const material = new MeshBasicMaterial({
    color: new Color(0.05, 0.05, 0.1),
    transparent: true,
    opacity: 0.3,
    side: DoubleSide,
    depthWrite: false,
  });
  const shadow = new Mesh(geometry, material);
  shadow.rotation.x = -Math.PI / 2;
  const startX = state.originX - SURPRISE_SPAN;
  shadow.position.set(startX, shadowY(startX, state.originZ), state.originZ);
  shadow.raycast = () => {}; // Decorative — must not intercept taps
  scene.add(shadow);
  state.whaleShadowMesh = shadow;
  state.activeSurprise = 'whaleShadow';
  state.surpriseTimer = 4.0;
  state.surpriseStartTime = elapsedTime;
}

/**
 * Starts the treasure sparkle surprise: golden sparkles burst from the treasure chest.
 *
 * @param state - Surprise state.
 * @param scene - The Three.js scene.
 * @param env - Scene environment containing the treasure chest.
 */
function startTreasureSparkle(state: SurpriseState, scene: Scene, env: SceneEnvironment): void {
  const chestPos = env.treasureChest.position.clone();
  // First burst immediately
  getParticleEngine(scene).emit(PARTICLES.sparkle, chestPos, { colors: [new Color(1.0, 0.85, 0.2)], count: 15 });
  state.activeSurprise = 'treasureSparkle';
  state.surpriseTimer = 2.0;
  // Schedule remaining bursts at 0.7s and 1.4s from now
  state.sparkleBurstTimes = [0.7, 1.4];
}

/**
 * Starts the fish parade surprise: 8 tiny decorative fish swim across the scene.
 *
 * @param state - Surprise state.
 * @param scene - The Three.js scene.
 * @param elapsedTime - Current elapsed game time.
 */
function startFishParade(state: SurpriseState, scene: Scene, elapsedTime: number): void {
  const fishColors = [
    new Color(1.0, 0.5, 0.15),
    new Color(0.3, 0.5, 1.0),
    new Color(0.2, 0.8, 0.3),
    new Color(1.0, 0.9, 0.2),
    new Color(1.0, 0.5, 0.7),
    new Color(0.5, 0.8, 1.0),
    new Color(0.8, 0.4, 0.9),
    new Color(0.9, 0.6, 0.2),
  ];

  const geometry = new SphereGeometry(0.12, 8, 6);

  for (let i = 0; i < 8; i++) {
    const material = new MeshBasicMaterial({
      color: fishColors[i % fishColors.length],
      transparent: true,
      opacity: 0.85,
    });
    const fish = new Mesh(geometry.clone(), material);
    // Start off-screen to the shark's left, spread vertically around its plane
    const yOffset = -1 + (i / 7) * 2;
    fish.position.set(state.originX - SURPRISE_SPAN, yOffset, state.originZ - 2 + i * 0.3);
    fish.scale.set(1.0, 0.6, 0.5);
    fish.raycast = () => {}; // Decorative — must not be mistaken for a catchable fish
    scene.add(fish);
    state.paradeFish.push(fish);
  }

  state.activeSurprise = 'fishParade';
  state.surpriseTimer = 5.0;
  state.surpriseStartTime = elapsedTime;
}

/**
 * Updates the surprise system, triggering serendipitous moments.
 *
 * @param state - Surprise state.
 * @param elapsedTime - Total elapsed game time.
 * @param dt - Frame delta time.
 * @param env - Scene environment.
 * @param scene - The Three.js scene.
 * @param sharkX - Current shark world X — surprises are staged around this.
 * @param sharkZ - Current shark world Z — surprises are staged around this.
 * @param audio - Optional sound sink. Omitted by the headless probe harness.
 */
export function updateSurprises(
  state: SurpriseState,
  elapsedTime: number,
  dt: number,
  env: SceneEnvironment,
  scene: Scene,
  sharkX = 0,
  sharkZ = 0,
  audio?: SurpriseAudio,
): void {
  // Handle active surprise
  if (state.activeSurprise) {
    state.surpriseTimer -= dt;

    if (state.activeSurprise === 'colorShift') {
      // Cycle coral colors through a rainbow
      const hueShift = (elapsedTime * 2) % 1;
      for (let i = 0; i < env.corals.length; i++) {
        const mat = findEmissiveMaterial(env.corals[i]);
        if (mat) {
          const h = (hueShift + i * 0.1) % 1;
          mat.emissive = new Color().setHSL(h, 0.6, 0.3);
        }
      }
    }

    if (state.activeSurprise === 'whaleShadow' && state.whaleShadowMesh) {
      // Sweep across the staging origin over 4 seconds
      const progress = 1 - state.surpriseTimer / 4.0;
      const x = state.originX - SURPRISE_SPAN + progress * SURPRISE_SPAN * 2;
      state.whaleShadowMesh.position.x = x;
      state.whaleShadowMesh.position.y = shadowY(x, state.originZ);
    }

    if (state.activeSurprise === 'treasureSparkle') {
      // Fire scheduled sparkle bursts
      const elapsed = 2.0 - state.surpriseTimer;
      const remaining: number[] = [];
      for (const burstTime of state.sparkleBurstTimes) {
        if (elapsed >= burstTime) {
          const chestPos = env.treasureChest.position.clone();
          getParticleEngine(scene).emit(PARTICLES.sparkle, chestPos, { colors: [new Color(1.0, 0.85, 0.2)], count: 15 });
        } else {
          remaining.push(burstTime);
        }
      }
      state.sparkleBurstTimes = remaining;
    }

    if (state.activeSurprise === 'fishParade') {
      // Move fish from left to right with sine undulation over 5 seconds
      const progress = 1 - state.surpriseTimer / 5.0;
      const localTime = elapsedTime - state.surpriseStartTime;
      for (let i = 0; i < state.paradeFish.length; i++) {
        const fish = state.paradeFish[i];
        const xBase = state.originX - SURPRISE_SPAN + progress * SURPRISE_SPAN * 2;
        // Stagger each fish slightly
        const stagger = i * 0.6;
        fish.position.x = xBase + stagger;
        // Sine wave undulation unique per fish
        fish.position.y += Math.sin(localTime * 3 + i * 0.8) * 0.005;
      }
    }

    if (state.surpriseTimer <= 0) {
      // Restore coral colors
      if (state.activeSurprise === 'colorShift') {
        for (let i = 0; i < env.corals.length && i < state.originalEmissives.length; i++) {
          const mat = findEmissiveMaterial(env.corals[i]);
          if (mat) {
            mat.emissive = state.originalEmissives[i];
          }
        }
        state.originalEmissives = [];
      }

      // Clean up whale shadow
      if (state.activeSurprise === 'whaleShadow') {
        cleanupWhaleShadow(state, scene);
      }

      // Clean up fish parade
      if (state.activeSurprise === 'fishParade') {
        cleanupParadeFish(state, scene);
      }

      state.activeSurprise = null;
      state.nextSurpriseTime = 30 + Math.random() * 15;
    }
    return;
  }

  // Count down to next surprise
  state.nextSurpriseTime -= dt;
  if (state.nextSurpriseTime > 0) return;

  // Stage everything that follows around wherever the shark is right now
  state.originX = sharkX;
  state.originZ = sharkZ;

  // The treasure chest is a fixed landmark, so its sparkle is the one surprise
  // that cannot be moved. Offer it only when the child is close enough to see
  // the chest; otherwise it would be a firework behind a hill.
  const chestDx = env.treasureChest.position.x - sharkX;
  const chestDz = env.treasureChest.position.z - sharkZ;
  const chestVisible = chestDx * chestDx + chestDz * chestDz < TREASURE_VISIBLE_RANGE * TREASURE_VISIBLE_RANGE;
  const available = chestVisible ? ALL_SURPRISE_TYPES : ALL_SURPRISE_TYPES.filter((t) => t !== 'treasureSparkle');

  const kind = available[Math.floor(Math.random() * available.length)];
  audio?.playSound(SURPRISE_SOUND[kind]);

  if (kind === 'bubbleColumn') {
    // Burst of bubbles just off the shark's shoulder, not at the world origin
    const angle = Math.random() * Math.PI * 2;
    const burstPos = new Vector3(sharkX + Math.cos(angle) * 3, -0.1, sharkZ + Math.sin(angle) * 3);
    getParticleEngine(scene).emit(PARTICLES.bubblePop, burstPos, { colors: [new Color(0.5, 0.8, 1.0)], count: 25 });
    state.activeSurprise = 'bubbleColumn';
    state.surpriseTimer = 3.0;
  } else if (kind === 'colorShift') {
    // Save original emissives
    state.originalEmissives = env.corals.map((coral) => {
      const mat = findEmissiveMaterial(coral);
      if (mat) return mat.emissive.clone();
      return new Color(0, 0, 0);
    });
    state.activeSurprise = 'colorShift';
    state.surpriseTimer = 3.0;
  } else if (kind === 'whaleShadow') {
    startWhaleShadow(state, scene, elapsedTime);
  } else if (kind === 'treasureSparkle') {
    startTreasureSparkle(state, scene, env);
  } else {
    startFishParade(state, scene, elapsedTime);
  }
}

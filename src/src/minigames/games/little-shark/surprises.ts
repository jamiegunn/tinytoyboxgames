import { Scene, Color, Vector3, Mesh, PlaneGeometry, MeshBasicMaterial, SphereGeometry, DoubleSide, type Object3D, type MeshStandardMaterial } from 'three';
import { createBubblePopEffect, createSparkleBurst } from '@app/minigames/shared/particleFx';
import type { SceneEnvironment } from './environment';

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
  shadow.position.set(-8, -0.4, 0);
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
  createSparkleBurst(scene, chestPos, new Color(1.0, 0.85, 0.2), 15);
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
    // Start off-screen left, spread vertically
    const yOffset = -1 + (i / 7) * 2;
    fish.position.set(-9, yOffset, -2 + i * 0.3);
    fish.scale.set(1.0, 0.6, 0.5);
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
 */
export function updateSurprises(state: SurpriseState, elapsedTime: number, dt: number, env: SceneEnvironment, scene: Scene): void {
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
      // Move shadow from left to right over 4 seconds
      const progress = 1 - state.surpriseTimer / 4.0;
      state.whaleShadowMesh.position.x = -8 + progress * 16;
    }

    if (state.activeSurprise === 'treasureSparkle') {
      // Fire scheduled sparkle bursts
      const elapsed = 2.0 - state.surpriseTimer;
      const remaining: number[] = [];
      for (const burstTime of state.sparkleBurstTimes) {
        if (elapsed >= burstTime) {
          const chestPos = env.treasureChest.position.clone();
          createSparkleBurst(scene, chestPos, new Color(1.0, 0.85, 0.2), 15);
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
        const xBase = -9 + progress * 18;
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

  // Trigger a random surprise from all 5 types
  const kind = ALL_SURPRISE_TYPES[Math.floor(Math.random() * ALL_SURPRISE_TYPES.length)];

  if (kind === 'bubbleColumn') {
    // Burst of bubbles from center
    createBubblePopEffect(scene, new Vector3(0, 0, 0), new Color(0.5, 0.8, 1.0), 25);
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
